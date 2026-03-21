'use strict';

const fs = require('fs');
const path = require('path');

const { toRelativePath } = require('./repo-fingerprint');

const NEXT_APP_API_ROUTE_PATTERN = /(^|\/)(src\/)?app\/api\/.+\/route\.(ts|js)$/iu;
const NEXT_PAGES_API_ROUTE_PATTERN = /(^|\/)(src\/)?pages\/api\/.+\.(ts|js)$/iu;
const NEXT_FRONTEND_ENTRY_PATTERN = /(^|\/)(src\/)?app\/(?!api\/)(?:.+\/)?(page|layout|loading|error|template|default|not-found)\.(tsx|jsx|ts|js)$/iu;
const PAGES_FRONTEND_ENTRY_PATTERN = /(^|\/)(src\/)?pages\/(?!api\/).+\.(tsx|jsx|ts|js)$/iu;

const AREA_PATTERNS = {
  frontend: [
    NEXT_FRONTEND_ENTRY_PATTERN,
    PAGES_FRONTEND_ENTRY_PATTERN,
    /(^|\/)(src\/)?(components|hooks|contexts|ui|views|layouts|styles)\//iu,
    /\.(tsx|jsx|css|scss|sass|less|vue|svelte)$/iu,
  ],
  backend: [
    NEXT_APP_API_ROUTE_PATTERN,
    NEXT_PAGES_API_ROUTE_PATTERN,
    /(^|\/)(src\/)?(api|routes|controllers|middleware|server|services|handlers|server-actions|actions)\//iu,
    /\.(route|controller|handler|middleware|service)\.(ts|js)$/iu,
  ],
  api: [
    NEXT_APP_API_ROUTE_PATTERN,
    NEXT_PAGES_API_ROUTE_PATTERN,
    /(^|\/)(src\/)?(routes|api)\/.+\.(ts|js)$/iu,
  ],
  data: [
    /(^|\/)(src\/)?(models|schemas|migrations|prisma|drizzle|db|database|repositories)\//iu,
    /(^|\/)(src\/)?lib\/(db|database|prisma)\.(ts|js)$/iu,
    /\.(model|schema|migration|seed)\.(ts|js)$/iu,
    /prisma\/schema\.prisma$/iu,
    /schema\.sql$/iu,
  ],
  integrations: [
    /(^|\/)(integrations?|third-party|external|plugins?|adapters?|connectors?)\//iu,
    /\.(integration|adapter|connector)\.(ts|js)$/iu,
  ],
  workers: [
    /(^|\/)(workers?|jobs?|queues?|tasks?|cron|background)\//iu,
    /\.(worker|job|queue|task|cron)\.(ts|js)$/iu,
  ],
  docs: [
    /(^|\/)(docs|AI_CONTEXT)\//iu,
    /README\.md$/iu,
    /\.md$/iu,
  ],
};

const SYMBOL_FILE_PATTERN = /\.(js|jsx|ts|tsx|mjs|cjs)$/iu;

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function matchesAnyPattern(relativePath, patterns = []) {
  return patterns.some(pattern => pattern.test(relativePath));
}

function inferFileDomains(relativePath) {
  const normalized = String(relativePath || '').split('\\').join('/');
  const domains = [];
  const isApiRoute = routeKindForPath(normalized) !== null;
  const isFrontendEntry = NEXT_FRONTEND_ENTRY_PATTERN.test(normalized) || PAGES_FRONTEND_ENTRY_PATTERN.test(normalized);
  const isFrontendSupport = /(^|\/)(src\/)?(components|hooks|contexts|ui|views|layouts|styles)\//iu.test(normalized);
  const isFrontendExtension = /\.(tsx|jsx|css|scss|sass|less|vue|svelte)$/iu.test(normalized);

  if (isApiRoute) {
    domains.push('backend', 'api');
  }

  if (!isApiRoute && (isFrontendEntry || isFrontendSupport || isFrontendExtension)) {
    domains.push('frontend');
  }

  if (!isApiRoute && matchesAnyPattern(normalized, AREA_PATTERNS.backend)) {
    domains.push('backend');
  }

  if (matchesAnyPattern(normalized, AREA_PATTERNS.data)) {
    domains.push('data');
  }

  if (matchesAnyPattern(normalized, AREA_PATTERNS.integrations)) {
    domains.push('integrations');
  }

  if (matchesAnyPattern(normalized, AREA_PATTERNS.workers)) {
    domains.push('workers');
  }

  if (matchesAnyPattern(normalized, AREA_PATTERNS.docs)) {
    domains.push('docs');
  }

  const resolved = unique(domains);
  return resolved.length > 0 ? resolved : ['other'];
}

