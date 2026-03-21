'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { normalizeIntent } = require('./intent-normalizer');
const {
  CONTEXT_PACKAGE_SCHEMA_VERSION,
  normalizeContextPackage,
  validateContextPackage
} = require('./context-package-schema');
const { buildExtendedReadiness, buildTaskAuditPack } = require('./task-audit-pack');
const { refinePreparedContext } = require('./context-preparer-ai');
const { createProjectCacheStore, createTaskRecordId } = require('./project-cache-store');
const { indexRepository } = require('./repo-index-service');
const { buildWorkingSetBudget } = require('./working-set-budget');
const { createWorkingSet } = require('./working-set-manager');
const { STANDARD_AI_CONTEXT_DOCS } = require('./ai-context-files');

const AI_CONTEXT_FILES = STANDARD_AI_CONTEXT_DOCS.reduce((accumulator, doc) => {
  accumulator[doc.key] = doc.path;
  return accumulator;
}, {});

const WORKING_SET_SIZE_BY_BUDGET = {
  small: 8,
  medium: 12,
  large: 16
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function fileExists(repoRoot, relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath.split('/').join(path.sep)));
}

function readAvailableAiContextDocs(repoRoot) {
  return Object.values(AI_CONTEXT_FILES).filter(relativePath => fileExists(repoRoot, relativePath));
}

function resolveSessionRecordingDir(options = {}) {
  if (typeof options.sessionRecordingDir === 'string' && options.sessionRecordingDir.length > 0) {
    return path.resolve(options.sessionRecordingDir);
  }

  if (typeof process.env.ECC_SESSION_RECORDING_DIR === 'string' && process.env.ECC_SESSION_RECORDING_DIR.length > 0) {
    return path.resolve(process.env.ECC_SESSION_RECORDING_DIR);
  }

  return path.join(os.tmpdir(), 'ecc-session-recordings');
}

function listRecentSessionArtifacts(repoRoot, options = {}, limit = 3) {
  const recordingRoot = resolveSessionRecordingDir(options);
  if (!fs.existsSync(recordingRoot)) {
    return [];
  }

  const records = [];
  const adapterDirs = fs.readdirSync(recordingRoot, { withFileTypes: true }).filter(entry => entry.isDirectory());

  for (const adapterDir of adapterDirs) {
    const adapterPath = path.join(recordingRoot, adapterDir.name);
    const files = fs.readdirSync(adapterPath, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.json'));

    for (const entry of files) {
      const fullPath = path.join(adapterPath, entry.name);
      try {
        const payload = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const latest = payload && payload.latest;
        if (!latest || !latest.session || latest.session.repoRoot !== repoRoot) {
          continue;
        }

        const stats = fs.statSync(fullPath);
        records.push({
          id: payload.sessionId || entry.name.replace(/\.json$/u, ''),
          path: fullPath,
          mtimeMs: stats.mtimeMs
        });
      } catch {
        continue;
      }
    }
  }

  return records
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, limit);
}

function buildScopeHypothesis(intent, indexPayload) {
  const domains = intent.expectedDomains.length > 0 ? intent.expectedDomains : [indexPayload.projectProfile.primary || 'repo'];
  return `${intent.intentType}:${domains.join('+')}`;
}

function extractMentionedPaths(taskText, indexPayload) {
  const loweredTask = String(taskText || '').toLowerCase();
  return indexPayload.fingerprints.files
    .map(file => file.path)
    .filter(filePath => loweredTask.includes(filePath.toLowerCase()))
    .slice(0, 10);
}

function collectModuleFiles(indexPayload, area) {
  const match = indexPayload.modules.areas.find(entry => entry.area === area);
  return match ? match.files : [];
}

function buildWorkingSetReasons(intent, taskText, workingSetFiles, indexPayload, callerMetadata = {}) {
  const selectedFiles = new Set(Array.isArray(callerMetadata.selectedFiles) ? callerMetadata.selectedFiles : []);
  const mentionedPaths = new Set(extractMentionedPaths(taskText, indexPayload));

  return workingSetFiles.map(filePath => {
    if (selectedFiles.has(filePath)) {
      return { path: filePath, reason: 'selected_file' };
    }

    if (mentionedPaths.has(filePath)) {
      return { path: filePath, reason: 'mentioned_in_task' };
    }

    if (intent.expectedDomains.includes('api') && indexPayload.routes.routes.some(route => route.path === filePath)) {
      return { path: filePath, reason: 'scope_hypothesis_api' };
    }

    if (intent.expectedDomains.includes('data') && (indexPayload.dbMap.prismaFiles.includes(filePath) || indexPayload.dbMap.modelFiles.includes(filePath))) {
      return { path: filePath, reason: 'scope_hypothesis_data' };
    }

    return { path: filePath, reason: 'scope_hypothesis' };
  });
}

