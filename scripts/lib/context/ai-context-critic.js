'use strict';

const { STANDARD_AI_CONTEXT_DOCS } = require('./ai-context-files');

const AI_CONTEXT_CRITIC_SCHEMA_VERSION = 'ecc.ai-context-critic.v1';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function roundScore(value) {
  return Number(Math.max(0, Math.min(1, value || 0)).toFixed(2));
}

function average(values) {
  const filtered = (Array.isArray(values) ? values : []).filter(value => typeof value === 'number');
  if (filtered.length === 0) {
    return 0;
  }
  return roundScore(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
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

function buildGlobalFindings(indexPayload, analysis) {
  const findings = [];
  const apiContracts = analysis.api && Array.isArray(analysis.api.contracts) ? analysis.api.contracts : [];
  const backendFiles = analysis.backend && Array.isArray(analysis.backend.backendFiles) ? analysis.backend.backendFiles : [];
  const frontendPages = analysis.frontend && Array.isArray(analysis.frontend.pages) ? analysis.frontend.pages : [];
  const openIssues = Array.isArray(analysis.openIssues) ? analysis.openIssues : [];
  const narrative = String(analysis.overview && analysis.overview.narrative || '').toLowerCase();
  const marketingPattern = /(beautiful|delightful|world[- ]class|revolutionary|seamless|modern experience|stunning|best[- ]in[- ]class)/u;

  if (apiContracts.length > 0 && backendFiles.length === 0) {
    findings.push({ severity: 'high', kind: 'backend-surface-missing', detail: 'API routes were discovered but backend surface remained empty.' });
  }

  if (frontendPages.some(filePath => /\/api\//u.test(filePath))) {
    findings.push({ severity: 'high', kind: 'frontend-backend-mixed', detail: 'Frontend pages list appears contaminated with API route handlers.' });
  }

  if (marketingPattern.test(narrative)) {
    findings.push({ severity: 'medium', kind: 'overview-marketing-copy', detail: 'Project overview narrative looks contaminated by marketing or landing-style language.' });
  }

  if (apiContracts.some(contract => contract.confidence === 'low') && !openIssues.some(issue => issue.kind === 'partial-endpoint')) {
    findings.push({ severity: 'medium', kind: 'partial-endpoints-not-opened', detail: 'Low-confidence API contracts exist but OPEN-ISSUES does not surface them clearly enough.' });
  }

  if ((analysis.dataModels && Array.isArray(analysis.dataModels.models) ? analysis.dataModels.models.length : 0) > 1
    && !(analysis.dataModels.models || []).some(model => Array.isArray(model.relations) && model.relations.length > 0)) {
    findings.push({ severity: 'medium', kind: 'data-relations-thin', detail: 'Multiple entities exist but useful relationships were not extracted.' });
  }

  if (openIssues.length === 0) {
    findings.push({ severity: 'medium', kind: 'open-issues-empty', detail: 'OPEN-ISSUES ended up empty; the critic expects at least explicit uncertainty or manual inspection gaps.' });
  }

  if ((analysis.recent && analysis.recent.projectChanges && Array.isArray(analysis.recent.projectChanges.files) ? analysis.recent.projectChanges.files.length : 0) === 0) {
    findings.push({ severity: 'low', kind: 'recent-history-thin', detail: 'Recent project changes are weakly supported and should be treated as partial.' });
  }

  return findings;
}

function summarizeEvidence(evidence = {}) {
  return unique([
    ...(Array.isArray(evidence.sourcePaths) ? evidence.sourcePaths : []),
    ...(Array.isArray(evidence.routeFiles) ? evidence.routeFiles : []),
    ...(Array.isArray(evidence.schemaRefs) ? evidence.schemaRefs : [])
  ]).slice(0, 8);
}

function evaluateDoc(definition, analysis, globalFindings) {
  const apiContracts = analysis.api && Array.isArray(analysis.api.contracts) ? analysis.api.contracts : [];
  const dataModels = analysis.dataModels && Array.isArray(analysis.dataModels.models) ? analysis.dataModels.models : [];
  const openIssues = Array.isArray(analysis.openIssues) ? analysis.openIssues : [];
  const contradictions = analysis.architecture && Array.isArray(analysis.architecture.contradictions) ? analysis.architecture.contradictions : [];
  const lowConfidenceZones = analysis.architecture && Array.isArray(analysis.architecture.lowConfidenceZones) ? analysis.architecture.lowConfidenceZones : [];
  const sectionConfidence = {};
  const evidenceAnchors = [];
  const warnings = [];
  const issues = [];
  let accuracyScore = 0.55;
  let usefulnessScore = 0.55;
  let evidenceScore = 0.5;
  let confidenceHonestyScore = 0.5;
  let signalDensityScore = 0.65;

  if (definition.key === 'start') {
    accuracyScore = analysis.overview && Array.isArray(analysis.overview.entryPoints) && analysis.overview.entryPoints.length > 0 ? 0.84 : 0.58;
    usefulnessScore = analysis.startHere && Array.isArray(analysis.startHere.taskRouter) && analysis.startHere.taskRouter.length >= 5 ? 0.9 : 0.68;
    evidenceScore = summarizeEvidence(analysis.startHere && analysis.startHere.evidence).length > 0 ? 0.78 : 0.55;
    confidenceHonestyScore = (openIssues.length > 0 || lowConfidenceZones.length > 0) ? 0.86 : 0.62;
    signalDensityScore = 0.84;
    sectionConfidence.router = 'high';
    sectionConfidence.entrypoints = analysis.overview && analysis.overview.entryPoints && analysis.overview.entryPoints.length > 0 ? 'high' : 'medium';
    evidenceAnchors.push(...summarizeEvidence(analysis.startHere && analysis.startHere.evidence));
  }

  if (definition.key === 'overview') {
    accuracyScore = analysis.overview && analysis.overview.narrative ? 0.8 : 0.52;
    usefulnessScore = analysis.overview && Array.isArray(analysis.overview.mainAreas) && analysis.overview.mainAreas.length > 0 ? 0.82 : 0.5;
    evidenceScore = summarizeEvidence(analysis.overview && analysis.overview.evidence).length > 0 ? 0.76 : 0.5;
    confidenceHonestyScore = String(analysis.overview && analysis.overview.narrative || '').includes('partially inferred') ? 0.86 : 0.72;
    signalDensityScore = 0.8;
    sectionConfidence.narrative = confidenceLabel(accuracyScore);
    sectionConfidence.hotspots = analysis.overview && analysis.overview.hotspots && analysis.overview.hotspots.length > 0 ? 'high' : 'medium';
    evidenceAnchors.push(...summarizeEvidence(analysis.overview && analysis.overview.evidence));
  }

  if (definition.key === 'architecture') {
    accuracyScore = contradictions.length > 0 || lowConfidenceZones.length > 0 ? 0.84 : 0.72;
    usefulnessScore = analysis.architecture && Array.isArray(analysis.architecture.criticalZones) && analysis.architecture.criticalZones.length > 0 ? 0.82 : 0.58;
    evidenceScore = summarizeEvidence(analysis.architecture && analysis.architecture.evidence).length > 0 ? 0.8 : 0.55;
    confidenceHonestyScore = 0.88;
    signalDensityScore = 0.8;
    sectionConfidence.boundaries = analysis.architecture && analysis.architecture.confidenceBySection && analysis.architecture.confidenceBySection.boundaries || 'medium';
    sectionConfidence.requestFlow = analysis.architecture && analysis.architecture.confidenceBySection && analysis.architecture.confidenceBySection.requestFlow || 'medium';
    evidenceAnchors.push(...summarizeEvidence(analysis.architecture && analysis.architecture.evidence));
  }

  if (definition.key === 'backend') {
    accuracyScore = analysis.backend && Array.isArray(analysis.backend.backendFiles) && analysis.backend.backendFiles.length > 0 ? 0.86 : 0.42;
    usefulnessScore = analysis.backend && Array.isArray(analysis.backend.routeGroups) && analysis.backend.routeGroups.length > 0 ? 0.84 : 0.48;
    evidenceScore = summarizeEvidence(analysis.backend && analysis.backend.evidence).length > 0 ? 0.82 : 0.45;
    confidenceHonestyScore = analysis.backend && Array.isArray(analysis.backend.partialZones) && analysis.backend.partialZones.length > 0 ? 0.88 : 0.72;
    signalDensityScore = 0.82;
    sectionConfidence.backendSurface = analysis.backend && analysis.backend.confidenceBySection && analysis.backend.confidenceBySection.backendSurface || 'medium';
    sectionConfidence.supportingFiles = analysis.backend && analysis.backend.confidenceBySection && analysis.backend.confidenceBySection.supportFiles || 'medium';
    evidenceAnchors.push(...summarizeEvidence(analysis.backend && analysis.backend.evidence));
  }

  if (definition.key === 'frontend') {
    accuracyScore = analysis.frontend && (analysis.frontend.pages || analysis.frontend.components) && ((analysis.frontend.pages || []).length + (analysis.frontend.components || []).length > 0) ? 0.84 : 0.5;
    usefulnessScore = analysis.frontend && Array.isArray(analysis.frontend.surfaces) && analysis.frontend.surfaces.length > 0 ? 0.8 : 0.56;
    evidenceScore = summarizeEvidence(analysis.frontend && analysis.frontend.evidence).length > 0 ? 0.78 : 0.5;
    confidenceHonestyScore = analysis.frontend && Array.isArray(analysis.frontend.partialZones) && analysis.frontend.partialZones.length > 0 ? 0.86 : 0.72;
    signalDensityScore = 0.82;
    sectionConfidence.frontendSurface = analysis.frontend && analysis.frontend.confidenceBySection && analysis.frontend.confidenceBySection.frontendSurface || 'medium';
    evidenceAnchors.push(...summarizeEvidence(analysis.frontend && analysis.frontend.evidence));
  }

  if (definition.key === 'data') {
    accuracyScore = dataModels.length > 0 ? 0.84 : 0.42;
    usefulnessScore = dataModels.some(model => Array.isArray(model.relations) && model.relations.length > 0) ? 0.84 : 0.54;
    evidenceScore = summarizeEvidence(analysis.dataModels && analysis.dataModels.evidence).length > 0 ? 0.84 : 0.48;
    confidenceHonestyScore = dataModels.some(model => model.confidence === 'low') ? 0.9 : 0.76;
    signalDensityScore = 0.8;
    sectionConfidence.entities = analysis.dataModels && analysis.dataModels.confidenceBySection && analysis.dataModels.confidenceBySection.entities || 'medium';
    sectionConfidence.relationships = analysis.dataModels && analysis.dataModels.confidenceBySection && analysis.dataModels.confidenceBySection.relationships || 'medium';
    evidenceAnchors.push(...summarizeEvidence(analysis.dataModels && analysis.dataModels.evidence));
  }

  if (definition.key === 'api') {
    accuracyScore = apiContracts.length > 0 ? 0.82 : 0.4;
    usefulnessScore = apiContracts.some(contract => (contract.requestShape && contract.requestShape.bodyFields || []).length > 0 || (contract.responseShape && contract.responseShape.keys || []).length > 0) ? 0.88 : 0.52;
    evidenceScore = apiContracts.some(contract => summarizeEvidence(contract.evidence).length > 0) ? 0.84 : 0.45;
    confidenceHonestyScore = apiContracts.some(contract => Array.isArray(contract.gaps) && contract.gaps.length > 0) ? 0.9 : 0.72;
    signalDensityScore = 0.84;
    sectionConfidence.methods = 'high';
    sectionConfidence.auth = apiContracts.some(contract => contract.confidenceByAspect && contract.confidenceByAspect.authInference === 'low') ? 'low' : 'medium';
    sectionConfidence.responseShape = apiContracts.some(contract => contract.confidenceByAspect && contract.confidenceByAspect.responseShape === 'low') ? 'low' : 'medium';
    evidenceAnchors.push(...unique(apiContracts.flatMap(contract => summarizeEvidence(contract.evidence))).slice(0, 8));
  }

  if (definition.key === 'adr') {
    accuracyScore = Array.isArray(analysis.decisions) && analysis.decisions.length > 0 ? 0.76 : 0.46;
    usefulnessScore = Array.isArray(analysis.decisions) && analysis.decisions.length > 1 ? 0.74 : 0.5;
    evidenceScore = Array.isArray(analysis.decisions) && analysis.decisions.some(decision => summarizeEvidence(decision.evidence).length > 0) ? 0.76 : 0.5;
    confidenceHonestyScore = Array.isArray(analysis.decisions) && analysis.decisions.some(decision => decision.qualifier !== 'observed') ? 0.9 : 0.72;
    signalDensityScore = 0.74;
    sectionConfidence.decisions = confidenceLabel(accuracyScore);
    evidenceAnchors.push(...unique((analysis.decisions || []).flatMap(decision => summarizeEvidence(decision.evidence))).slice(0, 8));
  }

  if (definition.key === 'recent') {
    accuracyScore = analysis.recent && analysis.recent.limitations ? 0.84 : 0.55;
    usefulnessScore = analysis.recent && analysis.recent.projectChanges && Array.isArray(analysis.recent.projectChanges.files) && analysis.recent.projectChanges.files.length > 0 ? 0.72 : 0.52;
    evidenceScore = summarizeEvidence(analysis.recent && analysis.recent.evidence).length > 0 ? 0.74 : 0.5;
    confidenceHonestyScore = String(analysis.recent && analysis.recent.limitations || '').length > 0 ? 0.92 : 0.6;
    signalDensityScore = 0.72;
    sectionConfidence.recentProjectChanges = analysis.recent && analysis.recent.projectChanges && analysis.recent.projectChanges.strategy === 'filesystem-mtime' ? 'medium' : 'low';
    evidenceAnchors.push(...summarizeEvidence(analysis.recent && analysis.recent.evidence));
  }

  if (definition.key === 'issues') {
    accuracyScore = openIssues.length > 0 ? 0.86 : 0.4;
    usefulnessScore = openIssues.some(issue => issue.kind !== 'no-unresolved') ? 0.88 : 0.58;
    evidenceScore = openIssues.some(issue => summarizeEvidence(issue.evidence).length > 0) ? 0.8 : 0.54;
    confidenceHonestyScore = openIssues.some(issue => issue.kind === 'manual-review-needed' || issue.kind === 'partial-endpoint' || issue.kind === 'low-confidence') ? 0.94 : 0.68;
    signalDensityScore = 0.84;
    sectionConfidence.openIssues = confidenceLabel(usefulnessScore);
    evidenceAnchors.push(...unique(openIssues.flatMap(issue => summarizeEvidence(issue.evidence))).slice(0, 8));
  }

  globalFindings.forEach(finding => {
    if (finding.severity === 'high') {
      issues.push(`${finding.kind}: ${finding.detail}`);
    } else if (definition.key !== 'start') {
      warnings.push(`${finding.kind}: ${finding.detail}`);
    }
  });

  const scores = {
    accuracyScore: roundScore(accuracyScore),
    usefulnessScore: roundScore(usefulnessScore),
    evidenceScore: roundScore(evidenceScore),
    confidenceHonestyScore: roundScore(confidenceHonestyScore),
    signalDensityScore: roundScore(signalDensityScore)
  };
  const averageScore = average(Object.values(scores));
  let decision = 'ready';

  if (issues.length > 0 || averageScore < 0.45) {
    decision = 'needs_review';
  } else if (scores.evidenceScore < 0.55 || scores.usefulnessScore < 0.55) {
    decision = 'needs_enrichment';
  } else if (warnings.length > 0 || averageScore < 0.76) {
    decision = 'partial';
  }

  return {
    docKey: definition.key,
    docPath: definition.path,
    scores,
    averageScore,
    decision,
    sectionConfidence,
    evidenceAnchors: unique(evidenceAnchors).slice(0, 8),
    warnings: unique(warnings).slice(0, 8),
    issues: unique(issues).slice(0, 8)
  };
}

function criticizeAiContextAnalysis(indexPayload, analysis, options = {}) {
  const globalFindings = buildGlobalFindings(indexPayload, analysis);
  const docEvaluations = STANDARD_AI_CONTEXT_DOCS.map(definition => evaluateDoc(definition, analysis, globalFindings));
  const globalIssues = globalFindings.filter(finding => finding.severity === 'high');
  const globalWarnings = globalFindings.filter(finding => finding.severity !== 'high');
  const overallScores = {
    accuracyScore: average(docEvaluations.map(doc => doc.scores.accuracyScore)),
    usefulnessScore: average(docEvaluations.map(doc => doc.scores.usefulnessScore)),
    evidenceScore: average(docEvaluations.map(doc => doc.scores.evidenceScore)),
    confidenceHonestyScore: average(docEvaluations.map(doc => doc.scores.confidenceHonestyScore)),
    signalDensityScore: average(docEvaluations.map(doc => doc.scores.signalDensityScore))
  };
  const overallAverage = average(Object.values(overallScores));
  let decision = 'ready';

  if (globalIssues.length > 0 || docEvaluations.some(doc => doc.decision === 'needs_review')) {
    decision = 'needs_review';
  } else if (overallScores.evidenceScore < 0.55 || overallScores.usefulnessScore < 0.55) {
    decision = 'needs_enrichment';
  } else if (docEvaluations.some(doc => doc.decision === 'partial' || doc.decision === 'needs_enrichment') || overallAverage < 0.76) {
    decision = 'partial';
  }

  return {
    schemaVersion: AI_CONTEXT_CRITIC_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    mode: options.mode || 'balanced',
    overall: {
      ...overallScores,
      averageScore: overallAverage,
      decision
    },
    globalIssues,
    globalWarnings,
    docEvaluations
  };
}

module.exports = {
  AI_CONTEXT_CRITIC_SCHEMA_VERSION,
  criticizeAiContextAnalysis
};