function classifyArea(relativePath) {
  const domains = inferFileDomains(relativePath);
  return domains[0] || 'other';
}

function collectTopLevelDirectories(relativePaths) {
  const counts = new Map();

  for (const relativePath of relativePaths) {
    const topLevel = relativePath.split('/')[0] || '.';
    counts.set(topLevel, (counts.get(topLevel) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, fileCount]) => ({ name, fileCount }))
    .sort((left, right) => right.fileCount - left.fileCount || left.name.localeCompare(right.name));
}

function buildTreeSummary(repoRoot, fingerprint) {
  const relativePaths = fingerprint.files.map(file => file.path);
  const directories = new Map();

  for (const relativePath of relativePaths) {
    const segments = relativePath.split('/');
    for (let depth = 1; depth < segments.length; depth += 1) {
      const directoryPath = segments.slice(0, depth).join('/');
      directories.set(directoryPath, (directories.get(directoryPath) || 0) + 1);
    }
  }

  return {
    schemaVersion: 'ecc.tree-summary.v1',
    generatedAt: new Date().toISOString(),
    repoRoot,
    totalFiles: relativePaths.length,
    topLevel: collectTopLevelDirectories(relativePaths),
    directories: [...directories.entries()]
      .map(([directoryPath, fileCount]) => ({ path: directoryPath, fileCount }))
      .sort((left, right) => right.fileCount - left.fileCount || left.path.localeCompare(right.path))
      .slice(0, 100)
  };
}

function buildModulesMap(repoRoot, fingerprint) {
  const areas = new Map();
  const fileDomains = [];

  for (const file of fingerprint.files) {
    const domains = inferFileDomains(file.path);
    fileDomains.push({
      path: file.path,
      domains,
      primaryArea: domains[0] || 'other'
    });
    for (const area of domains) {
      if (!areas.has(area)) {
        areas.set(area, []);
      }
      areas.get(area).push(file.path);
    }
  }

  return {
    schemaVersion: 'ecc.modules.v1',
    generatedAt: new Date().toISOString(),
    repoRoot,
    fileDomains: fileDomains.sort((left, right) => left.path.localeCompare(right.path)),
    areas: [...areas.entries()]
      .map(([area, files]) => ({
        area,
        fileCount: unique(files).length,
        files: unique(files).sort().slice(0, 200)
      }))
      .sort((left, right) => right.fileCount - left.fileCount || left.area.localeCompare(right.area))
  };
}

function routeKindForPath(relativePath) {
  if (NEXT_APP_API_ROUTE_PATTERN.test(relativePath)) {
    return 'nextjs-app-route';
  }

  if (NEXT_PAGES_API_ROUTE_PATTERN.test(relativePath)) {
    return 'nextjs-pages-api';
  }

  if (/(^|\/)(src\/)?(routes|api)\/.+\.(ts|js)$/iu.test(relativePath)) {
    return 'route-candidate';
  }

  return null;
}

