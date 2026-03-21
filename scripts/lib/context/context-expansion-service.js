'use strict';

const { createProjectCacheStore, createTaskRecordId } = require('./project-cache-store');
const { normalizeContextPackage } = require('./context-package-schema');
const { evaluateExpansionRequest } = require('./expansion-policy');
const { expandWorkingSet } = require('./working-set-manager');

const EXPANSION_SERVICE_SCHEMA_VERSION = 'ecc.context-expansion.v2';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function collectExpansionCandidates(request = {}, indexPayload = {}) {
  const files = [];
  const docs = [];
  const reasons = [];
  const knownFiles = new Set(
    Array.isArray(indexPayload.fingerprints && indexPayload.fingerprints.files)
      ? indexPayload.fingerprints.files.map(file => file.path)
      : []
  );

  if (Array.isArray(request.paths)) {
    request.paths.forEach(filePath => {
      if (knownFiles.has(filePath)) {
        files.push(filePath);
        reasons.push({ path: filePath, reason: 'explicit_path_request' });
      }
    });
  }

  const domains = Array.isArray(request.domains) ? request.domains : [];
  if (domains.includes('api') && indexPayload.routes) {
    indexPayload.routes.routes.forEach(route => {
      files.push(route.path);
      reasons.push({ path: route.path, reason: 'domain:api' });
    });
  }

  if (domains.includes('backend') && indexPayload.modules) {
    const backendArea = indexPayload.modules.areas.find(area => area.area === 'backend');
    if (backendArea) {
      backendArea.files.forEach(filePath => {
        files.push(filePath);
        reasons.push({ path: filePath, reason: 'domain:backend' });
      });
    }
  }

  if (domains.includes('frontend') && indexPayload.modules) {
    const frontendArea = indexPayload.modules.areas.find(area => area.area === 'frontend');
    if (frontendArea) {
      frontendArea.files.forEach(filePath => {
        files.push(filePath);
        reasons.push({ path: filePath, reason: 'domain:frontend' });
      });
    }
  }

  if (domains.includes('data') && indexPayload.dbMap) {
    [...indexPayload.dbMap.prismaFiles, ...indexPayload.dbMap.modelFiles].forEach(filePath => {
      files.push(filePath);
      reasons.push({ path: filePath, reason: 'domain:data' });
    });
  }

  if (Array.isArray(request.docs)) {
    docs.push(...request.docs);
  }

  return {
    files: unique(files),
    docs: unique(docs),
    reasons: reasons.filter(reason => unique(files).includes(reason.path))
  };
}

