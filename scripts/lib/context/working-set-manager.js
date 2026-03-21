'use strict';

const { createProjectCacheStore, createTaskRecordId } = require('./project-cache-store');
const { createBudgetState } = require('./working-set-budget');
const { toSeedPaths } = require('./working-set-transport');

const WORKING_SET_SCHEMA_VERSION = 'ecc.working-set.v2';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function normalizeReasons(reasons = [], files = []) {
  const normalized = Array.isArray(reasons)
    ? reasons
        .filter(reason => reason && typeof reason.path === 'string' && reason.path.length > 0)
        .map(reason => ({
          path: reason.path,
          reason: typeof reason.reason === 'string' && reason.reason.length > 0 ? reason.reason : 'explicitly_selected'
        }))
    : [];

  const known = new Set(normalized.map(reason => reason.path));
  for (const filePath of files) {
    if (!known.has(filePath)) {
      normalized.push({ path: filePath, reason: 'explicitly_selected' });
    }
  }

  return normalized;
}

function resolveStore(input = {}, options = {}) {
  if (options.store) {
    return options.store;
  }

  if (input.preparedContext && input.preparedContext.repo && input.preparedContext.repo.root) {
    return createProjectCacheStore(input.preparedContext.repo.root, options);
  }

  return createProjectCacheStore(input.repoRoot, options);
}

function createWorkingSet(input = {}, options = {}) {
  const preparedContext = input.preparedContext || null;
  const store = resolveStore(input, options);
  const intent = input.intent || preparedContext || {};
  const intentType = input.intentType || intent.intentType || 'unknown';
  const scopeHypothesis = input.scopeHypothesis || (preparedContext && preparedContext.scopeHypothesis) || 'unknown';
  const filesInput = unique(input.files || (preparedContext && preparedContext.workingSet && preparedContext.workingSet.files) || []);
  const docsInput = unique(input.docs || (preparedContext && preparedContext.recommendedDocs) || (preparedContext && preparedContext.workingSet && preparedContext.workingSet.docs) || []);
  const artifactsInput = unique(
    input.artifacts
    || input.relatedArtifacts
    || (preparedContext && preparedContext.workingSet && preparedContext.workingSet.artifacts)
    || (preparedContext && preparedContext.workingSet && preparedContext.workingSet.relatedArtifacts)
    || []
  );
  const taskMetadata = input.taskMetadata || {};
  const taskContextId = input.taskContextId
    || taskMetadata.taskContextId
    || (preparedContext && preparedContext.taskContextId)
    || (preparedContext && preparedContext.provenance && preparedContext.provenance.taskContextId)
    || null;
  const basedOnCommit = input.basedOnCommit
    || (preparedContext && preparedContext.basedOnCommit)
    || (preparedContext && preparedContext.cache && preparedContext.cache.basedOnCommit)
    || (preparedContext && preparedContext.provenance && preparedContext.provenance.basedOnCommit)
    || 'unknown';
  const createdAt = input.createdAt || (preparedContext && preparedContext.createdAt) || new Date().toISOString();
  const updatedAt = input.updatedAt || createdAt;
  const budgetInput = input.budget || (preparedContext && preparedContext.workingSet && preparedContext.workingSet.budget) || (preparedContext && preparedContext.allowedExpansion) || {};
  const provisionalBudget = createBudgetState({
    ...budgetInput,
    intentType,
    currentFilesCount: filesInput.length
  }, intent);
  const files = filesInput.slice(0, provisionalBudget.initialFilesMax);
  const docs = docsInput;
  const reasons = normalizeReasons(input.reasons || [], files);
  const budget = createBudgetState({
    ...provisionalBudget,
    currentFilesCount: files.length
  }, intent);
  const allowedExpansion = budget.allowedExpansion;
  const workingSetId = input.workingSetId || input.id || createTaskRecordId('ws', `${store.repoSlug}:${scopeHypothesis}:${intentType}`);
  const seedPaths = toSeedPaths({ files, docs, seedPaths: input.seedPaths }, store.repoRoot);
  const workingSet = {
    schemaVersion: WORKING_SET_SCHEMA_VERSION,
    workingSetId,
    id: workingSetId,
    repoSlug: store.repoSlug,
    repo: {
      root: store.repoRoot,
      slug: store.repoSlug,
      cacheDir: store.cacheDir
    },
    intentType,
    scopeHypothesis,
    files,
    docs,
    artifacts: artifactsInput,
    relatedArtifacts: artifactsInput,
    reasons,
    seedPaths,
    budget,
    allowedExpansion,
    taskContextId,
    basedOnCommit,
    taskMetadata,
    createdAt,
    updatedAt,
    provenance: {
      taskContextId,
      workingSetId,
      repoSlug: store.repoSlug,
      basedOnCommit,
      createdAt,
      updatedAt
    }
  };

  if (options.persist !== false) {
    store.writeTaskArtifact({
      ...workingSet,
      kind: 'working-set'
    }, workingSet.workingSetId);
  }

  return workingSet;
}

