'use strict';

const { classifyArea, routeKindForPath } = require('./repo-map-builders');
const { getDefaultDocTargetsForImpact, isAiContextFile } = require('./ai-context-files');

const CONTEXT_IMPACT_SCHEMA_VERSION = 'ecc.context-impact.v1';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function normalizeChangedFiles(changedFiles = []) {
  return unique(
    (Array.isArray(changedFiles) ? changedFiles : [])
      .filter(filePath => typeof filePath === 'string' && filePath.trim().length > 0)
      .map(filePath => filePath.trim().replace(/^\.\//u, '').split('\\').join('/'))
  );
}

function getKnownSet(values = []) {
  return new Set(Array.isArray(values) ? values : []);
}

function buildRepoSets(indexPayload = {}) {
  const dbMap = indexPayload.dbMap || {};
  const routes = indexPayload.routes && Array.isArray(indexPayload.routes.routes) ? indexPayload.routes.routes : [];
  const modules = indexPayload.modules && Array.isArray(indexPayload.modules.areas) ? indexPayload.modules.areas : [];
  const fileDomains = indexPayload.modules && Array.isArray(indexPayload.modules.fileDomains) ? indexPayload.modules.fileDomains : [];

  return {
    apiPaths: getKnownSet(routes.map(route => route.path)),
    dataPaths: getKnownSet([...(dbMap.prismaFiles || []), ...(dbMap.modelFiles || []), ...(dbMap.migrationFiles || [])]),
    domainsByFile: new Map(
      fileDomains.map(entry => [entry.path, Array.isArray(entry.domains) ? entry.domains : []])
    ),
    areaByFile: new Map(
      modules.flatMap(area => (Array.isArray(area.files) ? area.files : []).map(filePath => [filePath, area.area]))
    )
  };
}

function collectTextSignals(text = '') {
  const normalized = String(text || '').toLowerCase();
  const signals = [];

  if (!normalized) {
    return signals;
  }

  if (/(breaking|deprecat|remove|rename|migrate)/u.test(normalized)) {
    signals.push('significant_decision_text');
  }

  if (/(architecture|orchestrator|contract|schema|pipeline|adapter|workflow)/u.test(normalized)) {
    signals.push('architecture_text');
  }

  if (/(api|endpoint|route|handler)/u.test(normalized)) {
    signals.push('api_text');
  }

  if (/(prisma|schema|migration|database|model|repository)/u.test(normalized)) {
    signals.push('data_text');
  }

  if (/(frontend|ui|component|page|view|layout)/u.test(normalized)) {
    signals.push('frontend_text');
  }

  return signals;
}

function classifyChangedFile(filePath, repoSets) {
  const normalized = String(filePath || '').split('\\').join('/');
  const fileDomains = Array.isArray(repoSets.domainsByFile.get(normalized)) && repoSets.domainsByFile.get(normalized).length > 0
    ? repoSets.domainsByFile.get(normalized)
    : [repoSets.areaByFile.get(normalized) || classifyArea(normalized)];
  const area = fileDomains[0] || 'other';
  const signals = [];
  const domains = [...fileDomains];

  if (isAiContextFile(normalized)) {
    signals.push('ai_context_file_changed');
    domains.push('docs');
  }

  if (routeKindForPath(normalized) || repoSets.apiPaths.has(normalized)) {
    signals.push('api_route_changed');
    domains.push('api');
    domains.push('backend');
  }

  if (repoSets.dataPaths.has(normalized)) {
    signals.push('data_model_changed');
    domains.push('data');
  }

  if (area === 'frontend') {
    signals.push('frontend_code_changed');
    domains.push('frontend');
  }

  if (area === 'backend') {
    signals.push('backend_code_changed');
    domains.push('backend');
  }

  if (area === 'docs') {
    signals.push('docs_changed');
    domains.push('docs');
  }

  if (
    normalized.startsWith('scripts/lib/context/')
    || normalized === 'scripts/lib/tmux-worktree-orchestrator.js'
    || normalized === 'scripts/orchestrate-worktrees.js'
  ) {
    signals.push('architecture_boundary_changed');
    domains.push('architecture');
  }

  if (/\.(test|spec)\.(js|ts|tsx|jsx)$/u.test(normalized) || normalized.startsWith('tests/')) {
    signals.push('test_only_change');
  }

  return {
    area,
    domains: unique(domains),
    filePath: normalized,
    signals: unique(signals)
  };
}

function deriveImpactLevel(changedFiles, signals, domains) {
  const changedCount = changedFiles.length;
  const signalSet = new Set(signals);
  const domainSet = new Set(domains);

  if (changedCount === 0) {
    return 'low';
  }

  if (
    signalSet.has('data_model_changed')
    || signalSet.has('architecture_boundary_changed')
    || signalSet.has('significant_decision_text')
    || (domainSet.has('api') && domainSet.has('data'))
    || changedCount >= 12
  ) {
    return 'high';
  }

  if (
    domainSet.has('api')
    || domainSet.has('backend')
    || domainSet.has('frontend')
    || domainSet.has('data')
    || changedCount >= 4
  ) {
    return 'medium';
  }

  return 'low';
}

function shouldTreatAsMeaningful(changedFiles, signals, domains) {
  if (changedFiles.length === 0) {
    return false;
  }

  const signalSet = new Set(signals);
  const nonAiContextChanges = changedFiles.filter(filePath => !isAiContextFile(filePath));
  const hasCodeDomain = domains.some(domain => ['frontend', 'backend', 'api', 'data', 'architecture'].includes(domain));

  if (nonAiContextChanges.length === 0) {
    return false;
  }

  if (!hasCodeDomain && signalSet.has('test_only_change')) {
    return false;
  }

  return true;
}

function classifyContextImpact(input = {}) {
  const changedFiles = normalizeChangedFiles(
    input.changedFiles
      || (input.evidence && input.evidence.changedFiles)
      || (input.diff && input.diff.changedFiles)
      || []
  );
  const repoSets = buildRepoSets(input.indexPayload || {});
  const fileClassifications = changedFiles.map(filePath => classifyChangedFile(filePath, repoSets));
  const textSignals = collectTextSignals(`${input.diffSummary || ''}\n${input.patchExcerpt || ''}`);
  const signals = unique([...fileClassifications.flatMap(entry => entry.signals), ...textSignals]);
  const domains = unique([
    ...fileClassifications.flatMap(entry => entry.domains),
    ...(Array.isArray(input.normalizedIntent && input.normalizedIntent.expectedDomains) && changedFiles.length === 0 ? input.normalizedIntent.expectedDomains : []),
    ...(Array.isArray(input.preparedContext && input.preparedContext.expectedDomains) && changedFiles.length === 0 ? input.preparedContext.expectedDomains : [])
  ]);
  const hasMeaningfulImpact = shouldTreatAsMeaningful(changedFiles, signals, domains);
  const impactLevel = deriveImpactLevel(changedFiles, signals, domains);
  const needsAdrUpdate = signals.includes('architecture_boundary_changed') || signals.includes('significant_decision_text');
  const needsRecentChangesUpdate = hasMeaningfulImpact;
  const shouldSkipUpdate = !hasMeaningfulImpact;
  let skipReason = null;

  if (changedFiles.length === 0) {
    skipReason = 'no-changed-files';
  } else if (changedFiles.every(filePath => isAiContextFile(filePath))) {
    skipReason = 'ai-context-only-change';
  } else if (fileClassifications.every(entry => entry.signals.includes('test_only_change') || entry.area === 'docs')) {
    skipReason = 'tests-or-docs-only-change';
  }

  const impact = {
    schemaVersion: CONTEXT_IMPACT_SCHEMA_VERSION,
    hasMeaningfulImpact,
    impactLevel,
    domains,
    docTargets: [],
    needsAdrUpdate,
    needsRecentChangesUpdate,
    shouldSkipUpdate,
    skipReason,
    basedOnCommit: input.basedOnCommit
      || input.preparedContext && input.preparedContext.basedOnCommit
      || input.workingSet && input.workingSet.basedOnCommit
      || input.indexPayload && input.indexPayload.repoMeta && input.indexPayload.repoMeta.basedOnCommit
      || 'unknown',
    evidence: {
      changedFiles,
      signals,
      fileClassifications
    }
  };

  impact.docTargets = getDefaultDocTargetsForImpact(impact);

  return impact;
}

module.exports = {
  CONTEXT_IMPACT_SCHEMA_VERSION,
  classifyContextImpact,
  classifyChangedFile,
  collectTextSignals,
  deriveImpactLevel,
  normalizeChangedFiles
};
