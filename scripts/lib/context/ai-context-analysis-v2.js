'use strict';

const fs = require('fs');
const path = require('path');

const { buildAiContextAnalysis: buildBaseAiContextAnalysis } = require('./ai-context-analysis');
const { criticizeAiContextAnalysis } = require('./ai-context-critic');

const AI_CONTEXT_ANALYSIS_V2_SCHEMA_VERSION = 'ecc.ai-context-analysis.v2';
const MODE_CONFIG = Object.freeze({
  seed: { maxFilesPerEvidence: 4, maxContracts: 8, maxModels: 8, maxRecent: 5, deepReadBytes: 8000 },
  balanced: { maxFilesPerEvidence: 8, maxContracts: 12, maxModels: 12, maxRecent: 8, deepReadBytes: 16000 },
  deep: { maxFilesPerEvidence: 14, maxContracts: 20, maxModels: 20, maxRecent: 12, deepReadBytes: 40000 }
});
const MARKETING_PATTERN = /(beautiful|delightful|world[- ]class|revolutionary|seamless|stunning|best[- ]in[- ]class|amazing|incredible)/iu;

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function take(values, limit = 8) {
  return unique(values).slice(0, limit);
}

function normalizeFilePath(filePath) {
  return String(filePath || '').split(path.sep).join('/');
}

function getModeConfig(mode) {
  return MODE_CONFIG[mode] || MODE_CONFIG.balanced;
}

function getFingerprintMap(indexPayload) {
  const files = indexPayload.fingerprints && Array.isArray(indexPayload.fingerprints.files)
    ? indexPayload.fingerprints.files
    : [];
  return new Map(files.map(file => [file.path, file]));
}

function getSymbolsMap(indexPayload) {
  const symbolFiles = indexPayload.symbols && Array.isArray(indexPayload.symbols.files)
    ? indexPayload.symbols.files
    : [];
  return new Map(symbolFiles.map(file => [file.path, file]));
}

function getAreaFiles(indexPayload, area) {
  const areas = indexPayload.modules && Array.isArray(indexPayload.modules.areas) ? indexPayload.modules.areas : [];
  const match = areas.find(entry => entry.area === area);
  return match && Array.isArray(match.files) ? match.files : [];
}

function readRepoFile(repoRoot, relativePath, maxBytes) {
  try {
    const absolutePath = path.join(repoRoot, normalizeFilePath(relativePath).split('/').join(path.sep));
    const content = fs.readFileSync(absolutePath, 'utf8');
    return content.length > maxBytes ? content.slice(0, maxBytes) : content;
  } catch {
    return '';
  }
}

