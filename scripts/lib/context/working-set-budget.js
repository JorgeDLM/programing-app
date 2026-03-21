'use strict';

const WORKING_SET_BUDGET_SCHEMA_VERSION = 'ecc.working-set-budget.v2';

const WORKING_SET_BUDGET_PROFILES = {
  audit_quick: {
    broadSearchesMax: 1,
    initialFilesMax: 8,
    expansionsMax: 1,
    totalFilesMax: 12,
    repoWideExpansionAllowed: false,
    crossDomainExpansionAllowed: false,
    neighborCallsiteExpansionAllowed: false
  },
  audit_focused: {
    broadSearchesMax: 2,
    initialFilesMax: 12,
    expansionsMax: 2,
    totalFilesMax: 20,
    repoWideExpansionAllowed: 'only_with_explicit_reason',
    crossDomainExpansionAllowed: false,
    neighborCallsiteExpansionAllowed: false
  },
  bugfix: {
    broadSearchesMax: 2,
    initialFilesMax: 10,
    expansionsMax: 2,
    totalFilesMax: 18,
    repoWideExpansionAllowed: false,
    crossDomainExpansionAllowed: false,
    neighborCallsiteExpansionAllowed: true
  },
  feature: {
    broadSearchesMax: 3,
    initialFilesMax: 15,
    expansionsMax: 3,
    totalFilesMax: 28,
    repoWideExpansionAllowed: false,
    crossDomainExpansionAllowed: 'true_if_plan_says_fullstack',
    neighborCallsiteExpansionAllowed: true
  },
  refactor: {
    broadSearchesMax: 2,
    initialFilesMax: 20,
    expansionsMax: 2,
    totalFilesMax: 30,
    repoWideExpansionAllowed: false,
    crossDomainExpansionAllowed: false,
    neighborCallsiteExpansionAllowed: true
  },
  research: {
    broadSearchesMax: 2,
    initialFilesMax: 12,
    expansionsMax: 2,
    totalFilesMax: 20,
    repoWideExpansionAllowed: 'false_by_default',
    crossDomainExpansionAllowed: false,
    neighborCallsiteExpansionAllowed: false
  },
  unknown: {
    broadSearchesMax: 1,
    initialFilesMax: 8,
    expansionsMax: 1,
    totalFilesMax: 12,
    repoWideExpansionAllowed: false,
    crossDomainExpansionAllowed: false,
    neighborCallsiteExpansionAllowed: false
  }
};

function toNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function resolveBudgetClass(intent = {}) {
  if (typeof intent.initialBudgetClass === 'string' && intent.initialBudgetClass.length > 0) {
    return intent.initialBudgetClass;
  }

  return 'medium';
}

function isFullstackIntent(normalizedIntent = {}) {
  const expectedDomains = unique(normalizedIntent.expectedDomains);
  const hasFrontend = expectedDomains.includes('frontend');
  const hasServerSide = expectedDomains.includes('backend') || expectedDomains.includes('api') || expectedDomains.includes('data');
  return hasFrontend && hasServerSide;
}

function resolveBudgetProfileName(intentType = 'unknown', normalizedIntent = {}) {
  if (intentType === 'audit') {
    if (normalizedIntent.likelyScope === 'narrow' || normalizedIntent.initialBudgetClass === 'small') {
      return 'audit_quick';
    }
    return 'audit_focused';
  }

  if (Object.prototype.hasOwnProperty.call(WORKING_SET_BUDGET_PROFILES, intentType)) {
    return intentType;
  }

  return 'unknown';
}

function getBudgetForIntent(intentType, normalizedIntent = {}) {
  const resolvedIntentType = intentType || normalizedIntent.intentType || 'unknown';
  const profileName = resolveBudgetProfileName(resolvedIntentType, normalizedIntent);
  const profile = WORKING_SET_BUDGET_PROFILES[profileName] || WORKING_SET_BUDGET_PROFILES.unknown;

  return {
    schemaVersion: WORKING_SET_BUDGET_SCHEMA_VERSION,
    profileName,
    budgetClass: resolveBudgetClass(normalizedIntent),
    intentType: resolvedIntentType,
    broadSearchesMax: profile.broadSearchesMax,
    initialFilesMax: profile.initialFilesMax,
    expansionsMax: profile.expansionsMax,
    totalFilesMax: profile.totalFilesMax,
    repoWideExpansionAllowed: profile.repoWideExpansionAllowed,
    crossDomainExpansionAllowed: profile.crossDomainExpansionAllowed,
    neighborCallsiteExpansionAllowed: profile.neighborCallsiteExpansionAllowed
  };
}

