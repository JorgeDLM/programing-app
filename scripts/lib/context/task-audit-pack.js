'use strict';

const TASK_AUDIT_PACK_SCHEMA_VERSION = 'ecc.task-audit-pack.v1';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function take(values, limit = 8) {
  return unique(values).slice(0, limit);
}

function scoreToLabel(score) {
  if (score >= 0.78) {
    return 'high';
  }
  if (score >= 0.55) {
    return 'medium';
  }
  return 'low';
}

function average(values) {
  const filtered = (Array.isArray(values) ? values : []).filter(value => typeof value === 'number');
  if (filtered.length === 0) {
    return 0;
  }
  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(2));
}

function mapIntentToTaskType(intentType) {
  if (['feature', 'bugfix', 'refactor', 'audit', 'research'].includes(intentType)) {
    return intentType;
  }
  return 'research';
}

function buildDomainSummary(intent, structuredMaps, probableFiles) {
  const primaryDomains = unique(intent.expectedDomains || []);
  const secondaryDomains = unique([
    probableFiles.some(filePath => /(^|\/)(src\/)?app\/api\//u.test(filePath)) ? 'api' : null,
    probableFiles.some(filePath => /prisma\/schema\.prisma|schema\.sql|migrations?/iu.test(filePath)) ? 'data' : null,
    probableFiles.some(filePath => /(^|\/)(src\/)?app\/(?!api\/).+\/(page|layout)\.(tsx|jsx|ts|js)$/iu.test(filePath)) ? 'frontend' : null,
    probableFiles.some(filePath => /service|handler|controller|middleware/iu.test(filePath)) ? 'backend' : null
  ]).filter(domain => !primaryDomains.includes(domain));
  const why = take(unique([
    ...(primaryDomains.map(domain => `intent:${domain}`)),
    structuredMaps.routeToModelMap && structuredMaps.routeToModelMap.entries.some(entry => entry.endpoint && probableFiles.includes(entry.path)) ? 'route-to-model links suggest API/data impact' : null,
    structuredMaps.screenToApiMap && structuredMaps.screenToApiMap.entries.some(entry => entry.endpoints.length > 0) ? 'screen-to-api links suggest UI/API coupling' : null
  ]), 6);

  return {
    primaryDomains,
    secondaryDomains,
    why
  };
}

function collectAffectedScreens(structuredMaps, affectedApis) {
  return take((structuredMaps.screenToApiMap && structuredMaps.screenToApiMap.entries || [])
    .filter(entry => entry.endpoints.some(endpoint => affectedApis.includes(endpoint)))
    .map(entry => entry.screen), 12);
}

function collectAffectedEntities(structuredMaps, affectedApis) {
  const directEntities = (structuredMaps.routeToModelMap && structuredMaps.routeToModelMap.entries || [])
    .filter(entry => affectedApis.includes(entry.endpoint))
    .flatMap(entry => entry.entities || []);
  return take(directEntities, 12);
}

function collectAffectedApis(structuredMaps, probableFiles) {
  return take((structuredMaps.routeToModelMap && structuredMaps.routeToModelMap.entries || [])
    .filter(entry => probableFiles.includes(entry.path) || (entry.supportingFiles || []).some(filePath => probableFiles.includes(filePath)))
    .map(entry => entry.endpoint), 12);
}

function collectProbableFiles(preparedContext, structuredMaps, taskText) {
  const loweredTask = String(taskText || '').toLowerCase();
  const routeFiles = (structuredMaps.routeToModelMap && structuredMaps.routeToModelMap.entries || [])
    .filter(entry => loweredTask.includes(String(entry.endpoint || '').replace(/^\//u, '').toLowerCase()) || loweredTask.includes(entry.path.toLowerCase()))
    .flatMap(entry => [entry.path, ...(entry.supportingFiles || [])]);
  const screenFiles = (structuredMaps.screenToApiMap && structuredMaps.screenToApiMap.entries || [])
    .filter(entry => loweredTask.includes(entry.screen.toLowerCase()) || /screen|page|ui|frontend|admin/iu.test(taskText))
    .map(entry => entry.screen);
  const entityFiles = (structuredMaps.entityUsageMap && structuredMaps.entityUsageMap.entities || [])
    .filter(entry => loweredTask.includes(entry.entity.toLowerCase()))
    .flatMap(entry => entry.keyFiles || []);

  return take(unique([
    ...(preparedContext.workingSet && preparedContext.workingSet.files || []),
    ...routeFiles,
    ...screenFiles,
    ...entityFiles,
    ...((structuredMaps.hotspots && structuredMaps.hotspots.entries || []).slice(0, 4).map(entry => entry.target))
  ]), 16);
}

function buildRiskSummary(structuredMaps, probableFiles, affectedApis) {
  const zones = (structuredMaps.riskZones && structuredMaps.riskZones.zones || [])
    .filter(zone => zone.targets.some(target => probableFiles.includes(target)) || zone.targets.some(target => affectedApis.some(api => target.includes(api.replace(/^\//u, '')))));
  const highestSeverity = zones.some(zone => zone.severity === 'high') ? 'high' : zones.some(zone => zone.severity === 'medium') ? 'medium' : 'low';
  return {
    level: highestSeverity,
    reasons: take(unique(zones.flatMap(zone => zone.reasons || [])), 8)
  };
}

function buildConfidenceSummary(preparedContext, structuredMaps, affectedScreens, affectedApis, affectedEntities) {
  const scores = [
    typeof preparedContext.confidence === 'number' ? preparedContext.confidence : 0,
    structuredMaps.readiness && typeof structuredMaps.readiness.confidenceScore === 'number' ? structuredMaps.readiness.confidenceScore : 0,
    affectedScreens.length > 0 ? 0.75 : 0.45,
    affectedApis.length > 0 ? 0.8 : 0.4,
    affectedEntities.length > 0 ? 0.8 : 0.4
  ];
  const averageScore = average(scores);
  const knownUnknowns = [];

  if (affectedScreens.length === 0) {
    knownUnknowns.push('No strong screen linkage was established.');
  }
  if (affectedEntities.length === 0) {
    knownUnknowns.push('Entity impact remains partially inferred.');
  }
  if (structuredMaps.readiness && structuredMaps.readiness.decision !== 'ready') {
    knownUnknowns.push(...(structuredMaps.readiness.warnings || []));
  }

  return {
    overall: scoreToLabel(averageScore),
    knownUnknowns: take(knownUnknowns, 8)
  };
}

function buildGaps(structuredMaps, affectedScreens, affectedApis, affectedEntities) {
  const gaps = [];
  if (affectedApis.length === 0) {
    gaps.push('No API route was confidently tied to the task yet.');
  }
  if (affectedEntities.length === 0) {
    gaps.push('No entity/model was confidently tied to the task yet.');
  }
  if (affectedScreens.length === 0) {
    gaps.push('No screen/page was confidently tied to the task yet.');
  }
  if (structuredMaps.readiness && Array.isArray(structuredMaps.readiness.issues)) {
    gaps.push(...structuredMaps.readiness.issues);
  }
  return take(gaps, 10);
}

function buildExpansionSuggestions(preparedContext, structuredMaps, pack) {
  const suggestions = [];
  if (pack.affectedScreens.length === 0 && (structuredMaps.screenToApiMap && structuredMaps.screenToApiMap.entries || []).length > 0) {
    suggestions.push('Expand into the screen-to-api candidates connected to the affected endpoints.');
  }
  if (pack.affectedEntities.length === 0 && (structuredMaps.entityUsageMap && structuredMaps.entityUsageMap.entities || []).length > 0) {
    suggestions.push('Inspect entity-usage links for the closest route or schema files before broadening scope.');
  }
  if ((preparedContext.workingSet && preparedContext.workingSet.files || []).length < 4) {
    suggestions.push('Request a narrow expansion for neighboring supporting files around the main route/service pair.');
  }
  return take(suggestions, 6);
}

function buildExtendedReadiness(preparedContext, structuredMaps, taskAuditPack) {
  const score = average([
    typeof preparedContext.confidence === 'number' ? preparedContext.confidence : 0,
    structuredMaps.readiness && structuredMaps.readiness.confidenceScore || 0,
    taskAuditPack.confidenceSummary.overall === 'high' ? 0.85 : taskAuditPack.confidenceSummary.overall === 'medium' ? 0.65 : 0.4,
    taskAuditPack.riskSummary.level === 'high' ? 0.55 : taskAuditPack.riskSummary.level === 'medium' ? 0.7 : 0.82
  ]);
  let decision = 'ready';
  if ((taskAuditPack.gaps || []).length > 2 || (structuredMaps.readiness && structuredMaps.readiness.decision === 'needs_review')) {
    decision = 'needs_review';
  } else if ((taskAuditPack.gaps || []).length > 0 || (structuredMaps.readiness && structuredMaps.readiness.decision === 'partial') || score < 0.76) {
    decision = 'partial';
  }
  return {
    decision,
    confidence: scoreToLabel(score),
    confidenceScore: score,
    sourceOfTruthPolicy: 'code > maps > markdown > task pack summary'
  };
}

function buildTaskAuditPack(input = {}) {
  const preparedContext = input.preparedContext || {};
  const intent = input.intent || {};
  const structuredMaps = input.structuredMaps || {};
  const rawTask = input.rawTask || '';
  const probableFiles = collectProbableFiles(preparedContext, structuredMaps, rawTask);
  const affectedApis = collectAffectedApis(structuredMaps, probableFiles);
  const affectedEntities = collectAffectedEntities(structuredMaps, affectedApis);
  const affectedScreens = collectAffectedScreens(structuredMaps, affectedApis);
  const initialWorkingSet = {
    files: take(unique([...(preparedContext.workingSet && preparedContext.workingSet.files || []), ...probableFiles]), 16),
    docs: take(unique(preparedContext.recommendedDocs || []), 10),
    artifacts: take(unique([
      ...(preparedContext.artifacts && preparedContext.artifacts.previousTaskArtifacts || []),
      preparedContext.workingSetId,
      preparedContext.taskContextId
    ]), 10)
  };
  const taskAuditPack = {
    schemaVersion: TASK_AUDIT_PACK_SCHEMA_VERSION,
    taskType: mapIntentToTaskType(intent.intentType),
    scopeHypothesis: preparedContext.scopeHypothesis || `${intent.intentType || 'task'}:${(intent.expectedDomains || []).join('+') || 'repo'}`,
    domainSummary: buildDomainSummary(intent, structuredMaps, probableFiles),
    affectedScreens,
    affectedApis,
    affectedEntities,
    probableFiles,
    recommendedDocs: take(unique(preparedContext.recommendedDocs || []), 10),
    initialWorkingSet,
    riskSummary: buildRiskSummary(structuredMaps, probableFiles, affectedApis),
    confidenceSummary: buildConfidenceSummary(preparedContext, structuredMaps, affectedScreens, affectedApis, affectedEntities),
    gaps: [],
    expansionSuggestions: []
  };

  taskAuditPack.gaps = buildGaps(structuredMaps, affectedScreens, affectedApis, affectedEntities);
  taskAuditPack.expansionSuggestions = buildExpansionSuggestions(preparedContext, structuredMaps, taskAuditPack);

  return taskAuditPack;
}

module.exports = {
  TASK_AUDIT_PACK_SCHEMA_VERSION,
  buildExtendedReadiness,
  buildTaskAuditPack
};
