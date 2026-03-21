'use strict';

const fs = require('fs');
const path = require('path');

const { getModeConfig } = require('./ai-context-analysis-v2');

const STRUCTURED_MAPS_SCHEMA_VERSION = 'ecc.structured-maps.v1';
const ROUTE_TO_MODEL_MAP_SCHEMA_VERSION = 'ecc.route-to-model-map.v1';
const ENTITY_USAGE_MAP_SCHEMA_VERSION = 'ecc.entity-usage-map.v1';
const HOTSPOTS_MAP_SCHEMA_VERSION = 'ecc.hotspots-map.v1';
const SCREEN_TO_API_MAP_SCHEMA_VERSION = 'ecc.screen-to-api-map.v1';
const RISK_ZONES_MAP_SCHEMA_VERSION = 'ecc.risk-zones-map.v1';
const DEPENDENCY_CLUSTERS_MAP_SCHEMA_VERSION = 'ecc.dependency-clusters-map.v1';
const CONFIDENCE_MAP_SCHEMA_VERSION = 'ecc.confidence-map.v1';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function take(values, limit = 8) {
  return unique(values).slice(0, limit);
}

function round(value) {
  return Number(Math.max(0, Math.min(1, value || 0)).toFixed(2));
}

function confidenceLabel(score) {
  if (score >= 0.78) {
    return 'high';
  }
  if (score >= 0.55) {
    return 'medium';
  }
  return 'low';
}

function stateFromScore(score, evidenceCount = 0) {
  if (score >= 0.78 && evidenceCount >= 2) {
    return 'ready';
  }
  if (score >= 0.45 && evidenceCount >= 1) {
    return 'partial';
  }
  return 'needs_review';
}

