'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');

const { prepareContext } = require('../../scripts/lib/context/context-preparer');
const { indexRepository } = require('../../scripts/lib/context/repo-index-service');
const {
  getDefaultDocTargetsForImpact,
  getStandardAiContextFiles,
  isAiContextFile,
  mapDomainToPrimaryDocs
} = require('../../scripts/lib/context/ai-context-files');
const { classifyContextImpact } = require('../../scripts/lib/context/context-impact-classifier');
const { parseFreshnessMetadata, readManagedSection } = require('../../scripts/lib/context/context-freshness');
const { updateContext } = require('../../scripts/lib/context/context-updater');
const { validateContext } = require('../../scripts/lib/context/context-validator');
const contextUpdateCli = require('../../scripts/context-update');
const contextValidateCli = require('../../scripts/context-validate');

console.log('=== Testing context-maintenance.js ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}: ${error.message}`);
    failed += 1;
  }
}

function testAsync(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed += 1;
    })
    .catch(error => {
      console.log(`  ✗ ${name}: ${error.message}`);
      failed += 1;
    });
}

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    return;
  }
}

function writeFile(dirPath, relativePath, content = '') {
  const fullPath = path.join(dirPath, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

function seedRepo(repoRoot) {
  writeFile(repoRoot, 'package.json', JSON.stringify({
    dependencies: {
      next: '16.0.0',
      react: '19.0.0',
      '@prisma/client': '6.0.0'
    }
  }, null, 2));
  writeFile(repoRoot, 'tsconfig.json', '{}');
  writeFile(repoRoot, 'next.config.mjs', 'export default {}\n');
  writeFile(repoRoot, 'app/api/billing/route.ts', 'export async function POST() { return Response.json({ ok: true }); }\n');
  writeFile(repoRoot, 'src/services/billing-service.ts', 'export async function createInvoice() { return { ok: true }; }\n');
  writeFile(repoRoot, 'prisma/schema.prisma', 'generator client { provider = "prisma-client-js" }\ndatasource db { provider = "postgresql" url = env("DATABASE_URL") }\nmodel Invoice { id String @id }\n');
  writeFile(repoRoot, 'AI_CONTEXT/00-START-HERE.md', '# Start\n');
  writeFile(repoRoot, 'AI_CONTEXT/01-PROJECT-OVERVIEW.md', '# Overview\n');
  writeFile(repoRoot, 'AI_CONTEXT/02-ARCHITECTURE.md', '# Architecture\n');
  writeFile(repoRoot, 'AI_CONTEXT/03-BACKEND.md', '# Backend\n');
  writeFile(repoRoot, 'AI_CONTEXT/05-DATA-MODELS.md', '# Data Models\n');
  writeFile(repoRoot, 'AI_CONTEXT/06-API-CONTRACTS.md', '# API Contracts\n');
  writeFile(repoRoot, 'AI_CONTEXT/07-DECISIONS-ADR.md', '# Decisions\n');
  writeFile(repoRoot, 'AI_CONTEXT/08-RECENT-CHANGES.md', '# Recent Changes\n');
}

async function run() {
  console.log('AI_CONTEXT mapping:');

  test('ai-context-files exposes standard docs and domain mapping', () => {
    const standardDocs = getStandardAiContextFiles();
    assert.ok(standardDocs.includes('AI_CONTEXT/03-BACKEND.md'));
    assert.ok(standardDocs.includes('AI_CONTEXT/08-RECENT-CHANGES.md'));
    assert.deepStrictEqual(mapDomainToPrimaryDocs('api'), ['AI_CONTEXT/06-API-CONTRACTS.md']);
    assert.strictEqual(isAiContextFile('AI_CONTEXT/05-DATA-MODELS.md'), true);
    assert.strictEqual(isAiContextFile('README.md'), false);
    assert.ok(getDefaultDocTargetsForImpact({
      hasMeaningfulImpact: true,
      impactLevel: 'medium',
      domains: ['backend', 'api'],
      needsAdrUpdate: false,
      needsRecentChangesUpdate: true,
      evidence: { signals: ['api_route_changed'] }
    }).includes('AI_CONTEXT/08-RECENT-CHANGES.md'));
  });

  console.log('\nSelective maintenance:');

  await testAsync('classifier, updater, validator and CLIs stay aligned with the real diff', async () => {
    const repoRoot = createTempDir('ecc-context-maintenance-repo-');
    const cacheRoot = createTempDir('ecc-context-maintenance-cache-');
    const preparedContextPath = path.join(repoRoot, 'prepared-context.json');

    try {
      seedRepo(repoRoot);
      const indexPayload = indexRepository(repoRoot, { cacheRoot });
      const prepared = await prepareContext({
        task: 'Implement billing API and persist invoice model changes',
        repoRoot
      }, {
        cacheRoot
      });
      fs.writeFileSync(preparedContextPath, JSON.stringify(prepared, null, 2), 'utf8');

      const changedFiles = ['app/api/billing/route.ts', 'prisma/schema.prisma'];
      const impact = classifyContextImpact({
        changedFiles,
        preparedContext: prepared,
        indexPayload,
        diffSummary: 'Add billing API route and invoice model'
      });

      assert.strictEqual(impact.hasMeaningfulImpact, true);
      assert.strictEqual(impact.shouldSkipUpdate, false);
      assert.ok(impact.domains.includes('api'));
      assert.ok(impact.domains.includes('data'));
      assert.ok(impact.docTargets.includes('AI_CONTEXT/06-API-CONTRACTS.md'));
      assert.ok(impact.docTargets.includes('AI_CONTEXT/05-DATA-MODELS.md'));
      assert.ok(impact.docTargets.includes('AI_CONTEXT/08-RECENT-CHANGES.md'));
      assert.strictEqual(impact.docTargets.includes('AI_CONTEXT/02-ARCHITECTURE.md'), false);

      const updateResult = updateContext({
        repoRoot,
        preparedContext: prepared,
        changedFiles,
        diffSummary: 'Add billing API route and invoice model'
      }, {
        cacheRoot
      });

      assert.strictEqual(updateResult.updated, true);
      assert.strictEqual(updateResult.skipped, false);
      assert.ok(updateResult.docTargets.includes('AI_CONTEXT/06-API-CONTRACTS.md'));
      assert.ok(updateResult.docUpdates.some(update => update.docPath === 'AI_CONTEXT/06-API-CONTRACTS.md'));

      const apiDocContent = fs.readFileSync(path.join(repoRoot, 'AI_CONTEXT', '06-API-CONTRACTS.md'), 'utf8');
      const freshness = parseFreshnessMetadata(apiDocContent);
      assert.ok(freshness);
      assert.strictEqual(freshness.taskContextId, prepared.taskContextId);
      assert.strictEqual(freshness.workingSetId, prepared.workingSet.workingSetId);
      assert.strictEqual(freshness.basedOnCommit, prepared.basedOnCommit);
      assert.ok(Array.isArray(freshness.sourcePaths) && freshness.sourcePaths.includes('app/api/billing/route.ts'));
      assert.ok(readManagedSection(apiDocContent, '## Selective Sync'));

      const validation = validateContext({
        repoRoot,
        preparedContext: prepared,
        changedFiles,
        diffSummary: 'Add billing API route and invoice model'
      }, {
        cacheRoot,
        persist: false
      });

      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.skipped, false);
      assert.strictEqual(validation.issues.length, 0);

      const cliUpdate = spawnSync('node', [
        path.join(REPO_ROOT, 'scripts', 'context-update.js'),
        '--repo', repoRoot,
        '--prepared-context', preparedContextPath,
        '--changed-files', '["app/api/billing/route.ts","prisma/schema.prisma"]',
        '--no-persist'
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      assert.strictEqual(cliUpdate.status, 0);
      const cliUpdatePayload = JSON.parse(cliUpdate.stdout);
      assert.strictEqual(cliUpdatePayload.updated, true);

      const cliValidate = spawnSync('node', [
        path.join(REPO_ROOT, 'scripts', 'context-validate.js'),
        '--repo', repoRoot,
        '--prepared-context', preparedContextPath,
        '--changed-files', '["app/api/billing/route.ts","prisma/schema.prisma"]',
        '--no-persist'
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      assert.strictEqual(cliValidate.status, 0);
      const cliValidatePayload = JSON.parse(cliValidate.stdout);
      assert.strictEqual(cliValidatePayload.valid, true);

      const parsedUpdateArgs = contextUpdateCli.parseArgs([
        'node',
        'scripts/context-update.js',
        '--repo', repoRoot,
        '--changed-files', '["app/api/billing/route.ts","prisma/schema.prisma"]',
        '--doc-targets', 'AI_CONTEXT/06-API-CONTRACTS.md,AI_CONTEXT/05-DATA-MODELS.md'
      ]);
      assert.strictEqual(parsedUpdateArgs.repoRoot, repoRoot);
      assert.strictEqual(parsedUpdateArgs.changedFiles.length, 2);
      assert.strictEqual(parsedUpdateArgs.docTargets.length, 2);

      const parsedValidateArgs = contextValidateCli.parseArgs([
        'node',
        'scripts/context-validate.js',
        '--repo', repoRoot,
        '--changed-files', 'app/api/billing/route.ts,prisma/schema.prisma'
      ]);
      assert.strictEqual(parsedValidateArgs.repoRoot, repoRoot);
      assert.strictEqual(parsedValidateArgs.changedFiles.length, 2);
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
