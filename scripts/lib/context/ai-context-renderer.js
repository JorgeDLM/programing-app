'use strict';

const path = require('path');

const AI_CONTEXT_RENDER_SCHEMA_VERSION = 'ecc.ai-context-render.v1';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function take(values, limit = 8) {
  return unique(values).slice(0, limit);
}

function formatList(values, fallback = '- none') {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback;
  }
  return values.map(value => `- ${value}`).join('\n');
}

function formatKeyValueList(entries, fallback = '- none') {
  const filtered = entries.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (filtered.length === 0) {
    return fallback;
  }
  return filtered.map(([key, value]) => `- ${key}: ${value}`).join('\n');
}

function formatNestedList(items, fallback = '- none') {
  if (!Array.isArray(items) || items.length === 0) {
    return fallback;
  }
  return items.join('\n');
}

function buildMetadata(definition, store, indexPayload, options = {}) {
  const analysis = indexPayload.analysis || null;
  const hasEvidenceEnrichment = Boolean(analysis && analysis.schemaVersion);
  return {
    schemaVersion: AI_CONTEXT_RENDER_SCHEMA_VERSION,
    docPath: definition.path,
    title: definition.title,
    generatedAt: new Date().toISOString(),
    generatedBy: 'repo-mapping',
    generationStrategy: 'two_level_seed_plus_evidence_enrichment',
    seedStatus: 'generated',
    enrichmentStatus: hasEvidenceEnrichment ? 'evidence_enriched' : 'deterministic_only',
    aiEnrichmentStatus: options.enableAiEnrichment === true
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

function buildTaskRouter() {
  return [
    '- frontend/ui -> AI_CONTEXT/04-FRONTEND.md, then AI_CONTEXT/02-ARCHITECTURE.md',
    '- backend/api -> AI_CONTEXT/03-BACKEND.md, then AI_CONTEXT/06-API-CONTRACTS.md',
    '- data/db -> AI_CONTEXT/05-DATA-MODELS.md, then AI_CONTEXT/03-BACKEND.md',
    '- fullstack -> AI_CONTEXT/00-START-HERE.md, 01-PROJECT-OVERVIEW.md, 02-ARCHITECTURE.md, then domain docs',
    '- delicate changes -> AI_CONTEXT/02-ARCHITECTURE.md, 07-DECISIONS-ADR.md, 09-OPEN-ISSUES.md'
  ];
}

function buildOperatingRules() {
  return [
    '- Start from prepared context or the working set if available.',
    '- Use AI_CONTEXT docs to narrow search before broad rediscovery.',
    '- Treat source files as the final source of truth.',
    '- If a section is marked low-confidence or partial, inspect the cited files directly.',
    '- Prefer route/data/module evidence already cached before reading the whole repo.'
  ];
}

function formatSurfaceEntries(surfaces = []) {
  return surfaces.map(surface => `${surface.surface}: ${take(surface.files, 6).join(', ') || 'no-files'}`);
}

function formatRouteGroup(group) {
  const routeLines = group.routes.map(route => {
    const methodText = route.methods.length > 0 ? route.methods.join(', ') : 'partial-method-detection';
    return `  - ${route.endpoint} [${methodText}] (${route.path})`;
  });
  return [`- ${group.domain}`, ...routeLines].join('\n');
}

function formatModel(model) {
  return [
    `- ${model.name}`,
    `  - fields: ${model.importantFields.join(', ') || 'partial'}`,
    `  - relations: ${model.relations.join(', ') || 'none-observed'}`
  ].join('\n');
}

function formatEnum(entity) {
  return `- ${entity.name}: ${entity.values.join(', ') || 'none'}`;
}

function formatApiContract(contract) {
  return [
    `- ${contract.endpoint}`,
    `  - methods: ${contract.methods.join(', ') || 'partial'}`,
    `  - source: ${contract.path}`,
    `  - purpose: ${contract.purpose}`,
    `  - auth: ${contract.authRequired ? 'evident' : 'not evident'}`,
    `  - request: body[${contract.requestShape.bodyFields.join(', ') || 'partial'}] query[${contract.requestShape.queryFields.join(', ') || 'none'}]`,
    `  - response: ${contract.responseKeys.join(', ') || 'partial'}`,
    `  - side effects: ${contract.sideEffects.join(', ') || 'none-observed'}`,
    `  - related models: ${contract.relatedModels.join(', ') || 'not confidently inferred'}`,
    `  - confidence: ${contract.confidence}`
  ].join('\n');
}

function buildDocSections(definition, indexPayload, store, metadata) {
  const analysis = indexPayload.analysis || {};
  const overview = analysis.overview || {};
  const architecture = analysis.architecture || {};
  const backend = analysis.backend || {};
  const frontend = analysis.frontend || {};
  const dataModels = analysis.dataModels || {};
  const api = analysis.api || {};
  const projectProfile = indexPayload.projectProfile || {};
  const treeSummary = indexPayload.treeSummary || {};
  const repoMeta = indexPayload.repoMeta || {};
  const routeCount = Array.isArray(api.contracts) ? api.contracts.length : 0;
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
        heading: 'Repository Snapshot',
        body: formatKeyValueList([
          ['Project', path.basename(store.repoRoot)],
          ['Repo slug', store.repoSlug],
          ['Frameworks', Array.isArray(projectProfile.frameworks) ? projectProfile.frameworks.join(', ') : 'unknown'],
          ['Primary', projectProfile.primary || 'unknown'],
          ['Commit', metadata.basedOnCommit],
          ['Routes detected', routeCount],
          ['Data entities', Array.isArray(dataModels.models) ? dataModels.models.length : 0]
        ])
      },
      {
        heading: 'Task Router',
        body: formatList(buildTaskRouter())
      },
      {
        heading: 'Start Sequence',
        body: formatList([
          'Read the prepared context or working set first when available.',
          'Read AI_CONTEXT/01-PROJECT-OVERVIEW.md to orient yourself quickly.',
          'Jump to the domain doc that matches the task before broad search.',
          'Return to source files once the likely files are identified.'
        ])
      },
      {
        heading: 'Operating Rules',
        body: formatList(buildOperatingRules())
      },
      {
        heading: 'Key Entry Points',
        body: formatList(take(overview.entryPoints || [], 12))
      }
    ],
    overview: [
      ...baseSections,
      {
        heading: 'What This Repo Appears To Do',
        body: overview.narrative || 'Repo purpose is only partially inferred from metadata and source layout.'
      },
      {
        heading: 'Main Areas',
        body: formatList(overview.mainAreas || [])
      },
      {
        heading: 'Surfaces',
        body: formatList(formatSurfaceEntries(overview.surfaces || []), '- No distinct surfaces were confidently detected.')
      },
      {
        heading: 'Important Entry Points',
        body: formatList(overview.entryPoints || [])
      },
      {
        heading: 'Hotspots',
        body: formatList(overview.hotspots || [])
      },
      {
        heading: 'Top-Level Structure',
        body: formatList((treeSummary.topLevel || []).slice(0, 10).map(entry => `${entry.name} (${entry.fileCount})`))
      }
    ],
    architecture: [
      ...baseSections,
      {
        heading: 'Boundaries',
        body: formatKeyValueList([
          ['Frontend surface', architecture.boundaries && architecture.boundaries.frontend !== undefined ? architecture.boundaries.frontend : 0],
          ['Backend surface', architecture.boundaries && architecture.boundaries.backend !== undefined ? architecture.boundaries.backend : 0],
          ['API routes', architecture.boundaries && architecture.boundaries.api !== undefined ? architecture.boundaries.api : 0],
          ['Data entities', architecture.boundaries && architecture.boundaries.data !== undefined ? architecture.boundaries.data : 0]
        ])
      },
      {
        heading: 'Observed Request Flow',
        body: architecture.requestFlow || 'No concrete request flow could be inferred.'
      },
      {
        heading: 'Critical Zones',
        body: formatList(architecture.criticalZones || [], '- No critical zones were highlighted by the deterministic pass.')
      },
      {
        heading: 'Contradictions',
        body: formatList(architecture.contradictions || [], '- No contradictions were detected in the current map.')
      },
      {
        heading: 'Low-Confidence Zones',
        body: formatList(architecture.lowConfidenceZones || [], '- No low-confidence zones were flagged.')
      }
    ],
    backend: [
      ...baseSections,
      {
        heading: 'Backend Surface',
        body: formatList(backend.backendFiles || [], '- No backend files detected.')
      },
      {
        heading: 'API Domains',
        body: formatNestedList((backend.routeGroups || []).slice(0, 10).map(formatRouteGroup), '- No API route groups detected.')
      },
      {
        heading: 'Supporting Backend Files',
        body: formatList(backend.supportFiles || [], '- No supporting backend files detected.')
      },
      {
        heading: 'Sensitive Operations',
        body: formatList(backend.sensitiveOperations || [], '- No sensitive backend operations were surfaced by the deterministic pass.')
      }
    ],
    frontend: [
      ...baseSections,
      {
        heading: 'Pages',
        body: formatList(frontend.pages || [], '- No frontend pages were detected.')
      },
      {
        heading: 'Layouts',
        body: formatList(frontend.layouts || [], '- No layouts were detected.')
      },
      {
        heading: 'Key Components',
        body: formatList(frontend.components || [], '- No key components were detected.')
      },
      {
        heading: 'Surfaces',
        body: formatList(formatSurfaceEntries(frontend.surfaces || []), '- No frontend surfaces were confidently grouped.')
      },
      {
        heading: 'UI Hotspots',
        body: formatList(frontend.hotspots || [], '- No UI hotspots were detected.')
      }
    ],
    data: [
      ...baseSections,
      {
        heading: 'Schema Files',
        body: formatList(dataModels.prismaFiles || [], '- No Prisma or SQL schema files detected.')
      },
      {
        heading: 'Core Entities',
        body: formatList(dataModels.coreEntities || [], '- No core entities were confidently ranked.')
      },
      {
        heading: 'Models',
        body: formatNestedList((dataModels.models || []).slice(0, 12).map(formatModel), '- No structured models were extracted from schema evidence.')
      },
      {
        heading: 'Enums',
        body: formatList((dataModels.enums || []).slice(0, 12).map(formatEnum), '- No enums were extracted.')
      },
      {
        heading: 'Change Risks',
        body: formatList(dataModels.risks || [], '- No explicit data-layer risks were surfaced.')
      }
    ],
    api: [
      ...baseSections,
      {
        heading: 'Endpoint Contracts',
        body: formatNestedList((api.contracts || []).slice(0, 12).map(formatApiContract), '- No API contracts were inferred.')
      }
    ],
    adr: [
      ...baseSections,
      {
        heading: 'Observed Decisions',
        body: formatList(analysis.decisions || [], '- No architecture decisions were confidently inferred from repo evidence.')
      }
    ],
    recent: [
      ...baseSections,
      {
        heading: 'Recent Change Strategy',
        body: formatKeyValueList([
          ['Strategy', analysis.recent && analysis.recent.strategy ? analysis.recent.strategy : 'insufficient-history'],
          ['Summary', analysis.recent && analysis.recent.summary ? analysis.recent.summary : 'No recent change evidence was available.']
        ])
      },
      {
        heading: 'Recent Files',
        body: formatList((analysis.recent && Array.isArray(analysis.recent.files) ? analysis.recent.files : []).map(file => `${file.path} [${(file.domains || []).join(', ') || 'unknown'}]`), '- No recent file evidence was captured.')
      }
    ],
    issues: [
      ...baseSections,
      {
        heading: 'Open Issues',
        body: formatList((analysis.openIssues || []).map(issue => `${issue.kind} (${issue.severity}): ${issue.detail}`), '- No unresolved issues were detected in the deterministic evidence pass.')
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
        ['Files indexed', repoMeta.fileCount || 0]
      ])
    }
  ];
}

function renderAiContextDoc(definition, indexPayload, store, options = {}) {
  const metadata = buildMetadata(definition, store, indexPayload, options);
  const sections = buildDocSections(definition, indexPayload, store, metadata);
  const body = sections
    .map(section => `## ${section.heading}\n\n${section.body}`)
    .join('\n\n');
  return {
    metadata,
    content: `# ${definition.title}\n\n${body}\n`
  };
}

module.exports = {
  AI_CONTEXT_RENDER_SCHEMA_VERSION,
  buildAiContextMetadata: buildMetadata,
  buildAiContextSections: buildDocSections,
  renderAiContextDoc
};
