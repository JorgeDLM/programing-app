#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { indexRepository } = require('./lib/context/repo-index-service');

function showHelp(exitCode = 0) {
  console.log([
    'Usage:',
    '  node scripts/context-index.js [repo-root] [--cache-root <path>] [--write <output.json>] [--no-persist]',
    '',
    'Index a local repository into deterministic cache artifacts under data/project-cache/<repoSlug>.'
  ].join('\n'));
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    repoRoot: null,
    cacheRoot: null,
    help: false,
    persist: true,
    writePath: null,
    forceRefresh: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--cache-root') {
      parsed.cacheRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--write') {
      parsed.writePath = args[index + 1] || null;
      index += 1;
    } else if (arg === '--no-persist') {
      parsed.persist = false;
    } else if (arg === '--force-refresh') {
      parsed.forceRefresh = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (!arg.startsWith('--') && !parsed.repoRoot) {
      parsed.repoRoot = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    showHelp(0);
  }

  const payload = indexRepository(options.repoRoot || process.cwd(), {
    cacheRoot: options.cacheRoot,
    forceRefresh: options.forceRefresh,
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
    console.error(`[context-index] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  main,
  parseArgs,
  showHelp
};
