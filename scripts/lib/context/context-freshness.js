'use strict';

const {
  getAiContextDocDefinition,
  normalizeDocInput
} = require('./ai-context-files');

const CONTEXT_FRESHNESS_SCHEMA_VERSION = 'ecc.context-freshness.v1';
const FRESHNESS_SECTION_HEADING = '## Context Freshness';
const SELECTIVE_SYNC_SECTION_HEADING = '## Selective Sync';
const RECENT_CHANGES_SECTION_HEADING = '## Latest Selective Update';
const ADR_SECTION_HEADING = '## Pending ADR Follow-up';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function serializeJsonBlock(value) {
  return ['```json', JSON.stringify(value, null, 2), '```'].join('\n');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function readManagedSection(content = '', heading = '') {
  const pattern = new RegExp(`(^|\\n)${escapeRegExp(heading)}\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'u');
  const match = String(content).match(pattern);
  if (!match) {
    return null;
  }

  return {
    body: match[2].trim(),
    fullMatch: match[0]
  };
}

function upsertManagedSection(content = '', heading = '', body = '') {
  const normalizedContent = String(content || '').trimEnd();
  const section = `${heading}\n${String(body || '').trim()}\n`;
  const pattern = new RegExp(`(^|\\n)${escapeRegExp(heading)}\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'u');

  if (pattern.test(normalizedContent)) {
    return normalizedContent.replace(pattern, `$1${section}`).trimEnd() + '\n';
  }

  if (normalizedContent.length === 0) {
    return `${section}`;
  }

  return `${normalizedContent}\n\n${section}`;
}

function buildContextFreshnessMetadata(input = {}) {
  const normalizedDocPath = normalizeDocInput(input.docPath);
  const docDefinition = getAiContextDocDefinition(normalizedDocPath);
  const impact = input.impact || {};
  const workingSet = input.workingSet || input.preparedContext && input.preparedContext.workingSet || {};
  const provenance = input.provenance || input.preparedContext && input.preparedContext.provenance || {};
  const updatedAt = input.updatedAt || new Date().toISOString();

  return {
    schemaVersion: CONTEXT_FRESHNESS_SCHEMA_VERSION,
    docPath: docDefinition ? docDefinition.path : normalizedDocPath,
    docName: docDefinition ? docDefinition.name : normalizedDocPath,
    repoSlug: input.repoSlug || input.preparedContext && input.preparedContext.repoSlug || workingSet.repoSlug || provenance.repoSlug || null,
    basedOnCommit: input.basedOnCommit || input.preparedContext && input.preparedContext.basedOnCommit || workingSet.basedOnCommit || provenance.basedOnCommit || 'unknown',
    taskContextId: input.taskContextId || input.preparedContext && input.preparedContext.taskContextId || workingSet.taskContextId || provenance.taskContextId || null,
    workingSetId: input.workingSetId || workingSet.workingSetId || workingSet.id || provenance.workingSetId || null,
    updatedAt,
    impactLevel: impact.impactLevel || 'low',
    domains: unique(impact.domains || []),
    sourcePaths: unique(input.sourcePaths || impact.evidence && impact.evidence.changedFiles || []),
    signals: unique(input.signals || impact.evidence && impact.evidence.signals || []),
    docTargets: unique(impact.docTargets || []),
    generatedBy: 'context-updater'
  };
}

function buildSelectiveSyncSection(docPath, input = {}) {
  const impact = input.impact || {};
  const metadata = input.metadata || buildContextFreshnessMetadata({ ...input, docPath });
  const heading = normalizeDocInput(docPath) === 'AI_CONTEXT/08-RECENT-CHANGES.md'
    ? RECENT_CHANGES_SECTION_HEADING
    : normalizeDocInput(docPath) === 'AI_CONTEXT/07-DECISIONS-ADR.md'
      ? ADR_SECTION_HEADING
      : SELECTIVE_SYNC_SECTION_HEADING;
  const lines = [
    `- Updated at: \`${metadata.updatedAt}\``,
    `- Based on commit: \`${metadata.basedOnCommit}\``,
    `- Impact level: \`${impact.impactLevel || metadata.impactLevel}\``
  ];

  if (metadata.domains.length > 0) {
    lines.push(`- Domains: ${metadata.domains.map(domain => `\`${domain}\``).join(', ')}`);
  }

  if (metadata.sourcePaths.length > 0) {
    lines.push('- Source paths:');
    lines.push(...metadata.sourcePaths.slice(0, 10).map(filePath => `  - \`${filePath}\``));
  }

  if (metadata.signals.length > 0) {
    lines.push(`- Signals: ${metadata.signals.map(signal => `\`${signal}\``).join(', ')}`);
  }

  if (normalizeDocInput(docPath) === 'AI_CONTEXT/07-DECISIONS-ADR.md') {
    lines.push('- Review status: manual ADR review recommended for this change set.');
  }

  return {
    body: lines.join('\n'),
    heading
  };
}

function parseFreshnessMetadata(content = '') {
  const section = readManagedSection(content, FRESHNESS_SECTION_HEADING);
  if (!section) {
    return null;
  }

  const match = section.body.match(/```json\n([\s\S]*?)\n```/u);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

module.exports = {
  ADR_SECTION_HEADING,
  CONTEXT_FRESHNESS_SCHEMA_VERSION,
  FRESHNESS_SECTION_HEADING,
  RECENT_CHANGES_SECTION_HEADING,
  SELECTIVE_SYNC_SECTION_HEADING,
  buildContextFreshnessMetadata,
  buildSelectiveSyncSection,
  parseFreshnessMetadata,
  readManagedSection,
  serializeJsonBlock,
  upsertManagedSection
};