function extractImports(content) {
  const imports = [];
  for (const match of content.matchAll(/import\s+[^'"`]+?from\s+['"`]([^'"`]+)['"`]/gu)) {
    imports.push(match[1]);
  }
  for (const match of content.matchAll(/require\(['"`]([^'"`]+)['"`]\)/gu)) {
    imports.push(match[1]);
  }
  return unique(imports);
}

function collectImports(repoRoot, filePaths, config) {
  const imports = [];
  for (const filePath of take(filePaths, config.maxFilesPerEvidence)) {
    imports.push(...extractImports(readRepoFile(repoRoot, filePath, config.deepReadBytes)));
  }
  return take(imports, config.maxFilesPerEvidence * 2);
}

function collectSymbols(symbolMap, filePaths, limit = 10) {
  const symbols = [];
  for (const filePath of filePaths) {
    const symbolEntry = symbolMap.get(filePath);
    if (!symbolEntry) {
      continue;
    }
    symbols.push(...(symbolEntry.exports || []).map(value => `${filePath}#export:${value}`));
    symbols.push(...(symbolEntry.functions || []).map(value => `${filePath}#fn:${value}`));
  }
  return take(symbols, limit);
}

function buildSourceFingerprint(paths, fingerprintMap, limit = 8) {
  return take(paths, limit)
    .map(filePath => {
      const match = fingerprintMap.get(filePath);
      if (!match) {
        return null;
      }
      return `${filePath}:${match.sha1 || 'nohash'}`;
    })
    .filter(Boolean);
}

function buildEvidence(indexPayload, sourcePaths = [], extras = {}, config = MODE_CONFIG.balanced) {
  const fingerprintMap = getFingerprintMap(indexPayload);
  return {
    sourcePaths: take(sourcePaths, config.maxFilesPerEvidence),
    routeFiles: take(extras.routeFiles || [], config.maxFilesPerEvidence),
    schemaRefs: take(extras.schemaRefs || [], config.maxFilesPerEvidence),
    importsSeen: take(extras.importsSeen || [], config.maxFilesPerEvidence * 2),
    symbolsSeen: take(extras.symbolsSeen || [], config.maxFilesPerEvidence * 2),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit ? indexPayload.repoMeta.basedOnCommit : 'unknown',
    sourceFingerprint: buildSourceFingerprint(sourcePaths, fingerprintMap, config.maxFilesPerEvidence)
  };
}

function buildRelatedDomainSummary(routeGroups = []) {
  return take(routeGroups.map(group => `${group.domain} (${group.routes.length} routes)`), 8);
}

function sanitizeNarrative(baseAnalysis) {
  const candidates = [
    baseAnalysis.packageInfo && baseAnalysis.packageInfo.description,
    baseAnalysis.readmeSummary,
    baseAnalysis.overview && baseAnalysis.overview.narrative
  ].filter(value => typeof value === 'string' && value.trim().length > 0);
  const cleaned = candidates.find(value => !MARKETING_PATTERN.test(value));
  return cleaned || candidates[0] || 'Repo purpose is only partially inferred from package metadata and source layout.';
}

function buildStartHere(baseAnalysis, indexPayload, config) {
  const entryPoints = take(baseAnalysis.overview && baseAnalysis.overview.entryPoints || [], 12);
  const hotspots = take(baseAnalysis.overview && baseAnalysis.overview.hotspots || [], 10);
  const sourcePaths = unique([
    ...entryPoints,
    ...(baseAnalysis.backend && baseAnalysis.backend.backendFiles || []).slice(0, 4),
    ...(baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || []).slice(0, 2)
  ]);
  return {
    taskRouter: [
      'frontend/ui -> 04-FRONTEND.md, then 02-ARCHITECTURE.md',
      'backend/api -> 03-BACKEND.md, then 06-API-CONTRACTS.md',
      'data/db -> 05-DATA-MODELS.md, then 03-BACKEND.md',
      'fullstack -> 00-START-HERE.md, 01-PROJECT-OVERVIEW.md, 02-ARCHITECTURE.md, then domain docs',
      'cambios delicados -> 02-ARCHITECTURE.md, 07-DECISIONS-ADR.md, 09-OPEN-ISSUES.md'
    ],
    rules: [
      'Código real sigue siendo source of truth.',
      'Empieza por prepared context y working set cuando existan.',
      'No hagas broad search primero si el mapa ya cubre el dominio.',
      'Si una sección está en partial o low confidence, baja al código citado.'
    ],
    entryPoints,
    hotspots,
    evidence: buildEvidence(indexPayload, sourcePaths, {
      routeFiles: (baseAnalysis.api && baseAnalysis.api.contracts || []).map(contract => contract.path),
      schemaRefs: baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || []
    }, config)
  };
}

function buildOverview(repoRoot, baseAnalysis, indexPayload, config) {
  const narrative = sanitizeNarrative(baseAnalysis);
  const routeGroups = baseAnalysis.backend && Array.isArray(baseAnalysis.backend.routeGroups) ? baseAnalysis.backend.routeGroups : [];
  const coreEntities = baseAnalysis.dataModels && Array.isArray(baseAnalysis.dataModels.coreEntities) ? baseAnalysis.dataModels.coreEntities : [];
  const mainFlow = routeGroups.length > 0
    ? `Main flow appears to go through ${routeGroups[0].domain} routes, then backend helpers/data access, with ${coreEntities.join(', ') || 'core entities'} involved.`
    : 'Main flow could not be strongly inferred because route surface is thin.';
  const modules = take([
    ...buildRelatedDomainSummary(routeGroups),
    ...(baseAnalysis.frontend && Array.isArray(baseAnalysis.frontend.hotspots) ? baseAnalysis.frontend.hotspots : []),
    ...coreEntities.map(entity => `data:${entity}`)
  ], 12);
  const surfaces = baseAnalysis.overview && Array.isArray(baseAnalysis.overview.surfaces) ? baseAnalysis.overview.surfaces : [];
  const evidencePaths = unique([
    ...(baseAnalysis.overview && baseAnalysis.overview.entryPoints || []),
    ...(baseAnalysis.frontend && baseAnalysis.frontend.pages || []),
    ...(baseAnalysis.backend && baseAnalysis.backend.backendFiles || []).slice(0, 4)
  ]);
  return {
    narrative,
    mainFlow,
    mainAreas: baseAnalysis.overview && baseAnalysis.overview.mainAreas || [],
    surfaces,
    importantModules: modules,
    entryPoints: baseAnalysis.overview && baseAnalysis.overview.entryPoints || [],
    hotspots: baseAnalysis.overview && baseAnalysis.overview.hotspots || [],
    evidence: buildEvidence(indexPayload, evidencePaths, {
      routeFiles: (baseAnalysis.api && baseAnalysis.api.contracts || []).map(contract => contract.path),
      schemaRefs: baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || []
    }, config)
  };
}

function buildArchitecture(repoRoot, baseAnalysis, indexPayload, config) {
  const sharedUtilities = getAreaFiles(indexPayload, 'backend')
    .concat(getAreaFiles(indexPayload, 'frontend'))
    .filter(filePath => /(^|\/)(src\/)?(lib|utils|shared|common)\//u.test(filePath));
  const requestFlow = (baseAnalysis.api && baseAnalysis.api.contracts || []).length > 0
    ? 'Observed request flow: public route -> route handler -> helper/service or direct data access -> JSON response.'
    : 'No strong request flow could be established from routes.';
  const confidenceBySection = {
    boundaries: baseAnalysis.architecture && baseAnalysis.architecture.boundaries && baseAnalysis.architecture.boundaries.api > 0 ? 'high' : 'medium',
    requestFlow: (baseAnalysis.api && baseAnalysis.api.contracts || []).some(contract => contract.methods.length > 0) ? 'medium' : 'low',
    sharedUtilities: sharedUtilities.length > 0 ? 'medium' : 'low'
  };
  const evidencePaths = unique([
    ...(baseAnalysis.frontend && baseAnalysis.frontend.pages || []).slice(0, 4),
    ...(baseAnalysis.backend && baseAnalysis.backend.backendFiles || []).slice(0, 6),
    ...sharedUtilities.slice(0, 4),
    ...(baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || [])
  ]);
  return {
    boundaries: baseAnalysis.architecture && baseAnalysis.architecture.boundaries || {},
    frontendSurface: baseAnalysis.frontend && baseAnalysis.frontend.pages || [],
    backendSurface: baseAnalysis.backend && baseAnalysis.backend.backendFiles || [],
    dataLayer: baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || [],
    sharedUtilities: take(sharedUtilities, config.maxFilesPerEvidence),
    requestFlow,
    criticalZones: baseAnalysis.architecture && baseAnalysis.architecture.criticalZones || [],
    contradictions: baseAnalysis.architecture && baseAnalysis.architecture.contradictions || [],
    lowConfidenceZones: baseAnalysis.architecture && baseAnalysis.architecture.lowConfidenceZones || [],
    confidenceBySection,
    evidence: buildEvidence(indexPayload, evidencePaths, {
      routeFiles: (baseAnalysis.api && baseAnalysis.api.contracts || []).map(contract => contract.path),
      schemaRefs: baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || [],
      importsSeen: collectImports(repoRoot, evidencePaths, config),
      symbolsSeen: collectSymbols(getSymbolsMap(indexPayload), evidencePaths)
    }, config)
  };
}

function buildBackend(repoRoot, baseAnalysis, indexPayload, config) {
  const contracts = baseAnalysis.api && Array.isArray(baseAnalysis.api.contracts) ? baseAnalysis.api.contracts : [];
  const supportFiles = baseAnalysis.backend && Array.isArray(baseAnalysis.backend.supportFiles) ? baseAnalysis.backend.supportFiles : [];
  const risks = take([
    contracts.some(contract => contract.authRequired) ? 'Auth-sensitive handlers exist and should be changed carefully.' : null,
    contracts.some(contract => contract.sideEffects.some(effect => effect.startsWith('prisma.'))) ? 'Several handlers mutate persistent data directly.' : null,
    supportFiles.some(filePath => /service|controller|handler/u.test(filePath)) ? 'Supporting backend helpers may hide business logic outside route files.' : null
  ], 8);
  const partialZones = take([
    ...contracts.filter(contract => contract.confidence === 'low').map(contract => `${contract.endpoint}: contract is only partially inferred.`),
    supportFiles.length === 0 && contracts.length > 0 ? 'Backend support files were not confidently linked beyond route handlers.' : null
  ], 8);
  const evidencePaths = unique([
    ...(baseAnalysis.backend && baseAnalysis.backend.backendFiles || []).slice(0, config.maxFilesPerEvidence),
    ...supportFiles.slice(0, 4)
  ]);
  return {
    backendFiles: baseAnalysis.backend && baseAnalysis.backend.backendFiles || [],
    routeGroups: baseAnalysis.backend && baseAnalysis.backend.routeGroups || [],
    handlers: contracts.slice(0, config.maxContracts).map(contract => `${contract.endpoint} [${contract.methods.join(', ') || 'partial'}]`),
    supportFiles,
    sensitiveOperations: baseAnalysis.backend && baseAnalysis.backend.sensitiveOperations || [],
    risks,
    partialZones,
    confidenceBySection: {
      backendSurface: (baseAnalysis.backend && baseAnalysis.backend.backendFiles || []).length > 0 ? 'high' : 'low',
      supportFiles: supportFiles.length > 0 ? 'medium' : 'low',
      authInference: contracts.some(contract => contract.authRequired) ? 'medium' : 'low'
    },
    evidence: buildEvidence(indexPayload, evidencePaths, {
      routeFiles: contracts.map(contract => contract.path),
      importsSeen: collectImports(repoRoot, evidencePaths, config),
      symbolsSeen: collectSymbols(getSymbolsMap(indexPayload), evidencePaths)
    }, config)
  };
}

function buildFrontend(repoRoot, baseAnalysis, indexPayload, config) {
  const surfaces = baseAnalysis.frontend && Array.isArray(baseAnalysis.frontend.surfaces) ? baseAnalysis.frontend.surfaces : [];
  const categorizedSurfaces = ['admin', 'client', 'public', 'shared'].map(name => ({
    name,
    files: take(surfaces.filter(surface => surface.surface === name).flatMap(surface => surface.files || []), config.maxFilesPerEvidence)
  })).filter(entry => entry.files.length > 0);
  const evidencePaths = unique([
    ...(baseAnalysis.frontend && baseAnalysis.frontend.pages || []),
    ...(baseAnalysis.frontend && baseAnalysis.frontend.layouts || []),
    ...(baseAnalysis.frontend && baseAnalysis.frontend.components || []).slice(0, 6)
  ]);
  return {
    pages: baseAnalysis.frontend && baseAnalysis.frontend.pages || [],
    layouts: baseAnalysis.frontend && baseAnalysis.frontend.layouts || [],
    components: baseAnalysis.frontend && baseAnalysis.frontend.components || [],
    surfaces: categorizedSurfaces,
    hotspots: baseAnalysis.frontend && baseAnalysis.frontend.hotspots || [],
    partialZones: categorizedSurfaces.length === 0 ? ['No strong admin/client/public surface split could be inferred.'] : [],
    confidenceBySection: {
      frontendSurface: (baseAnalysis.frontend && baseAnalysis.frontend.pages || []).length > 0 ? 'high' : 'medium',
      surfaceSegmentation: categorizedSurfaces.length > 0 ? 'medium' : 'low'
    },
    evidence: buildEvidence(indexPayload, evidencePaths, {
      importsSeen: collectImports(repoRoot, evidencePaths, config),
      symbolsSeen: collectSymbols(getSymbolsMap(indexPayload), evidencePaths)
    }, config)
  };
}

function deriveEntityPurpose(model, relatedEndpoints) {
  if (relatedEndpoints.length > 0) {
    return `Likely supports ${relatedEndpoints.join(', ')} routes.`;
  }
  if ((model.relations || []).length > 0) {
    return 'Appears to be a relational core entity in the data layer.';
  }
  return 'Purpose is only partially inferred from schema fields.';
}

function deriveEntityConfidence(model, relatedEndpoints) {
  let score = 0.35;
  if ((model.importantFields || []).length > 2) {
    score += 0.2;
  }
  if ((model.relations || []).length > 0) {
    score += 0.25;
  }
  if (relatedEndpoints.length > 0) {
    score += 0.15;
  }
  if (score >= 0.75) {
    return 'high';
  }
  if (score >= 0.55) {
    return 'medium';
  }
  return 'low';
}

function buildDataModels(repoRoot, baseAnalysis, indexPayload, config) {
  const contracts = baseAnalysis.api && Array.isArray(baseAnalysis.api.contracts) ? baseAnalysis.api.contracts : [];
  const models = (baseAnalysis.dataModels && Array.isArray(baseAnalysis.dataModels.models) ? baseAnalysis.dataModels.models : [])
    .slice(0, config.maxModels)
    .map(model => {
      const relatedEndpoints = take(contracts.filter(contract => (contract.relatedModels || []).includes(model.name)).map(contract => contract.endpoint), 6);
      const confidence = deriveEntityConfidence(model, relatedEndpoints);
      return {
        ...model,
        purpose: deriveEntityPurpose(model, relatedEndpoints),
        keyFields: take((model.importantFields || []).map(field => String(field).split(':')[0].trim()), 8),
        ownership: relatedEndpoints.length > 0 ? `Owned mainly by ${relatedEndpoints[0]} flow.` : 'Ownership is only partially inferred.',
        relatedEndpoints,
        relatedModules: take(relatedEndpoints.map(endpoint => `api:${String(endpoint).replace(/^\//u, '').split('/')[0] || 'root'}`), 4),
        confidence,
        evidence: buildEvidence(indexPayload, baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || [], {
          schemaRefs: baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || []
        }, config)
      };
    });
  const enumEntries = baseAnalysis.dataModels && baseAnalysis.dataModels.enums || [];
  const evidencePaths = unique([
    ...(baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || []),
    ...(baseAnalysis.dataModels && baseAnalysis.dataModels.modelFiles || []).slice(0, 4)
  ]);
  return {
    prismaFiles: baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || [],
    modelFiles: baseAnalysis.dataModels && baseAnalysis.dataModels.modelFiles || [],
    models,
    enums: enumEntries,
    coreEntities: baseAnalysis.dataModels && baseAnalysis.dataModels.coreEntities || [],
    risks: baseAnalysis.dataModels && baseAnalysis.dataModels.risks || [],
    confidenceBySection: {
      entities: models.length > 0 ? 'high' : 'low',
      relationships: models.some(model => (model.relations || []).length > 0) ? 'medium' : 'low'
    },
    evidence: buildEvidence(indexPayload, evidencePaths, {
      schemaRefs: baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || [],
      importsSeen: collectImports(repoRoot, evidencePaths, config),
      symbolsSeen: collectSymbols(getSymbolsMap(indexPayload), evidencePaths)
    }, config)
  };
}

function buildApi(repoRoot, baseAnalysis, indexPayload, config) {
  const contracts = (baseAnalysis.api && Array.isArray(baseAnalysis.api.contracts) ? baseAnalysis.api.contracts : [])
    .slice(0, config.maxContracts)
    .map(contract => {
      const gaps = take([
        contract.methods.length === 0 ? 'HTTP method export was not confidently inferred.' : null,
        contract.requestShape.bodyFields.length === 0 && contract.requestShape.queryFields.length === 0 ? 'Request shape is partial.' : null,
        contract.responseKeys.length === 0 ? 'Response shape is partial.' : null,
        contract.relatedModels.length === 0 ? 'Related entity/model is unclear.' : null,
        contract.authRequired === false ? 'Auth is not evident from static inspection.' : null
      ], 6);
      return {
        ...contract,
        publicRoute: contract.endpoint,
        responseShape: {
          keys: contract.responseKeys,
          confidence: contract.responseKeys.length > 0 ? 'medium' : 'low'
        },
        confidenceByAspect: {
          backendSurface: 'high',
          authInference: contract.authRequired ? 'medium' : 'low',
          requestShape: contract.requestShape.bodyFields.length > 0 || contract.requestShape.queryFields.length > 0 ? 'medium' : 'low',
          responseShape: contract.responseKeys.length > 0 ? 'medium' : 'low'
        },
        gaps,
        evidence: buildEvidence(indexPayload, [contract.path], {
          routeFiles: [contract.path],
          schemaRefs: (baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || []).filter(() => contract.relatedModels.length > 0),
          importsSeen: collectImports(repoRoot, [contract.path], config),
          symbolsSeen: collectSymbols(getSymbolsMap(indexPayload), [contract.path])
        }, config)
      };
    });
  return {
    contracts,
    routeGroups: baseAnalysis.api && baseAnalysis.api.routeGroups || [],
    evidence: buildEvidence(indexPayload, contracts.map(contract => contract.path), {
      routeFiles: contracts.map(contract => contract.path),
      importsSeen: take(contracts.flatMap(contract => contract.evidence.importsSeen), config.maxFilesPerEvidence * 2),
      symbolsSeen: take(contracts.flatMap(contract => contract.evidence.symbolsSeen), config.maxFilesPerEvidence * 2)
    }, config)
  };
}

function buildDecisions(baseAnalysis, indexPayload, config) {
  const projectProfile = indexPayload.projectProfile || {};
  const decisions = [];
  if (projectProfile.primary) {
    decisions.push({
      statement: `${projectProfile.primary} appears to be the primary framework/runtime entry for the repo.`,
      qualifier: 'observed',
      confidence: 'high',
      evidence: buildEvidence(indexPayload, [], { sourcePaths: [], importsSeen: [], schemaRefs: [] }, config)
    });
  }
  for (const text of baseAnalysis.decisions || []) {
    decisions.push({
      statement: text,
      qualifier: /indicate|present/u.test(text) ? 'candidate' : 'observed',
      confidence: /present|used/u.test(text) ? 'medium' : 'high',
      evidence: buildEvidence(indexPayload, [], {
        routeFiles: (baseAnalysis.api && baseAnalysis.api.contracts || []).map(contract => contract.path),
        schemaRefs: baseAnalysis.dataModels && baseAnalysis.dataModels.prismaFiles || []
      }, config)
    });
  }
  return decisions.slice(0, 10);
}

function buildRecent(indexPayload, config) {
  const files = indexPayload.fingerprints && Array.isArray(indexPayload.fingerprints.files) ? indexPayload.fingerprints.files : [];
  const projectChanges = files
    .filter(file => !/^AI_CONTEXT\//u.test(file.path) && !/^scripts\/lib\/context\//u.test(file.path))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, config.maxRecent)
    .map(file => ({ path: file.path, mtimeMs: file.mtimeMs }));
  const mappingChanges = files
    .filter(file => /^AI_CONTEXT\//u.test(file.path) || /^scripts\/lib\/context\//u.test(file.path))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, config.maxRecent)
    .map(file => ({ path: file.path, mtimeMs: file.mtimeMs }));
  return {
    projectChanges: {
      strategy: projectChanges.length > 0 ? 'filesystem-mtime' : 'insufficient-history',
      files: projectChanges
    },
    mappingChanges: {
      strategy: mappingChanges.length > 0 ? 'filesystem-mtime' : 'insufficient-history',
      files: mappingChanges
    },
    limitations: 'Recent changes are inferred from filesystem mtimes. This is weaker than git diff/history and should not be treated as strong semantic evidence.',
    evidence: buildEvidence(indexPayload, unique([...projectChanges.map(file => file.path), ...mappingChanges.map(file => file.path)]), {}, config)
  };
}

function buildOpenIssues(baseAnalysis, indexPayload, config, enriched) {
  const baseIssues = Array.isArray(baseAnalysis.openIssues) ? baseAnalysis.openIssues : [];
  const extraIssues = [];
  (enriched.api.contracts || []).forEach(contract => {
    if ((contract.gaps || []).length > 0) {
      extraIssues.push({
        severity: contract.confidence === 'low' ? 'high' : 'medium',
        kind: 'partial-endpoint',
        detail: `${contract.endpoint}: ${contract.gaps.join(' ')}`,
        evidence: contract.evidence
      });
    }
  });
  (enriched.dataModels.models || []).forEach(model => {
    if (model.confidence === 'low') {
      extraIssues.push({
        severity: 'medium',
        kind: 'data-model-gap',
        detail: `${model.name}: purpose or relationships remain partially inferred.`,
        evidence: model.evidence
      });
    }
  });
  if ((enriched.backend.supportFiles || []).length === 0 && (enriched.backend.backendFiles || []).length > 0) {
    extraIssues.push({
      severity: 'low',
      kind: 'manual-review-needed',
      detail: 'Backend support files are thin; inspect handlers directly before making large backend changes.',
      evidence: enriched.backend.evidence
    });
  }
  const combined = unique([
    ...baseIssues.map(issue => JSON.stringify({ ...issue, evidence: issue.evidence || enriched.architecture.evidence })),
    ...extraIssues.map(issue => JSON.stringify(issue))
  ]).map(value => JSON.parse(value));
  if (combined.length === 0) {
    combined.push({
      severity: 'medium',
      kind: 'manual-review-needed',
      detail: 'No strong contradictions were found, but a manual check is still recommended before delicate changes.',
      evidence: enriched.architecture.evidence
    });
  }
  return combined.slice(0, 14);
}

function buildAiContextAnalysis(repoRoot, indexPayload, options = {}) {
  const mode = options.mode || 'balanced';
  const config = getModeConfig(mode);
  const base = buildBaseAiContextAnalysis(repoRoot, indexPayload);
  const startHere = buildStartHere(base, indexPayload, config);
  const overview = buildOverview(repoRoot, base, indexPayload, config);
  const architecture = buildArchitecture(repoRoot, base, indexPayload, config);
  const backend = buildBackend(repoRoot, base, indexPayload, config);
  const frontend = buildFrontend(repoRoot, base, indexPayload, config);
  const dataModels = buildDataModels(repoRoot, base, indexPayload, config);
  const api = buildApi(repoRoot, base, indexPayload, config);
  const decisions = buildDecisions(base, indexPayload, config);
  const recent = buildRecent(indexPayload, config);
  const enriched = {
    schemaVersion: AI_CONTEXT_ANALYSIS_V2_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    mode,
    repoRoot,
    packageInfo: base.packageInfo,
    readmeSummary: base.readmeSummary,
    startHere,
    overview,
    architecture,
    backend,
    frontend,
    dataModels,
    api,
    decisions,
    recent,
    openIssues: []
  };
  enriched.openIssues = buildOpenIssues(base, indexPayload, config, enriched);
  enriched.critic = criticizeAiContextAnalysis(indexPayload, enriched, { mode });
  return enriched;
}

module.exports = {
  AI_CONTEXT_ANALYSIS_V2_SCHEMA_VERSION,
  MODE_CONFIG,
  buildAiContextAnalysis,
  getModeConfig
};
