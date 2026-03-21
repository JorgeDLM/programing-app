#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const {
  buildOrchestrationPlan,
  executePlan,
  materializePlan
} = require('./lib/tmux-worktree-orchestrator');
const { preparePlanConfigForExecution } = require('./lib/context/context-orchestration');
const { recordContextObservation } = require('./lib/context/context-observability');

function usage() {
  console.log([
    'Usage:',
    '  node scripts/orchestrate-worktrees.js <plan.json> [--execute]',
    '  node scripts/orchestrate-worktrees.js <plan.json> [--write-only]',
    '',
    'Plan config context inputs:',
    '  - preparedContext (inline object)',
    '  - preparedContextPath (path to a prepared-context JSON file)',
    '  - contextTask / taskDescription / task (generates PreparedContextPackage automatically)',
    '',
    'Placeholders supported in launcherCommand:',
    '  {worker_name} {worker_slug} {session_name} {repo_root}',
    '  {worktree_path} {branch_name} {task_file} {handoff_file} {status_file}',
    '',
    'Without flags the script prints a dry-run plan only.'
  ].join('\n'));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const planPath = args.find(arg => !arg.startsWith('--'));
  return {
    execute: args.includes('--execute'),
    planPath,
    writeOnly: args.includes('--write-only')
  };
}

async function loadPlanConfig(planPath) {
  const absolutePath = path.resolve(planPath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const config = JSON.parse(raw);
  config.repoRoot = config.repoRoot || process.cwd();
  const prepared = await preparePlanConfigForExecution(config, {
    cacheRoot: config.cacheRoot,
    commandName: 'orchestrate-worktrees'
  });
  return {
    absolutePath,
    config: prepared.config,
    contextRuntime: prepared.contextRuntime,
    preparedContext: prepared.preparedContext,
    workingSet: prepared.workingSet
  };
}

function printDryRun(plan, absolutePath) {
  const preview = {
    planFile: absolutePath,
    sessionName: plan.sessionName,
    repoRoot: plan.repoRoot,
    coordinationDir: plan.coordinationDir,
    contextRuntime: plan.contextRuntime || null,
    preparedContext: plan.preparedContext
      ? {
          taskContextId: plan.preparedContext.taskContextId,
          basedOnCommit: plan.preparedContext.basedOnCommit,
          recommendedDocs: plan.preparedContext.recommendedDocs,
          workingSetId: plan.preparedContext.workingSet && (plan.preparedContext.workingSet.workingSetId || plan.preparedContext.workingSet.id)
        }
      : null,
    workers: plan.workerPlans.map(worker => ({
      workerName: worker.workerName,
      branchName: worker.branchName,
      worktreePath: worker.worktreePath,
      seedPaths: worker.seedPaths,
      workingSetId: worker.workingSetId || null,
      workingSet: worker.workingSet
        ? {
            intentType: worker.workingSet.intentType,
            filesCount: worker.workingSet.files.length,
            docsCount: worker.workingSet.docs.length,
            budget: worker.workingSet.budget,
            allowedExpansion: worker.workingSet.allowedExpansion
          }
        : null,
      taskFilePath: worker.taskFilePath,
      handoffFilePath: worker.handoffFilePath,
      launchCommand: worker.launchCommand
    })),
    commands: [
      ...plan.workerPlans.map(worker => worker.gitCommand),
      ...plan.tmuxCommands.map(command => [command.cmd, ...command.args].join(' '))
    ]
  };

  console.log(JSON.stringify(preview, null, 2));
}

function recordPlanObservation(plan, absolutePath, phase) {
  const sharedWorkingSet = plan.preparedContext && plan.preparedContext.workingSet
    ? plan.preparedContext.workingSet
    : plan.workerPlans.find(worker => worker.workingSet) && plan.workerPlans.find(worker => worker.workingSet).workingSet;

  return recordContextObservation({
    repoRoot: plan.repoRoot,
    preparedContext: plan.preparedContext || null,
    workingSet: sharedWorkingSet || null,
    commandName: 'orchestrate-worktrees',
    phase,
    source: plan.contextRuntime && plan.contextRuntime.source || 'legacy-config',
    backwardCompatibilityFallback: Boolean(plan.contextRuntime && plan.contextRuntime.backwardCompatibilityFallback),
    broadSearchTriggered: Boolean(plan.contextRuntime && plan.contextRuntime.contextMode === 'legacy'),
    repeatedRediscovery: Boolean(plan.contextRuntime && plan.contextRuntime.contextMode === 'legacy'),
    fallbackReason: plan.contextRuntime && plan.contextRuntime.fallbackReason || null,
    notes: absolutePath,
    planFile: absolutePath,
    sessionName: plan.sessionName
  }, {
    cacheRoot: plan.cacheRoot || null
  });
}

async function main() {
  const { execute, planPath, writeOnly } = parseArgs(process.argv);

  if (!planPath) {
    usage();
    process.exit(1);
  }

  const { absolutePath, config } = await loadPlanConfig(planPath);
  const plan = buildOrchestrationPlan(config);
  recordPlanObservation(plan, absolutePath, 'orchestration-plan');

  if (writeOnly) {
    materializePlan(plan);
    console.log(`Wrote orchestration files to ${plan.coordinationDir}`);
    return;
  }

  if (!execute) {
    printDryRun(plan, absolutePath);
    return;
  }

  const result = executePlan(plan);
  recordPlanObservation(plan, absolutePath, 'orchestration-execute');
  console.log([
    `Started tmux session '${result.sessionName}' with ${result.workerCount} worker panes.`,
    `Coordination files: ${result.coordinationDir}`,
    `Attach with: tmux attach -t ${result.sessionName}`
  ].join('\n'));
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[orchestrate-worktrees] ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  loadPlanConfig,
  main,
  parseArgs,
  printDryRun,
  usage
};
