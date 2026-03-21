'use strict';

const { resolveIntentProfile } = require('./intent-rules');

const VALID_INTENT_TYPES = new Set(['bugfix', 'feature', 'audit', 'refactor', 'research', 'unknown']);
const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high']);
const VALID_SCOPE_LEVELS = new Set(['narrow', 'medium', 'broad']);
const VALID_AMBIGUITY_LEVELS = new Set(['low', 'medium', 'high']);
const VALID_BUDGET_CLASSES = new Set(['small', 'medium', 'large']);

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function normalizeCallerMetadata(options = {}) {
  return options.callerMetadata && typeof options.callerMetadata === 'object'
    ? options.callerMetadata
    : {};
}

function normalizeRepoIdentity(options = {}) {
  const repoIdentity = options.repoIdentity && typeof options.repoIdentity === 'object'
    ? options.repoIdentity
    : {};

  return {
    repoRoot: typeof repoIdentity.repoRoot === 'string' ? repoIdentity.repoRoot : null,
    repoSlug: typeof repoIdentity.repoSlug === 'string' ? repoIdentity.repoSlug : null
  };
}

function sanitizeProfile(profile, repoIdentity) {
  return {
    intentType: VALID_INTENT_TYPES.has(profile.intentType) ? profile.intentType : 'unknown',
    riskLevel: VALID_RISK_LEVELS.has(profile.riskLevel) ? profile.riskLevel : 'medium',
    expectedDomains: unique(profile.expectedDomains),
    requiresWrite: Boolean(profile.requiresWrite),
    likelyScope: VALID_SCOPE_LEVELS.has(profile.likelyScope) ? profile.likelyScope : 'medium',
    ambiguity: VALID_AMBIGUITY_LEVELS.has(profile.ambiguity) ? profile.ambiguity : 'high',
    initialBudgetClass: VALID_BUDGET_CLASSES.has(profile.initialBudgetClass) ? profile.initialBudgetClass : 'medium',
    repoRoot: repoIdentity.repoRoot,
    repoSlug: repoIdentity.repoSlug
  };
}

function normalizeIntent(taskText, options = {}) {
  const callerMetadata = normalizeCallerMetadata(options);
  const repoIdentity = normalizeRepoIdentity(options);
  const profile = resolveIntentProfile(taskText, callerMetadata);

  return sanitizeProfile(profile, repoIdentity);
}

module.exports = {
  VALID_AMBIGUITY_LEVELS,
  VALID_BUDGET_CLASSES,
  VALID_INTENT_TYPES,
  VALID_RISK_LEVELS,
  VALID_SCOPE_LEVELS,
  normalizeCallerMetadata,
  normalizeIntent,
  normalizeRepoIdentity,
  sanitizeProfile
};
