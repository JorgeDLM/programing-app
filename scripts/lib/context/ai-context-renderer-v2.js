'use strict';

const { getAiContextDocDefinition } = require('./ai-context-files');

const AI_CONTEXT_RENDER_V2_SCHEMA_VERSION = 'ecc.ai-context-render.v2';

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

function findDocEvaluation(analysis, definition) {
  const evaluations = analysis.critic && Array.isArray(analysis.critic.docEvaluations) ? analysis.critic.docEvaluations : [];
  return evaluations.find(entry => entry.docKey === definition.key || entry.docPath === definition.path) || null;
}

function normalizeEvidence(evidence = {}) {
  return {
    sourcePaths: take(evidence.sourcePaths || [], 8),
    routeFiles: take(evidence.routeFiles || [], 8),
    schemaRefs: take(evidence.schemaRefs || [], 8),
    importsSeen: take(evidence.importsSeen || [], 8),
    symbolsSeen: take(evidence.symbolsSeen || [], 8),
    basedOnCommit: evidence.basedOnCommit || 'unknown',
    sourceFingerprint: take(evidence.sourceFingerprint || [], 8)
  };
}

function buildMetadata(definition, store, indexPayload, options = {}) {
  const analysis = indexPayload.analysis || {};
  const docEvaluation = findDocEvaluation(analysis, definition);
  const overall = analysis.critic && analysis.critic.overall ? analysis.critic.overall : null;
  return {
    schemaVersion: AI_CONTEXT_RENDER_V2_SCHEMA_VERSION,
    docPath: definition.path,
    title: definition.title,
    generatedAt: new Date().toISOString(),
    generatedBy: 'repo-mapping',
    generationLayers: ['seed', 'enrichment', 'critic', 'scoring'],
    mode: analysis.mode || options.mode || 'balanced',
    seedStatus: 'generated',
    enrichmentStatus: analysis.schemaVersion ? 'evidence_enriched' : 'deterministic_only',
    aiEnrichmentStatus: options.enableAiEnrichment === true
      ? (typeof options.aiEnricher === 'function' ? 'available' : 'not_configured_optional')
      : 'disabled',
    readiness: docEvaluation ? docEvaluation.decision : 'needs_review',
    docScores: docEvaluation ? docEvaluation.scores : null,
    overallReadiness: overall ? overall.decision : 'needs_review',
    overallScores: overall || null,
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

function renderReadinessSection(docEvaluation) {
  if (!docEvaluation) {
    return {
      heading: 'Readiness',
      body: formatList(['- needs_review: critic output missing for this document'])
    };
  }

  return {
    heading: 'Readiness',
    body: [
      formatKeyValueList([
        ['Decision', docEvaluation.decision],
        ['accuracyScore', docEvaluation.scores.accuracyScore],
        ['usefulnessScore', docEvaluation.scores.usefulnessScore],
        ['evidenceScore', docEvaluation.scores.evidenceScore],
        ['confidenceHonestyScore', docEvaluation.scores.confidenceHonestyScore],
        ['signalDensityScore', docEvaluation.scores.signalDensityScore]
      ]),
      '### Section Confidence',
      formatKeyValueList(Object.entries(docEvaluation.sectionConfidence || {}), '- none'),
      '### Critic Warnings',
      formatList(docEvaluation.warnings || [], '- none'),
      '### Critic Issues',
      formatList(docEvaluation.issues || [], '- none')
    ].join('\n\n')
  };
}

function renderEvidenceSection(evidence) {
  const normalized = normalizeEvidence(evidence);
  return {
    heading: 'Evidence Profile',
    body: [
      formatKeyValueList([
        ['basedOnCommit', normalized.basedOnCommit],
        ['sourcePaths', normalized.sourcePaths.length],
        ['routeFiles', normalized.routeFiles.length],
        ['schemaRefs', normalized.schemaRefs.length],
        ['importsSeen', normalized.importsSeen.length],
        ['symbolsSeen', normalized.symbolsSeen.length]
      ]),
      '### Source Paths',
      formatList(normalized.sourcePaths, '- none'),
      '### Route Files',
      formatList(normalized.routeFiles, '- none'),
      '### Schema Refs',
      formatList(normalized.schemaRefs, '- none')
    ].join('\n\n')
  };
}

function formatSurfaceEntries(surfaces = []) {
  return surfaces.map(surface => `${surface.name || surface.surface}: ${(surface.files || []).join(', ') || 'no-files'}`);
}

function formatModel(model) {
  return [
    `- ${model.name}`,
    `  - purpose: ${model.purpose || 'partial'}`,
    `  - key fields: ${(model.keyFields || []).join(', ') || 'partial'}`,
    `  - relations: ${(model.relations || []).join(', ') || 'none-observed'}`,
    `  - related endpoints: ${(model.relatedEndpoints || []).join(', ') || 'not clearly linked'}`,
    `  - ownership: ${model.ownership || 'partial'}`,
    `  - confidence: ${model.confidence || 'low'}`
  ].join('\n');
}

function formatApiContract(contract) {
  return [
    `- ${contract.publicRoute || contract.endpoint}`,
    `  - methods: ${(contract.methods || []).join(', ') || 'partial'}`,
    `  - source: ${contract.path}`,
    `  - purpose: ${contract.purpose}`,
    `  - auth: ${contract.authRequired ? 'evident' : 'not evident'}`,
    `  - request shape: body[${(contract.requestShape && contract.requestShape.bodyFields || []).join(', ') || 'partial'}] query[${(contract.requestShape && contract.requestShape.queryFields || []).join(', ') || 'none'}]`,
    `  - response shape: ${(contract.responseShape && contract.responseShape.keys || []).join(', ') || 'partial'}`,
    `  - side effects: ${(contract.sideEffects || []).join(', ') || 'none-observed'}`,
    `  - related model: ${(contract.relatedModels || []).join(', ') || 'not confidently inferred'}`,
    `  - confidence: ${contract.confidence}`,
    `  - gaps: ${(contract.gaps || []).join(' ') || 'none'}`
  ].join('\n');
}

function formatDecision(decision) {
  return `- ${decision.statement} [${decision.qualifier || 'candidate'} | ${decision.confidence || 'low'}]`;
}

function formatIssue(issue) {
  return `- ${issue.kind} (${issue.severity}): ${issue.detail}`;
}

function takeFromAnalysis(...groups) {
  return take(groups.flat().filter(Boolean), 6);
}

function buildAgentPlaybook(definition, analysis) {
  const sharedVerifyPaths = {
    start: takeFromAnalysis(
      analysis.startHere && analysis.startHere.entryPoints,
      analysis.startHere && analysis.startHere.hotspots
    ),
    overview: takeFromAnalysis(
      analysis.overview && analysis.overview.entryPoints,
      analysis.overview && analysis.overview.hotspots
    ),
    architecture: takeFromAnalysis(
      analysis.architecture && analysis.architecture.backendSurface,
      analysis.architecture && analysis.architecture.dataLayer,
      analysis.architecture && analysis.architecture.sharedUtilities
    ),
    backend: takeFromAnalysis(
      analysis.backend && analysis.backend.backendFiles,
      analysis.backend && analysis.backend.supportFiles
    ),
    frontend: takeFromAnalysis(
      analysis.frontend && analysis.frontend.pages,
      analysis.frontend && analysis.frontend.components
    ),
    data: takeFromAnalysis(
      analysis.dataModels && analysis.dataModels.prismaFiles,
      analysis.dataModels && analysis.dataModels.modelFiles
    ),
    api: takeFromAnalysis(
      analysis.api && analysis.api.contracts && analysis.api.contracts.map(contract => contract.path),
      analysis.backend && analysis.backend.supportFiles
    ),
    adr: takeFromAnalysis(
      analysis.architecture && analysis.architecture.sharedUtilities,
      analysis.api && analysis.api.contracts && analysis.api.contracts.map(contract => contract.path)
    ),
    recent: takeFromAnalysis(
      analysis.recent && analysis.recent.projectChanges && analysis.recent.projectChanges.files && analysis.recent.projectChanges.files.map(file => file.path),
      analysis.recent && analysis.recent.mappingChanges && analysis.recent.mappingChanges.files && analysis.recent.mappingChanges.files.map(file => file.path)
    ),
    issues: takeFromAnalysis(
      analysis.openIssues && analysis.openIssues.flatMap(issue => issue.evidence && issue.evidence.sourcePaths || []),
      analysis.openIssues && analysis.openIssues.flatMap(issue => issue.evidence && issue.evidence.routeFiles || [])
    )
  };

  const playbooks = {
    start: {
      useWhen: [
        'You are starting a new task and need the fastest route into the repo.',
        'You must choose which domain doc to read first.'
      ],
      readNext: ['01-PROJECT-OVERVIEW.md', '02-ARCHITECTURE.md', 'domain doc matched to the task router'],
      verifyInCode: sharedVerifyPaths.start,
      avoidAssuming: [
        'Task routing is guidance, not proof of ownership.',
        'If readiness is partial, verify the cited paths before broad edits.'
      ]
    },
    overview: {
      useWhen: [
        'You need the repo purpose, main areas, and primary surfaces.',
        'You are onboarding or re-entering the codebase after time away.'
      ],
      readNext: ['02-ARCHITECTURE.md', '03-BACKEND.md', '04-FRONTEND.md', '05-DATA-MODELS.md'],
      verifyInCode: sharedVerifyPaths.overview,
      avoidAssuming: [
        'Overview is a map, not a contract.',
        'Do not treat summary language as enough evidence for sensitive edits.'
      ]
    },
    architecture: {
      useWhen: [
        'The change crosses frontend, backend, API, or data boundaries.',
        'You are planning a refactor or tracing request/data flow.'
      ],
      readNext: ['03-BACKEND.md', '04-FRONTEND.md', '05-DATA-MODELS.md', '07-DECISIONS-ADR.md'],
      verifyInCode: sharedVerifyPaths.architecture,
      avoidAssuming: [
        'Inferred request flow may miss runtime indirection.',
        'Shared utilities often hide coupling that the summary cannot fully prove.'
      ]
    },
    backend: {
      useWhen: [
        'You are editing route handlers, services, workers, or server-side flows.',
        'You need the safest backend entry files before changing behavior.'
      ],
      readNext: ['06-API-CONTRACTS.md', '05-DATA-MODELS.md', '09-OPEN-ISSUES.md'],
      verifyInCode: sharedVerifyPaths.backend,
      avoidAssuming: [
        'Business logic may be outside route files.',
        'Auth and side effects must be verified in the cited code.'
      ]
    },
    frontend: {
      useWhen: [
        'You are changing UI, navigation, layouts, or interaction flows.',
        'You need the main pages/components without mixing in API handlers.'
      ],
      readNext: ['02-ARCHITECTURE.md', '03-BACKEND.md', '06-API-CONTRACTS.md'],
      verifyInCode: sharedVerifyPaths.frontend,
      avoidAssuming: [
        'Component lists do not prove rendering ownership.',
        'UI hotspots should be validated against the actual entry page/layout.'
      ]
    },
    data: {
      useWhen: [
        'You are changing schema, entity ownership, or persistence behavior.',
        'You need to see which models are weakly linked to endpoints.'
      ],
      readNext: ['03-BACKEND.md', '06-API-CONTRACTS.md', '09-OPEN-ISSUES.md'],
      verifyInCode: sharedVerifyPaths.data,
      avoidAssuming: [
        'Model purpose and ownership can be partially inferred.',
        'Relations without endpoint evidence should be treated carefully.'
      ]
    },
    api: {
      useWhen: [
        'You are changing an endpoint contract, auth behavior, or payload shape.',
        'You need evidence-backed request/response expectations.'
      ],
      readNext: ['03-BACKEND.md', '05-DATA-MODELS.md', '09-OPEN-ISSUES.md'],
      verifyInCode: sharedVerifyPaths.api,
      avoidAssuming: [
        'Static auth inference is weaker than runtime middleware inspection.',
        'Partial request or response shapes must be confirmed in code/tests.'
      ]
    },
    adr: {
      useWhen: [
        'You need architectural intent before a non-trivial change.',
        'You are deciding whether the current structure is observed or only inferred.'
      ],
      readNext: ['02-ARCHITECTURE.md', '09-OPEN-ISSUES.md'],
      verifyInCode: sharedVerifyPaths.adr,
      avoidAssuming: [
        'Candidate decisions are not authoritative until confirmed in code/history.',
        'Do not treat inferred decisions as stable policy.'
      ]
    },
    recent: {
      useWhen: [
        'You are continuing recent work or need the freshest likely touchpoints.',
        'You need a fast shortlist before diff or blame inspection.'
      ],
      readNext: ['00-START-HERE.md', '09-OPEN-ISSUES.md'],
      verifyInCode: sharedVerifyPaths.recent,
      avoidAssuming: [
        'Recent changes are based on filesystem mtimes, not semantic git history.',
        'Freshness does not imply importance.'
      ]
    },
    issues: {
      useWhen: [
        'You are about to make a risky change and want known uncertainty first.',
        'You need contradictions, partial zones, and manual review prompts.'
      ],
      readNext: ['02-ARCHITECTURE.md', '03-BACKEND.md', '06-API-CONTRACTS.md', '05-DATA-MODELS.md'],
      verifyInCode: sharedVerifyPaths.issues,
      avoidAssuming: [
        'An issue list is not exhaustive.',
        'Absence of an issue is not evidence of correctness.'
      ]
    }
  };

  const playbook = playbooks[definition.key] || {
    useWhen: ['You need a focused summary before reading raw code.'],
    readNext: ['00-START-HERE.md'],
    verifyInCode: [],
    avoidAssuming: ['This doc is a map, not the source of truth.']
  };

  return {
    heading: 'Agent Playbook',
    body: [
      '### When To Use This Doc',
      formatList(playbook.useWhen, '- none'),
      '### Read Next',
      formatList(playbook.readNext, '- none'),
      '### Verify In Code',
      formatList(playbook.verifyInCode, '- none'),
      '### Do Not Assume',
      formatList(playbook.avoidAssuming, '- none')
    ].join('\n\n')
  };
}

function buildDocSpecificSections(definition, analysis, indexPayload, store) {
  if (definition.key === 'start') {
    return [
      {
        heading: 'Task Router',
        body: formatList((analysis.startHere && analysis.startHere.taskRouter) || [])
      },
      {
        heading: 'Entrypoints',
        body: formatList((analysis.startHere && analysis.startHere.entryPoints) || [])
      },
      {
        heading: 'Hotspots',
        body: formatList((analysis.startHere && analysis.startHere.hotspots) || [])
      },
      {
        heading: 'Operating Rules',
        body: formatList((analysis.startHere && analysis.startHere.rules) || [])
      }
    ];
  }

  if (definition.key === 'overview') {
    return [
      {
        heading: 'What This Repo Appears To Do',
        body: analysis.overview && analysis.overview.narrative || 'Repo purpose is only partially inferred.'
      },
      {
        heading: 'Main Flow',
        body: analysis.overview && analysis.overview.mainFlow || 'Main flow could not be strongly inferred.'
      },
      {
        heading: 'Main Areas',
        body: formatList(analysis.overview && analysis.overview.mainAreas || [])
      },
      {
        heading: 'Surfaces',
        body: formatList(formatSurfaceEntries(analysis.overview && analysis.overview.surfaces || []), '- none')
      },
      {
        heading: 'Important Modules',
        body: formatList(analysis.overview && analysis.overview.importantModules || [])
      },
      {
        heading: 'Entrypoints and Hotspots',
        body: [
          '### Entrypoints',
          formatList(analysis.overview && analysis.overview.entryPoints || [], '- none'),
          '### Hotspots',
          formatList(analysis.overview && analysis.overview.hotspots || [], '- none')
        ].join('\n\n')
      }
    ];
  }

  if (definition.key === 'architecture') {
    return [
      {
        heading: 'Boundaries',
        body: formatKeyValueList([
          ['frontend surface', analysis.architecture && analysis.architecture.boundaries && analysis.architecture.boundaries.frontend],
          ['backend surface', analysis.architecture && analysis.architecture.boundaries && analysis.architecture.boundaries.backend],
          ['api surface', analysis.architecture && analysis.architecture.boundaries && analysis.architecture.boundaries.api],
          ['data layer', analysis.architecture && analysis.architecture.boundaries && analysis.architecture.boundaries.data]
        ])
      },
      {
        heading: 'Request Flow',
        body: analysis.architecture && analysis.architecture.requestFlow || 'No concrete request flow could be inferred.'
      },
      {
        heading: 'Shared Utilities',
        body: formatList(analysis.architecture && analysis.architecture.sharedUtilities || [], '- none')
      },
      {
        heading: 'Critical Zones',
        body: formatList(analysis.architecture && analysis.architecture.criticalZones || [], '- none')
      },
      {
        heading: 'Contradictions',
        body: formatList(analysis.architecture && analysis.architecture.contradictions || [], '- none detected, but verify before delicate changes')
      },
      {
        heading: 'Low-Confidence Zones',
        body: formatList(analysis.architecture && analysis.architecture.lowConfidenceZones || [], '- none explicitly surfaced')
      }
    ];
  }

  if (definition.key === 'backend') {
    return [
      {
        heading: 'Backend Surface',
        body: formatList(analysis.backend && analysis.backend.backendFiles || [], '- none')
      },
      {
        heading: 'Endpoints by Domain',
        body: formatNestedList((analysis.backend && analysis.backend.routeGroups || []).map(group => {
          return [`- ${group.domain}`, ...(group.routes || []).map(route => `  - ${route.endpoint} [${(route.methods || []).join(', ') || 'partial'}] (${route.path})`)].join('\n');
        }), '- none')
      },
      {
        heading: 'Supporting Backend Files',
        body: formatList(analysis.backend && analysis.backend.supportFiles || [], '- none')
      },
      {
        heading: 'Sensitive Operations and Risks',
        body: [
          '### Sensitive Operations',
          formatList(analysis.backend && analysis.backend.sensitiveOperations || [], '- none'),
          '### Risks',
          formatList(analysis.backend && analysis.backend.risks || [], '- none'),
          '### Partial Zones',
          formatList(analysis.backend && analysis.backend.partialZones || [], '- none')
        ].join('\n\n')
      }
    ];
  }

  if (definition.key === 'frontend') {
    return [
      {
        heading: 'Pages',
        body: formatList(analysis.frontend && analysis.frontend.pages || [], '- none')
      },
      {
        heading: 'Layouts',
        body: formatList(analysis.frontend && analysis.frontend.layouts || [], '- none')
      },
      {
        heading: 'Key Components',
        body: formatList(analysis.frontend && analysis.frontend.components || [], '- none')
      },
      {
        heading: 'Surfaces',
        body: formatList(formatSurfaceEntries(analysis.frontend && analysis.frontend.surfaces || []), '- none')
      },
      {
        heading: 'UI Hotspots and Partial Zones',
        body: [
          '### Hotspots',
          formatList(analysis.frontend && analysis.frontend.hotspots || [], '- none'),
          '### Partial Zones',
          formatList(analysis.frontend && analysis.frontend.partialZones || [], '- none')
        ].join('\n\n')
      }
    ];
  }

  if (definition.key === 'data') {
    return [
      {
        heading: 'Schema Files',
        body: formatList(analysis.dataModels && analysis.dataModels.prismaFiles || [], '- none')
      },
      {
        heading: 'Core Entities',
        body: formatList(analysis.dataModels && analysis.dataModels.coreEntities || [], '- none')
      },
      {
        heading: 'Entities',
        body: formatNestedList((analysis.dataModels && analysis.dataModels.models || []).map(formatModel), '- none')
      },
      {
        heading: 'Enums',
        body: formatList((analysis.dataModels && analysis.dataModels.enums || []).map(item => `${item.name}: ${(item.values || []).join(', ')}`), '- none')
      },
      {
        heading: 'Risks',
        body: formatList(analysis.dataModels && analysis.dataModels.risks || [], '- none')
      }
    ];
  }

  if (definition.key === 'api') {
    return [
      {
        heading: 'Endpoint Contracts',
        body: formatNestedList((analysis.api && analysis.api.contracts || []).map(formatApiContract), '- none')
      }
    ];
  }

  if (definition.key === 'adr') {
    return [
      {
        heading: 'Decisions',
        body: formatList((analysis.decisions || []).map(formatDecision), '- none')
      }
    ];
  }

  if (definition.key === 'recent') {
    return [
      {
        heading: 'Recent Project Changes',
        body: [
          formatKeyValueList([
            ['strategy', analysis.recent && analysis.recent.projectChanges && analysis.recent.projectChanges.strategy],
            ['limitations', analysis.recent && analysis.recent.limitations]
          ]),
          '### Files',
          formatList((analysis.recent && analysis.recent.projectChanges && analysis.recent.projectChanges.files || []).map(file => file.path), '- none')
        ].join('\n\n')
      },
      {
        heading: 'Recent Mapping / Context Changes',
        body: [
          formatKeyValueList([
            ['strategy', analysis.recent && analysis.recent.mappingChanges && analysis.recent.mappingChanges.strategy]
          ]),
          '### Files',
          formatList((analysis.recent && analysis.recent.mappingChanges && analysis.recent.mappingChanges.files || []).map(file => file.path), '- none')
        ].join('\n\n')
      }
    ];
  }

  if (definition.key === 'issues') {
    return [
      {
        heading: 'Open Issues',
        body: formatList((analysis.openIssues || []).map(formatIssue), '- none')
      }
    ];
  }

  return [
    {
      heading: 'Project Snapshot',
      body: formatKeyValueList([
        ['repo slug', store.repoSlug],
        ['commit', indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit],
        ['files indexed', indexPayload.repoMeta && indexPayload.repoMeta.fileCount]
      ])
    }
  ];
}

function renderAiContextDoc(definition, indexPayload, store, options = {}) {
  const analysis = indexPayload.analysis || {};
  const metadata = buildMetadata(definition, store, indexPayload, options);
  const docEvaluation = findDocEvaluation(analysis, definition);
  const evidenceByKey = {
    start: analysis.startHere && analysis.startHere.evidence,
    overview: analysis.overview && analysis.overview.evidence,
    architecture: analysis.architecture && analysis.architecture.evidence,
    backend: analysis.backend && analysis.backend.evidence,
    frontend: analysis.frontend && analysis.frontend.evidence,
    data: analysis.dataModels && analysis.dataModels.evidence,
    api: analysis.api && analysis.api.evidence,
    adr: { basedOnCommit: metadata.basedOnCommit },
    recent: analysis.recent && analysis.recent.evidence,
    issues: analysis.architecture && analysis.architecture.evidence
  };

  const sections = [
    {
      heading: 'Mapping Metadata',
      body: ['```json', JSON.stringify(metadata, null, 2), '```'].join('\n')
    },
    renderReadinessSection(docEvaluation),
    buildAgentPlaybook(definition, analysis),
    ...buildDocSpecificSections(definition, analysis, indexPayload, store),
    renderEvidenceSection(evidenceByKey[definition.key] || { basedOnCommit: metadata.basedOnCommit })
  ];
  const body = sections.map(section => `## ${section.heading}\n\n${section.body}`).join('\n\n');
  return {
    metadata,
    content: `# ${definition.title}\n\n${body}\n`
  };
}

function renderAllAiContextDocs(indexPayload, store, options = {}) {
  return ['start', 'overview', 'architecture', 'backend', 'frontend', 'data', 'api', 'adr', 'recent', 'issues']
    .map(key => getAiContextDocDefinition(key))
    .filter(Boolean)
    .map(definition => ({
      definition,
      rendered: renderAiContextDoc(definition, indexPayload, store, options)
    }));
}

module.exports = {
  AI_CONTEXT_RENDER_V2_SCHEMA_VERSION,
  buildAiContextMetadata: buildMetadata,
  renderAiContextDoc,
  renderAllAiContextDocs
};
