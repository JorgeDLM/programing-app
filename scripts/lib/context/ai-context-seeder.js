'use strict';

const fs = require('fs');
const path = require('path');

const { createProjectCacheStore } = require('./project-cache-store');
const { STANDARD_AI_CONTEXT_DOCS, resolveAiContextPath } = require('./ai-context-files');

const AI_CONTEXT_SEED_SCHEMA_VERSION = 'ecc.ai-context-seed.v1';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function formatList(values, fallback = '- none') {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback;
  }

  return values.map(value => `- ${value}`).join('\n');
}

function formatKeyValueList(entries) {
  const filtered = entries.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (filtered.length === 0) {
    return '- none';
  }

  return filtered.map(([key, value]) => `- ${key}: ${value}`).join('\n');
}

function takePaths(values, limit = 12) {
  return unique((Array.isArray(values) ? values : []).filter(Boolean)).slice(0, limit);
}

function buildMetadata(definition, store, indexPayload, options = {}) {
  return {
    schemaVersion: AI_CONTEXT_SEED_SCHEMA_VERSION,
    docPath: definition.path,
    title: definition.title,
    generatedAt: new Date().toISOString(),
    generatedBy: 'repo-mapping',
    mode: options.enableAiEnrichment === true ? 'deterministic_with_optional_ai' : 'deterministic',
    enrichmentStatus: options.enableAiEnrichment === true
      ? (typeof options.aiEnricher === 'function' ? 'available' : 'requested_but_unavailable')
      : 'disabled',
    repoSlug: store.repoSlug,
    repoRoot: store.repoRoot,
    cacheDir: store.cacheDir,
    basedOnCommit: indexPayload && indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit
      ? indexPayload.repoMeta.basedOnCommit
      : 'unknown',
    indexVersion: indexPayload && indexPayload.repoMeta && indexPayload.repoMeta.indexVersion
      ? indexPayload.repoMeta.indexVersion
      : 'unknown'
  };
}

