'use strict';

const CONTEXT_PACKAGE_SCHEMA_VERSION = 'ecc.context-package.v1';
const CONTEXT_PACKAGE_VERSION_STRATEGY = 'v1_extended_backward_compatible';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ensureString(value, fieldPath) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Context package requires ${fieldPath} to be a non-empty string`);
  }
}

function ensureBoolean(value, fieldPath) {
  if (typeof value !== 'boolean') {
    throw new Error(`Context package requires ${fieldPath} to be a boolean`);
  }
}

function ensureNumber(value, fieldPath) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Context package requires ${fieldPath} to be a number`);
  }
}

function ensureArrayOfStrings(value, fieldPath) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error(`Context package requires ${fieldPath} to be an array of strings`);
  }
}

function ensureOptionalArrayOfStrings(value, fieldPath) {
  if (value === undefined) {
    return;
  }

  ensureArrayOfStrings(value, fieldPath);
}

function ensureOptionalString(value, fieldPath) {
  if (value === undefined || value === null) {
    return;
  }

  ensureString(value, fieldPath);
}

function ensureOptionalObject(value, fieldPath) {
  if (value === undefined || value === null) {
    return;
  }

  if (!isObject(value)) {
    throw new Error(`Context package requires ${fieldPath} to be an object when present`);
  }
}

function shallowClone(value) {
  return isObject(value) ? { ...value } : {};
}

function normalizeWorkingSetMetadata(value = {}, payload = {}) {
  if (!isObject(value)) {
    return value;
  }

  const workingSetId = value.workingSetId || value.id || payload.workingSetId || payload.provenance && payload.provenance.workingSetId || null;
  const repoSlug = value.repoSlug || value.repo && value.repo.slug || payload.repoSlug || payload.repo && payload.repo.slug || payload.provenance && payload.provenance.repoSlug || null;
  const basedOnCommit = value.basedOnCommit || payload.basedOnCommit || payload.cache && payload.cache.basedOnCommit || payload.provenance && payload.provenance.basedOnCommit || 'unknown';
  const createdAt = value.createdAt || payload.createdAt || new Date().toISOString();
  const updatedAt = value.updatedAt || payload.updatedAt || createdAt;
  const taskContextId = value.taskContextId || payload.taskContextId || payload.provenance && payload.provenance.taskContextId || null;
  const budget = isObject(value.budget) ? { ...value.budget } : {};
  const allowedExpansion = isObject(value.allowedExpansion)
    ? { ...value.allowedExpansion }
    : isObject(budget.allowedExpansion)
      ? { ...budget.allowedExpansion }
      : value.allowedExpansion;

  return {
    ...value,
    workingSetId,
    id: workingSetId || value.id,
    repoSlug,
    basedOnCommit,
    createdAt,
    updatedAt,
    taskContextId,
    budget,
    allowedExpansion,
    provenance: {
      taskContextId,
      workingSetId,
      repoSlug,
      basedOnCommit,
      createdAt,
      updatedAt
    }
  };
}

function deriveAllowedExpansionAlias(workingSet = {}) {
  return isObject(workingSet && workingSet.budget) ? { ...workingSet.budget } : {};
}

function normalizeContextPackage(payload = {}) {
  if (!isObject(payload)) {
    return payload;
  }

  const normalizedWorkingSet = normalizeWorkingSetMetadata(payload.workingSet, payload);
  const taskContextId = payload.taskContextId || payload.provenance && payload.provenance.taskContextId || null;
  const workingSetId = normalizedWorkingSet && (normalizedWorkingSet.workingSetId || normalizedWorkingSet.id) || payload.workingSetId || payload.provenance && payload.provenance.workingSetId || null;
  const repoSlug = payload.repoSlug || payload.repo && payload.repo.slug || normalizedWorkingSet && normalizedWorkingSet.repoSlug || payload.provenance && payload.provenance.repoSlug || null;
  const basedOnCommit = payload.basedOnCommit || payload.cache && payload.cache.basedOnCommit || normalizedWorkingSet && normalizedWorkingSet.basedOnCommit || payload.provenance && payload.provenance.basedOnCommit || 'unknown';
  const createdAt = payload.createdAt || normalizedWorkingSet && normalizedWorkingSet.createdAt || new Date().toISOString();
  const updatedAt = payload.updatedAt || normalizedWorkingSet && normalizedWorkingSet.updatedAt || createdAt;
  const allowedExpansion = deriveAllowedExpansionAlias(normalizedWorkingSet);

  return {
    ...payload,
    schemaVersion: payload.schemaVersion || CONTEXT_PACKAGE_SCHEMA_VERSION,
    schemaStrategy: CONTEXT_PACKAGE_VERSION_STRATEGY,
    taskContextId,
    workingSetId,
    repoSlug,
    basedOnCommit,
    createdAt,
    updatedAt,
    workingSet: normalizedWorkingSet,
    allowedExpansion,
    allowedExpansionSource: 'workingSet.budget',
    provenance: {
      ...shallowClone(payload.provenance),
      taskContextId,
      workingSetId,
      repoSlug,
      basedOnCommit,
      createdAt,
      updatedAt
    },
    cache: isObject(payload.cache)
      ? {
          ...payload.cache,
          basedOnCommit: payload.cache.basedOnCommit || basedOnCommit
        }
      : payload.cache
  };
}

