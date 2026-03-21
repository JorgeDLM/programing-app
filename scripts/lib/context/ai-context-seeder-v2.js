'use strict';

const fs = require('fs');
const path = require('path');

const { createProjectCacheStore } = require('./project-cache-store');
const { STANDARD_AI_CONTEXT_DOCS, resolveAiContextPath } = require('./ai-context-files');
const { renderAiContextDoc } = require('./ai-context-renderer-v2');

const AI_CONTEXT_SEED_SCHEMA_VERSION = 'ecc.ai-context-seed.v2';

function seedAiContext(repoRoot, indexPayload, options = {}) {
  const store = createProjectCacheStore(repoRoot, options);
  const aiContextDir = path.join(store.repoRoot, 'AI_CONTEXT');
  const aiContextExists = fs.existsSync(aiContextDir);
  const shouldCreate = options.createAiContextIfMissing === true || aiContextExists;

  if (!shouldCreate) {
    return {
      schemaVersion: AI_CONTEXT_SEED_SCHEMA_VERSION,
      step: 'seed_ai_context',
      skipped: true,
      reason: 'create-ai-context-disabled',
      aiContextDir,
      created: [],
      updated: [],
      existing: [],
      warnings: []
    };
  }

  fs.mkdirSync(aiContextDir, { recursive: true });

  const created = [];
  const updated = [];
  const existing = [];
  const docReports = [];

  for (const definition of STANDARD_AI_CONTEXT_DOCS) {
    const absolutePath = resolveAiContextPath(store.repoRoot, definition.path);
    const alreadyExists = fs.existsSync(absolutePath);

    if (alreadyExists && options.forceRemap !== true && aiContextExists) {
      existing.push(definition.path);
      continue;
    }

    const rendered = renderAiContextDoc(definition, indexPayload, store, options);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, rendered.content, 'utf8');

    docReports.push({
      docPath: definition.path,
      enrichmentStatus: rendered.metadata.enrichmentStatus,
      aiEnrichmentStatus: rendered.metadata.aiEnrichmentStatus,
      readiness: rendered.metadata.readiness,
      docScores: rendered.metadata.docScores
    });

    if (alreadyExists) {
      updated.push(definition.path);
    } else {
      created.push(definition.path);
    }
  }

  return {
    schemaVersion: AI_CONTEXT_SEED_SCHEMA_VERSION,
    step: 'seed_ai_context',
    skipped: false,
    reason: null,
    aiContextDir,
    created,
    updated,
    existing,
    warnings: [],
    mode: indexPayload.analysis && indexPayload.analysis.mode ? indexPayload.analysis.mode : options.mode || 'balanced',
    overallReadiness: indexPayload.analysis && indexPayload.analysis.critic && indexPayload.analysis.critic.overall
      ? indexPayload.analysis.critic.overall.decision
      : 'needs_review',
    overallScores: indexPayload.analysis && indexPayload.analysis.critic ? indexPayload.analysis.critic.overall : null,
    docReports
  };
}

module.exports = {
  AI_CONTEXT_SEED_SCHEMA_VERSION,
  seedAiContext
};
