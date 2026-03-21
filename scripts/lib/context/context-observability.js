'use strict';

const fs = require('fs');
const path = require('path');

const { createProjectCacheStore, createTaskRecordId } = require('./project-cache-store');

const CONTEXT_OBSERVABILITY_SCHEMA_VERSION = 'ecc.context-observability.v1';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function toNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function resolveWorkingSet(input = {}) {
  return input.workingSet || input.preparedContext && input.preparedContext.workingSet || {};
}

function resolveRepoRoot(input = {}, store = null) {
  return path.resolve(
    input.repoRoot
      || input.preparedContext && input.preparedContext.repo && input.preparedContext.repo.root
      || input.workingSet && input.workingSet.repo && input.workingSet.repo.root
      || store && store.repoRoot
      || process.cwd()
  );
}

function resolveRelatedArtifacts(preparedContext = {}) {
  const artifacts = preparedContext.artifacts || {};
  return unique([
    ...(artifacts.previousTaskContexts || []),
    ...(artifacts.previousTaskArtifacts || []),
    ...(artifacts.previousSessionArtifacts || [])
  ]);
}

function resolveContextMode(input = {}) {
  if (typeof input.contextMode === 'string' && input.contextMode.length > 0) {
    return input.contextMode;
  }

  if (input.preparedContext && input.preparedContext.workingSet) {
    return 'prepared-context';
  }

  if (input.workingSet) {
    return 'working-set-only';
  }

  return 'legacy';
}

function buildObservationPayload(input = {}, store) {
  const preparedContext = input.preparedContext || null;
  const workingSet = resolveWorkingSet(input);
  const observationId = input.observationId
    || createTaskRecordId('context-observation', `${store.repoSlug}:${input.commandName || 'runtime'}:${input.phase || 'runtime'}`);
  const basedOnCommit = input.basedOnCommit
    || preparedContext && preparedContext.basedOnCommit
    || workingSet.basedOnCommit
    || preparedContext && preparedContext.cache && preparedContext.cache.basedOnCommit
    || 'unknown';
  const taskContextId = input.taskContextId
    || preparedContext && preparedContext.taskContextId
    || preparedContext && preparedContext.provenance && preparedContext.provenance.taskContextId
    || workingSet.taskContextId
    || workingSet.provenance && workingSet.provenance.taskContextId
    || null;
  const workingSetId = input.workingSetId
    || workingSet.workingSetId
    || workingSet.id
    || preparedContext && preparedContext.workingSetId
    || preparedContext && preparedContext.provenance && preparedContext.provenance.workingSetId
    || null;
  const budget = workingSet.budget || preparedContext && preparedContext.allowedExpansion || {};
  const recommendedDocs = unique(
    input.recommendedDocs
      || preparedContext && preparedContext.recommendedDocs
      || workingSet.docs
      || []
  );
  const relatedArtifacts = unique(input.relatedArtifacts || resolveRelatedArtifacts(preparedContext || {}));

  return {
    schemaVersion: CONTEXT_OBSERVABILITY_SCHEMA_VERSION,
    kind: 'context-observability',
    observationId,
    commandName: input.commandName || null,
    phase: input.phase || 'runtime',
    source: input.source || null,
    contextMode: resolveContextMode(input),
    preparedContextUsed: Boolean(preparedContext && preparedContext.workingSet),
    workingSetUsed: Boolean(workingSet && Array.isArray(workingSet.files)),
    expansionRequested: Boolean(input.expansionRequested),
    expansionApproved: input.expansionApproved === undefined ? null : Boolean(input.expansionApproved),
    broadSearchTriggered: Boolean(input.broadSearchTriggered),
    repeatedRediscovery: Boolean(input.repeatedRediscovery),
    backwardCompatibilityFallback: Boolean(input.backwardCompatibilityFallback),
    fallbackReason: input.fallbackReason || null,
    notes: input.notes || null,
    planFile: input.planFile || null,
    sessionName: input.sessionName || null,
    workerName: input.workerName || null,
    repoSlug: input.repoSlug || store.repoSlug,
    basedOnCommit,
    taskContextId,
    workingSetId,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || input.createdAt || new Date().toISOString(),
    retrieval: {
      workingSetFileCount: Array.isArray(workingSet.files) ? workingSet.files.length : 0,
      recommendedDocsCount: recommendedDocs.length,
      relatedArtifactsCount: relatedArtifacts.length,
      expansionBudgetRemaining: toNumber(budget.expansionsRemaining, 0),
      broadSearchBudgetRemaining: toNumber(budget.broadSearchesRemaining, 0),
      totalFilesMax: toNumber(budget.totalFilesMax || budget.maxFiles, 0)
    },
    recommendedDocs,
    relatedArtifacts
  };
}

function recordContextObservation(input = {}, options = {}) {
  const repoRoot = resolveRepoRoot(input);
  const store = options.store || createProjectCacheStore(repoRoot, options);
  const payload = buildObservationPayload({
    ...input,
    repoRoot
  }, store);

  if (options.persist !== false) {
    store.writeTaskArtifact(payload, payload.observationId);
  }

  return payload;
}