function validateAllowedExpansion(value) {
  if (!isObject(value)) {
    throw new Error('Context package requires allowedExpansion to be an object');
  }

  ensureNumber(value.broadSearchesMax, 'allowedExpansion.broadSearchesMax');
  ensureNumber(value.broadSearchesRemaining, 'allowedExpansion.broadSearchesRemaining');
  ensureNumber(value.broadSearchesUsed, 'allowedExpansion.broadSearchesUsed');
  ensureNumber(value.initialFilesMax, 'allowedExpansion.initialFilesMax');
  ensureNumber(value.expansionsMax, 'allowedExpansion.expansionsMax');
  ensureNumber(value.expansionsRemaining, 'allowedExpansion.expansionsRemaining');
  ensureNumber(value.expansionsUsed, 'allowedExpansion.expansionsUsed');
  ensureNumber(value.totalFilesMax, 'allowedExpansion.totalFilesMax');
  ensureNumber(value.currentFilesCount, 'allowedExpansion.currentFilesCount');
}

function validateReasons(value, fieldPath) {
  if (!Array.isArray(value)) {
    throw new Error(`Context package requires ${fieldPath} to be an array`);
  }

  value.forEach((item, index) => {
    if (!isObject(item)) {
      throw new Error(`Context package requires ${fieldPath}[${index}] to be an object`);
    }
    ensureString(item.path, `${fieldPath}[${index}].path`);
    ensureString(item.reason, `${fieldPath}[${index}].reason`);
  });
}

function validateWorkingSet(value) {
  if (!isObject(value)) {
    throw new Error('Context package requires workingSet to be an object');
  }

  ensureString(value.workingSetId || value.id, 'workingSet.workingSetId');
  ensureString(value.intentType, 'workingSet.intentType');
  ensureOptionalString(value.taskContextId, 'workingSet.taskContextId');
  ensureOptionalString(value.repoSlug, 'workingSet.repoSlug');
  ensureOptionalString(value.basedOnCommit, 'workingSet.basedOnCommit');
  ensureString(value.createdAt, 'workingSet.createdAt');
  ensureString(value.updatedAt || value.createdAt, 'workingSet.updatedAt');
  ensureArrayOfStrings(value.files, 'workingSet.files');
  ensureArrayOfStrings(value.docs, 'workingSet.docs');
  ensureArrayOfStrings(value.seedPaths, 'workingSet.seedPaths');
  ensureArrayOfStrings(value.relatedArtifacts || value.artifacts || [], 'workingSet.relatedArtifacts');
  validateReasons(Array.isArray(value.reasons) ? value.reasons : [], 'workingSet.reasons');

  if (value.allowedExpansion !== undefined && !isObject(value.allowedExpansion)) {
    throw new Error('Context package requires workingSet.allowedExpansion to be an object when present');
  }

  if (value.allowedExpansion !== undefined) {
    ensureBoolean(value.allowedExpansion.repoWide, 'workingSet.allowedExpansion.repoWide');
    ensureBoolean(value.allowedExpansion.crossDomain, 'workingSet.allowedExpansion.crossDomain');
    ensureBoolean(value.allowedExpansion.neighborCallsite, 'workingSet.allowedExpansion.neighborCallsite');
  }

  if (!isObject(value.budget)) {
    throw new Error('Context package requires workingSet.budget to be an object');
  }

  validateAllowedExpansion(value.budget);
  ensureOptionalArrayOfStrings(value.artifacts, 'workingSet.artifacts');

  if (value.provenance !== undefined) {
    if (!isObject(value.provenance)) {
      throw new Error('Context package requires workingSet.provenance to be an object when present');
    }

    ensureOptionalString(value.provenance.taskContextId, 'workingSet.provenance.taskContextId');
    ensureOptionalString(value.provenance.workingSetId, 'workingSet.provenance.workingSetId');
    ensureOptionalString(value.provenance.repoSlug, 'workingSet.provenance.repoSlug');
    ensureOptionalString(value.provenance.basedOnCommit, 'workingSet.provenance.basedOnCommit');
    ensureString(value.provenance.createdAt || value.createdAt, 'workingSet.provenance.createdAt');
    ensureString(value.provenance.updatedAt || value.updatedAt || value.createdAt, 'workingSet.provenance.updatedAt');
  }
}

