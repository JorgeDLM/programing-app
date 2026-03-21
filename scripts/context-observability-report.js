#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { summarizeContextObservability } = require('./lib/context/context-observability');

function showHelp(exitCode = 0) {
  console.log([
    'Usage:',
    '  node scripts/context-observability-report.js [--repo <path>] [--cache-root <path>] [--write <output.json>]',
    '',
    'Generate a practical audit report for context adoption, expansions, broad-search fallbacks, and retrieval cost estimates.'
  ].join('\n'));
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    repoRoot: null,
    cacheRoot: null,
    writePath: null,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--repo') {
      parsed.repoRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--cache-root') {
      parsed.cacheRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--write') {
      parsed.writePath = args[index + 1] || null;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
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

  const payload = summarizeContextObservability(options.repoRoot || process.cwd(), {
    cacheRoot: options.cacheRoot
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
    console.error(`[context-observability-report] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  main,
  parseArgs,
  showHelp
};