function readArtifactRecords(store, limit = 1000) {
  store.ensureLayout();

  return fs.readdirSync(store.taskArtifactsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => path.join(store.taskArtifactsDir, entry.name))
    .map(filePath => {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(-limit);
}

function aggregateByKey(records, selector) {
  const counts = new Map();

  for (const record of records) {
    const key = selector(record);
    if (!key) {
      continue;
    }

    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function resolveRepoFilesCount(store) {
  const fingerprints = store.readJson('fingerprints.json', { files: [] });
  return Array.isArray(fingerprints && fingerprints.files) ? fingerprints.files.length : 0;
}

function estimateObservationCost(record, repoFilesCount) {
  const retrieval = record.retrieval || {};
  const workingSetFileCount = toNumber(retrieval.workingSetFileCount, 0);
  const recommendedDocsCount = toNumber(retrieval.recommendedDocsCount, 0);
  const expansionUsed = record.expansionRequested === true && record.expansionApproved === true ? Math.max(1, Math.ceil(workingSetFileCount * 0.25)) : 0;
  const broadSearchUsed = record.broadSearchTriggered === true ? Math.max(8, workingSetFileCount * 2) : 0;
  const retrievalUsed = workingSetFileCount + recommendedDocsCount + expansionUsed + broadSearchUsed;
  const retrievalAvoided = Math.max(0, repoFilesCount - (workingSetFileCount + expansionUsed));

  return {
    avoidedFilesEstimate: retrievalAvoided,
    usedFilesEstimate: retrievalUsed
  };
}

function estimateExpansionCost(record, repoFilesCount) {
  const result = record.result || {};
  const addedFiles = Array.isArray(result.addedFiles) ? result.addedFiles.length : 0;
  const addedDocs = Array.isArray(result.addedDocs) ? result.addedDocs.length : 0;
  const broadPenalty = record.request && (record.request.mode === 'broad' || record.request.kind === 'broad-search') ? Math.max(8, addedFiles * 2) : 0;

  return {
    avoidedFilesEstimate: Math.max(0, repoFilesCount - addedFiles),
    usedFilesEstimate: addedFiles + addedDocs + broadPenalty
  };
}

function summarizeContextObservability(repoRoot, options = {}) {
  const store = options.store || createProjectCacheStore(repoRoot, options);
  const records = readArtifactRecords(store, options.limit || 1000);
  const observations = records.filter(record => record.kind === 'context-observability');
  const expansionLogs = records.filter(record => record.kind === 'expansion-log');
  const repoFilesCount = resolveRepoFilesCount(store);
  const observationCosts = observations.map(record => estimateObservationCost(record, repoFilesCount));
  const expansionCosts = expansionLogs.map(record => estimateExpansionCost(record, repoFilesCount));
  const combinedCosts = [...observationCosts, ...expansionCosts];

  return {
    schemaVersion: CONTEXT_OBSERVABILITY_SCHEMA_VERSION,
    repoRoot: store.repoRoot,
    repoSlug: store.repoSlug,
    generatedAt: new Date().toISOString(),
    repoFilesCount,
    totals: {
      observations: observations.length,
      tasksEnteredWithPreparedContext: observations.filter(record => record.phase === 'entry' && record.preparedContextUsed === true).length,
      workingSetUsedWithoutExpansion: observations.filter(record => record.workingSetUsed === true && record.expansionRequested !== true).length,
      expansionRequests: expansionLogs.length,
      expansionsApproved: expansionLogs.filter(record => record.approved === true).length,
      expansionsRejected: expansionLogs.filter(record => record.approved === false).length,
      broadSearches: observations.filter(record => record.broadSearchTriggered === true).length
        + expansionLogs.filter(record => record.request && (record.request.mode === 'broad' || record.request.kind === 'broad-search')).length,
      repeatedRediscoveryEvents: observations.filter(record => record.repeatedRediscovery === true).length,
      backwardCompatibilityFallbacks: observations.filter(record => record.backwardCompatibilityFallback === true).length,
      retrievalAvoidedEstimate: combinedCosts.reduce((sum, cost) => sum + cost.avoidedFilesEstimate, 0),
      retrievalUsedEstimate: combinedCosts.reduce((sum, cost) => sum + cost.usedFilesEstimate, 0)
    },
    byCommand: aggregateByKey(observations, record => record.commandName || 'unknown'),
    byContextMode: aggregateByKey(observations, record => record.contextMode || 'unknown'),
    broadSearchSources: aggregateByKey(
      observations.filter(record => record.broadSearchTriggered === true),
      record => `${record.commandName || 'unknown'}:${record.phase || 'runtime'}`
    ),
    rediscoveryHotspots: aggregateByKey(
      observations.filter(record => record.repeatedRediscovery === true || record.backwardCompatibilityFallback === true),
      record => `${record.commandName || 'unknown'}:${record.fallbackReason || 'legacy-flow'}`
    ).slice(0, 10),
    latestObservations: observations.slice(-10),
    latestExpansionLogs: expansionLogs.slice(-10)
  };
}

module.exports = {
  CONTEXT_OBSERVABILITY_SCHEMA_VERSION,
  buildObservationPayload,
  estimateExpansionCost,
  estimateObservationCost,
  recordContextObservation,
  summarizeContextObservability
};