function resolveWorkingSetFiles(intent, taskText, indexPayload, callerMetadata = {}) {
  const candidates = [];
  const pushMany = values => {
    for (const value of values || []) {
      if (typeof value === 'string' && value.length > 0) {
        candidates.push(value);
      }
    }
  };

  pushMany(Array.isArray(callerMetadata.selectedFiles) ? callerMetadata.selectedFiles : []);
  pushMany(extractMentionedPaths(taskText, indexPayload));

  if (intent.expectedDomains.includes('api') || intent.expectedDomains.includes('backend')) {
    pushMany(indexPayload.routes.routes.map(route => route.path));
    pushMany(collectModuleFiles(indexPayload, 'backend'));
  }

  if (intent.expectedDomains.includes('data')) {
    pushMany(indexPayload.dbMap.prismaFiles);
    pushMany(indexPayload.dbMap.modelFiles);
  }

  if (intent.expectedDomains.includes('frontend')) {
    pushMany(collectModuleFiles(indexPayload, 'frontend'));
  }

  if (intent.expectedDomains.includes('docs')) {
    pushMany(readAvailableAiContextDocs(indexPayload.repoMeta.repoRoot));
  }

  if (candidates.length === 0) {
    pushMany(indexPayload.routes.routes.map(route => route.path));
    pushMany(collectModuleFiles(indexPayload, 'backend'));
    pushMany(collectModuleFiles(indexPayload, 'frontend'));
  }

  const limit = buildAllowedExpansion(intent).initialFilesMax;
  return unique(candidates).slice(0, limit);
}

function buildAllowedExpansion(intent) {
  return buildWorkingSetBudget(intent);
}

function buildConfidence(intent, workingSetFiles, recommendedDocs, indexPayload) {
  let confidence = 0.45;

  if (recommendedDocs.includes(AI_CONTEXT_FILES.start)) {
    confidence += 0.15;
  }

  if (workingSetFiles.length > 0) {
    confidence += 0.15;
  }

  if (intent.ambiguity === 'low') {
    confidence += 0.1;
  }

  if (intent.ambiguity === 'high') {
    confidence -= 0.1;
  }

  if (indexPayload.cacheHit) {
    confidence += 0.05;
  }

  if (intent.likelyScope === 'broad') {
    confidence -= 0.05;
  }

  return Math.max(0.05, Math.min(0.95, Number(confidence.toFixed(2))));
}

