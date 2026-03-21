'use strict';

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function getNormalizeSeedPaths() {
  return require('../tmux-worktree-orchestrator').normalizeSeedPaths;
}

function resolveWorkingSetSeedPaths(workingSet, repoRoot) {
  const normalizeSeedPaths = getNormalizeSeedPaths();
  const candidates = unique([
    ...(workingSet && Array.isArray(workingSet.files) ? workingSet.files : []),
    ...(workingSet && Array.isArray(workingSet.docs) ? workingSet.docs : []),
    ...(workingSet && Array.isArray(workingSet.seedPaths) ? workingSet.seedPaths : [])
  ]);

  return normalizeSeedPaths(candidates, repoRoot);
}

function toSeedPaths(workingSet, repoRoot) {
  return resolveWorkingSetSeedPaths(workingSet, repoRoot);
}

function mergeSeedPaths(baseSeedPaths, additions, repoRoot) {
  const normalizeSeedPaths = getNormalizeSeedPaths();
  return normalizeSeedPaths(unique([...(baseSeedPaths || []), ...(additions || [])]), repoRoot);
}

function applyWorkingSetToWorker(worker, workingSet, repoRoot) {
  return {
    ...worker,
    seedPaths: mergeSeedPaths(worker && worker.seedPaths ? worker.seedPaths : [], toSeedPaths(workingSet, repoRoot), repoRoot),
    workingSetId: workingSet && (workingSet.workingSetId || workingSet.id) ? (workingSet.workingSetId || workingSet.id) : worker && worker.workingSetId,
    workingSet: workingSet || worker && worker.workingSet
  };
}

function applyWorkingSetToWorkers(workers, workingSet, repoRoot) {
  return (Array.isArray(workers) ? workers : []).map(worker => applyWorkingSetToWorker(worker, workingSet, repoRoot));
}

module.exports = {
  applyWorkingSetToWorker,
  applyWorkingSetToWorkers,
  mergeSeedPaths,
  resolveWorkingSetSeedPaths,
  toSeedPaths
};