function buildDocSections(definition, indexPayload, store, metadata) {
  const projectProfile = indexPayload.projectProfile || {};
  const treeSummary = indexPayload.treeSummary || {};
  const modules = indexPayload.modules || { areas: [] };
  const routes = indexPayload.routes || { routes: [] };
  const apiMap = indexPayload.apiMap || { routes: [], supportingFiles: [] };
  const dbMap = indexPayload.dbMap || { prismaFiles: [], migrationFiles: [], modelFiles: [] };
  const symbols = indexPayload.symbols || { files: [] };
  const repoMeta = indexPayload.repoMeta || {};
  const fingerprints = indexPayload.fingerprints || {};
  const backendArea = Array.isArray(modules.areas) ? modules.areas.find(area => area.area === 'backend') : null;
  const frontendArea = Array.isArray(modules.areas) ? modules.areas.find(area => area.area === 'frontend') : null;
  const dataArea = Array.isArray(modules.areas) ? modules.areas.find(area => area.area === 'data') : null;
  const keyDirectories = Array.isArray(treeSummary.topLevel) ? treeSummary.topLevel.slice(0, 10).map(entry => `${entry.name} (${entry.fileCount})`) : [];
  const routeLines = Array.isArray(routes.routes)
    ? routes.routes.slice(0, 20).map(route => `${route.endpoint || route.path} [${route.kind}]`)
    : [];
  const symbolLines = Array.isArray(symbols.files)
    ? symbols.files.slice(0, 12).map(file => `${file.path}: ${takePaths([...(file.exports || []), ...(file.classes || []), ...(file.functions || [])], 6).join(', ') || 'no-symbols'}`)
    : [];
  const missingSignals = [];

  if (!frontendArea || frontendArea.fileCount === 0) {
    missingSignals.push('No frontend area detected in the technical index.');
  }
  if (!backendArea || backendArea.fileCount === 0) {
    missingSignals.push('No backend area detected in the technical index.');
  }
  if (!Array.isArray(routes.routes) || routes.routes.length === 0) {
    missingSignals.push('No API routes were detected.');
  }
  if ((!Array.isArray(dbMap.prismaFiles) || dbMap.prismaFiles.length === 0) && (!Array.isArray(dbMap.modelFiles) || dbMap.modelFiles.length === 0)) {
    missingSignals.push('No database schema or model files were detected.');
  }

  const baseSections = [
    {
      heading: 'Mapping Metadata',
      body: ['```json', JSON.stringify(metadata, null, 2), '```'].join('\n')
    }
  ];

  const docsByKey = {
    start: [
      ...baseSections,
      {
        heading: 'Project Identity',
        body: formatKeyValueList([
          ['Project', path.basename(store.repoRoot)],
          ['Repo slug', store.repoSlug],
          ['Frameworks', Array.isArray(projectProfile.frameworks) ? projectProfile.frameworks.join(', ') : 'unknown'],
          ['Languages', Array.isArray(projectProfile.languages) ? projectProfile.languages.join(', ') : 'unknown'],
          ['Primary', projectProfile.primary || 'unknown'],
          ['Commit', metadata.basedOnCommit],
          ['Cache dir', store.cacheDir],
          ['Files indexed', repoMeta.fileCount || fingerprints.fileCount || 0]
        ])
      },
      {
        heading: 'Navigate Next',
        body: formatList([
          'AI_CONTEXT/01-PROJECT-OVERVIEW.md',
          'AI_CONTEXT/02-ARCHITECTURE.md',
          'AI_CONTEXT/03-BACKEND.md',
          'AI_CONTEXT/04-FRONTEND.md',
          'AI_CONTEXT/06-API-CONTRACTS.md'
        ])
      }
    ],
    overview: [
      ...baseSections,
      {
        heading: 'Technical Profile',
        body: formatKeyValueList([
          ['Frameworks', Array.isArray(projectProfile.frameworks) ? projectProfile.frameworks.join(', ') : 'unknown'],
          ['Languages', Array.isArray(projectProfile.languages) ? projectProfile.languages.join(', ') : 'unknown'],
          ['Primary', projectProfile.primary || 'unknown'],
          ['Total files', treeSummary.totalFiles || repoMeta.fileCount || 0],
          ['Indexed at', repoMeta.generatedAt || metadata.generatedAt]
        ])
      },
      {
        heading: 'Top-Level Structure',
        body: formatList(keyDirectories)
      },
      {
        heading: 'Module Areas',
        body: formatList((modules.areas || []).slice(0, 10).map(area => `${area.area}: ${area.fileCount} files`))
      }
    ],
    architecture: [
      ...baseSections,
      {
        heading: 'System Shape',
        body: formatKeyValueList([
          ['Frontend files', frontendArea ? frontendArea.fileCount : 0],
          ['Backend files', backendArea ? backendArea.fileCount : 0],
          ['Data files', dataArea ? dataArea.fileCount : 0],
          ['Routes detected', Array.isArray(routes.routes) ? routes.routes.length : 0],
          ['Database files', takePaths([...(dbMap.prismaFiles || []), ...(dbMap.modelFiles || [])], 100).length]
        ])
      },
      {
        heading: 'Key Directories',
        body: formatList((treeSummary.directories || []).slice(0, 15).map(entry => `${entry.path} (${entry.fileCount})`))
      },
      {
        heading: 'Open Architecture Notes',
        body: formatList(missingSignals, '- No structural warnings detected by the deterministic mapper.')
      }
    ],
    backend: [
      ...baseSections,
      {
        heading: 'Backend Surface',
        body: formatList(backendArea ? takePaths(backendArea.files, 20) : [], '- No backend files detected.')
      },
      {
        heading: 'Supporting API Files',
        body: formatList(takePaths(apiMap.supportingFiles, 20), '- No supporting backend files detected.')
      }
    ],
    frontend: [
      ...baseSections,
      {
        heading: 'Frontend Surface',
        body: formatList(frontendArea ? takePaths(frontendArea.files, 20) : [], '- No frontend files detected.')
      },
      {
        heading: 'UI Directories',
        body: formatList((treeSummary.directories || []).filter(entry => /(^|\/)(app|pages|components|ui|views|layouts|styles)(\/|$)/u.test(entry.path)).slice(0, 20).map(entry => `${entry.path} (${entry.fileCount})`), '- No UI directories detected.')
      }
    ],
    data: [
      ...baseSections,
      {
        heading: 'Schema Files',
        body: formatList(takePaths(dbMap.prismaFiles, 20), '- No Prisma or SQL schema files detected.')
      },
      {
        heading: 'Model Files',
        body: formatList(takePaths(dbMap.modelFiles, 20), '- No model files detected.')
      },
      {
        heading: 'Migration Files',
        body: formatList(takePaths(dbMap.migrationFiles, 20), '- No migration files detected.')
      }
    ],
    api: [
      ...baseSections,
      {
        heading: 'Detected Routes',
        body: formatList(routeLines, '- No API routes detected.')
      },
      {
        heading: 'Route Files',
        body: formatList((routes.routes || []).slice(0, 20).map(route => route.path), '- No route files detected.')
      }
    ],
    adr: [
      ...baseSections,
      {
        heading: 'Current Mapping Decision',
        body: formatList([
          'Deterministic repository mapping is enabled for this repo.',
          'Prepared context should start from cached technical artifacts and AI_CONTEXT docs.',
          'Optional AI enrichment must never block the mapping baseline.'
        ])
      },
      {
        heading: 'Pending ADRs',
        body: '- Record architectural decisions here as they become explicit.'
      }
    ],
    recent: [
      ...baseSections,
      {
        heading: 'Latest Mapping Snapshot',
        body: formatKeyValueList([
          ['Commit', metadata.basedOnCommit],
          ['Generated at', metadata.generatedAt],
          ['Aggregate hash', fingerprints.aggregateHash || 'unknown'],
          ['Files indexed', fingerprints.fileCount || repoMeta.fileCount || 0]
        ])
      },
      {
        heading: 'Latest Technical Signals',
        body: formatList([
          `Routes detected: ${Array.isArray(routes.routes) ? routes.routes.length : 0}`,
          `Schema files: ${takePaths(dbMap.prismaFiles, 100).length}`,
          `Symbols indexed: ${Array.isArray(symbols.files) ? symbols.files.length : 0}`
        ])
      }
    ],
    issues: [
      ...baseSections,
      {
        heading: 'Open Technical Issues',
        body: formatList(missingSignals, '- No open issues were inferred during the deterministic mapping pass.')
      },
      {
        heading: 'Indexed Symbols To Review',
        body: formatList(symbolLines, '- No symbol-rich files detected.')
      }
    ]
  };

  return docsByKey[definition.key] || [
    ...baseSections,
    {
      heading: 'Project Snapshot',
      body: formatKeyValueList([
        ['Repo slug', store.repoSlug],
        ['Commit', metadata.basedOnCommit],
        ['Files indexed', repoMeta.fileCount || fingerprints.fileCount || 0]
      ])
    }
  ];
}

