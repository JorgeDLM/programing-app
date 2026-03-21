'use strict';

const path = require('path');

const AI_CONTEXT_DIRECTORY = 'AI_CONTEXT';
const STANDARD_AI_CONTEXT_DOCS = Object.freeze([
  {
    key: 'start',
    name: '00-START-HERE.md',
    path: 'AI_CONTEXT/00-START-HERE.md',
    title: 'Start Here'
  },
  {
    key: 'overview',
    name: '01-PROJECT-OVERVIEW.md',
    path: 'AI_CONTEXT/01-PROJECT-OVERVIEW.md',
    title: 'Project Overview'
  },
  {
    key: 'architecture',
    name: '02-ARCHITECTURE.md',
    path: 'AI_CONTEXT/02-ARCHITECTURE.md',
    title: 'Architecture'
  },
  {
    key: 'backend',
    name: '03-BACKEND.md',
    path: 'AI_CONTEXT/03-BACKEND.md',
    title: 'Backend'
  },
  {
    key: 'frontend',
    name: '04-FRONTEND.md',
    path: 'AI_CONTEXT/04-FRONTEND.md',
    title: 'Frontend'
  },
  {
    key: 'data',
    name: '05-DATA-MODELS.md',
    path: 'AI_CONTEXT/05-DATA-MODELS.md',
    title: 'Data Models'
  },
  {
    key: 'api',
    name: '06-API-CONTRACTS.md',
    path: 'AI_CONTEXT/06-API-CONTRACTS.md',
    title: 'API Contracts'
  },
  {
    key: 'adr',
    name: '07-DECISIONS-ADR.md',
    path: 'AI_CONTEXT/07-DECISIONS-ADR.md',
    title: 'Decisions / ADR'
  },
  {
    key: 'recent',
    name: '08-RECENT-CHANGES.md',
    path: 'AI_CONTEXT/08-RECENT-CHANGES.md',
    title: 'Recent Changes'
  },
  {
    key: 'issues',
    name: '09-OPEN-ISSUES.md',
    path: 'AI_CONTEXT/09-OPEN-ISSUES.md',
    title: 'Open Issues'
  }
]);

const DOMAIN_DOC_MAP = Object.freeze({
  api: ['AI_CONTEXT/06-API-CONTRACTS.md'],
  architecture: ['AI_CONTEXT/02-ARCHITECTURE.md'],
  backend: ['AI_CONTEXT/03-BACKEND.md'],
  data: ['AI_CONTEXT/05-DATA-MODELS.md'],
  decision: ['AI_CONTEXT/07-DECISIONS-ADR.md'],
  docs: ['AI_CONTEXT/00-START-HERE.md', 'AI_CONTEXT/08-RECENT-CHANGES.md'],
  frontend: ['AI_CONTEXT/04-FRONTEND.md'],
  repo: ['AI_CONTEXT/01-PROJECT-OVERVIEW.md']
});

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function normalizeDocInput(docNameOrPath) {
  if (typeof docNameOrPath !== 'string' || docNameOrPath.trim().length === 0) {
    return null;
  }

  const normalized = docNameOrPath.trim().split(path.sep).join('/').replace(/^\.\//u, '');
  if (normalized.startsWith(`${AI_CONTEXT_DIRECTORY}/`)) {
    return normalized;
  }

  return `${AI_CONTEXT_DIRECTORY}/${normalized}`;
}

function getStandardAiContextFiles() {
  return STANDARD_AI_CONTEXT_DOCS.map(doc => doc.path);
}

function getAiContextDocDefinition(docNameOrPath) {
  const normalized = normalizeDocInput(docNameOrPath);
  if (!normalized) {
    return null;
  }

  return STANDARD_AI_CONTEXT_DOCS.find(doc => doc.path === normalized || doc.name === docNameOrPath || doc.key === docNameOrPath) || null;
}

function resolveAiContextPath(repoRoot, docNameOrPath) {
  const definition = getAiContextDocDefinition(docNameOrPath);
  const relativePath = definition ? definition.path : normalizeDocInput(docNameOrPath);

  if (!relativePath) {
    throw new Error('resolveAiContextPath requires a valid AI_CONTEXT doc name or path');
  }

  return path.join(path.resolve(repoRoot), relativePath.split('/').join(path.sep));
}

function mapDomainToPrimaryDocs(domain) {
  return unique(DOMAIN_DOC_MAP[String(domain || '').trim().toLowerCase()] || []);
}

function isAiContextFile(filePath) {
  const normalized = normalizeDocInput(filePath);
  return Boolean(normalized) && getStandardAiContextFiles().includes(normalized);
}

function getDefaultDocTargetsForImpact(impact = {}) {
  if (impact.shouldSkipUpdate === true || impact.hasMeaningfulImpact === false) {
    return [];
  }

  const domains = Array.isArray(impact.domains) ? impact.domains : [];
  const signals = Array.isArray(impact.evidence && impact.evidence.signals) ? impact.evidence.signals : [];
  const targets = [];

  for (const domain of domains) {
    targets.push(...mapDomainToPrimaryDocs(domain));
  }

  if (
    domains.includes('architecture')
    || signals.includes('architecture_boundary_changed')
    || signals.includes('significant_decision_text')
  ) {
    targets.push('AI_CONTEXT/02-ARCHITECTURE.md');
  }

  if (impact.needsAdrUpdate === true) {
    targets.push('AI_CONTEXT/07-DECISIONS-ADR.md');
  }

  if (impact.needsRecentChangesUpdate !== false) {
    targets.push('AI_CONTEXT/08-RECENT-CHANGES.md');
  }

  return unique(targets.filter(isAiContextFile));
}

module.exports = {
  AI_CONTEXT_DIRECTORY,
  DOMAIN_DOC_MAP,
  STANDARD_AI_CONTEXT_DOCS,
  getAiContextDocDefinition,
  getDefaultDocTargetsForImpact,
  getStandardAiContextFiles,
  isAiContextFile,
  mapDomainToPrimaryDocs,
  normalizeDocInput,
  resolveAiContextPath
};