function resolveAllowedExpansion(budgetState = {}, normalizedIntent = {}) {
  return {
    repoWide: budgetState.repoWideExpansionAllowed === true,
    crossDomain: budgetState.crossDomainExpansionAllowed === true
      || (budgetState.crossDomainExpansionAllowed === 'true_if_plan_says_fullstack' && isFullstackIntent(normalizedIntent)),
    neighborCallsite: budgetState.neighborCallsiteExpansionAllowed === true
  };
}

function clampBudgetToPolicy(input = {}) {
  const baseBudget = getBudgetForIntent(input.intentType, input);
  const broadSearchesMax = Math.max(0, toNumber(input.broadSearchesMax, baseBudget.broadSearchesMax));
  const expansionsMax = Math.max(0, toNumber(input.expansionsMax, baseBudget.expansionsMax));
  const initialFilesMax = Math.max(0, toNumber(input.initialFilesMax || input.initialFilesLimit, baseBudget.initialFilesMax));
  const totalFilesMax = Math.max(initialFilesMax, toNumber(input.totalFilesMax || input.maxFiles, baseBudget.totalFilesMax));
  const broadSearchesUsed = clampNumber(toNumber(input.broadSearchesUsed, 0), 0, broadSearchesMax);
  const expansionsUsed = clampNumber(toNumber(input.expansionsUsed, 0), 0, expansionsMax);
  const currentFilesCount = clampNumber(toNumber(input.currentFilesCount, 0), 0, totalFilesMax);
  const normalizedBudget = {
    ...baseBudget,
    schemaVersion: WORKING_SET_BUDGET_SCHEMA_VERSION,
    broadSearchesMax,
    broadSearchesUsed,
    broadSearchesRemaining: Math.max(0, broadSearchesMax - broadSearchesUsed),
    initialFilesMax,
    initialFilesLimit: initialFilesMax,
    expansionsMax,
    expansionsUsed,
    expansionsRemaining: Math.max(0, expansionsMax - expansionsUsed),
    totalFilesMax,
    maxFiles: totalFilesMax,
    currentFilesCount,
    repoWideExpansionAllowed: input.repoWideExpansionAllowed !== undefined ? input.repoWideExpansionAllowed : baseBudget.repoWideExpansionAllowed,
    crossDomainExpansionAllowed: input.crossDomainExpansionAllowed !== undefined ? input.crossDomainExpansionAllowed : baseBudget.crossDomainExpansionAllowed,
    neighborCallsiteExpansionAllowed: input.neighborCallsiteExpansionAllowed !== undefined
      ? input.neighborCallsiteExpansionAllowed
      : baseBudget.neighborCallsiteExpansionAllowed
  };

  return normalizedBudget;
}

function createBudgetState(input = {}, normalizedIntent = {}) {
  const intent = {
    ...normalizedIntent,
    ...input,
    intentType: input.intentType || normalizedIntent.intentType || 'unknown'
  };
  const baseBudget = getBudgetForIntent(intent.intentType, intent);
  const currentFilesCount = toNumber(input.currentFilesCount, 0);
  const state = clampBudgetToPolicy({
    ...baseBudget,
    ...input,
    currentFilesCount
  });

  return {
    ...state,
    allowedExpansion: resolveAllowedExpansion(state, intent)
  };
}

function buildWorkingSetBudget(intent = {}) {
  return createBudgetState({}, intent);
}

module.exports = {
  WORKING_SET_BUDGET_PROFILES,
  WORKING_SET_BUDGET_SCHEMA_VERSION,
  buildWorkingSetBudget,
  clampBudgetToPolicy,
  createBudgetState,
  getBudgetForIntent,
  isFullstackIntent,
  resolveAllowedExpansion,
  resolveBudgetClass,
  resolveBudgetProfileName
};
