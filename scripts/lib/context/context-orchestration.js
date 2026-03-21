'use strict';

const fs = require('fs');
const path = require('path');

const { prepareContext } = require('./context-preparer');
const { hydrateWorkingSet } = require('./working-set-manager');

const CONTEXT_RUNTIME_SCHEMA_VERSION = 'ecc.context-runtime.v1';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function resolveContextTask(config = {}) {
  const candidate = config.contextTask || config.taskDescription || config.task || null;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}

function summarizePreparedContext(preparedContext = null) {
  if (!preparedContext || !preparedContext.workingSet) {
    return null;
  }

  return {
    taskContextId: preparedContext.taskContextId || null,
    workingSetId: preparedContext.workingSet.workingSetId || preparedContext.workingSet.id || null,
    basedOnCommit: preparedContext.basedOnCommit || preparedContext.cache && preparedContext.cache.basedOnCommit || 'unknown',
    prepareMode: preparedContext.prepareMode || 'standard',
    analysisMode: preparedContext.analysisMode || 'balanced',
    recommendedDocs: unique(preparedContext.recommendedDocs || []),
    relatedArtifacts: unique([
      ...(preparedContext.artifacts && preparedContext.artifacts.previousTaskContexts ? preparedContext.artifacts.previousTaskContexts : []),
      ...(preparedContext.artifacts && preparedContext.artifacts.previousTaskArtifacts ? preparedContext.artifacts.previousTaskArtifacts : []),
      ...(preparedContext.artifacts && preparedContext.artifacts.previousSessionArtifacts ? preparedContext.artifacts.previousSessionArtifacts : [])
    ]),
    budget: preparedContext.workingSet.budget || preparedContext.allowedExpansion || {},
    allowedExpansion: preparedContext.workingSet.allowedExpansion || preparedContext.allowedExpansion && preparedContext.allowedExpansion.allowedExpansion || {},
    structuredMapsReadiness: preparedContext.structuredMapsReadiness || null,
    extendedReadiness: preparedContext.extendedReadiness || null,
    taskAuditPack: preparedContext.taskAuditPack
      ? {
          taskType: preparedContext.taskAuditPack.taskType,
          affectedScreens: unique(preparedContext.taskAuditPack.affectedScreens || []),
          affectedApis: unique(preparedContext.taskAuditPack.affectedApis || []),
          affectedEntities: unique(preparedContext.taskAuditPack.affectedEntities || []),
          riskLevel: preparedContext.taskAuditPack.riskSummary && preparedContext.taskAuditPack.riskSummary.level || 'medium',
          confidence: preparedContext.taskAuditPack.confidenceSummary && preparedContext.taskAuditPack.confidenceSummary.overall || 'medium',
          artifactId: preparedContext.taskAuditPack.artifactId || null
        }
      : null
  };
}

async function resolvePreparedContextFromConfig(config = {}, options = {}) {
  const repoRoot = path.resolve(config.repoRoot || process.cwd());

  if (config.preparedContext && config.preparedContext.workingSet) {
    return {
      preparedContext: config.preparedContext,
      source: 'inline-prepared-context',
      taskText: resolveContextTask(config)
    };
  }

  if (typeof config.preparedContextPath === 'string' && config.preparedContextPath.length > 0) {
    return {
      preparedContext: readJsonFile(path.resolve(repoRoot, config.preparedContextPath)),
      source: 'prepared-context-path',
      taskText: resolveContextTask(config)
    };
  }

  const taskText = resolveContextTask(config);
  if (taskText) {
    const preparedContext = await prepareContext({
      task: taskText,
      taskId: config.taskContextId || config.contextTaskId || null,
      repoRoot,
      callerMetadata: config.contextMetadata || config.callerMetadata || {}
    }, options);

    return {
      preparedContext,
      source: 'generated-from-context-task',
      taskText
    };
  }

  return {
    preparedContext: null,
    source: null,
    taskText: null
  };
}

async function preparePlanConfigForExecution(config = {}, options = {}) {
  const repoRoot = path.resolve(config.repoRoot || process.cwd());
  const baseConfig = {
    ...config,
    repoRoot
  };
  const resolved = await resolvePreparedContextFromConfig(baseConfig, options);
  const nextConfig = {
    ...baseConfig
  };
  let contextMode = 'legacy';
  let workingSet = null;
  let backwardCompatibilityFallback = false;
  let fallbackReason = null;

  if (resolved.preparedContext && resolved.preparedContext.workingSet) {
    nextConfig.preparedContext = resolved.preparedContext;
    contextMode = 'prepared-context';
    workingSet = resolved.preparedContext.workingSet;
  } else if (baseConfig.workingSet) {
    nextConfig.workingSet = hydrateWorkingSet({
      ...baseConfig.workingSet,
      repoRoot: baseConfig.workingSet.repoRoot || baseConfig.workingSet.repo && baseConfig.workingSet.repo.root || repoRoot
    }, {
      persist: false
    });
    contextMode = 'working-set-only';
    workingSet = nextConfig.workingSet;
    backwardCompatibilityFallback = true;
    fallbackReason = 'working-set-without-prepared-context';
  } else {
    backwardCompatibilityFallback = true;
    fallbackReason = 'legacy-config-without-context';
  }

  const preparedContextSummary = summarizePreparedContext(nextConfig.preparedContext || null);
  nextConfig.contextRuntime = {
    schemaVersion: CONTEXT_RUNTIME_SCHEMA_VERSION,
    commandName: options.commandName || 'orchestrate-worktrees',
    contextMode,
    source: resolved.source || (contextMode === 'working-set-only' ? 'inline-working-set' : 'legacy-config'),
    taskText: resolved.taskText,
    preparedContext: preparedContextSummary,
    workingSetId: preparedContextSummary && preparedContextSummary.workingSetId || workingSet && (workingSet.workingSetId || workingSet.id) || null,
    taskContextId: preparedContextSummary && preparedContextSummary.taskContextId || workingSet && workingSet.taskContextId || null,
    recommendedDocs: preparedContextSummary ? preparedContextSummary.recommendedDocs : unique(workingSet && workingSet.docs || []),
    relatedArtifacts: preparedContextSummary ? preparedContextSummary.relatedArtifacts : unique(workingSet && workingSet.relatedArtifacts || workingSet && workingSet.artifacts || []),
    budget: preparedContextSummary && preparedContextSummary.budget || workingSet && workingSet.budget || null,
    expansionProtocol: {
      requiresRequest: true,
      broadSearchByDefault: false,
      allowedExpansion: preparedContextSummary && preparedContextSummary.allowedExpansion || workingSet && workingSet.allowedExpansion || null
    },
    backwardCompatibilityFallback,
    fallbackReason
  };

  return {
    config: nextConfig,
    contextRuntime: nextConfig.contextRuntime,
    preparedContext: nextConfig.preparedContext || null,
    workingSet
  };
}

module.exports = {
  CONTEXT_RUNTIME_SCHEMA_VERSION,
  preparePlanConfigForExecution,
  readJsonFile,
  resolveContextTask,
  resolvePreparedContextFromConfig,
  summarizePreparedContext
};
