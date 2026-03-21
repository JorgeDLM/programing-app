#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { expandPreparedContext } = require('./lib/context/context-expansion-service');
const { indexRepository } = require('./lib/context/repo-index-service');
const { recordContextObservation } = require('./lib/context/context-observability');

function showHelp(exitCode = 0) {
  console.log([
    'Usage:',
    '  node scripts/context-expand.js --prepared-context <file.json> --request <json> [--repo <path>] [--cache-root <path>] [--write <output.json>] [--force-refresh] [--no-persist]',
    '  node scripts/context-expand.js --prepared-context <file.json> --request-file <request.json> [--write <output.json>]',
    '',
    'Apply a controlled expansion request to an existing PreparedContextPackage.'
  ].join('\n'));
  process.exit(exitCode);
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid ${label}: ${error.message}`);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    repoRoot: null,
    preparedContextPath: null,
    request: null,
    requestFile: null,
    cacheRoot: null,
    writePath: null,
    forceRefresh: false,
    persist: true,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--repo') {
      parsed.repoRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--prepared-context') {
      parsed.preparedContextPath = args[index + 1] || null;
      index += 1;
    } else if (arg === '--request') {
      parsed.request = parseJson(args[index + 1] || '{}', '--request');
      index += 1;
    } else if (arg === '--request-file') {
      parsed.requestFile = args[index + 1] || null;
      index += 1;
    } else if (arg === '--cache-root') {
      parsed.cacheRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--write') {
      parsed.writePath = args[index + 1] || null;
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

function loadPreparedContext(preparedContextPath) {
  if (!preparedContextPath) {
    throw new Error('Missing --prepared-context');
  }

  return parseJson(fs.readFileSync(path.resolve(preparedContextPath), 'utf8'), '--prepared-context');
}

function loadRequest(options) {
  if (options.request) {
    return options.request;
  }

  if (options.requestFile) {
    return parseJson(fs.readFileSync(path.resolve(options.requestFile), 'utf8'), '--request-file');
  }

  throw new Error('Missing expansion request. Use --request or --request-file.');
}

function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    showHelp(0);
  }

  const preparedContext = loadPreparedContext(options.preparedContextPath);
  const repoRoot = options.repoRoot || preparedContext.repo && preparedContext.repo.root || process.cwd();
  const indexPayload = indexRepository(repoRoot, {
    cacheRoot: options.cacheRoot,
    forceRefresh: options.forceRefresh,
    persist: options.persist
  });
  const request = loadRequest(options);
  const payload = expandPreparedContext(preparedContext, request, {
    cacheRoot: options.cacheRoot,
    indexPayload,
    persist: options.persist
  });

  recordContextObservation({
    repoRoot,
    preparedContext,
    workingSet: preparedContext.workingSet,
    commandName: 'context-expand',
    phase: 'expansion',
    source: 'cli',
    expansionRequested: true,
    expansionApproved: payload.approved,
    broadSearchTriggered: request.mode === 'broad' || request.kind === 'broad-search',
    backwardCompatibilityFallback: false,
    repeatedRediscovery: false,
    notes: request.reason || null
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
  try {
    main();
  } catch (error) {
    console.error(`[context-expand] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  loadPreparedContext,
  loadRequest,
  main,
  parseArgs,
  showHelp
};
