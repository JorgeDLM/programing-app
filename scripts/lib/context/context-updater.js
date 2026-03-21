'use strict';

const path = require('path');

const { createProjectCacheStore, createTaskRecordId } = require('./project-cache-store');
const { indexRepository } = require('./repo-index-service');
const { classifyContextImpact } = require('./context-impact-classifier');
const {
  FRESHNESS_SECTION_HEADING,
  buildContextFreshnessMetadata,
  buildSelectiveSyncSection,
  serializeJsonBlock,
  upsertManagedSection
} = require('./context-freshness');
const {
  getAiContextDocDefinition,
  normalizeDocInput,
  resolveAiContextPath
} = require('./ai-context-files');
const { readFile, writeFile } = require('../utils');

const CONTEXT_UPDATE_SCHEMA_VERSION = 'ecc.context-update.v1';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function deriveCorrelation(input = {}, impact = {}) {
  const preparedContext = input.preparedContext || {};
  const workingSet = input.workingSet || preparedContext.workingSet || {};

  return {
    basedOnCommit: input.basedOnCommit || impact.basedOnCommit || preparedContext.basedOnCommit || workingSet.basedOnCommit || 'unknown',
    repoSlug: input.repoSlug || preparedContext.repoSlug || workingSet.repoSlug || preparedContext.repo && preparedContext.repo.slug || null,
    taskContextId: input.taskContextId || preparedContext.taskContextId || workingSet.taskContextId || preparedContext.provenance && preparedContext.provenance.taskContextId || null,
    workingSetId: input.workingSetId || workingSet.workingSetId || workingSet.id || preparedContext.workingSetId || preparedContext.provenance && preparedContext.provenance.workingSetId || null
  };
}

function buildInitialDocContent(docPath) {
  const definition = getAiContextDocDefinition(docPath);
  const title = definition ? definition.title : path.basename(String(docPath || ''), '.md');
  return `# ${title}\n`;
}

function applySelectiveUpdate(docPath, input = {}) {
  const absolutePath = resolveAiContextPath(input.repoRoot, docPath);
  const existingContent = readFile(absolutePath);
  const baseContent = existingContent === null ? buildInitialDocContent(docPath) : existingContent;
  const metadata = buildContextFreshnessMetadata({
    ...input,
    docPath,
    updatedAt: input.updatedAt
  });
  const freshnessBody = serializeJsonBlock(metadata);
  const withFreshness = upsertManagedSection(baseContent, FRESHNESS_SECTION_HEADING, freshnessBody);
  const selectiveSection = buildSelectiveSyncSection(docPath, {
    impact: input.impact,
    metadata
  });
  const nextContent = upsertManagedSection(withFreshness, selectiveSection.heading, selectiveSection.body);

  if (input.persist !== false) {
    writeFile(absolutePath, nextContent);
  }

  return {
    created: existingContent === null,
    docPath: normalizeDocInput(docPath),
    metadata,
    updated: nextContent !== baseContent
  };
}

function updateContext(input = {}, options = {}) {
  const repoRoot = path.resolve(input.repoRoot || process.cwd());
  const store = createProjectCacheStore(repoRoot, options);
  const indexPayload = input.indexPayload || indexRepository(repoRoot, {
    ...options,
    forceRefresh: options.forceRefresh === true
  });
  const impact = classifyContextImpact({
    ...input,
    repoRoot,
    indexPayload,
    basedOnCommit: input.basedOnCommit || indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit || 'unknown'
  });
  const correlation = deriveCorrelation(input, impact);
  const requestedTargets = Array.isArray(input.docTargets) && input.docTargets.length > 0 ? input.docTargets : impact.docTargets;
  const docTargets = unique(requestedTargets.map(normalizeDocInput).filter(Boolean));
  const updatedAt = new Date().toISOString();

  if (impact.shouldSkipUpdate === true || docTargets.length === 0) {
    return {
      schemaVersion: CONTEXT_UPDATE_SCHEMA_VERSION,
      updated: false,
      skipped: true,
      skipReason: impact.skipReason || 'no-doc-targets',
      basedOnCommit: correlation.basedOnCommit,
      docTargets,
      impact,
      updateLogId: null
    };
  }

  const docUpdates = docTargets.map(docPath => applySelectiveUpdate(docPath, {
    ...input,
    ...correlation,
    impact,
    persist: options.persist,
    repoRoot,
    updatedAt
  }));
  const updateLogId = createTaskRecordId('ai-context-update', `${store.repoSlug}:${correlation.basedOnCommit}:${docTargets.join(',')}`);
  const result = {
    schemaVersion: CONTEXT_UPDATE_SCHEMA_VERSION,
    updated: true,
    skipped: false,
    skipReason: null,
    basedOnCommit: correlation.basedOnCommit,
    repoSlug: correlation.repoSlug || store.repoSlug,
    taskContextId: correlation.taskContextId,
    workingSetId: correlation.workingSetId,
    updateLogId,
    updatedAt,
    docTargets,
    impact,
    docUpdates
  };

  if (options.persist !== false) {
    store.writeTaskArtifact({
      schemaVersion: CONTEXT_UPDATE_SCHEMA_VERSION,
      kind: 'ai-context-update',
      updateLogId,
      basedOnCommit: correlation.basedOnCommit,
      createdAt: updatedAt,
      updatedAt,
      repoSlug: correlation.repoSlug || store.repoSlug,
      taskContextId: correlation.taskContextId,
      workingSetId: correlation.workingSetId,
      docTargets,
      impact,
      docUpdates
    }, updateLogId);
  }

  return result;
}

module.exports = {
  CONTEXT_UPDATE_SCHEMA_VERSION,
  applySelectiveUpdate,
  updateContext
};