function renderDoc(definition, indexPayload, store, metadata) {
  const sections = buildDocSections(definition, indexPayload, store, metadata);
  const body = sections
    .map(section => `## ${section.heading}\n\n${section.body}`)
    .join('\n\n');

  return `# ${definition.title}\n\n${body}\n`;
}

function seedAiContext(repoRoot, indexPayload, options = {}) {
  const store = createProjectCacheStore(repoRoot, options);
  const aiContextDir = path.join(store.repoRoot, 'AI_CONTEXT');
  const aiContextExists = fs.existsSync(aiContextDir);
  const shouldCreate = options.createAiContextIfMissing === true || aiContextExists;
  const warnings = [];

  if (options.enableAiEnrichment === true && typeof options.aiEnricher !== 'function') {
    warnings.push('ai-enrichment-requested-but-no-enricher-configured');
  }

  if (!shouldCreate) {
    return {
      schemaVersion: AI_CONTEXT_SEED_SCHEMA_VERSION,
      step: 'seed_ai_context',
      skipped: true,
      reason: 'create-ai-context-disabled',
      aiContextDir,
      created: [],
      updated: [],
      warnings
    };
  }

  fs.mkdirSync(aiContextDir, { recursive: true });

  const created = [];
  const updated = [];
  const existing = [];

  for (const definition of STANDARD_AI_CONTEXT_DOCS) {
    const absolutePath = resolveAiContextPath(store.repoRoot, definition.path);
    const alreadyExists = fs.existsSync(absolutePath);

    if (alreadyExists && options.forceRemap !== true && aiContextExists) {
      existing.push(definition.path);
      continue;
    }

    const metadata = buildMetadata(definition, store, indexPayload, options);
    const content = renderDoc(definition, indexPayload, store, metadata);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');

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
    warnings
  };
}

module.exports = {
  AI_CONTEXT_SEED_SCHEMA_VERSION,
  seedAiContext
};
