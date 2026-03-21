'use strict';

const { detectProjectType } = require('../project-detect');
const { createProjectCacheStore } = require('./project-cache-store');
const { collectRepoFingerprints, resolveGitCommit } = require('./repo-fingerprint');
const { buildAiContextAnalysis } = require('./ai-context-analysis-v2');
const { buildStructuredMaps } = require('./structured-maps');
const {
  buildApiMap,
  buildDbMap,
  buildModulesMap,
  buildRoutesMap,
  buildSymbolsMap,
  buildTreeSummary
} = require('./repo-map-builders');

const REPO_INDEX_SCHEMA_VERSION = 'ecc.repo-index.v1';
const CACHE_FILE_NAMES = {
  repoMeta: 'repo-meta.json',
  fingerprints: 'fingerprints.json',
  projectProfile: 'project-profile.json',
  treeSummary: 'tree-summary.json',
  modules: 'modules.json',
  routes: 'routes.json',
  apiMap: 'api-map.json',
  dbMap: 'db-map.json',
  symbols: 'symbols.json',
  analysis: 'analysis.json',
  structuredMaps: 'structured-maps.json'
};

function readCachedIndex(store) {
  const repoMeta = store.readJson(CACHE_FILE_NAMES.repoMeta, null);
  const fingerprints = store.readJson(CACHE_FILE_NAMES.fingerprints, null);
  const projectProfile = store.readJson(CACHE_FILE_NAMES.projectProfile, null);
  const treeSummary = store.readJson(CACHE_FILE_NAMES.treeSummary, null);
  const modules = store.readJson(CACHE_FILE_NAMES.modules, null);
  const routes = store.readJson(CACHE_FILE_NAMES.routes, null);
  const apiMap = store.readJson(CACHE_FILE_NAMES.apiMap, null);
  const dbMap = store.readJson(CACHE_FILE_NAMES.dbMap, null);
  const symbols = store.readJson(CACHE_FILE_NAMES.symbols, null);
  const analysis = store.readJson(CACHE_FILE_NAMES.analysis, null);
  const structuredMaps = store.readJson(CACHE_FILE_NAMES.structuredMaps, null);

  if (!repoMeta || !fingerprints || !projectProfile || !treeSummary || !modules || !routes || !apiMap || !dbMap || !symbols || !analysis || !structuredMaps) {
    return null;
  }

  return {
    repoMeta,
    fingerprints,
    projectProfile,
    treeSummary,
    modules,
    routes,
    apiMap,
    dbMap,
    symbols,
    analysis,
    structuredMaps,
    cacheHit: true
  };
}

function isCacheFresh(repoRoot, cachedIndex, options = {}) {
  if (!cachedIndex || !cachedIndex.repoMeta) {
    return false;
  }

  const requestedMode = options.mode || 'balanced';
  const cachedMode = cachedIndex.analysis && cachedIndex.analysis.mode ? cachedIndex.analysis.mode : 'balanced';
  if (requestedMode !== cachedMode) {
    return false;
  }

  const currentCommit = resolveGitCommit(repoRoot);
  if (!currentCommit) {
    return true;
  }

  return currentCommit === cachedIndex.repoMeta.basedOnCommit;
}

function buildProjectProfile(repoRoot) {
  const detected = detectProjectType(repoRoot);

  return {
    schemaVersion: 'ecc.project-profile.v1',
    generatedAt: new Date().toISOString(),
    repoRoot,
    languages: detected.languages,
    frameworks: detected.frameworks,
    primary: detected.primary,
    projectDir: detected.projectDir
  };
}

function buildRepoMeta(store, repoRoot, fingerprints, projectProfile) {
  return {
    schemaVersion: 'ecc.repo-meta.v1',
    generatedAt: new Date().toISOString(),
    indexVersion: REPO_INDEX_SCHEMA_VERSION,
    repoRoot,
    repoSlug: store.repoSlug,
    cacheDir: store.cacheDir,
    basedOnCommit: fingerprints.basedOnCommit,
    aggregateHash: fingerprints.aggregateHash,
    fileCount: fingerprints.fileCount,
    primary: projectProfile.primary
  };
}

function persistIndex(store, payload) {
  store.writeJson(CACHE_FILE_NAMES.repoMeta, payload.repoMeta);
  store.writeJson(CACHE_FILE_NAMES.fingerprints, payload.fingerprints);
  store.writeJson(CACHE_FILE_NAMES.projectProfile, payload.projectProfile);
  store.writeJson(CACHE_FILE_NAMES.treeSummary, payload.treeSummary);
  store.writeJson(CACHE_FILE_NAMES.modules, payload.modules);
  store.writeJson(CACHE_FILE_NAMES.routes, payload.routes);
  store.writeJson(CACHE_FILE_NAMES.apiMap, payload.apiMap);
  store.writeJson(CACHE_FILE_NAMES.dbMap, payload.dbMap);
  store.writeJson(CACHE_FILE_NAMES.symbols, payload.symbols);
  store.writeJson(CACHE_FILE_NAMES.analysis, payload.analysis);
  store.writeJson(CACHE_FILE_NAMES.structuredMaps, payload.structuredMaps);
}

function indexRepository(repoRoot, options = {}) {
  const store = createProjectCacheStore(repoRoot, options);
  store.ensureLayout();

  if (options.forceRefresh !== true) {
    const cachedIndex = readCachedIndex(store);
    if (cachedIndex && isCacheFresh(store.repoRoot, cachedIndex, options)) {
      return cachedIndex;
    }
  }

  const fingerprints = collectRepoFingerprints(store.repoRoot, options);
  const projectProfile = buildProjectProfile(store.repoRoot);
  const treeSummary = buildTreeSummary(store.repoRoot, fingerprints);
  const modules = buildModulesMap(store.repoRoot, fingerprints);
  const routes = buildRoutesMap(store.repoRoot, fingerprints);
  const apiMap = buildApiMap(store.repoRoot, routes, modules);
  const dbMap = buildDbMap(store.repoRoot, fingerprints);
  const symbols = buildSymbolsMap(store.repoRoot, fingerprints);
  const repoMeta = buildRepoMeta(store, store.repoRoot, fingerprints, projectProfile);
  const analysis = buildAiContextAnalysis(store.repoRoot, {
    repoMeta,
    fingerprints,
    projectProfile,
    treeSummary,
    modules,
    routes,
    apiMap,
    dbMap,
    symbols,
    cacheHit: false
  }, {
    mode: options.mode || 'balanced'
  });
  const structuredMaps = buildStructuredMaps(store.repoRoot, {
    repoMeta,
    fingerprints,
    projectProfile,
    treeSummary,
    modules,
    routes,
    apiMap,
    dbMap,
    symbols,
    analysis,
    cacheHit: false
  }, {
    mode: options.mode || 'balanced'
  });

  const payload = {
    repoMeta,
    fingerprints,
    projectProfile,
    treeSummary,
    modules,
    routes,
    apiMap,
    dbMap,
    symbols,
    analysis,
    structuredMaps,
    cacheHit: false
  };

  if (options.persist !== false) {
    persistIndex(store, payload);
  }

  return payload;
}

module.exports = {
  CACHE_FILE_NAMES,
  REPO_INDEX_SCHEMA_VERSION,
  buildProjectProfile,
  buildRepoMeta,
  indexRepository,
  isCacheFresh,
  persistIndex,
  readCachedIndex
};
