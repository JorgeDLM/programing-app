'use strict';

const fs = require('fs');
const path = require('path');

const { getStandardAiContextFiles, resolveAiContextPath } = require('./ai-context-files');
const { seedAiContext } = require('./ai-context-seeder-v2');
const { getRepoSlug } = require('./cache-paths');
const { createProjectCacheStore } = require('./project-cache-store');
const { CACHE_FILE_NAMES, indexRepository, readCachedIndex } = require('./repo-index-service');
const { collectRepoFingerprints, resolveGitCommit } = require('./repo-fingerprint');

const REPO_MAPPING_SCHEMA_VERSION = 'ecc.repo-mapping.v1';
const REPO_MAPPING_STEPS = Object.freeze([
  'resolve_repo',
  'fingerprint_repo',
  'build_cache',
  'seed_ai_context',
  'validate_mapping',
  'finalize_status'
]);

function resolveRepo(repoRoot, options = {}) {
  const store = createProjectCacheStore(repoRoot, options);
  const aiContextDir = path.join(store.repoRoot, 'AI_CONTEXT');
  const hasGit = fs.existsSync(path.join(store.repoRoot, '.git'));
  const basedOnCommit = resolveGitCommit(store.repoRoot) || 'unknown';
  const cachedIndex = readCachedIndex(store);

  return {
    schemaVersion: `${REPO_MAPPING_SCHEMA_VERSION}.resolve-repo`,
    step: 'resolve_repo',
    repoRoot: store.repoRoot,
    repoSlug: store.repoSlug,
    cacheDir: store.cacheDir,
    taskContextDir: store.taskContextDir,
    taskArtifactsDir: store.taskArtifactsDir,
    aiContextDir,
    aiContextExists: fs.existsSync(aiContextDir),
    hasGit,
    basedOnCommit,
    cachedIndexAvailable: Boolean(cachedIndex),
    cachedCommit: cachedIndex && cachedIndex.repoMeta ? cachedIndex.repoMeta.basedOnCommit || 'unknown' : null,
    cacheFilesPresent: Object.values(CACHE_FILE_NAMES).filter(fileName => fs.existsSync(path.join(store.cacheDir, fileName)))
  };
}

function fingerprintRepo(repoRoot, options = {}) {
  const store = createProjectCacheStore(repoRoot, options);
  const fingerprints = collectRepoFingerprints(store.repoRoot, options);

  return {
    schemaVersion: `${REPO_MAPPING_SCHEMA_VERSION}.fingerprint-repo`,
    step: 'fingerprint_repo',
    repoRoot: store.repoRoot,
    repoSlug: store.repoSlug,
    basedOnCommit: fingerprints.basedOnCommit || 'unknown',
    aggregateHash: fingerprints.aggregateHash,
    fileCount: fingerprints.fileCount,
    sampleFiles: fingerprints.files.slice(0, 20).map(file => file.path)
  };
}

function buildCache(repoRoot, options = {}) {
  const store = createProjectCacheStore(repoRoot, options);
  const indexPayload = indexRepository(store.repoRoot, {
    ...options,
    persist: options.persist !== false,
    forceRefresh: options.forceRefresh === true || options.forceRemap === true
  });

  return {
    schemaVersion: `${REPO_MAPPING_SCHEMA_VERSION}.build-cache`,
    step: 'build_cache',
    repoRoot: store.repoRoot,
    repoSlug: store.repoSlug,
    cacheDir: store.cacheDir,
    cacheHit: Boolean(indexPayload.cacheHit),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit ? indexPayload.repoMeta.basedOnCommit : 'unknown',
    cacheFiles: Object.values(CACHE_FILE_NAMES).map(fileName => ({
      fileName,
      path: path.join(store.cacheDir, fileName),
      exists: fs.existsSync(path.join(store.cacheDir, fileName))
    })),
    indexPayload
  };
}

function seedAiContextStep(repoRoot, input = {}, options = {}) {
  const store = createProjectCacheStore(repoRoot, options);
  const indexPayload = input.indexPayload || indexRepository(store.repoRoot, {
    ...options,
    persist: options.persist !== false,
    forceRefresh: false
  });
  const seedResult = seedAiContext(store.repoRoot, indexPayload, options);

  return {
    schemaVersion: `${REPO_MAPPING_SCHEMA_VERSION}.seed-ai-context`,
    repoRoot: store.repoRoot,
    repoSlug: store.repoSlug,
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit ? indexPayload.repoMeta.basedOnCommit : 'unknown',
    indexPayload,
    ...seedResult
  };
}