function validateTaskAuditPack(value) {
  ensureOptionalObject(value, 'taskAuditPack');
  if (!value) {
    return;
  }

  ensureString(value.schemaVersion, 'taskAuditPack.schemaVersion');
  ensureString(value.taskType, 'taskAuditPack.taskType');
  ensureString(value.scopeHypothesis, 'taskAuditPack.scopeHypothesis');
  ensureArrayOfStrings(value.affectedScreens || [], 'taskAuditPack.affectedScreens');
  ensureArrayOfStrings(value.affectedApis || [], 'taskAuditPack.affectedApis');
  ensureArrayOfStrings(value.affectedEntities || [], 'taskAuditPack.affectedEntities');
  ensureArrayOfStrings(value.probableFiles || [], 'taskAuditPack.probableFiles');
  ensureArrayOfStrings(value.recommendedDocs || [], 'taskAuditPack.recommendedDocs');
  ensureArrayOfStrings(value.gaps || [], 'taskAuditPack.gaps');
  ensureArrayOfStrings(value.expansionSuggestions || [], 'taskAuditPack.expansionSuggestions');
  ensureOptionalString(value.artifactId, 'taskAuditPack.artifactId');

  if (!isObject(value.domainSummary)) {
    throw new Error('Context package requires taskAuditPack.domainSummary to be an object');
  }
  ensureArrayOfStrings(value.domainSummary.primaryDomains || [], 'taskAuditPack.domainSummary.primaryDomains');
  ensureArrayOfStrings(value.domainSummary.secondaryDomains || [], 'taskAuditPack.domainSummary.secondaryDomains');
  ensureArrayOfStrings(value.domainSummary.why || [], 'taskAuditPack.domainSummary.why');

  if (!isObject(value.initialWorkingSet)) {
    throw new Error('Context package requires taskAuditPack.initialWorkingSet to be an object');
  }
  ensureArrayOfStrings(value.initialWorkingSet.files || [], 'taskAuditPack.initialWorkingSet.files');
  ensureArrayOfStrings(value.initialWorkingSet.docs || [], 'taskAuditPack.initialWorkingSet.docs');
  ensureArrayOfStrings(value.initialWorkingSet.artifacts || [], 'taskAuditPack.initialWorkingSet.artifacts');

  if (!isObject(value.riskSummary)) {
    throw new Error('Context package requires taskAuditPack.riskSummary to be an object');
  }
  ensureString(value.riskSummary.level, 'taskAuditPack.riskSummary.level');
  ensureArrayOfStrings(value.riskSummary.reasons || [], 'taskAuditPack.riskSummary.reasons');

  if (!isObject(value.confidenceSummary)) {
    throw new Error('Context package requires taskAuditPack.confidenceSummary to be an object');
  }
  ensureString(value.confidenceSummary.overall, 'taskAuditPack.confidenceSummary.overall');
  ensureArrayOfStrings(value.confidenceSummary.knownUnknowns || [], 'taskAuditPack.confidenceSummary.knownUnknowns');
}

function validateExtendedReadiness(value) {
  ensureOptionalObject(value, 'extendedReadiness');
  if (!value) {
    return;
  }

  ensureString(value.decision, 'extendedReadiness.decision');
  ensureString(value.confidence, 'extendedReadiness.confidence');
  ensureNumber(value.confidenceScore, 'extendedReadiness.confidenceScore');
  ensureString(value.sourceOfTruthPolicy, 'extendedReadiness.sourceOfTruthPolicy');
}

function validateStructuredMapsReadiness(value) {
  ensureOptionalObject(value, 'structuredMapsReadiness');
  if (!value) {
    return;
  }

  ensureString(value.decision, 'structuredMapsReadiness.decision');
  ensureString(value.confidence, 'structuredMapsReadiness.confidence');
  ensureNumber(value.confidenceScore, 'structuredMapsReadiness.confidenceScore');
  ensureOptionalArrayOfStrings(value.issues, 'structuredMapsReadiness.issues');
  ensureOptionalArrayOfStrings(value.warnings, 'structuredMapsReadiness.warnings');
}

