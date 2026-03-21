'use strict';

const INTENT_RULES = [
  {
    intentType: 'bugfix',
    patterns: ['bug', 'fix', 'broken', 'crash', 'error', 'issue', 'regression', 'hotfix', 'failing']
  },
  {
    intentType: 'feature',
    patterns: ['implement', 'add', 'create', 'build', 'support', 'introduce', 'new endpoint', 'new feature']
  },
  {
    intentType: 'audit',
    patterns: ['audit', 'analyze', 'inspect', 'review', 'diagnose', 'map', 'assess']
  },
  {
    intentType: 'refactor',
    patterns: ['refactor', 'cleanup', 'simplify', 'extract', 'rename', 'reorganize', 'decouple']
  },
  {
    intentType: 'research',
    patterns: ['research', 'investigate', 'explore', 'compare', 'evaluate options', 'spike']
  }
];

const DOMAIN_RULES = [
  {
    domain: 'frontend',
    patterns: ['frontend', 'ui', 'page', 'pages', 'component', 'layout', 'tailwind', 'react', 'next.js', 'nextjs', 'tsx', 'client']
  },
  {
    domain: 'backend',
    patterns: ['backend', 'service', 'server', 'handler', 'controller', 'middleware', 'route', 'endpoint', 'api', 'rest']
  },
  {
    domain: 'data',
    patterns: ['database', 'db', 'schema', 'migration', 'model', 'prisma', 'orm', 'sql', 'table', 'query', 'postgres']
  },
  {
    domain: 'api',
    patterns: ['api', 'endpoint', 'contract', 'request', 'response', 'route', 'graphql', 'rpc']
  },
  {
    domain: 'docs',
    patterns: ['docs', 'documentation', 'readme', 'codemap', 'audit', 'architecture', 'ai_context']
  }
];

const LOW_RISK_PATTERNS = ['docs', 'readme', 'audit', 'inspect', 'review', 'analyze', 'test-only', 'read-only'];
const HIGH_RISK_PATTERNS = ['architecture', 'security', 'payment', 'auth', 'migration', 'schema', 'database', 'multi-repo', 'multiple repos', 'production'];
const BROAD_SCOPE_PATTERNS = ['entire repo', 'whole repo', 'codebase', 'across the repo', 'multiple repos', 'architecture', 'system-wide', 'global'];
const NARROW_SCOPE_PATTERNS = ['single file', 'specific file', 'this file', 'this route', 'selected file'];
const FILE_LIKE_PATTERN = /[A-Za-z0-9_./-]+\.[A-Za-z0-9]+/gu;

const BUDGET_CLASS_PROFILES = {
  small: {
    broadSearchesRemaining: 1,
    expansionsRemaining: 1,
    maxFiles: 12
  },
  medium: {
    broadSearchesRemaining: 2,
    expansionsRemaining: 2,
    maxFiles: 20
  },
  large: {
    broadSearchesRemaining: 3,
    expansionsRemaining: 3,
    maxFiles: 30
  }
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function scoreMatches(text, patterns) {
  return patterns.reduce((total, pattern) => total + (text.includes(pattern) ? 1 : 0), 0);
}

function resolveIntentType(text, metadata = {}) {
  if (typeof metadata.intentType === 'string' && metadata.intentType.length > 0) {
    return metadata.intentType;
  }

  const ranked = INTENT_RULES
    .map(rule => ({ intentType: rule.intentType, score: scoreMatches(text, rule.patterns) }))
    .filter(rule => rule.score > 0)
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) {
    return 'unknown';
  }

  return ranked[0].intentType;
}

function resolveExpectedDomains(text, metadata = {}) {
  const metadataDomains = Array.isArray(metadata.expectedDomains) ? metadata.expectedDomains : [];
  const matchedDomains = DOMAIN_RULES
    .filter(rule => scoreMatches(text, rule.patterns) > 0)
    .map(rule => rule.domain);

  return unique([...metadataDomains, ...matchedDomains]);
}