async function prepareContext(input = {}, options = {}) {
  const repoRoot = input.repoRoot || process.cwd();
  const store = createProjectCacheStore(repoRoot, options);
  const prepareMode = options.prepareMode || 'standard';
  const analysisMode = options.analysisMode || options.mode || 'balanced';
  const indexPayload = input.indexPayload || indexRepository(repoRoot, {
    ...options,
    mode: analysisMode,
    forceRefresh: options.forceRefresh === true
  });
  const intent = normalizeIntent(input.task, {
    callerMetadata: input.callerMetadata,
    repoIdentity: {
      repoRoot: store.repoRoot,
      repoSlug: store.repoSlug
    }
  });
  const recommendedDocs = resolveRecommendedDocs(intent, store.repoRoot);
  const workingSetFiles = resolveWorkingSetFiles(intent, input.task, indexPayload, input.callerMetadata);
  const previousTaskContexts = store.listTaskContexts(3);
  const previousTaskArtifacts = store.listTaskArtifacts(3);
  const previousSessionArtifacts = listRecentSessionArtifacts(store.repoRoot, options, 3);
  const relatedArtifacts = unique([
    ...previousTaskContexts.map(record => record.id),
    ...previousTaskArtifacts.map(record => record.id),
    ...previousSessionArtifacts.map(record => record.id)
  ]);
  const initialBudget = buildAllowedExpansion(intent);
  const scopeHypothesis = buildScopeHypothesis(intent, indexPayload);
  const taskContextId = input.taskId || createTaskRecordId('task-context', `${store.repoSlug}:${scopeHypothesis}:${input.task || 'task'}`);
  const basedOnCommit = indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit ? indexPayload.repoMeta.basedOnCommit : 'unknown';
  const createdAt = new Date().toISOString();
  const workingSet = createWorkingSet({
    repoRoot: store.repoRoot,
    intent,
    scopeHypothesis,
    files: workingSetFiles,
    docs: recommendedDocs,
    relatedArtifacts,
    reasons: buildWorkingSetReasons(intent, input.task, workingSetFiles, indexPayload, input.callerMetadata),
    budget: initialBudget,
    taskContextId,
    basedOnCommit,
    createdAt,
    taskMetadata: {
      taskContextId,
      taskId: input.taskId || null,
      taskText: input.task,
      callerMetadata: input.callerMetadata || {}
    }
  }, {
    store,
    persist: options.persist
  });
  const confidence = buildConfidence(intent, workingSet.files, recommendedDocs, indexPayload);
  const prepared = normalizeContextPackage({
    schemaVersion: CONTEXT_PACKAGE_SCHEMA_VERSION,
    taskContextId,
    workingSetId: workingSet.workingSetId || workingSet.id,
    repoSlug: store.repoSlug,
    basedOnCommit,
    createdAt,
    updatedAt: createdAt,
    repo: {
      root: store.repoRoot,
      slug: store.repoSlug,
      cacheDir: store.cacheDir
    },
    intentType: intent.intentType,
    riskLevel: intent.riskLevel,
    expectedDomains: intent.expectedDomains,
    requiresWrite: intent.requiresWrite,
    likelyScope: intent.likelyScope,
    ambiguity: intent.ambiguity,
    initialBudgetClass: intent.initialBudgetClass,
    scopeHypothesis,
    recommendedDocs,
    workingSet,
    allowedExpansion: workingSet.budget,
    confidence,
    needsDiscovery: workingSet.files.length === 0 || confidence < 0.6 || intent.ambiguity === 'high',
    cache: {
      hit: Boolean(indexPayload.cacheHit),
      indexVersion: indexPayload.repoMeta.indexVersion,
      basedOnCommit: indexPayload.repoMeta.basedOnCommit,
      lastIndexedAt: indexPayload.repoMeta.generatedAt
    },
    provenance: {
      taskContextId,
      workingSetId: workingSet.workingSetId || workingSet.id,
      repoSlug: store.repoSlug,
      basedOnCommit,
      createdAt,
      updatedAt: createdAt
    },
    artifacts: {
      previousTaskContexts: previousTaskContexts.map(record => record.id),
      previousTaskArtifacts: unique([
        ...previousTaskArtifacts.map(record => record.id),
        workingSet.workingSetId || workingSet.id
      ]),
      previousSessionArtifacts: previousSessionArtifacts.map(record => record.id)
    }
  });

  if (prepareMode === 'task-focused' && indexPayload.structuredMaps) {
    const taskAuditPack = buildTaskAuditPack({
      rawTask: input.task,
      intent,
      preparedContext: prepared,
      structuredMaps: indexPayload.structuredMaps,
      indexPayload
    });
    const artifactRecord = options.persist !== false
      ? store.writeTaskArtifact({
          ...taskAuditPack,
          kind: 'task-audit-pack',
          taskContextId,
          workingSetId: workingSet.workingSetId || workingSet.id,
          repoSlug: store.repoSlug,
          basedOnCommit,
          prepareMode
        }, createTaskRecordId('task-audit-pack', `${store.repoSlug}:${scopeHypothesis}:${input.task || 'task'}`))
      : null;
    const taskAuditPackWithArtifact = {
      ...taskAuditPack,
      artifactId: artifactRecord ? artifactRecord.id : null
    };
    prepared.taskAuditPack = taskAuditPackWithArtifact;
    prepared.extendedReadiness = buildExtendedReadiness(prepared, indexPayload.structuredMaps, taskAuditPackWithArtifact);
  }

  prepared.prepareMode = prepareMode;
  prepared.analysisMode = analysisMode;
  prepared.structuredMapsReadiness = indexPayload.structuredMaps && indexPayload.structuredMaps.readiness
    ? indexPayload.structuredMaps.readiness
    : null;

  const refined = refinePreparedContext(prepared, options.aiFallback || {});
  const validatedContextPackage = validateContextPackage(refined.contextPackage);

  if (options.persist !== false) {
    store.writeTaskContext(validatedContextPackage, taskContextId);
  }

  return validatedContextPackage;
}

function resolveRecommendedDocs(intent, repoRoot) {
  const availableDocs = readAvailableAiContextDocs(repoRoot);
  const docs = [];
  const pushIfAvailable = fileName => {
    if (availableDocs.includes(fileName)) {
      docs.push(fileName);
    }
  };

  pushIfAvailable(AI_CONTEXT_FILES.start);

  if (intent.likelyScope === 'broad' || intent.riskLevel === 'high' || intent.intentType === 'audit') {
    pushIfAvailable(AI_CONTEXT_FILES.overview);
    pushIfAvailable(AI_CONTEXT_FILES.architecture);
  }

  if (intent.expectedDomains.includes('backend')) {
    pushIfAvailable(AI_CONTEXT_FILES.backend);
  }

  if (intent.expectedDomains.includes('frontend')) {
    pushIfAvailable(AI_CONTEXT_FILES.frontend);
  }

  if (intent.expectedDomains.includes('data')) {
    pushIfAvailable(AI_CONTEXT_FILES.data);
  }

  if (intent.expectedDomains.includes('api')) {
    pushIfAvailable(AI_CONTEXT_FILES.api);
  }

  if (intent.intentType === 'audit' || intent.intentType === 'research') {
    pushIfAvailable(AI_CONTEXT_FILES.recent);
    pushIfAvailable(AI_CONTEXT_FILES.issues);
  }

  return unique(docs);
}

module.exports = {
  AI_CONTEXT_FILES,
  WORKING_SET_SIZE_BY_BUDGET,
  buildAllowedExpansion,
  buildConfidence,
  buildScopeHypothesis,
  extractMentionedPaths,
  prepareContext,
  readAvailableAiContextDocs,
  listRecentSessionArtifacts,
  resolveRecommendedDocs,
  resolveSessionRecordingDir,
  buildWorkingSetReasons,
  resolveWorkingSetFiles
};