function validateContextPackage(payload) {
  const normalizedPayload = normalizeContextPackage(payload);

  if (!isObject(normalizedPayload)) {
    throw new Error('Context package must be an object');
  }

  ensureString(normalizedPayload.schemaVersion, 'schemaVersion');
  if (normalizedPayload.schemaVersion !== CONTEXT_PACKAGE_SCHEMA_VERSION) {
    throw new Error(`Unsupported context package schema version: ${normalizedPayload.schemaVersion}`);
  }

  ensureString(normalizedPayload.createdAt, 'createdAt');
  ensureString(normalizedPayload.updatedAt || normalizedPayload.createdAt, 'updatedAt');
  ensureOptionalString(normalizedPayload.taskContextId, 'taskContextId');
  ensureOptionalString(normalizedPayload.workingSetId, 'workingSetId');
  ensureOptionalString(normalizedPayload.repoSlug, 'repoSlug');
  ensureOptionalString(normalizedPayload.basedOnCommit, 'basedOnCommit');
  ensureString(normalizedPayload.allowedExpansionSource, 'allowedExpansionSource');
  if (normalizedPayload.allowedExpansionSource !== 'workingSet.budget') {
    throw new Error('Context package requires allowedExpansionSource to be workingSet.budget');
  }

  ensureString(normalizedPayload.intentType, 'intentType');
  ensureString(normalizedPayload.riskLevel, 'riskLevel');
  ensureArrayOfStrings(normalizedPayload.expectedDomains, 'expectedDomains');
  ensureBoolean(normalizedPayload.requiresWrite, 'requiresWrite');
  ensureString(normalizedPayload.likelyScope, 'likelyScope');
  ensureString(normalizedPayload.ambiguity, 'ambiguity');
  ensureString(normalizedPayload.initialBudgetClass, 'initialBudgetClass');
  ensureString(normalizedPayload.scopeHypothesis, 'scopeHypothesis');
  ensureArrayOfStrings(normalizedPayload.recommendedDocs, 'recommendedDocs');
  validateWorkingSet(normalizedPayload.workingSet);
  validateAllowedExpansion(normalizedPayload.allowedExpansion);
  ensureNumber(normalizedPayload.confidence, 'confidence');
  ensureBoolean(normalizedPayload.needsDiscovery, 'needsDiscovery');

  if (!isObject(normalizedPayload.repo)) {
    throw new Error('Context package requires repo to be an object');
  }

  ensureString(normalizedPayload.repo.root, 'repo.root');
  ensureString(normalizedPayload.repo.slug, 'repo.slug');
  ensureString(normalizedPayload.repo.cacheDir, 'repo.cacheDir');

  if (!isObject(normalizedPayload.cache)) {
    throw new Error('Context package requires cache to be an object');
  }

  ensureBoolean(normalizedPayload.cache.hit, 'cache.hit');
  ensureString(normalizedPayload.cache.indexVersion, 'cache.indexVersion');
  ensureString(normalizedPayload.cache.basedOnCommit, 'cache.basedOnCommit');
  ensureOptionalString(normalizedPayload.prepareMode, 'prepareMode');
  ensureOptionalString(normalizedPayload.analysisMode, 'analysisMode');

  if (!isObject(normalizedPayload.provenance)) {
    throw new Error('Context package requires provenance to be an object');
  }

  ensureOptionalString(normalizedPayload.provenance.taskContextId, 'provenance.taskContextId');
  ensureOptionalString(normalizedPayload.provenance.workingSetId, 'provenance.workingSetId');
  ensureOptionalString(normalizedPayload.provenance.repoSlug, 'provenance.repoSlug');
  ensureOptionalString(normalizedPayload.provenance.basedOnCommit, 'provenance.basedOnCommit');
  ensureString(normalizedPayload.provenance.createdAt || normalizedPayload.createdAt, 'provenance.createdAt');
  ensureString(normalizedPayload.provenance.updatedAt || normalizedPayload.updatedAt || normalizedPayload.createdAt, 'provenance.updatedAt');

  if (
    normalizedPayload.workingSet
    && normalizedPayload.allowedExpansion
    && normalizedPayload.workingSet.budget
    && (
      normalizedPayload.allowedExpansion.broadSearchesRemaining !== normalizedPayload.workingSet.budget.broadSearchesRemaining
      || normalizedPayload.allowedExpansion.expansionsRemaining !== normalizedPayload.workingSet.budget.expansionsRemaining
      || normalizedPayload.allowedExpansion.totalFilesMax !== normalizedPayload.workingSet.budget.totalFilesMax
      || normalizedPayload.allowedExpansion.currentFilesCount !== normalizedPayload.workingSet.budget.currentFilesCount
    )
  ) {
    throw new Error('Context package allowedExpansion must be derived from workingSet.budget');
  }

  validateTaskAuditPack(normalizedPayload.taskAuditPack);
  validateExtendedReadiness(normalizedPayload.extendedReadiness);
  validateStructuredMapsReadiness(normalizedPayload.structuredMapsReadiness);

  return normalizedPayload;
}

module.exports = {
  CONTEXT_PACKAGE_SCHEMA_VERSION,
  CONTEXT_PACKAGE_VERSION_STRATEGY,
  deriveAllowedExpansionAlias,
  normalizeContextPackage,
  validateAllowedExpansion,
  validateContextPackage,
  validateWorkingSet
};