function expandPreparedContext(preparedContext, request = {}, options = {}) {
  const indexPayload = options.indexPayload || null;
  if (!preparedContext || !preparedContext.workingSet || !indexPayload) {
    throw new Error('expandPreparedContext requires preparedContext with workingSet and an indexPayload');
  }

  const taskContextId = preparedContext.taskContextId || preparedContext.provenance && preparedContext.provenance.taskContextId || preparedContext.workingSet.taskContextId || null;
  const basedOnCommit = preparedContext.basedOnCommit || preparedContext.cache && preparedContext.cache.basedOnCommit || preparedContext.provenance && preparedContext.provenance.basedOnCommit || preparedContext.workingSet.basedOnCommit || 'unknown';
  const candidates = collectExpansionCandidates(request, indexPayload);
  const evaluation = evaluateExpansionRequest({
    workingSet: preparedContext.workingSet,
    budget: preparedContext.workingSet.budget,
    allowedExpansion: preparedContext.workingSet.allowedExpansion,
    request,
    candidateFiles: candidates.files,
    candidateDocs: candidates.docs,
    candidateReasons: candidates.reasons
  });

  const store = options.store || createProjectCacheStore(preparedContext.repo.root, options);
  const expansionLogId = createTaskRecordId('expansion-log', `${preparedContext.repo.slug}:${preparedContext.workingSet.workingSetId || preparedContext.workingSet.id}:${request.mode || 'narrow'}`);

  if (!evaluation.approved) {
    if (options.persist !== false) {
      store.writeTaskArtifact({
        schemaVersion: EXPANSION_SERVICE_SCHEMA_VERSION,
        kind: 'expansion-log',
        expansionLogId,
        createdAt: new Date().toISOString(),
        approved: false,
        deniedReason: evaluation.deniedReason,
        request,
        decision: evaluation,
        taskContextId,
        workingSetId: preparedContext.workingSet.workingSetId || preparedContext.workingSet.id,
        basedOnCommit,
        repo: preparedContext.repo
      }, expansionLogId);
    }

    return {
      schemaVersion: EXPANSION_SERVICE_SCHEMA_VERSION,
      approved: false,
      deniedReason: evaluation.deniedReason,
      decision: evaluation,
      expansionLogId,
      preparedContext
    };
  }

  const nextWorkingSet = expandWorkingSet(preparedContext.workingSet, {
    files: evaluation.additions.files,
    docs: evaluation.additions.docs,
    relatedArtifacts: [expansionLogId],
    reasons: evaluation.additions.reasons,
    budget: evaluation.nextBudget,
    taskContextId,
    basedOnCommit
  }, {
    repoRoot: preparedContext.repo.root,
    expectedDomains: preparedContext.expectedDomains
  });
  const nextPreparedContext = normalizeContextPackage({
    ...preparedContext,
    taskContextId,
    workingSetId: nextWorkingSet.workingSetId || nextWorkingSet.id,
    basedOnCommit,
    workingSet: nextWorkingSet,
    allowedExpansion: nextWorkingSet.budget,
    updatedAt: nextWorkingSet.updatedAt,
    confidence: Math.min(0.98, Number((preparedContext.confidence + 0.03).toFixed(2))),
    needsDiscovery: false,
    provenance: {
      ...(preparedContext.provenance || {}),
      taskContextId,
      workingSetId: nextWorkingSet.workingSetId || nextWorkingSet.id,
      repoSlug: preparedContext.repo && preparedContext.repo.slug || nextWorkingSet.repoSlug || null,
      basedOnCommit,
      createdAt: preparedContext.createdAt,
      updatedAt: nextWorkingSet.updatedAt
    },
    artifacts: {
      ...preparedContext.artifacts,
      previousTaskArtifacts: unique([
        ...(preparedContext.artifacts && preparedContext.artifacts.previousTaskArtifacts ? preparedContext.artifacts.previousTaskArtifacts : []),
        expansionLogId,
        ...(nextWorkingSet.relatedArtifacts || [])
      ])
    }
  });

  if (options.persist !== false) {
    store.writeTaskArtifact({
      schemaVersion: EXPANSION_SERVICE_SCHEMA_VERSION,
      kind: 'expansion-log',
      expansionLogId,
      createdAt: new Date().toISOString(),
      approved: true,
      decision: evaluation,
      request,
      additions: evaluation.additions,
      taskContextId,
      result: {
        workingSetId: nextWorkingSet.workingSetId || nextWorkingSet.id,
        addedFiles: evaluation.additions.files,
        addedDocs: evaluation.additions.docs,
        budgetDelta: evaluation.budgetDelta,
        updatedBudget: nextWorkingSet.budget
      },
      workingSetId: nextWorkingSet.workingSetId || nextWorkingSet.id,
      basedOnCommit,
      repo: nextWorkingSet.repo
    }, expansionLogId);
  }

  return {
    schemaVersion: EXPANSION_SERVICE_SCHEMA_VERSION,
    approved: true,
    deniedReason: null,
    decision: evaluation,
    expansionLogId,
    result: {
      workingSetId: nextWorkingSet.workingSetId || nextWorkingSet.id,
      addedFiles: evaluation.additions.files,
      addedDocs: evaluation.additions.docs,
      budgetDelta: evaluation.budgetDelta,
      updatedBudget: nextWorkingSet.budget
    },
    preparedContext: nextPreparedContext
  };
}

module.exports = {
  EXPANSION_SERVICE_SCHEMA_VERSION,
  collectExpansionCandidates,
  expandPreparedContext
};