function validateMapping(repoRoot, input = {}, options = {}) {
  const store = createProjectCacheStore(repoRoot, options);
  const indexPayload = input.indexPayload || indexRepository(store.repoRoot, {
    ...options,
    persist: options.persist !== false,
    forceRefresh: false
  });
  const cacheReports = Object.values(CACHE_FILE_NAMES).map(fileName => {
    const filePath = path.join(store.cacheDir, fileName);
    return {
      type: 'cache-file',
      id: fileName,
      path: filePath,
      exists: fs.existsSync(filePath)
    };
  });
  const aiContextDir = path.join(store.repoRoot, 'AI_CONTEXT');
  const shouldValidateAiContext = options.createAiContextIfMissing === true || fs.existsSync(aiContextDir);
  const aiContextReports = shouldValidateAiContext
    ? getStandardAiContextFiles().map(docPath => {
        const absolutePath = resolveAiContextPath(store.repoRoot, docPath);
        const exists = fs.existsSync(absolutePath);
        const content = exists ? fs.readFileSync(absolutePath, 'utf8').trim() : '';
        return {
          type: 'ai-context-doc',
          id: docPath,
          path: absolutePath,
          exists,
          nonEmpty: content.length > 0,
          hasSeedMetadata: content.includes('## Mapping Metadata')
        };
      })
    : [];
  const issues = [];
  const warnings = [];
  const analysis = indexPayload.analysis || {};
  const critic = analysis.critic || { overall: null, globalIssues: [], globalWarnings: [], docEvaluations: [] };

  for (const report of cacheReports) {
    if (!report.exists) {
      issues.push(`missing-cache-file:${report.id}`);
    }
  }

  for (const report of aiContextReports) {
    if (!report.exists) {
      issues.push(`missing-ai-context-doc:${report.id}`);
    } else if (!report.nonEmpty) {
      issues.push(`empty-ai-context-doc:${report.id}`);
    } else if (!report.hasSeedMetadata) {
      warnings.push(`ai-context-doc-missing-seed-metadata:${report.id}`);
    }
  }

  for (const issue of critic.globalIssues || []) {
    issues.push(`critic:${issue.kind}`);
  }

  for (const warning of critic.globalWarnings || []) {
    warnings.push(`critic:${warning.kind}`);
  }

  for (const docEvaluation of critic.docEvaluations || []) {
    if (docEvaluation.decision === 'needs_review') {
      issues.push(`doc-needs-review:${docEvaluation.docPath}`);
    } else if (docEvaluation.decision === 'partial' || docEvaluation.decision === 'needs_enrichment') {
      warnings.push(`doc-${docEvaluation.decision}:${docEvaluation.docPath}`);
    }
  }

  return {
    schemaVersion: `${REPO_MAPPING_SCHEMA_VERSION}.validate-mapping`,
    step: 'validate_mapping',
    repoRoot: store.repoRoot,
    repoSlug: store.repoSlug,
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit ? indexPayload.repoMeta.basedOnCommit : 'unknown',
    valid: issues.length === 0,
    warnings,
    issues,
    readiness: critic.overall ? critic.overall.decision : 'needs_review',
    critic: critic.overall ? critic : null,
    cacheReports,
    aiContextReports,
    shouldValidateAiContext
  };
}

function finalizeMappingStatus(repoRoot, input = {}, options = {}) {
  const store = createProjectCacheStore(repoRoot, options);
  const validation = input.validation || validateMapping(store.repoRoot, input, options);
  const warnings = []
    .concat(Array.isArray(input.warnings) ? input.warnings : [])
    .concat(Array.isArray(validation.warnings) ? validation.warnings : []);
  const issues = Array.isArray(validation.issues) ? validation.issues : [];
  const status = issues.length > 0
    ? 'error'
    : warnings.length > 0
      ? 'mapped_with_warnings'
      : 'mapped';

  return {
    schemaVersion: `${REPO_MAPPING_SCHEMA_VERSION}.finalize-status`,
    step: 'finalize_status',
    repoRoot: store.repoRoot,
    repoSlug: store.repoSlug,
    basedOnCommit: validation.basedOnCommit || resolveGitCommit(store.repoRoot) || 'unknown',
    status,
    warnings,
    issues,
    valid: issues.length === 0
  };
}

function runRepoMappingStep(step, input = {}, options = {}) {
  const repoRoot = input.repoRoot || options.repoRoot || process.cwd();

  if (!REPO_MAPPING_STEPS.includes(step)) {
    throw new Error(`Unsupported repo mapping step: ${step}`);
  }

  if (step === 'resolve_repo') {
    return resolveRepo(repoRoot, options);
  }

  if (step === 'fingerprint_repo') {
    return fingerprintRepo(repoRoot, options);
  }

  if (step === 'build_cache') {
    return buildCache(repoRoot, options);
  }

  if (step === 'seed_ai_context') {
    return seedAiContextStep(repoRoot, input, options);
  }

  if (step === 'validate_mapping') {
    return validateMapping(repoRoot, input, options);
  }

  return finalizeMappingStatus(repoRoot, input, options);
}

module.exports = {
  CACHE_FILE_NAMES,
  REPO_MAPPING_SCHEMA_VERSION,
  REPO_MAPPING_STEPS,
  buildCache,
  finalizeMappingStatus,
  fingerprintRepo,
  getRepoSlug,
  resolveRepo,
  runRepoMappingStep,
  seedAiContextStep,
  validateMapping
};