function routePatternToEndpoint(relativePath) {
  if (NEXT_APP_API_ROUTE_PATTERN.test(relativePath)) {
    return '/' + relativePath
      .replace(/^(src\/)?app\/api\//iu, '')
      .replace(/\/route\.(ts|js)$/iu, '')
      .split('/')
      .filter(Boolean)
      .join('/');
  }

  if (NEXT_PAGES_API_ROUTE_PATTERN.test(relativePath)) {
    return '/' + relativePath
      .replace(/^(src\/)?pages\/api\//iu, '')
      .replace(/\.(ts|js)$/iu, '')
      .split('/')
      .filter(Boolean)
      .join('/');
  }

  return null;
}

function buildRoutesMap(repoRoot, fingerprint) {
  const routes = fingerprint.files
    .map(file => ({
      path: file.path,
      kind: routeKindForPath(file.path),
      endpoint: routePatternToEndpoint(file.path),
      domains: inferFileDomains(file.path)
    }))
    .filter(route => route.kind);

  return {
    schemaVersion: 'ecc.routes.v1',
    generatedAt: new Date().toISOString(),
    repoRoot,
    routes
  };
}

function buildApiMap(repoRoot, routesMap, modulesMap) {
  const backendArea = modulesMap.areas.find(area => area.area === 'backend');
  const routePaths = new Set(routesMap.routes.map(route => route.path));

  return {
    schemaVersion: 'ecc.api-map.v1',
    generatedAt: new Date().toISOString(),
    repoRoot,
    routes: routesMap.routes,
    supportingFiles: backendArea ? backendArea.files.filter(filePath => !routePaths.has(filePath)).slice(0, 100) : []
  };
}

function buildDbMap(repoRoot, fingerprint) {
  const prismaFiles = fingerprint.files
    .map(file => file.path)
    .filter(filePath => /(^|\/)(prisma\/schema\.prisma|schema\.sql)$/iu.test(filePath));
  const migrationDirs = fingerprint.files
    .map(file => file.path)
    .filter(filePath => /(^|\/)(migrations|prisma\/migrations)\//iu.test(filePath));
  const modelFiles = fingerprint.files
    .map(file => file.path)
    .filter(filePath => /(^|\/)(models|schemas|db|database|repositories)\//iu.test(filePath));

  return {
    schemaVersion: 'ecc.db-map.v1',
    generatedAt: new Date().toISOString(),
    repoRoot,
    prismaFiles,
    migrationFiles: migrationDirs,
    modelFiles
  };
}

function extractSymbolsFromContent(content) {
  const exports = new Set();
  const functions = new Set();
  const classes = new Set();

  for (const match of content.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gu)) {
    exports.add(match[1]);
    functions.add(match[1]);
  }

  for (const match of content.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/gu)) {
    functions.add(match[1]);
  }

  for (const match of content.matchAll(/class\s+([A-Za-z0-9_]+)/gu)) {
    classes.add(match[1]);
  }

  for (const match of content.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_]+)/gu)) {
    exports.add(match[1]);
  }

  const moduleExportsMatch = content.match(/module\.exports\s*=\s*\{([\s\S]*?)\}/u);
  if (moduleExportsMatch) {
    moduleExportsMatch[1]
      .split(',')
      .map(token => token.trim())
      .filter(Boolean)
      .forEach(token => {
        const normalized = token.split(':')[0].trim();
        if (normalized) {
          exports.add(normalized);
        }
      });
  }

  return {
    exports: [...exports].sort(),
    functions: [...functions].sort(),
    classes: [...classes].sort()
  };
}

function buildSymbolsMap(repoRoot, fingerprint) {
  const files = fingerprint.files
    .map(file => {
      if (!SYMBOL_FILE_PATTERN.test(file.path)) {
        return null;
      }

      const fullPath = path.join(repoRoot, file.path.split('/').join(path.sep));
      let content = '';
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        return null;
      }

      const symbols = extractSymbolsFromContent(content);
      if (symbols.exports.length === 0 && symbols.functions.length === 0 && symbols.classes.length === 0) {
        return null;
      }

      return {
        path: toRelativePath(repoRoot, fullPath),
        exports: symbols.exports,
        functions: symbols.functions,
        classes: symbols.classes
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    schemaVersion: 'ecc.symbols.v1',
    generatedAt: new Date().toISOString(),
    repoRoot,
    files
  };
}

module.exports = {
  AREA_PATTERNS,
  buildApiMap,
  buildDbMap,
  buildModulesMap,
  buildRoutesMap,
  buildSymbolsMap,
  buildTreeSummary,
  classifyArea,
  extractSymbolsFromContent,
  inferFileDomains,
  routeKindForPath,
  routePatternToEndpoint
};
