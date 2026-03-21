'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { runCommand } = require('../utils');
const { normalizeRepoRoot } = require('./cache-paths');

const REPO_FINGERPRINT_SCHEMA_VERSION = 'ecc.repo-fingerprint.v1';
const DEFAULT_SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'out',
  'coverage',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'venv'
]);

function toRelativePath(repoRoot, fullPath) {
  return path.relative(repoRoot, fullPath).split(path.sep).join('/');
}

function shouldSkipEntry(entryName, options = {}) {
  const skipDirs = options.skipDirs || DEFAULT_SKIP_DIRS;
  return skipDirs.has(entryName);
}

function walkRepoFiles(repoRoot, options = {}, currentDir = repoRoot, results = []) {
  let entries = [];

  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldSkipEntry(entry.name, options)) {
        continue;
      }

      walkRepoFiles(repoRoot, options, path.join(currentDir, entry.name), results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fullPath = path.join(currentDir, entry.name);
    const stats = fs.statSync(fullPath);

    results.push({
      fullPath,
      path: toRelativePath(repoRoot, fullPath),
      mtimeMs: stats.mtimeMs,
      size: stats.size
    });
  }

  return results;
}

function hashFile(fullPath, options = {}) {
  const maxFileSizeBytes = Number.isInteger(options.maxFileSizeBytes)
    ? options.maxFileSizeBytes
    : 1024 * 1024 * 5;

  const stats = fs.statSync(fullPath);
  if (stats.size > maxFileSizeBytes) {
    return null;
  }

  const content = fs.readFileSync(fullPath);
  return crypto.createHash('sha1').update(content).digest('hex');
}

function resolveGitCommit(repoRoot) {
  const result = runCommand(`git -C "${repoRoot}" rev-parse HEAD`);
  if (!result.success) {
    return null;
  }

  const commit = String(result.output || '').trim();
  return commit.length > 0 ? commit : null;
}

function collectRepoFingerprints(repoRoot, options = {}) {
  const resolvedRepoRoot = normalizeRepoRoot(repoRoot);
  const files = walkRepoFiles(resolvedRepoRoot, options)
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(file => ({
      path: file.path,
      mtimeMs: file.mtimeMs,
      size: file.size,
      sha1: hashFile(file.fullPath, options)
    }));

  const aggregateHash = crypto
    .createHash('sha1')
    .update(JSON.stringify(files))
    .digest('hex');

  return {
    schemaVersion: REPO_FINGERPRINT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    repoRoot: resolvedRepoRoot,
    basedOnCommit: resolveGitCommit(resolvedRepoRoot),
    aggregateHash,
    fileCount: files.length,
    files
  };
}

module.exports = {
  DEFAULT_SKIP_DIRS,
  REPO_FINGERPRINT_SCHEMA_VERSION,
  collectRepoFingerprints,
  hashFile,
  resolveGitCommit,
  toRelativePath,
  walkRepoFiles
};