function average(values) {
  const filtered = (Array.isArray(values) ? values : []).filter(value => typeof value === 'number');
  if (filtered.length === 0) {
    return 0;
  }
  return round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

function normalizePath(value) {
  return String(value || '').split(path.sep).join('/');
}

function getFileSet(indexPayload) {
  return new Set((indexPayload.fingerprints && indexPayload.fingerprints.files || []).map(file => file.path));
}

function getFingerprintMap(indexPayload) {
  return new Map((indexPayload.fingerprints && indexPayload.fingerprints.files || []).map(file => [file.path, file]));
}

function readRepoFile(repoRoot, filePath, maxBytes) {
  try {
    const absolutePath = path.join(repoRoot, normalizePath(filePath).split('/').join(path.sep));
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

function resolveImportToRepoPath(importTarget, fromFilePath, fileSet) {
  if (typeof importTarget !== 'string' || importTarget.length === 0) {
    return null;
  }

  const candidates = [];
  const addStemCandidates = stem => {
    candidates.push(stem);
    candidates.push(`${stem}.ts`);
    candidates.push(`${stem}.tsx`);
    candidates.push(`${stem}.js`);
    candidates.push(`${stem}.jsx`);
    candidates.push(`${stem}.mjs`);
    candidates.push(`${stem}.cjs`);
    candidates.push(`${stem}/index.ts`);
    candidates.push(`${stem}/index.tsx`);
    candidates.push(`${stem}/index.js`);
    candidates.push(`${stem}/index.jsx`);
  };

  if (importTarget.startsWith('@/')) {
    addStemCandidates(importTarget.slice(2));
  } else if (importTarget.startsWith('./') || importTarget.startsWith('../')) {
    const baseDir = normalizePath(path.posix.dirname(normalizePath(fromFilePath)));
    addStemCandidates(path.posix.normalize(path.posix.join(baseDir, importTarget)));
  }

  for (const candidate of unique(candidates)) {
    if (fileSet.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildEvidence(indexPayload, sourcePaths = [], extras = {}, limit = 8) {
  const fingerprintMap = getFingerprintMap(indexPayload);
  const normalizedSourcePaths = take(sourcePaths, limit);
  return {
    sourcePaths: normalizedSourcePaths,
    routeFiles: take(extras.routeFiles || [], limit),
    schemaRefs: take(extras.schemaRefs || [], limit),
    importsSeen: take(extras.importsSeen || [], limit),
    symbolsSeen: take(extras.symbolsSeen || [], limit),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit ? indexPayload.repoMeta.basedOnCommit : 'unknown',
    sourceFingerprint: normalizedSourcePaths.map(filePath => {
      const file = fingerprintMap.get(filePath);
      return file ? `${filePath}:${file.sha1 || 'nohash'}` : null;
    }).filter(Boolean)
  };
}

function buildMapContract(schemaVersion, sourceOfTruth, fields, invalidationRules) {
  return {
    schemaVersion,
    sourceOfTruth,
    fields,
    invalidationRules
  };
}

function collectResolvedImports(repoRoot, filePaths, indexPayload, config) {
  const fileSet = getFileSet(indexPayload);
  const resolved = [];
  const rawImports = [];

  take(filePaths, config.maxFilesPerEvidence).forEach(filePath => {
    const content = readRepoFile(repoRoot, filePath, config.deepReadBytes);
    const imports = extractImports(content);
    rawImports.push(...imports);
    imports.forEach(importTarget => {
      const resolvedImport = resolveImportToRepoPath(importTarget, filePath, fileSet);
      if (resolvedImport) {
        resolved.push(resolvedImport);
      }
    });
  });

  return {
    importsSeen: take(rawImports, config.maxFilesPerEvidence * 2),
    resolvedFiles: take(resolved, config.maxFilesPerEvidence * 2)
  };
}

function detectEntitiesInContent(content, models = []) {
  const matches = [];
  models.forEach(model => {
    const modelName = String(model.name || '');
    if (!modelName) {
      return;
    }
    const lowerName = modelName.toLowerCase();
    const prismaPattern = new RegExp(`prisma\\.${lowerName}\\b`, 'u');
    const modelPattern = new RegExp(`\\b${modelName}\\b`, 'u');
    if (prismaPattern.test(content) || modelPattern.test(content)) {
      matches.push(modelName);
    }
  });
  return unique(matches);
}

function buildRouteToModelMap(repoRoot, indexPayload, config) {
  const analysis = indexPayload.analysis || {};
  const models = analysis.dataModels && Array.isArray(analysis.dataModels.models) ? analysis.dataModels.models : [];
  const contracts = analysis.api && Array.isArray(analysis.api.contracts) ? analysis.api.contracts : [];
  const contractByPath = new Map(contracts.map(contract => [contract.path, contract]));
  const fileSet = getFileSet(indexPayload);

  const entries = (indexPayload.routes && Array.isArray(indexPayload.routes.routes) ? indexPayload.routes.routes : []).map(route => {
    const contract = contractByPath.get(route.path) || contracts.find(candidate => candidate.endpoint === route.endpoint);
    const routeContent = readRepoFile(repoRoot, route.path, config.deepReadBytes);
    const importInfo = collectResolvedImports(repoRoot, [route.path], indexPayload, config);
    const importedContents = importInfo.resolvedFiles.map(filePath => readRepoFile(repoRoot, filePath, config.deepReadBytes)).join('\n');
    const inferredEntities = unique([
      ...(contract && Array.isArray(contract.relatedModels) ? contract.relatedModels : []),
      ...detectEntitiesInContent(routeContent, models),
      ...detectEntitiesInContent(importedContents, models)
    ]);
    const score = round(Math.min(0.95,
      0.35
      + (contract ? 0.2 : 0)
      + (inferredEntities.length > 0 ? 0.25 : 0)
      + (importInfo.resolvedFiles.length > 0 ? 0.1 : 0)
      + ((contract && contract.confidence === 'high') ? 0.1 : 0)
    ));
    const evidenceSourcePaths = take([route.path, ...importInfo.resolvedFiles], config.maxFilesPerEvidence);
    const evidence = buildEvidence(indexPayload, evidenceSourcePaths, {
      routeFiles: [route.path],
      schemaRefs: models.length > 0 && inferredEntities.length > 0 ? (analysis.dataModels && analysis.dataModels.prismaFiles || []) : [],
      importsSeen: importInfo.importsSeen
    }, config.maxFilesPerEvidence);

    return {
      endpoint: route.endpoint,
      path: route.path,
      kind: route.kind,
      entities: inferredEntities,
      supportingFiles: take(importInfo.resolvedFiles.filter(filePath => fileSet.has(filePath)), config.maxFilesPerEvidence),
      confidence: confidenceLabel(score),
      confidenceScore: score,
      state: stateFromScore(score, evidence.sourcePaths.length),
      evidence
    };
  });

  const overallScore = average(entries.map(entry => entry.confidenceScore));
  return {
    ...buildMapContract(
      ROUTE_TO_MODEL_MAP_SCHEMA_VERSION,
      ['repo code', 'routes map', 'API contract analysis', 'data model analysis'],
      ['endpoint', 'path', 'entities', 'supportingFiles', 'confidence', 'evidence', 'state'],
      ['invalidate when route files, backend support files, schema files, or analysis mode change']
    ),
    generatedAt: new Date().toISOString(),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit || 'unknown',
    mode: analysis.mode || 'balanced',
    confidence: confidenceLabel(overallScore),
    confidenceScore: overallScore,
    state: stateFromScore(overallScore, entries.length),
    partialCount: entries.filter(entry => entry.state !== 'ready').length,
    entries
  };
}

function buildEntityUsageMap(indexPayload, routeToModelMap, config) {
  const analysis = indexPayload.analysis || {};
  const models = analysis.dataModels && Array.isArray(analysis.dataModels.models) ? analysis.dataModels.models : [];
  const screenEntries = [];
  const screenMapEntries = [];

  const screenCandidates = unique([
    ...(analysis.frontend && analysis.frontend.pages || []),
    ...(analysis.frontend && analysis.frontend.components || [])
  ]);

  const routeByEndpoint = new Map((routeToModelMap.entries || []).map(entry => [entry.endpoint, entry]));

  screenCandidates.forEach(screen => {
    const content = readRepoFile(indexPayload.repoMeta.repoRoot, screen, config.deepReadBytes);
    const endpointMentions = [];
    for (const match of content.matchAll(/['"`]\/api\/([A-Za-z0-9_\-/[\]]+)['"`]/gu)) {
      endpointMentions.push(`/${match[1]}`);
    }
    const endpoints = unique(endpointMentions).filter(endpoint => routeByEndpoint.has(endpoint));
    const evidence = buildEvidence(indexPayload, [screen], {
      routeFiles: endpoints.map(endpoint => routeByEndpoint.get(endpoint).path)
    }, config.maxFilesPerEvidence);
    const score = round(Math.min(0.9, 0.35 + (endpoints.length > 0 ? 0.35 : 0) + (content.includes('fetch(') ? 0.1 : 0) + (evidence.routeFiles.length > 0 ? 0.1 : 0)));
    const entry = {
      screen,
      endpoints,
      confidence: confidenceLabel(score),
      confidenceScore: score,
      state: stateFromScore(score, evidence.sourcePaths.length),
      evidence
    };
    screenEntries.push(entry);
    screenMapEntries.push(entry);
  });

  const entities = models.map(model => {
    const routeEntries = routeToModelMap.entries.filter(entry => entry.entities.includes(model.name));
    const endpoints = take(routeEntries.map(entry => entry.endpoint), 12);
    const screens = take(screenEntries.filter(entry => entry.endpoints.some(endpoint => endpoints.includes(endpoint))).map(entry => entry.screen), 12);
    const modules = take(unique([
      ...routeEntries.flatMap(entry => entry.supportingFiles || []),
      ...(analysis.backend && analysis.backend.supportFiles || []).filter(filePath => routeEntries.some(entry => (entry.supportingFiles || []).includes(filePath)))
    ]), 12);
    const keyFiles = take(unique([
      ...(analysis.dataModels && analysis.dataModels.prismaFiles || []),
      ...routeEntries.map(entry => entry.path),
      ...modules,
      ...screens
    ]), 12);
    const score = round(Math.min(0.95,
      0.35
      + (endpoints.length > 0 ? 0.2 : 0)
      + (screens.length > 0 ? 0.15 : 0)
      + (modules.length > 0 ? 0.1 : 0)
      + ((model.relations || []).length > 0 ? 0.1 : 0)
    ));
    const evidence = buildEvidence(indexPayload, keyFiles, {
      routeFiles: routeEntries.map(entry => entry.path),
      schemaRefs: analysis.dataModels && analysis.dataModels.prismaFiles || []
    }, config.maxFilesPerEvidence);

    return {
      entity: model.name,
      endpoints,
      modules,
      screens,
      keyFiles,
      confidence: confidenceLabel(score),
      confidenceScore: score,
      state: stateFromScore(score, evidence.sourcePaths.length),
      evidence
    };
  });

  const overallScore = average(entities.map(entry => entry.confidenceScore));
  return {
    ...buildMapContract(
      ENTITY_USAGE_MAP_SCHEMA_VERSION,
      ['repo code', 'data model analysis', 'route-to-model map', 'screen-to-api map'],
      ['entity', 'endpoints', 'modules', 'screens', 'keyFiles', 'confidence', 'evidence', 'state'],
      ['invalidate when schema files, backend support files, frontend screens, or route-to-model map change']
    ),
    generatedAt: new Date().toISOString(),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit || 'unknown',
    mode: analysis.mode || 'balanced',
    confidence: confidenceLabel(overallScore),
    confidenceScore: overallScore,
    state: stateFromScore(overallScore, entities.length),
    entities,
    screenEntries: screenMapEntries
  };
}

function buildHotspotsMap(indexPayload, routeToModelMap, entityUsageMap, riskZonesMap, config) {
  const analysis = indexPayload.analysis || {};
  const entrypoints = analysis.startHere && Array.isArray(analysis.startHere.entryPoints) ? analysis.startHere.entryPoints : [];
  const hotspotSeeds = unique([
    ...entrypoints,
    ...(analysis.startHere && analysis.startHere.hotspots || []),
    ...(analysis.backend && analysis.backend.backendFiles || []).slice(0, 6),
    ...(analysis.frontend && analysis.frontend.pages || []).slice(0, 6),
    ...(analysis.dataModels && analysis.dataModels.prismaFiles || [])
  ]);

  const entries = hotspotSeeds.map(target => {
    const linkedRoute = routeToModelMap.entries.find(entry => entry.path === target || (entry.supportingFiles || []).includes(target));
    const linkedEntity = entityUsageMap.entities.find(entry => entry.keyFiles.includes(target) || entry.screens.includes(target));
    const linkedRiskZones = riskZonesMap.zones.filter(zone => (zone.targets || []).includes(target));
    const impactScore = round(Math.min(0.95,
      0.3
      + (entrypoints.includes(target) ? 0.2 : 0)
      + (linkedRoute ? 0.15 : 0)
      + (linkedEntity ? 0.15 : 0)
      + (linkedRiskZones.length > 0 ? 0.15 : 0)
    ));
    const reasons = take(unique([
      entrypoints.includes(target) ? 'entrypoint' : null,
      linkedRoute ? `route-linked:${linkedRoute.endpoint}` : null,
      linkedEntity ? `entity-linked:${linkedEntity.entity}` : null,
      ...linkedRiskZones.map(zone => `risk-zone:${zone.kind}`)
    ]), 6);
    const evidence = buildEvidence(indexPayload, [target], {
      routeFiles: linkedRoute ? [linkedRoute.path] : [],
      schemaRefs: linkedEntity ? linkedEntity.keyFiles.filter(filePath => /prisma\/schema\.prisma|schema\.sql/iu.test(filePath)) : []
    }, config.maxFilesPerEvidence);

    return {
      target,
      kind: entrypoints.includes(target) ? 'entrypoint' : linkedRiskZones.length > 0 ? 'delicate-zone' : 'central-module',
      impact: impactScore >= 0.75 ? 'high' : impactScore >= 0.55 ? 'medium' : 'low',
      confidence: confidenceLabel(impactScore),
      confidenceScore: impactScore,
      state: stateFromScore(impactScore, evidence.sourcePaths.length),
      reasons,
      evidence
    };
  });

  const overallScore = average(entries.map(entry => entry.confidenceScore));
  return {
    ...buildMapContract(
      HOTSPOTS_MAP_SCHEMA_VERSION,
      ['repo code', 'AI context analysis', 'route-to-model map', 'entity-usage map', 'risk-zones map'],
      ['target', 'kind', 'impact', 'reasons', 'confidence', 'evidence', 'state'],
      ['invalidate when entrypoints, routes, entity usage, or risk zones change']
    ),
    generatedAt: new Date().toISOString(),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit || 'unknown',
    mode: analysis.mode || 'balanced',
    confidence: confidenceLabel(overallScore),
    confidenceScore: overallScore,
    state: stateFromScore(overallScore, entries.length),
    entries: entries.sort((left, right) => right.confidenceScore - left.confidenceScore || left.target.localeCompare(right.target))
  };
}

function buildScreenToApiMap(indexPayload, entityUsageMap) {
  const entries = entityUsageMap.screenEntries || [];
  const overallScore = average(entries.map(entry => entry.confidenceScore));
  return {
    ...buildMapContract(
      SCREEN_TO_API_MAP_SCHEMA_VERSION,
      ['repo code', 'frontend analysis', 'routes map'],
      ['screen', 'endpoints', 'confidence', 'evidence', 'state'],
      ['invalidate when frontend screens/components or route files change']
    ),
    generatedAt: new Date().toISOString(),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit || 'unknown',
    mode: indexPayload.analysis && indexPayload.analysis.mode || 'balanced',
    confidence: confidenceLabel(overallScore),
    confidenceScore: overallScore,
    state: stateFromScore(overallScore, entries.length),
    entries: entries.map(entry => ({
      screen: entry.screen,
      endpoints: entry.endpoints,
      confidence: entry.confidence,
      confidenceScore: entry.confidenceScore,
      state: entry.state,
      evidence: entry.evidence
    }))
  };
}

function buildRiskZonesMap(indexPayload, config) {
  const analysis = indexPayload.analysis || {};
  const files = (indexPayload.fingerprints && indexPayload.fingerprints.files || []).map(file => file.path);
  const zones = [];
  const pushZone = (kind, targets, reasons, score) => {
    const filteredTargets = take(targets, 12);
    if (filteredTargets.length === 0) {
      return;
    }
    const evidence = buildEvidence(indexPayload, filteredTargets, {
      routeFiles: filteredTargets.filter(filePath => /\/api\/|pages\/api|route\.(ts|js)$/iu.test(filePath)),
      schemaRefs: filteredTargets.filter(filePath => /prisma\/schema\.prisma|schema\.sql|migrations?/iu.test(filePath))
    }, config.maxFilesPerEvidence);
    zones.push({
      kind,
      severity: score >= 0.78 ? 'high' : score >= 0.55 ? 'medium' : 'low',
      targets: filteredTargets,
      reasons: take(reasons, 6),
      confidence: confidenceLabel(score),
      confidenceScore: round(score),
      state: stateFromScore(score, evidence.sourcePaths.length),
      evidence
    });
  };

  pushZone('auth', files.filter(filePath => /auth|login|session|middleware/iu.test(filePath)).concat(
    (analysis.api && analysis.api.contracts || []).filter(contract => contract.authRequired || (contract.gaps || []).some(gap => /auth/iu.test(gap))).map(contract => contract.path)
  ), ['Auth-sensitive flows exist or auth inference appears in route contracts.'], 0.82);

  pushZone('billing-payments', files.filter(filePath => /billing|payment|invoice|subscription|checkout/iu.test(filePath)), ['Billing or payment-like areas are expensive to break.'], 0.78);
  pushZone('admin-critical-flow', files.filter(filePath => /\/admin\//iu.test(filePath)), ['Admin surfaces often have elevated blast radius.'], 0.74);
  pushZone('migrations', files.filter(filePath => /migrations|prisma\/schema\.prisma|schema\.sql/iu.test(filePath)), ['Schema or migration files imply persistent data risk.'], 0.76);
  pushZone('pdf', files.filter(filePath => /pdf/iu.test(filePath)).concat(
    files.filter(filePath => /jspdf|pdfkit/iu.test(readRepoFile(indexPayload.repoMeta.repoRoot, filePath, config.deepReadBytes)))
  ), ['PDF generation/export code is often brittle and user-visible.'], 0.71);
  pushZone('ai-integration', files.filter(filePath => /ai|llm|anthropic|openai|fal|gemini/iu.test(filePath)).concat(
    files.filter(filePath => /@anthropic-ai\/sdk|openai|fal|gemini/iu.test(readRepoFile(indexPayload.repoMeta.repoRoot, filePath, config.deepReadBytes)))
  ), ['AI integrations usually depend on external APIs and prompt assumptions.'], 0.72);

  const overallScore = average(zones.map(entry => entry.confidenceScore));
  return {
    ...buildMapContract(
      RISK_ZONES_MAP_SCHEMA_VERSION,
      ['repo code', 'file classification', 'API contract analysis', 'data map'],
      ['kind', 'severity', 'targets', 'reasons', 'confidence', 'evidence', 'state'],
      ['invalidate when auth, billing, admin, migration, PDF, or AI integration files change']
    ),
    generatedAt: new Date().toISOString(),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit || 'unknown',
    mode: analysis.mode || 'balanced',
    confidence: confidenceLabel(overallScore),
    confidenceScore: overallScore,
    state: stateFromScore(overallScore, zones.length),
    zones
  };
}

function buildDependencyClustersMap(indexPayload, routeToModelMap, entityUsageMap, config) {
  const clusters = [];
  entityUsageMap.entities.forEach(entity => {
    const files = take(unique([...entity.keyFiles, ...entity.modules, ...entity.screens]), 12);
    if (files.length < 2) {
      return;
    }
    const score = round(Math.min(0.9, 0.35 + files.length * 0.04 + (entity.endpoints.length > 0 ? 0.15 : 0)));
    const evidence = buildEvidence(indexPayload, files, {
      routeFiles: routeToModelMap.entries.filter(entry => entity.endpoints.includes(entry.endpoint)).map(entry => entry.path)
    }, config.maxFilesPerEvidence);
    clusters.push({
      cluster: `entity:${entity.entity}`,
      files,
      reasons: take(unique([
        `${entity.entity} fans out into endpoints`,
        entity.screens.length > 0 ? 'linked screens detected' : null,
        entity.modules.length > 0 ? 'linked modules detected' : null
      ]), 6),
      confidence: confidenceLabel(score),
      confidenceScore: score,
      state: stateFromScore(score, evidence.sourcePaths.length),
      evidence
    });
  });

  const overallScore = average(clusters.map(entry => entry.confidenceScore));
  return {
    ...buildMapContract(
      DEPENDENCY_CLUSTERS_MAP_SCHEMA_VERSION,
      ['entity-usage map', 'route-to-model map', 'repo code'],
      ['cluster', 'files', 'reasons', 'confidence', 'evidence', 'state'],
      ['invalidate when route/entity usage links change']
    ),
    generatedAt: new Date().toISOString(),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit || 'unknown',
    mode: indexPayload.analysis && indexPayload.analysis.mode || 'balanced',
    confidence: confidenceLabel(overallScore),
    confidenceScore: overallScore,
    state: stateFromScore(overallScore, clusters.length),
    clusters
  };
}

function buildConfidenceMap(indexPayload, maps) {
  const analysis = indexPayload.analysis || {};
  const critic = analysis.critic || {};
  const docConfidence = (critic.docEvaluations || []).map(doc => ({
    target: doc.docPath,
    type: 'doc',
    confidence: confidenceLabel(doc.averageScore),
    confidenceScore: doc.averageScore,
    state: doc.decision
  }));
  const sectionConfidence = Object.entries({
    startHere: analysis.startHere && analysis.startHere.evidence && analysis.startHere.evidence.sourcePaths && analysis.startHere.evidence.sourcePaths.length > 0 ? 0.78 : 0.5,
    architecture: analysis.architecture && analysis.architecture.confidenceBySection ? average(Object.values(analysis.architecture.confidenceBySection).map(value => value === 'high' ? 0.85 : value === 'medium' ? 0.65 : 0.4)) : 0.5,
    backend: analysis.backend && analysis.backend.confidenceBySection ? average(Object.values(analysis.backend.confidenceBySection).map(value => value === 'high' ? 0.85 : value === 'medium' ? 0.65 : 0.4)) : 0.5,
    frontend: analysis.frontend && analysis.frontend.confidenceBySection ? average(Object.values(analysis.frontend.confidenceBySection).map(value => value === 'high' ? 0.85 : value === 'medium' ? 0.65 : 0.4)) : 0.5,
    data: analysis.dataModels && analysis.dataModels.confidenceBySection ? average(Object.values(analysis.dataModels.confidenceBySection).map(value => value === 'high' ? 0.85 : value === 'medium' ? 0.65 : 0.4)) : 0.5,
    api: analysis.api && Array.isArray(analysis.api.contracts) && analysis.api.contracts.length > 0 ? average(analysis.api.contracts.map(contract => contract.confidence === 'high' ? 0.85 : contract.confidence === 'medium' ? 0.65 : 0.4)) : 0.5
  }).map(([target, confidenceScore]) => ({
    target,
    type: 'section',
    confidence: confidenceLabel(confidenceScore),
    confidenceScore: round(confidenceScore),
    state: stateFromScore(confidenceScore, 1)
  }));
  const mapConfidence = Object.entries({
    routeToModelMap: maps.routeToModelMap,
    entityUsageMap: maps.entityUsageMap,
    hotspots: maps.hotspots,
    screenToApiMap: maps.screenToApiMap,
    riskZones: maps.riskZones,
    dependencyClusters: maps.dependencyClusters
  }).map(([target, map]) => ({
    target,
    type: 'map',
    confidence: map.confidence,
    confidenceScore: map.confidenceScore,
    state: map.state
  }));

  const overallScore = average([...docConfidence, ...sectionConfidence, ...mapConfidence].map(entry => entry.confidenceScore));
  return {
    ...buildMapContract(
      CONFIDENCE_MAP_SCHEMA_VERSION,
      ['AI context critic', 'structured maps'],
      ['target', 'type', 'confidence', 'confidenceScore', 'state'],
      ['invalidate when docs or structured maps change']
    ),
    generatedAt: new Date().toISOString(),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit || 'unknown',
    mode: analysis.mode || 'balanced',
    confidence: confidenceLabel(overallScore),
    confidenceScore: overallScore,
    state: stateFromScore(overallScore, mapConfidence.length),
    entries: [...docConfidence, ...sectionConfidence, ...mapConfidence]
  };
}

function validateStructuredMaps(maps) {
  const issues = [];
  const warnings = [];

  (maps.routeToModelMap.entries || []).forEach(entry => {
    entry.entities.forEach(entity => {
      const usage = (maps.entityUsageMap.entities || []).find(candidate => candidate.entity === entity);
      if (!usage) {
        issues.push(`entity-usage-missing:${entity}`);
      } else if (!usage.endpoints.includes(entry.endpoint)) {
        warnings.push(`entity-usage-endpoint-mismatch:${entity}:${entry.endpoint}`);
      }
    });
  });

  (maps.screenToApiMap.entries || []).forEach(entry => {
    entry.endpoints.forEach(endpoint => {
      const route = (maps.routeToModelMap.entries || []).find(candidate => candidate.endpoint === endpoint);
      if (!route) {
        issues.push(`screen-to-api-route-missing:${entry.screen}:${endpoint}`);
      }
    });
  });

  const averageScore = average([
    maps.routeToModelMap.confidenceScore,
    maps.entityUsageMap.confidenceScore,
    maps.hotspots.confidenceScore,
    maps.screenToApiMap.confidenceScore,
    maps.riskZones.confidenceScore,
    maps.dependencyClusters.confidenceScore,
    maps.confidenceMap.confidenceScore
  ]);

  let decision = 'ready';
  if (issues.length > 0 || averageScore < 0.45) {
    decision = 'needs_review';
  } else if (warnings.length > 0 || averageScore < 0.76) {
    decision = 'partial';
  }

  return {
    decision,
    confidence: confidenceLabel(averageScore),
    confidenceScore: averageScore,
    issues,
    warnings
  };
}

function buildStructuredMaps(repoRoot, indexPayload, options = {}) {
  const analysis = indexPayload.analysis || {};
  const config = getModeConfig(analysis.mode || options.mode || 'balanced');
  const routeToModelMap = buildRouteToModelMap(repoRoot, indexPayload, config);
  const entityUsageMap = buildEntityUsageMap(indexPayload, routeToModelMap, config);
  const screenToApiMap = buildScreenToApiMap(indexPayload, entityUsageMap);
  const riskZones = buildRiskZonesMap(indexPayload, config);
  const hotspots = buildHotspotsMap(indexPayload, routeToModelMap, entityUsageMap, riskZones, config);
  const dependencyClusters = buildDependencyClustersMap(indexPayload, routeToModelMap, entityUsageMap, config);
  const confidenceMap = buildConfidenceMap(indexPayload, {
    routeToModelMap,
    entityUsageMap,
    hotspots,
    screenToApiMap,
    riskZones,
    dependencyClusters
  });
  const readiness = validateStructuredMaps({
    routeToModelMap,
    entityUsageMap,
    hotspots,
    screenToApiMap,
    riskZones,
    dependencyClusters,
    confidenceMap
  });

  return {
    schemaVersion: STRUCTURED_MAPS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    basedOnCommit: indexPayload.repoMeta && indexPayload.repoMeta.basedOnCommit || 'unknown',
    mode: analysis.mode || options.mode || 'balanced',
    sourceOfTruthPolicy: 'code > maps > markdown > task pack summary',
    routeToModelMap,
    entityUsageMap,
    hotspots,
    screenToApiMap,
    riskZones,
    dependencyClusters,
    confidenceMap,
    readiness
  };
}

module.exports = {
  CONFIDENCE_MAP_SCHEMA_VERSION,
  DEPENDENCY_CLUSTERS_MAP_SCHEMA_VERSION,
  ENTITY_USAGE_MAP_SCHEMA_VERSION,
  HOTSPOTS_MAP_SCHEMA_VERSION,
  RISK_ZONES_MAP_SCHEMA_VERSION,
  ROUTE_TO_MODEL_MAP_SCHEMA_VERSION,
  SCREEN_TO_API_MAP_SCHEMA_VERSION,
  STRUCTURED_MAPS_SCHEMA_VERSION,
  buildStructuredMaps,
  validateStructuredMaps
};
