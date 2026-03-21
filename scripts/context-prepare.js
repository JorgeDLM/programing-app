#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { prepareContext } = require('./lib/context/context-preparer');
const { recordContextObservation } = require('./lib/context/context-observability');

function showHelp(exitCode = 0) {
  console.log([
    'Usage:',
    '  node scripts/context-prepare.js --task "<task>" [--repo <path>] [--cache-root <path>] [--meta <json>] [--task-id <id>] [--write <output.json>] [--prepare-mode <standard|task-focused>] [--analysis-mode <seed|balanced|deep>] [--force-refresh] [--no-persist]',
    '  node scripts/context-prepare.js --task-file <task.txt> [--repo <path>] [--cache-root <path>] [--meta <json>]',
    '',
    'Prepare bounded repo-aware context for a local task using deterministic cache artifacts.'
  ].join('\n'));
  process.exit(exitCode);
}

function parseJson(value, label) {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid ${label}: ${error.message}`);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    task: null,
    taskFile: null,
    repoRoot: null,
    cacheRoot: null,
    taskId: null,
    writePath: null,
    prepareMode: 'standard',
    analysisMode: 'balanced',
    persist: true,
    forceRefresh: false,
    help: false,
    callerMetadata: {}
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--task') {
      parsed.task = args[index + 1] || null;
      index += 1;
    } else if (arg === '--task-file') {
      parsed.taskFile = args[index + 1] || null;
      index += 1;
    } else if (arg === '--repo') {
      parsed.repoRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--cache-root') {
      parsed.cacheRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--meta') {
      parsed.callerMetadata = parseJson(args[index + 1] || '{}', '--meta');
      index += 1;
    } else if (arg === '--task-id') {
      parsed.taskId = args[index + 1] || null;
      index += 1;
    } else if (arg === '--write') {
      parsed.writePath = args[index + 1] || null;
      index += 1;
    } else if (arg === '--prepare-mode') {
      parsed.prepareMode = args[index + 1] || 'standard';
      index += 1;
    } else if (arg === '--analysis-mode') {
      parsed.analysisMode = args[index + 1] || 'balanced';
      index += 1;
    } else if (arg === '--force-refresh') {
      parsed.forceRefresh = true;
    } else if (arg === '--no-persist') {
      parsed.persist = false;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function resolveTask(options) {
  if (typeof options.task === 'string' && options.task.trim().length > 0) {
    return options.task.trim();
  }

  if (typeof options.taskFile === 'string' && options.taskFile.length > 0) {
    return fs.readFileSync(path.resolve(options.taskFile), 'utf8').trim();
  }

  throw new Error('Missing task. Use --task or --task-file.');
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    showHelp(0);
  }

  const task = resolveTask(options);
  const payload = await prepareContext({
    task,
    taskId: options.taskId,
    repoRoot: options.repoRoot || process.cwd(),
    callerMetadata: options.callerMetadata
  }, {
    cacheRoot: options.cacheRoot,
    prepareMode: options.prepareMode,
    analysisMode: options.analysisMode,
    forceRefresh: options.forceRefresh,
    persist: options.persist
  });
  recordContextObservation({
    repoRoot: options.repoRoot || process.cwd(),
    preparedContext: payload,
    workingSet: payload.workingSet,
    commandName: 'context-prepare',
    phase: 'entry',
    source: 'cli',
    backwardCompatibilityFallback: false,
    broadSearchTriggered: false,
    repeatedRediscovery: false
  }, {
    cacheRoot: options.cacheRoot,
    persist: options.persist
  });
  const output = JSON.stringify(payload, null, 2);

  if (options.writePath) {
    const absoluteWritePath = path.resolve(options.writePath);
    fs.mkdirSync(path.dirname(absoluteWritePath), { recursive: true });
    fs.writeFileSync(absoluteWritePath, output + '\n', 'utf8');
  }

  console.log(output);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[context-prepare] ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  main,
  parseArgs,
  resolveTask,
  showHelp
};