function resolveRequiresWrite(intentType, text, metadata = {}) {
  if (typeof metadata.requiresWrite === 'boolean') {
    return metadata.requiresWrite;
  }

  if (intentType === 'feature' || intentType === 'bugfix' || intentType === 'refactor') {
    return true;
  }

  return /(write|update|change|modify|implement|add|create|fix)/u.test(text);
}

function resolveLikelyScope(text, metadata = {}, expectedDomains = []) {
  if (typeof metadata.likelyScope === 'string' && metadata.likelyScope.length > 0) {
    return metadata.likelyScope;
  }

  if (BROAD_SCOPE_PATTERNS.some(pattern => text.includes(pattern))) {
    return 'broad';
  }

  if (NARROW_SCOPE_PATTERNS.some(pattern => text.includes(pattern))) {
    return 'narrow';
  }

  const mentionedFiles = text.match(FILE_LIKE_PATTERN) || [];
  if (mentionedFiles.length > 0 || (Array.isArray(metadata.selectedFiles) && metadata.selectedFiles.length === 1)) {
    return 'narrow';
  }

  if (expectedDomains.length >= 3) {
    return 'broad';
  }

  return 'medium';
}

function resolveRiskLevel(text, metadata = {}, intentType = 'unknown', expectedDomains = []) {
  if (typeof metadata.riskLevel === 'string' && metadata.riskLevel.length > 0) {
    return metadata.riskLevel;
  }

  if (HIGH_RISK_PATTERNS.some(pattern => text.includes(pattern))) {
    return 'high';
  }

  if (intentType === 'refactor' && expectedDomains.length >= 2) {
    return 'high';
  }

  if (LOW_RISK_PATTERNS.some(pattern => text.includes(pattern)) && intentType !== 'feature') {
    return 'low';
  }

  return 'medium';
}

function resolveAmbiguity(text, metadata = {}, intentType = 'unknown', expectedDomains = []) {
  if (typeof metadata.ambiguity === 'string' && metadata.ambiguity.length > 0) {
    return metadata.ambiguity;
  }

  const mentionedFiles = text.match(FILE_LIKE_PATTERN) || [];
  const intentScores = INTENT_RULES
    .map(rule => scoreMatches(text, rule.patterns))
    .filter(score => score > 0)
    .length;

  if (intentType === 'unknown' || intentScores >= 3) {
    return 'high';
  }

  if (mentionedFiles.length > 0 || (Array.isArray(metadata.selectedFiles) && metadata.selectedFiles.length > 0)) {
    return 'low';
  }

  if (expectedDomains.length >= 3) {
    return 'medium';
  }

  return 'low';
}

function resolveInitialBudgetClass(metadata = {}, likelyScope = 'medium', riskLevel = 'medium') {
  if (typeof metadata.initialBudgetClass === 'string' && metadata.initialBudgetClass.length > 0) {
    return metadata.initialBudgetClass;
  }

  if (likelyScope === 'broad' || riskLevel === 'high') {
    return 'large';
  }

  if (likelyScope === 'narrow') {
    return 'small';
  }

  return 'medium';
}

function resolveIntentProfile(taskText, metadata = {}) {
  const text = normalizeText(taskText);
  const intentType = resolveIntentType(text, metadata);
  const expectedDomains = resolveExpectedDomains(text, metadata);
  const requiresWrite = resolveRequiresWrite(intentType, text, metadata);
  const likelyScope = resolveLikelyScope(text, metadata, expectedDomains);
  const riskLevel = resolveRiskLevel(text, metadata, intentType, expectedDomains);
  const ambiguity = resolveAmbiguity(text, metadata, intentType, expectedDomains);
  const initialBudgetClass = resolveInitialBudgetClass(metadata, likelyScope, riskLevel);

  return {
    intentType,
    riskLevel,
    expectedDomains,
    requiresWrite,
    likelyScope,
    ambiguity,
    initialBudgetClass
  };
}

module.exports = {
  BUDGET_CLASS_PROFILES,
  DOMAIN_RULES,
  INTENT_RULES,
  resolveAmbiguity,
  resolveExpectedDomains,
  resolveInitialBudgetClass,
  resolveIntentProfile,
  resolveIntentType,
  resolveLikelyScope,
  resolveRequiresWrite,
  resolveRiskLevel
};
