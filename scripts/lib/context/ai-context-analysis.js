'use strict';

const fs = require('fs');
const path = require('path');

const { inferFileDomains } = require('./repo-map-builders');

const AI_CONTEXT_ANALYSIS_SCHEMA_VERSION = 'ecc.ai-context-analysis.v1';
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const IMPORTANT_FIELD_PATTERN = /(^id$|Id$|status$|type$|slug$|name$|title$|email$|amount$|total$|price$|createdAt$|updatedAt$|deletedAt$)/u;

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function take(values, limit = 8) {
  return unique(values).slice(0, limit);
}

function normalizeFilePath(filePath) {
  return String(filePath || '').split(path.sep).join('/');
}

function resolveRepoPath(repoRoot, relativePath) {
  return path.join(repoRoot, normalizeFilePath(relativePath).split('/').join(path.sep));
}

function readRepoFile(repoRoot, relativePath, maxBytes = 50000) {
  try {
    const absolutePath = resolveRepoPath(repoRoot, relativePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    return content.length > maxBytes ? content.slice(0, maxBytes) : content;
  } catch {
    return '';
  }
}

function getAreaFiles(indexPayload, area) {
  const modules = indexPayload.modules || {};
  const areas = Array.isArray(modules.areas) ? modules.areas : [];
  const match = areas.find(entry => entry.area === area);
  return match && Array.isArray(match.files) ? match.files : [];
}

function parsePackageInfo(repoRoot) {
  const packagePath = path.join(repoRoot, 'package.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return {
      name: typeof parsed.name === 'string' ? parsed.name : path.basename(repoRoot),
      description: typeof parsed.description === 'string' ? parsed.description : '',
      dependencies: parsed.dependencies || {},
      devDependencies: parsed.devDependencies || {},
      scripts: parsed.scripts || {}
    };
  } catch {
    return {
      name: path.basename(repoRoot),
      description: '',
      dependencies: {},
      devDependencies: {},
      scripts: {}
    };
  }
}

function parseReadmeSummary(repoRoot) {
  const candidates = ['README.md', 'readme.md'];
  for (const candidate of candidates) {
    const content = readRepoFile(repoRoot, candidate, 4000).trim();
    if (!content) {
      continue;
    }
    const lines = content
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('```'));
    if (lines.length > 0) {
      return lines.slice(0, 3).join(' ');
    }
  }
  return '';
}

function detectFrontendPage(filePath) {
  return /(^|\/)(src\/)?app\/(?!api\/)(?:.+\/)?(page|layout|loading|error|template|default|not-found)\.(tsx|jsx|ts|js)$/iu.test(filePath)
    || /(^|\/)(src\/)?pages\/(?!api\/).+\.(tsx|jsx|ts|js)$/iu.test(filePath);
}

function detectLayoutFile(filePath) {
  return /(^|\/)(src\/)?app\/(?!api\/)(?:.+\/)?layout\.(tsx|jsx|ts|js)$/iu.test(filePath)
    || /(^|\/)(src\/)?layouts?\/.+\.(tsx|jsx|ts|js)$/iu.test(filePath);
}

function detectComponentFile(filePath) {
  return /(^|\/)(src\/)?(components|ui|views)\/.+\.(tsx|jsx|ts|js)$/iu.test(filePath)
    || /(^|\/)(src\/)?app\/(?!api\/).+\/components?\/.+\.(tsx|jsx|ts|js)$/iu.test(filePath);
}

function detectSurface(filePath) {
  const normalized = normalizeFilePath(filePath).toLowerCase();
  if (normalized.includes('/admin/') || normalized.includes('/dashboard/')) {
    return 'admin';
  }
  if (normalized.includes('/public/') || normalized.includes('/marketing/') || normalized.includes('/landing/')) {
    return 'public';
  }
  if (normalized.includes('/client/') || normalized.includes('/customer/') || normalized.includes('/account/')) {
    return 'client';
  }
  return 'shared';
}

