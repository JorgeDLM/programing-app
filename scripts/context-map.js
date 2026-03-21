#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { runRepoMappingStep, REPO_MAPPING_STEPS } = require('./lib/context/repo-mapping-service');

function showHelp(exitCode = 0) {
  console.log([
    'Usage:',
    '  node scripts/context-map.js --step <step> [--repo <path>] [--cache-root <path>] [--write <output.json>] [--input <json>] [--input-file <input.json>] [--force-refresh] [--force-remap] [--create-ai-context-if-missing] [--enable-ai-enrichment] [--mode <seed|balanced|deep>]',
    '',
    `Steps: ${REPO_MAPPING_STEPS.join(', ')}`
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

function parseJsonFile(filePath, label) {
  if (!filePath) {
    return {};
  }

  const absolutePath = path.resolve(filePath);

  try {
    return parseJson(fs.readFileSync(absolutePath, 'utf8'), label);
  } catch (error) {
    throw new Error(`Invalid ${label}: ${error.message}`);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    step: null,
    repoRoot: null,
    cacheRoot: null,
    writePath: null,
    help: false,
    forceRefresh: false,
    forceRemap: false,
    persist: true,
    createAiContextIfMissing: false,
    enableAiEnrichment: false,
    mode: 'balanced',
    input: {}
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--step') {
      parsed.step = args[index + 1] || null;
      index += 1;
    } else if (arg === '--repo') {
      parsed.repoRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--cache-root') {
      parsed.cacheRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--write') {
      parsed.writePath = args[index + 1] || null;
      index += 1;
    } else if (arg === '--input') {
      parsed.input = parseJson(args[index + 1] || '{}', '--input');
      index += 1;
    } else if (arg === '--input-file') {
      parsed.input = parseJsonFile(args[index + 1] || '', '--input-file');
      index += 1;
    } else if (arg === '--force-refresh') {
      parsed.forceRefresh = true;
    } else if (arg === '--force-remap') {
      parsed.forceRemap = true;
    } else if (arg === '--create-ai-context-if-missing') {
      parsed.createAiContextIfMissing = true;
    } else if (arg === '--enable-ai-enrichment') {
      parsed.enableAiEnrichment = true;
    } else if (arg === '--mode') {
      parsed.mode = args[index + 1] || 'balanced';
      index += 1;
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

function main() {
  const options = parseArgs(process.argv);
  if (options.help || !options.step) {
    showHelp(options.help ? 0 : 1);
  }

  const payload = runRepoMappingStep(options.step, {
    ...options.input,
    repoRoot: options.repoRoot || options.input.repoRoot || process.cwd()
  }, {
    cacheRoot: options.cacheRoot,
    forceRefresh: options.forceRefresh,
    forceRemap: options.forceRemap,
    persist: options.persist,
    createAiContextIfMissing: options.createAiContextIfMissing,
    enableAiEnrichment: options.enableAiEnrichment,
    mode: options.mode
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
    console.error(`[context-map] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  main,
  parseArgs,
  parseJson,
  showHelp
};
