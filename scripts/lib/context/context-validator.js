'use strict';

const path = require('path');

const { indexRepository } = require('./repo-index-service');
const { classifyContextImpact } = require('./context-impact-classifier');
const {
  buildSelectiveSyncSection,
  parseFreshnessMetadata,
  readManagedSection
} = require('./context-freshness');
const {
  normalizeDocInput,
  resolveAiContextPath,
  getAiContextDocDefinition
} = require('./ai-context-files');
const { readFile } = require('../utils');

const CONTEXT_VALIDATE_SCHEMA_VERSION = 'ecc.context-validate.v1';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function buildExpectedTargets(input = {}, impact = {}) {
  const requested = Array.isArray(input.docTargets) && input.docTargets.length > 0 ? input.docTargets : impact.docTargets;
  return unique(requested.map(normalizeDocInput).filter(Boolean));
}

function validateSingleDoc(docPath, input = {}) {
  const normalizedDocPath = normalizeDocInput(docPath);
  const definition = getAiContextDocDefinition(normalizedDocPath);
  const absolutePath = resolveAiContextPath(input.repoRoot, normalizedDocPath);
  const content = readFile(absolutePath);
  const issues = [];

  if (!definition) {
    issues.push('unknown-ai-context-doc');
    return { docPath: normalizedDocPath, valid: false, issues, metadata: null };
  }

  if (content === null) {
    issues.push('doc-missing');
    return { docPath: normalizedDocPath, valid: false, issues, metadata: null };
  }

  const metadata = parseFreshnessMetadata(content);
  if (!metadata) {
    issues.push('missing-freshness-metadata');
  }

  const selectiveSection = buildSelectiveSyncSection(normalizedDocPath, {
    impact: input.impact,
    metadata: metadata || {}
  });
  if (!readManagedSection(content, selectiveSection.heading)) {
    issues.push('missing-selective-sync-section');
  }

  if (metadata) {
    if (metadata.docPath !== normalizedDocPath) {
      issues.push('doc-path-mismatch');
    }

    if (input.expectedBasedOnCommit && metadata.basedOnCommit !== input.expectedBasedOnCommit) {
      issues.push('based-on-commit-mismatch');
    }

    if (input.expectedTaskContextId && metadata.taskContextId !== input.expectedTaskContextId) {
      issues.push('task-context-mismatch');
    }

    if (input.expectedWorkingSetId && metadata.workingSetId !== input.expectedWorkingSetId) {
      issues.push('working-set-mismatch');
    }

    if (Array.isArray(input.changedFiles) && input.changedFiles.length > 0) {
      const intersects = input.changedFiles.some(filePath => Array.isArray(metadata.sourcePaths) && metadata.sourcePaths.includes(filePath));
      if (!intersects) {
        issues.push('source-paths-mismatch');
      }
    }
  }

  return {
    docPath: normalizedDocPath,
    valid: issues.length === 0,
    issues,
    metadata
  };
}

function validateContext(input = {}, options = {}) {
  const repoRoot = path.resolve(input.repoRoot || process.cwd());
  const indexPayload = input.indexPayload || indexRepository(repoRoot, {
    ...options,
    forceRefresh: options.forceRefresh === true,
    persist: options.persist
  });
  const impact = classifyContextImpact({
    ...input,
    repoRoot,
    indexPayload,
    basedOnCommit: input.basedOnCommit || indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit || 'unknown'
  });
  const docTargets = buildExpectedTargets(input, impact);

  if (impact.shouldSkipUpdate === true || docTargets.length === 0) {
    return {
      schemaVersion: CONTEXT_VALIDATE_SCHEMA_VERSION,
      valid: true,
      skipped: true,
      skipReason: impact.skipReason || 'no-doc-targets',
      basedOnCommit: impact.basedOnCommit,
      docTargets,
      impact,
      reports: [],
      issues: []
    };
  }

  const preparedContext = input.preparedContext || {};
  const workingSet = input.workingSet || preparedContext.workingSet || {};
  const reports = docTargets.map(docPath => validateSingleDoc(docPath, {
    repoRoot,
    impact,
    changedFiles: impact.evidence.changedFiles,
    expectedBasedOnCommit: impact.basedOnCommit,
    expectedTaskContextId: input.taskContextId || preparedContext.taskContextId || workingSet.taskContextId || preparedContext.provenance && preparedContext.provenance.taskContextId || null,
    expectedWorkingSetId: input.workingSetId || workingSet.workingSetId || workingSet.id || preparedContext.workingSetId || preparedContext.provenance && preparedContext.provenance.workingSetId || null
  }));
  const issues = reports.flatMap(report => report.issues.map(issue => `${report.docPath}:${issue}`));

  return {
    schemaVersion: CONTEXT_VALIDATE_SCHEMA_VERSION,
    valid: issues.length === 0,
    skipped: false,
    skipReason: null,
    basedOnCommit: impact.basedOnCommit,
    docTargets,
    impact,
    reports,
    issues
  };
}

module.exports = {
  CONTEXT_VALIDATE_SCHEMA_VERSION,
  validateContext,
  validateSingleDoc
};