function routeDomain(route) {
  const endpoint = String(route && route.endpoint || '').replace(/^\//u, '');
  const firstSegment = endpoint.split('/').filter(Boolean)[0];
  if (firstSegment) {
    return firstSegment;
  }
  const filePath = String(route && route.path || '').replace(/^src\//u, '');
  const apiMatch = filePath.match(/^app\/api\/([^/]+)/u) || filePath.match(/^pages\/api\/([^/]+)/u);
  return apiMatch ? apiMatch[1] : 'root';
}

function extractHttpMethods(content) {
  const methods = new Set();
  const functionPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/gu;
  const constPattern = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*=/gu;
  for (const match of content.matchAll(functionPattern)) {
    methods.add(match[1]);
  }
  for (const match of content.matchAll(constPattern)) {
    methods.add(match[1]);
  }
  return HTTP_METHODS.filter(method => methods.has(method));
}

function splitObjectFields(raw) {
  return raw
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => token.replace(/\s*=.*$/u, '').replace(/:.*$/u, '').replace(/^\.\.\./u, '').trim())
    .filter(Boolean);
}

function extractRequestShape(content) {
  const bodyFields = new Set();
  const queryFields = new Set();

  for (const match of content.matchAll(/const\s*\{([^}]+)\}\s*=\s*await\s+[A-Za-z0-9_$.]+\.json\(\)/gu)) {
    splitObjectFields(match[1]).forEach(field => bodyFields.add(field));
  }
  for (const match of content.matchAll(/searchParams\.(?:get|has|set)\(['"`]([^'"`]+)['"`]\)/gu)) {
    queryFields.add(match[1]);
  }

  return {
    bodyFields: take([...bodyFields], 8),
    queryFields: take([...queryFields], 8)
  };
}

function extractTopLevelJsonKeys(content) {
  const keys = new Set();
  const jsonPattern = /(?:NextResponse|Response)\.json\(\s*\{([\s\S]*?)\}\s*(?:\)|,)/gu;
  for (const match of content.matchAll(jsonPattern)) {
    const raw = match[1];
    for (const keyMatch of raw.matchAll(/([A-Za-z0-9_]+)\s*:/gu)) {
      keys.add(keyMatch[1]);
    }
  }
  return take([...keys], 8);
}

function detectAuth(content) {
  return /(requireAuth|getServerSession|currentUser|auth\(|clerk|supabase\.auth|authorization|bearer|session)/iu.test(content);
}

function detectSideEffects(content) {
  const sideEffects = [];
  const prismaOperations = [];
  for (const match of content.matchAll(/prisma\.([A-Za-z0-9_]+)\.(create|createMany|update|updateMany|delete|deleteMany|upsert|findMany|findUnique|findFirst)\b/gu)) {
    prismaOperations.push({ model: match[1], operation: match[2] });
  }
  if (prismaOperations.length > 0) {
    sideEffects.push(...prismaOperations.map(entry => `prisma.${entry.model}.${entry.operation}`));
  }
  if (/fetch\(/u.test(content)) {
    sideEffects.push('external-fetch');
  }
  if (/revalidatePath\(/u.test(content) || /revalidateTag\(/u.test(content)) {
    sideEffects.push('cache-revalidation');
  }
  if (/cookies\(\)\.set/u.test(content) || /headers\(\)/u.test(content)) {
    sideEffects.push('header-cookie-mutation');
  }
  return {
    sideEffects: take(sideEffects, 8),
    prismaOperations: prismaOperations.slice(0, 8)
  };
}

function deriveRoutePurpose(route, methods, sideEffects) {
  const endpoint = route.endpoint || route.path;
  if (methods.includes('POST')) {
    return `Handles write operations for ${endpoint}.`;
  }
  if (methods.includes('PATCH') || methods.includes('PUT')) {
    return `Updates resources behind ${endpoint}.`;
  }
  if (methods.includes('DELETE')) {
    return `Removes resources exposed by ${endpoint}.`;
  }
  if (methods.includes('GET')) {
    return `Returns data for ${endpoint}.`;
  }
  if (sideEffects.length > 0) {
    return `Executes backend logic for ${endpoint}.`;
  }
  return `Route purpose for ${endpoint} is only partially inferred from file structure.`;
}

function deriveConfidence(methods, requestShape, responseKeys, authRequired, sideEffects, relatedModels) {
  let score = 0.25;
  if (methods.length > 0) {
    score += 0.2;
  }
  if (requestShape.bodyFields.length > 0 || requestShape.queryFields.length > 0) {
    score += 0.15;
  }
  if (responseKeys.length > 0) {
    score += 0.15;
  }
  if (authRequired) {
    score += 0.05;
  }
  if (sideEffects.length > 0) {
    score += 0.1;
  }
  if (relatedModels.length > 0) {
    score += 0.1;
  }
  if (score >= 0.75) {
    return 'high';
  }
  if (score >= 0.55) {
    return 'medium';
  }
  return 'low';
}

function parseRouteContracts(repoRoot, indexPayload) {
  const routes = indexPayload.routes && Array.isArray(indexPayload.routes.routes) ? indexPayload.routes.routes : [];
  return routes.map(route => {
    const content = readRepoFile(repoRoot, route.path);
    const methods = extractHttpMethods(content);
    const requestShape = extractRequestShape(content);
    const responseKeys = extractTopLevelJsonKeys(content);
    const authRequired = detectAuth(content);
    const sideEffectsData = detectSideEffects(content);
    const relatedModels = take(sideEffectsData.prismaOperations.map(entry => entry.model[0].toUpperCase() + entry.model.slice(1)), 6);
    return {
      path: route.path,
      endpoint: route.endpoint || route.path,
      kind: route.kind,
      domain: routeDomain(route),
      methods,
      purpose: deriveRoutePurpose(route, methods, sideEffectsData.sideEffects),
      authRequired,
      requestShape,
      responseKeys,
      sideEffects: sideEffectsData.sideEffects,
      relatedModels,
      confidence: deriveConfidence(methods, requestShape, responseKeys, authRequired, sideEffectsData.sideEffects, relatedModels)
    };
  });
}

function groupRouteContracts(contracts) {
  const groups = new Map();
  for (const contract of contracts) {
    const key = contract.domain || 'root';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(contract);
  }
  return [...groups.entries()]
    .map(([domain, routes]) => ({
      domain,
      routes: routes.sort((left, right) => left.endpoint.localeCompare(right.endpoint))
    }))
    .sort((left, right) => right.routes.length - left.routes.length || left.domain.localeCompare(right.domain));
}

function parsePrismaSchemaContent(content) {
  const models = [];
  const enums = [];
  const modelBlocks = [...content.matchAll(/model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\n\}/gu)];
  const enumBlocks = [...content.matchAll(/enum\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\n\}/gu)];
  const modelNames = modelBlocks.map(match => match[1]);

  for (const match of modelBlocks) {
    const name = match[1];
    const lines = match[2]
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));
    const fields = [];
    const relations = [];
    for (const line of lines) {
      const tokens = line.split(/\s+/u);
      const fieldName = tokens[0];
      const fieldType = tokens[1] || '';
      const attributes = tokens.slice(2).join(' ');
      const normalizedType = fieldType.replace(/[?[\]]/gu, '');
      const isRelation = modelNames.includes(normalizedType) || /@relation/u.test(attributes);
      fields.push({
        name: fieldName,
        type: fieldType,
        attributes,
        isRelation
      });
      if (isRelation) {
        relations.push(`${fieldName} -> ${normalizedType}`);
      }
    }
    models.push({
      name,
      fields,
      importantFields: take(fields.filter(field => IMPORTANT_FIELD_PATTERN.test(field.name) || field.isRelation || /@id|@unique/u.test(field.attributes)).map(field => `${field.name}: ${field.type}`), 10),
      relations: take(relations, 8)
    });
  }

  for (const match of enumBlocks) {
    enums.push({
      name: match[1],
      values: match[2]
        .split(/\r?\n/u)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//'))
    });
  }

  return { models, enums };
}

function parseDataModels(repoRoot, indexPayload, apiContracts) {
  const prismaFiles = indexPayload.dbMap && Array.isArray(indexPayload.dbMap.prismaFiles)
    ? indexPayload.dbMap.prismaFiles
    : [];
  const modelFiles = indexPayload.dbMap && Array.isArray(indexPayload.dbMap.modelFiles)
    ? indexPayload.dbMap.modelFiles
    : [];
  const aggregated = { models: [], enums: [] };

  for (const prismaFile of prismaFiles) {
    const content = readRepoFile(repoRoot, prismaFile, 80000);
    const parsed = parsePrismaSchemaContent(content);
    aggregated.models.push(...parsed.models);
    aggregated.enums.push(...parsed.enums);
  }

  const usageCount = new Map();
  for (const contract of apiContracts) {
    for (const modelName of contract.relatedModels) {
      usageCount.set(modelName, (usageCount.get(modelName) || 0) + 1);
    }
  }

  const coreEntities = aggregated.models
    .map(model => ({
      name: model.name,
      score: model.relations.length + (usageCount.get(model.name) || 0)
    }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, 5)
    .map(entry => entry.name);

  return {
    prismaFiles,
    modelFiles,
    models: aggregated.models,
    enums: aggregated.enums,
    coreEntities,
    risks: take([
      aggregated.models.some(model => model.relations.length > 0) ? 'Relational changes can ripple across linked entities.' : null,
      aggregated.models.some(model => model.fields.some(field => /status|type/u.test(field.name))) ? 'Enum and status transitions should be checked across API handlers.' : null,
      apiContracts.some(contract => contract.sideEffects.some(effect => effect.startsWith('prisma.'))) ? 'API handlers write directly to the data layer; schema changes should be coordinated with route contracts.' : null
    ], 6)
  };
}

function analyzeFrontend(indexPayload) {
  const frontendFiles = getAreaFiles(indexPayload, 'frontend');
  const pages = frontendFiles.filter(detectFrontendPage);
  const layouts = frontendFiles.filter(detectLayoutFile);
  const components = frontendFiles.filter(detectComponentFile);
  const surfaceMap = new Map();
  for (const filePath of [...pages, ...layouts, ...components]) {
    const surface = detectSurface(filePath);
    if (!surfaceMap.has(surface)) {
      surfaceMap.set(surface, []);
    }
    surfaceMap.get(surface).push(filePath);
  }
  const hotspots = [...surfaceMap.entries()]
    .map(([surface, files]) => ({ surface, files: take(files, 8), fileCount: files.length }))
    .sort((left, right) => right.fileCount - left.fileCount || left.surface.localeCompare(right.surface));
  return {
    pages: take(pages, 12),
    layouts: take(layouts, 8),
    components: take(components, 16),
    surfaces: hotspots,
    hotspots: take(hotspots.map(entry => `${entry.surface}: ${entry.fileCount} frontend files`), 8)
  };
}

function analyzeBackend(indexPayload, apiContracts) {
  const backendFiles = getAreaFiles(indexPayload, 'backend');
  const apiRoutePaths = new Set(apiContracts.map(contract => contract.path));
  const supportFiles = backendFiles.filter(filePath => !apiRoutePaths.has(filePath));
  const sensitiveOperations = [];
  for (const contract of apiContracts) {
    if (contract.authRequired || contract.sideEffects.some(effect => effect.startsWith('prisma.') || effect === 'external-fetch')) {
      sensitiveOperations.push(`${contract.endpoint}: ${contract.methods.join(', ') || 'unknown-method'}`);
    }
  }
  return {
    backendFiles: take(backendFiles, 24),
    supportFiles: take(supportFiles, 20),
    routeGroups: groupRouteContracts(apiContracts),
    sensitiveOperations: take(sensitiveOperations, 10)
  };
}

function analyzeOverview(repoRoot, indexPayload, frontend, backend, dataModels, packageInfo, readmeSummary) {
  const narrative = packageInfo.description || readmeSummary || 'Repo purpose is only partially inferred from package metadata and source layout.';
  const topLevel = indexPayload.treeSummary && Array.isArray(indexPayload.treeSummary.topLevel)
    ? indexPayload.treeSummary.topLevel.slice(0, 8).map(entry => `${entry.name} (${entry.fileCount})`)
    : [];
  const mainAreas = [];
  if (frontend.pages.length > 0 || frontend.components.length > 0) {
    mainAreas.push(`Frontend surface: ${frontend.pages.length} page/layout entries and ${frontend.components.length} components detected.`);
  }
  if (backend.routeGroups.length > 0) {
    mainAreas.push(`Backend/API surface: ${backend.routeGroups.reduce((total, group) => total + group.routes.length, 0)} route handlers across ${backend.routeGroups.length} domains.`);
  }
  if (dataModels.models.length > 0 || dataModels.prismaFiles.length > 0) {
    mainAreas.push(`Data layer: ${dataModels.models.length} schema models and ${dataModels.enums.length} enums detected.`);
  }
  const entryPoints = take([
    ...frontend.layouts,
    ...frontend.pages,
    ...backend.routeGroups.flatMap(group => group.routes.map(route => route.path))
  ], 12);
  const hotspots = take([
    ...frontend.hotspots,
    ...backend.routeGroups.slice(0, 4).map(group => `api:${group.domain} (${group.routes.length} routes)`),
    ...dataModels.coreEntities.map(entity => `data:${entity}`)
  ], 10);
  const surfaces = frontend.surfaces.map(entry => ({
    surface: entry.surface,
    files: entry.files
  }));
  return {
    narrative,
    topLevel,
    mainAreas,
    entryPoints,
    hotspots,
    surfaces
  };
}

function analyzeArchitecture(indexPayload, frontend, backend, dataModels, apiContracts) {
  const contradictions = [];
  const lowConfidenceZones = [];
  if (apiContracts.length > 0 && backend.backendFiles.length === 0) {
    contradictions.push('Routes were detected but the backend surface is empty.');
  }
  if (frontend.pages.length === 0 && frontend.components.length > 0) {
    lowConfidenceZones.push('Components exist without obvious page entry points.');
  }
  if (apiContracts.some(contract => contract.confidence === 'low')) {
    lowConfidenceZones.push('Some API contracts remain partial because request/response shapes were not fully inferable.');
  }
  if (dataModels.prismaFiles.length > 0 && dataModels.models.length === 0) {
    contradictions.push('Prisma schema files exist but no models were parsed from them.');
  }

  return {
    boundaries: {
      frontend: frontend.pages.length + frontend.components.length,
      backend: backend.backendFiles.length,
      api: apiContracts.length,
      data: dataModels.models.length || dataModels.prismaFiles.length
    },
    requestFlow: apiContracts.length > 0
      ? 'Observed flow: request enters route handler, route executes backend helpers or direct data calls, then returns JSON response.'
      : 'No concrete request flow could be inferred from route handlers.',
    criticalZones: take([
      backend.sensitiveOperations.length > 0 ? 'Authenticated or mutating API handlers should be reviewed first.' : null,
      dataModels.coreEntities.length > 0 ? `Core data entities: ${dataModels.coreEntities.join(', ')}.` : null,
      frontend.hotspots.length > 0 ? `Hot frontend surfaces: ${frontend.hotspots.slice(0, 2).join(' | ')}.` : null
    ], 6),
    contradictions,
    lowConfidenceZones
  };
}

function analyzeDecisions(indexPayload, packageInfo, dataModels, apiContracts) {
  const dependencies = { ...packageInfo.dependencies, ...packageInfo.devDependencies };
  const decisions = [];
  if (String(indexPayload.projectProfile && indexPayload.projectProfile.primary || '').toLowerCase().includes('next')) {
    decisions.push('Next.js is the primary application framework for this repo.');
  }
  if (apiContracts.some(contract => contract.kind === 'nextjs-app-route')) {
    decisions.push('App Router route handlers are used for API endpoints.');
  }
  if (dataModels.prismaFiles.length > 0) {
    decisions.push('Prisma schema files indicate a schema-first data strategy.');
  }
  if (dependencies.jspdf || dependencies['pdf-lib'] || dependencies.puppeteer) {
    decisions.push('PDF generation capability is present in dependencies.');
  }
  if (dependencies['@anthropic-ai/sdk'] || dependencies.openai) {
    decisions.push('AI integration dependency is present in the application stack.');
  }
  return decisions;
}

function analyzeRecentChanges(indexPayload) {
  const files = indexPayload.fingerprints && Array.isArray(indexPayload.fingerprints.files)
    ? indexPayload.fingerprints.files
    : [];
  const recentFiles = files
    .filter(file => !/^AI_CONTEXT\//u.test(file.path) && !/\.md$/iu.test(file.path))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, 8)
    .map(file => ({
      path: file.path,
      domains: inferFileDomains(file.path),
      mtimeMs: file.mtimeMs
    }));
  return {
    strategy: recentFiles.length > 0 ? 'filesystem-mtime' : 'insufficient-history',
    summary: recentFiles.length > 0
      ? 'Recent changes are inferred from file modification times, not commit diffs.'
      : 'No recent change evidence was available beyond the current snapshot.',
    files: recentFiles
  };
}

function analyzeOpenIssues(apiContracts, dataModels, architecture) {
  const issues = [];
  architecture.contradictions.forEach(issue => issues.push({ severity: 'high', kind: 'contradiction', detail: issue }));
  architecture.lowConfidenceZones.forEach(issue => issues.push({ severity: 'medium', kind: 'low-confidence', detail: issue }));
  apiContracts
    .filter(contract => contract.confidence === 'low')
    .forEach(contract => issues.push({ severity: 'medium', kind: 'partial-endpoint', detail: `${contract.endpoint} has low-confidence contract inference.` }));
  if (dataModels.prismaFiles.length > 0 && dataModels.models.length === 0) {
    issues.push({ severity: 'high', kind: 'data-gap', detail: 'Schema files exist but no data entities were extracted.' });
  }
  if (issues.length === 0) {
    issues.push({ severity: 'info', kind: 'no-unresolved', detail: 'No unresolved contradictions were detected in the deterministic evidence pass.' });
  }
  return issues.slice(0, 12);
}

function buildAiContextAnalysis(repoRoot, indexPayload) {
  const packageInfo = parsePackageInfo(repoRoot);
  const readmeSummary = parseReadmeSummary(repoRoot);
  const apiContracts = parseRouteContracts(repoRoot, indexPayload);
  const dataModels = parseDataModels(repoRoot, indexPayload, apiContracts);
  const frontend = analyzeFrontend(indexPayload);
  const backend = analyzeBackend(indexPayload, apiContracts);
  const overview = analyzeOverview(repoRoot, indexPayload, frontend, backend, dataModels, packageInfo, readmeSummary);
  const architecture = analyzeArchitecture(indexPayload, frontend, backend, dataModels, apiContracts);
  const decisions = analyzeDecisions(indexPayload, packageInfo, dataModels, apiContracts);
  const recent = analyzeRecentChanges(indexPayload);
  const openIssues = analyzeOpenIssues(apiContracts, dataModels, architecture);

  return {
    schemaVersion: AI_CONTEXT_ANALYSIS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    repoRoot,
    packageInfo: {
      name: packageInfo.name,
      description: packageInfo.description
    },
    readmeSummary,
    overview,
    architecture,
    backend,
    frontend,
    dataModels,
    api: {
      contracts: apiContracts,
      routeGroups: groupRouteContracts(apiContracts)
    },
    decisions,
    recent,
    openIssues
  };
}

module.exports = {
  AI_CONTEXT_ANALYSIS_SCHEMA_VERSION,
  buildAiContextAnalysis,
  detectAuth,
  detectComponentFile,
  detectFrontendPage,
  detectLayoutFile,
  detectSideEffects,
  deriveConfidence,
  extractHttpMethods,
  extractRequestShape,
  extractTopLevelJsonKeys,
  parsePrismaSchemaContent,
  parseRouteContracts
};
