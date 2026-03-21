#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { validateContext } = require('./lib/context/context-validator');
const { getGitModifiedFiles } = require('./lib/utils');

function showHelp(exitCode = 0) {
  console.log([
    'Usage:',
    '  node scripts/context-validate.js [--repo <path>] [--prepared-context <file.json>] [--changed-files <json-or-csv>] [--changed-files-file <file.txt|json>] [--doc-targets <json-or-csv>] [--diff-summary <text>] [--patch-file <file.diff>] [--cache-root <path>] [--write <output.json>] [--force-refresh] [--no-persist]',
    '',
    'Validate that the current AI_CONTEXT selective updates match the diff and repo state.'
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

function parseList(value, label) {
  if (!value) {
    return [];
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    const parsed = parseJson(trimmed, label);
    if (!Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON array when using JSON syntax`);
    }
    return parsed.map(item => String(item));
  }

  return trimmed.split(',').map(item => item.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    repoRoot: null,
    preparedContextPath: null,
    changedFiles: [],
    changedFilesFile: null,
    docTargets: [],
    diffSummary: '',
    patchFile: null,
    cacheRoot: null,
    writePath: null,
    forceRefresh: false,
    persist: true,
    help: false,
    basedOnCommit: null,
    taskContextId: null,
    workingSetId: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--repo') {
      parsed.repoRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--prepared-context') {
      parsed.preparedContextPath = args[index + 1] || null;
      index += 1;
    } else if (arg === '--changed-files') {
      parsed.changedFiles = parseList(args[index + 1] || '', '--changed-files');
      index += 1;
    } else if (arg === '--changed-files-file') {
      parsed.changedFilesFile = args[index + 1] || null;
      index += 1;
    } else if (arg === '--doc-targets') {
      parsed.docTargets = parseList(args[index + 1] || '', '--doc-targets');
      index += 1;
    } else if (arg === '--diff-summary') {
      parsed.diffSummary = args[index + 1] || '';
      index += 1;
    } else if (arg === '--patch-file') {
      parsed.patchFile = args[index + 1] || null;
      index += 1;
    } else if (arg === '--cache-root') {
      parsed.cacheRoot = args[index + 1] || null;
      index += 1;
    } else if (arg === '--write') {
      parsed.writePath = args[index + 1] || null;
      index += 1;
    } else if (arg === '--based-on-commit') {
      parsed.basedOnCommit = args[index + 1] || null;
      index += 1;
    } else if (arg === '--task-context-id') {
      parsed.taskContextId = args[index + 1] || null;
      index += 1;
    } else if (arg === '--working-set-id') {
      parsed.workingSetId = args[index + 1] || null;
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
    return null;
  }

  return parseJson(fs.readFileSync(path.resolve(preparedContextPath), 'utf8'), '--prepared-context');
}

function loadChangedFiles(options) {
  if (options.changedFiles.length > 0) {
    return options.changedFiles;
  }

  if (options.changedFilesFile) {
    const raw = fs.readFileSync(path.resolve(options.changedFilesFile), 'utf8').trim();
    if (!raw) {
      return [];
    }

    if (raw.startsWith('[')) {
      return parseList(raw, '--changed-files-file');
    }

    return raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  return getGitModifiedFiles();
}

function loadPatchExcerpt(patchFile) {
  if (!patchFile) {
    return '';
  }

  return fs.readFileSync(path.resolve(patchFile), 'utf8');
}

function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    showHelp(0);
  }

  const repoRoot = options.repoRoot || process.cwd();
  const preparedContext = loadPreparedContext(options.preparedContextPath);
  const payload = validateContext({
    repoRoot,
    preparedContext,
    changedFiles: loadChangedFiles(options),
    docTargets: options.docTargets,
    diffSummary: options.diffSummary,
    patchExcerpt: loadPatchExcerpt(options.patchFile),
    basedOnCommit: options.basedOnCommit,
    taskContextId: options.taskContextId,
    workingSetId: options.workingSetId
  }, {
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
    console.error(`[context-validate] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  loadChangedFiles,
  loadPreparedContext,
  main,
  parseArgs,
  showHelp
};
