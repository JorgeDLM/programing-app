'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { ensureDir, readFile, writeFile } = require('../utils');
const {
  getCacheRoot,
  getRepoCacheDir,
  getRepoCacheFilePath,
  getRepoSlug,
  getTaskArtifactsDir,
  getTaskContextDir,
  normalizeRepoRoot
} = require('./cache-paths');

const PROJECT_CACHE_STORE_SCHEMA_VERSION = 'ecc.project-cache.store.v1';

function createTaskRecordId(prefix, seed) {
  const hash = crypto
    .createHash('sha1')
    .update(String(seed || 'task'))
    .digest('hex')
    .slice(0, 12);

  return `${prefix}-${Date.now()}-${hash}`;
}

function createProjectCacheStore(repoRoot, options = {}) {
  const resolvedRepoRoot = normalizeRepoRoot(repoRoot);
  const cacheRoot = getCacheRoot(options);
  const repoSlug = getRepoSlug(resolvedRepoRoot);
  const cacheDir = getRepoCacheDir(resolvedRepoRoot, options);
  const taskContextDir = getTaskContextDir(resolvedRepoRoot, options);
  const taskArtifactsDir = getTaskArtifactsDir(resolvedRepoRoot, options);

  function buildRecordMetadata(payload = {}, recordId, kind) {
    const createdAt = payload.createdAt || new Date().toISOString();
    const updatedAt = payload.updatedAt || createdAt;
    const payloadRepoSlug = payload.repoSlug || payload.repo && payload.repo.slug || repoSlug;
    const basedOnCommit = payload.basedOnCommit || payload.cache && payload.cache.basedOnCommit || payload.provenance && payload.provenance.basedOnCommit || 'unknown';
    const taskContextId = payload.taskContextId
      || payload.provenance && payload.provenance.taskContextId
      || payload.taskMetadata && payload.taskMetadata.taskContextId
      || (kind === 'task-context' ? recordId : null);
    const workingSetId = payload.workingSetId
      || payload.workingSet && (payload.workingSet.workingSetId || payload.workingSet.id)
      || payload.provenance && payload.provenance.workingSetId
      || null;

    return {
      createdAt,
      updatedAt,
      repoSlug: payloadRepoSlug,
      basedOnCommit,
      taskContextId,
      workingSetId,
      provenance: {
        ...(payload.provenance && typeof payload.provenance === 'object' ? payload.provenance : {}),
        taskContextId,
        workingSetId,
        repoSlug: payloadRepoSlug,
        basedOnCommit,
        createdAt,
        updatedAt
      }
    };
  }

  function ensureLayout() {
    ensureDir(cacheRoot);
    ensureDir(cacheDir);
    ensureDir(taskContextDir);
    ensureDir(taskArtifactsDir);

    return {
      cacheRoot,
      cacheDir,
      repoRoot: resolvedRepoRoot,
      repoSlug,
      schemaVersion: PROJECT_CACHE_STORE_SCHEMA_VERSION,
      taskArtifactsDir,
      taskContextDir
    };
  }

  function readJson(fileName, defaultValue = null) {
    const filePath = getRepoCacheFilePath(resolvedRepoRoot, fileName, options);
    const content = readFile(filePath);
    if (!content) {
      return defaultValue;
    }

    try {
      return JSON.parse(content);
    } catch {
      return defaultValue;
    }
  }

  function writeJson(fileName, payload) {
    ensureLayout();
    const filePath = getRepoCacheFilePath(resolvedRepoRoot, fileName, options);
    writeFile(filePath, JSON.stringify(payload, null, 2) + '\n');
    return filePath;
  }

  function writeTaskContext(payload, taskId) {
    ensureLayout();
    const recordId = taskId || payload && payload.taskContextId || createTaskRecordId('task-context', payload && payload.scopeHypothesis);
    const filePath = path.join(taskContextDir, `${recordId}.json`);
    const normalizedPayload = {
      ...payload,
      taskContextId: recordId,
      ...buildRecordMetadata(payload, recordId, 'task-context')
    };
    writeFile(filePath, JSON.stringify(normalizedPayload, null, 2) + '\n');
    return { id: recordId, path: filePath };
  }

  function writeTaskArtifact(payload, artifactId) {
    ensureLayout();
    const recordId = artifactId
      || payload && payload.artifactId
      || payload && payload.expansionLogId
      || payload && payload.workingSetId
      || createTaskRecordId('task-artifact', payload && payload.kind);
    const filePath = path.join(taskArtifactsDir, `${recordId}.json`);
    const normalizedPayload = {
      ...payload,
      artifactId: recordId,
      ...buildRecordMetadata(payload, recordId, payload && payload.kind || 'task-artifact')
    };
    writeFile(filePath, JSON.stringify(normalizedPayload, null, 2) + '\n');
    return { id: recordId, path: filePath };
  }

  function readTaskContext(taskContextId) {
    if (typeof taskContextId !== 'string' || taskContextId.length === 0) {
      return null;
    }

    const filePath = path.join(taskContextDir, `${taskContextId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function readTaskArtifact(artifactId) {
    if (typeof artifactId !== 'string' || artifactId.length === 0) {
      return null;
    }

    const filePath = path.join(taskArtifactsDir, `${artifactId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function listJsonRecords(dirPath, limit = 5) {
    ensureLayout();

    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => {
        const fullPath = path.join(dirPath, entry.name);
        const stats = fs.statSync(fullPath);
        return {
          fullPath,
          mtimeMs: stats.mtimeMs,
          name: entry.name
        };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs)
      .slice(0, limit)
      .map(entry => ({
        id: entry.name.replace(/\.json$/u, ''),
        path: entry.fullPath,
        payload: readJson(path.relative(cacheDir, entry.fullPath).split(path.sep).join('/'), null)
      }));
  }

  function listTaskContexts(limit = 5) {
    return listJsonRecords(taskContextDir, limit);
  }

  function listTaskArtifacts(limit = 5) {
    return listJsonRecords(taskArtifactsDir, limit);
  }

  return {
    cacheDir,
    cacheRoot,
    ensureLayout,
    listTaskArtifacts,
    listTaskContexts,
    readTaskArtifact,
    readTaskContext,
    readJson,
    repoRoot: resolvedRepoRoot,
    repoSlug,
    taskArtifactsDir,
    taskContextDir,
    writeJson,
    writeTaskArtifact,
    writeTaskContext
  };
}

module.exports = {
  PROJECT_CACHE_STORE_SCHEMA_VERSION,
  createProjectCacheStore,
  createTaskRecordId
};
