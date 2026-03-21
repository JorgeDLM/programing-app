'use strict';

const crypto = require('crypto');
const path = require('path');

const PROJECT_CACHE_LAYOUT_VERSION = 'ecc.project-cache.layout.v1';

function getProgramingAppRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function normalizeRepoRoot(repoRoot) {
  return path.resolve(repoRoot || process.cwd());
}

function getCacheRoot(options = {}) {
  if (typeof options.cacheRoot === 'string' && options.cacheRoot.trim().length > 0) {
    return path.resolve(options.cacheRoot);
  }

  return path.join(getProgramingAppRoot(), 'data', 'project-cache');
}

function normalizeForHash(value) {
  return value.split(path.sep).join('/').toLowerCase();
}

function sanitizeSegment(value) {
  return String(value || 'repo')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'repo';
}

function getRepoSlug(repoRoot) {
  const resolvedRepoRoot = normalizeRepoRoot(repoRoot);
  const repoName = sanitizeSegment(path.basename(resolvedRepoRoot));
  const hash = crypto
    .createHash('sha1')
    .update(normalizeForHash(resolvedRepoRoot))
    .digest('hex')
    .slice(0, 10);

  return `${repoName}-${hash}`;
}

function getRepoCacheDir(repoRoot, options = {}) {
  return path.join(getCacheRoot(options), getRepoSlug(repoRoot));
}

function getRepoCacheFilePath(repoRoot, fileName, options = {}) {
  return path.join(getRepoCacheDir(repoRoot, options), fileName);
}

function getTaskContextDir(repoRoot, options = {}) {
  return path.join(getRepoCacheDir(repoRoot, options), 'task-context');
}

function getTaskArtifactsDir(repoRoot, options = {}) {
  return path.join(getRepoCacheDir(repoRoot, options), 'task-artifacts');
}

module.exports = {
  PROJECT_CACHE_LAYOUT_VERSION,
  getProgramingAppRoot,
  getCacheRoot,
  getRepoCacheDir,
  getRepoCacheFilePath,
  getRepoSlug,
  getTaskArtifactsDir,
  getTaskContextDir,
  normalizeRepoRoot,
  sanitizeSegment
};