function hydrateWorkingSet(payload = {}, options = {}) {
  return createWorkingSet({
    ...payload,
    repoRoot: payload.repoRoot || payload.repo && payload.repo.root,
    workingSetId: payload.workingSetId || payload.id,
    artifacts: payload.artifacts || payload.relatedArtifacts,
    reasons: payload.reasons,
    budget: payload.budget,
    taskMetadata: payload.taskMetadata,
    taskContextId: payload.taskContextId || payload.provenance && payload.provenance.taskContextId,
    basedOnCommit: payload.basedOnCommit || payload.provenance && payload.provenance.basedOnCommit,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    scopeHypothesis: payload.scopeHypothesis,
    intentType: payload.intentType,
    seedPaths: payload.seedPaths
  }, {
    ...options,
    persist: false
  });
}

function expandWorkingSet(workingSet, additions = {}, options = {}) {
  const repoRoot = options.repoRoot || workingSet.repo && workingSet.repo.root;
  const nextFiles = unique([...(workingSet.files || []), ...(additions.files || [])]).slice(0, workingSet.budget.totalFilesMax);
  const nextDocs = unique([...(workingSet.docs || []), ...(additions.docs || [])]);
  const nextArtifacts = unique([...(workingSet.artifacts || workingSet.relatedArtifacts || []), ...(additions.artifacts || additions.relatedArtifacts || [])]);
  const updatedAt = new Date().toISOString();
  const nextReasons = normalizeReasons([
    ...(workingSet.reasons || []),
    ...(Array.isArray(additions.reasons) ? additions.reasons : [])
  ], nextFiles);
  const budget = createBudgetState({
    ...(workingSet.budget || {}),
    ...(additions.budget || {}),
    currentFilesCount: nextFiles.length
  }, {
    intentType: workingSet.intentType,
    expectedDomains: options.expectedDomains || []
  });

  return {
    ...workingSet,
    workingSetId: workingSet.workingSetId || workingSet.id,
    id: workingSet.workingSetId || workingSet.id,
    files: nextFiles,
    docs: nextDocs,
    artifacts: nextArtifacts,
    relatedArtifacts: nextArtifacts,
    reasons: nextReasons,
    seedPaths: toSeedPaths({ files: nextFiles, docs: nextDocs, seedPaths: additions.seedPaths }, repoRoot),
    budget,
    allowedExpansion: budget.allowedExpansion,
    taskContextId: additions.taskContextId || workingSet.taskContextId || workingSet.provenance && workingSet.provenance.taskContextId || null,
    basedOnCommit: additions.basedOnCommit || workingSet.basedOnCommit || workingSet.provenance && workingSet.provenance.basedOnCommit || 'unknown',
    updatedAt,
    provenance: {
      ...(workingSet.provenance || {}),
      taskContextId: additions.taskContextId || workingSet.taskContextId || workingSet.provenance && workingSet.provenance.taskContextId || null,
      workingSetId: workingSet.workingSetId || workingSet.id,
      repoSlug: workingSet.repoSlug || workingSet.repo && workingSet.repo.slug || null,
      basedOnCommit: additions.basedOnCommit || workingSet.basedOnCommit || workingSet.provenance && workingSet.provenance.basedOnCommit || 'unknown',
      createdAt: workingSet.createdAt,
      updatedAt
    }
  };
}

module.exports = {
  WORKING_SET_SCHEMA_VERSION,
  createWorkingSet,
  expandWorkingSet,
  hydrateWorkingSet,
  normalizeReasons
};
