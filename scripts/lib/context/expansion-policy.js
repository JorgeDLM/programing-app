'use strict';

const EXPANSION_POLICY_SCHEMA_VERSION = 'ecc.context-expansion-policy.v2';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function hasWildcardPath(paths = []) {
  return paths.some(value => /[*?]/u.test(String(value)));
}

function hasExplicitReason(request = {}) {
  return typeof request.reason === 'string' && request.reason.trim().length > 0;
}

function isRepoWideRequest(request = {}, candidateFiles = []) {
  if (request.mode === 'repo-wide' || request.kind === 'repo-wide') {
    return true;
  }

  return Array.isArray(request.paths) && request.paths.length === 0 && candidateFiles.length > 0 && request.mode === 'broad';
}

function evaluateExpansionRequest(input = {}) {
  const workingSet = input.workingSet || { files: [], docs: [] };
  const budget = input.budget || {};
  const request = input.request || {};
  const candidateFiles = unique(input.candidateFiles);
  const candidateDocs = unique(input.candidateDocs);
  const candidateReasons = Array.isArray(input.candidateReasons) ? input.candidateReasons : [];
  const allowedExpansion = input.allowedExpansion || workingSet.allowedExpansion || budget.allowedExpansion || {
    repoWide: false,
    crossDomain: false,
    neighborCallsite: false
  };
  const broadSearchesRemaining = Number.isFinite(budget.broadSearchesRemaining) ? budget.broadSearchesRemaining : 0;
  const broadSearchesUsed = Number.isFinite(budget.broadSearchesUsed) ? budget.broadSearchesUsed : 0;
  const expansionsRemaining = Number.isFinite(budget.expansionsRemaining) ? budget.expansionsRemaining : 0;
  const expansionsUsed = Number.isFinite(budget.expansionsUsed) ? budget.expansionsUsed : 0;
  const totalFilesMax = Number.isFinite(budget.totalFilesMax) ? budget.totalFilesMax : Number.isFinite(budget.maxFiles) ? budget.maxFiles : Array.isArray(workingSet.files) ? workingSet.files.length : 0;
  const currentFiles = Array.isArray(workingSet.files) ? workingSet.files.length : 0;
  const isBroadSearch = request.mode === 'broad' || request.kind === 'broad-search';
  const repoWideRequest = isRepoWideRequest(request, candidateFiles);
  const crossDomainRequest = Array.isArray(request.domains) && request.domains.length > 1;

  function deny(reason, details = {}) {
    return {
      schemaVersion: EXPANSION_POLICY_SCHEMA_VERSION,
      approved: false,
      deniedReason: reason,
      reason: reason,
      request,
      additions: { files: [], docs: [], relatedArtifacts: [], reasons: [] },
      budgetDelta: {
        broadSearchesUsedDelta: 0,
        expansionsUsedDelta: 0,
        filesAdded: 0
      },
      nextBudget: {
        ...budget,
        broadSearchesRemaining,
        broadSearchesUsed,
        expansionsRemaining,
        expansionsUsed,
        totalFilesMax,
        maxFiles: totalFilesMax,
        currentFilesCount: currentFiles,
        allowedExpansion
      },
      details
    };
  }

  if (expansionsRemaining <= 0) {
    return deny('no-expansions-remaining');
  }

  if (Array.isArray(request.paths) && hasWildcardPath(request.paths)) {
    return deny('wildcard-paths-not-allowed');
  }

  if (repoWideRequest && allowedExpansion.repoWide !== true) {
    return deny('repo-wide-expansion-not-allowed-by-default');
  }

  if (repoWideRequest && !hasExplicitReason(request)) {
    return deny('repo-wide-expansion-requires-explicit-reason');
  }

  if (crossDomainRequest && allowedExpansion.crossDomain !== true) {
    return deny('cross-domain-expansion-not-allowed');
  }

  if (isBroadSearch && broadSearchesRemaining <= 0) {
    return deny('no-broad-searches-remaining');
  }

  const remainingFileSlots = Math.max(0, totalFilesMax - currentFiles);
  const approvedFiles = candidateFiles.slice(0, remainingFileSlots);
  const approvedDocs = candidateDocs;
  const approvedReasons = candidateReasons.filter(reason => approvedFiles.includes(reason.path));

  if (approvedFiles.length === 0 && approvedDocs.length === 0) {
    return deny('no-approved-additions');
  }

  return {
    schemaVersion: EXPANSION_POLICY_SCHEMA_VERSION,
    approved: true,
    deniedReason: null,
    reason: typeof request.reason === 'string' ? request.reason.trim() : null,
    request,
    additions: {
      files: approvedFiles,
      docs: approvedDocs,
      relatedArtifacts: [],
      reasons: approvedReasons
    },
    budgetDelta: {
      broadSearchesUsedDelta: isBroadSearch ? 1 : 0,
      expansionsUsedDelta: 1,
      filesAdded: approvedFiles.length
    },
    nextBudget: {
      ...budget,
      broadSearchesRemaining: Math.max(0, broadSearchesRemaining - (isBroadSearch ? 1 : 0)),
      broadSearchesUsed: broadSearchesUsed + (isBroadSearch ? 1 : 0),
      expansionsRemaining: Math.max(0, expansionsRemaining - 1),
      expansionsUsed: expansionsUsed + 1,
      totalFilesMax,
      maxFiles: totalFilesMax,
      currentFilesCount: currentFiles + approvedFiles.length,
      allowedExpansion
    }
  };
}

module.exports = {
  EXPANSION_POLICY_SCHEMA_VERSION,
  evaluateExpansionRequest,
  hasExplicitReason,
  hasWildcardPath
};
