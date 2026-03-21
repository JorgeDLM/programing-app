'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');

const { preparePlanConfigForExecution } = require('../../scripts/lib/context/context-orchestration');
const { recordContextObservation, summarizeContextObservability } = require('../../scripts/lib/context/context-observability');
const { buildOrchestrationPlan, materializePlan } = require('../../scripts/lib/tmux-worktree-orchestrator');
const { parseWorkerTask } = require('../../scripts/lib/orchestration-session');
const { loadPlanConfig } = require('../../scripts/orchestrate-worktrees');

console.log('=== Testing context iteration 4 adoption ===\n');

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
  writeFile(repoRoot, 'src/lib/adjacent.ts', 'export function adjacentDetail() { return "adjacent"; }\n');
  writeFile(repoRoot, 'prisma/schema.prisma', 'generator client { provider = "prisma-client-js" }\ndatasource db { provider = "postgresql" url = env("DATABASE_URL") }\nmodel Invoice { id String @id }\n');
  writeFile(repoRoot, 'AI_CONTEXT/00-START-HERE.md', '# Start\n');
  writeFile(repoRoot, 'AI_CONTEXT/02-ARCHITECTURE.md', '# Architecture\n');
  writeFile(repoRoot, 'AI_CONTEXT/03-BACKEND.md', '# Backend\n');
  writeFile(repoRoot, 'AI_CONTEXT/05-DATA-MODELS.md', '# Data Models\n');
  writeFile(repoRoot, 'AI_CONTEXT/06-API-CONTRACTS.md', '# API Contracts\n');
  writeFile(repoRoot, 'AI_CONTEXT/08-RECENT-CHANGES.md', '# Recent Changes\n');
}

async function run() {
  console.log('Adoption path:');

  await testAsync('new tasks enter through prepared context and working set becomes the initial execution surface', async () => {
    const repoRoot = createTempDir('ecc-iter4-repo-');
    const cacheRoot = createTempDir('ecc-iter4-cache-');
    const coordinationRoot = path.join(repoRoot, '.coordination');
    const planFile = path.join(repoRoot, 'workflow.json');

    try {
      seedRepo(repoRoot);
      fs.writeFileSync(planFile, JSON.stringify({
        sessionName: 'billing-fix',
        repoRoot,
        cacheRoot,
        coordinationRoot,
        contextTask: 'Implement billing API and invoice persistence flow',
        launcherCommand: 'echo run',
        workers: [
          {
            name: 'Backend',
            task: 'Implement the bounded backend changes first',
            seedPaths: ['commands/multi-execute.md']
          }
        ]
      }, null, 2));

      const preparedExecution = await preparePlanConfigForExecution({
        repoRoot,
        cacheRoot,
        contextTask: 'Implement billing API and invoice persistence flow',
        launcherCommand: 'echo run',
        workers: [{ name: 'Backend', task: 'Implement the bounded backend changes first' }]
      }, {
        cacheRoot,
        commandName: 'iteration4-test',
        prepareMode: 'task-focused',
        analysisMode: 'deep'
      });

      assert.strictEqual(preparedExecution.contextRuntime.contextMode, 'prepared-context');
      assert.ok(preparedExecution.preparedContext);
      assert.ok(preparedExecution.preparedContext.workingSet.files.includes('app/api/billing/route.ts'));
      assert.ok(preparedExecution.preparedContext.recommendedDocs.includes('AI_CONTEXT/06-API-CONTRACTS.md'));
      assert.strictEqual(preparedExecution.contextRuntime.preparedContext.prepareMode, 'task-focused');
      assert.strictEqual(preparedExecution.contextRuntime.preparedContext.analysisMode, 'deep');
      assert.ok(preparedExecution.contextRuntime.preparedContext.structuredMapsReadiness);
      assert.ok(preparedExecution.contextRuntime.preparedContext.extendedReadiness);
      assert.ok(preparedExecution.contextRuntime.preparedContext.taskAuditPack);
      assert.ok(preparedExecution.contextRuntime.preparedContext.taskAuditPack.affectedApis.includes('/billing'));

      const loaded = await loadPlanConfig(planFile);
      const plan = buildOrchestrationPlan(loaded.config);
      assert.strictEqual(plan.contextRuntime.contextMode, 'prepared-context');
      assert.ok(plan.workerPlans[0].seedPaths.includes('app/api/billing/route.ts'));
      assert.ok(plan.workerPlans[0].seedPaths.includes('AI_CONTEXT/06-API-CONTRACTS.md'));
      assert.strictEqual(plan.workerPlans[0].workingSetId, loaded.preparedContext.workingSet.workingSetId);

      materializePlan(plan);
      const taskContent = fs.readFileSync(plan.workerPlans[0].taskFilePath, 'utf8');
      const parsedTask = parseWorkerTask(taskContent);
      assert.strictEqual(parsedTask.contextMode, 'prepared-context');
      assert.strictEqual(parsedTask.workingSetId, loaded.preparedContext.workingSet.workingSetId);
      assert.ok(parsedTask.recommendedDocs.includes('AI_CONTEXT/06-API-CONTRACTS.md'));
      assert.strictEqual(parsedTask.expansionProtocol.broadSearchByDefault, false);
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  console.log('\nExpansion and compatibility:');

  await testAsync('controlled expansion and observability work while the legacy flow remains available', async () => {
    const repoRoot = createTempDir('ecc-iter4-obs-repo-');
    const cacheRoot = createTempDir('ecc-iter4-obs-cache-');
    const preparedContextPath = path.join(repoRoot, 'prepared-context.json');

    try {
      seedRepo(repoRoot);

      const prepareResult = spawnSync('node', [
        path.join(REPO_ROOT, 'scripts', 'context-prepare.js'),
        '--repo', repoRoot,
        '--cache-root', cacheRoot,
        '--task', 'Implement billing API and invoice persistence flow',
        '--write', preparedContextPath
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      assert.strictEqual(prepareResult.status, 0, prepareResult.stderr);
      const preparedPayload = JSON.parse(prepareResult.stdout);
      assert.ok(preparedPayload.workingSet.files.includes('app/api/billing/route.ts'));

      const expansionResult = spawnSync('node', [
        path.join(REPO_ROOT, 'scripts', 'context-expand.js'),
        '--repo', repoRoot,
        '--cache-root', cacheRoot,
        '--prepared-context', preparedContextPath,
        '--request', '{"mode":"narrow","paths":["src/lib/adjacent.ts"],"reason":"Need one adjacent dependency"}'
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      assert.strictEqual(expansionResult.status, 0, expansionResult.stderr);
      const expansionPayload = JSON.parse(expansionResult.stdout);
      assert.strictEqual(expansionPayload.approved, true);
      assert.ok(expansionPayload.preparedContext.workingSet.files.includes('src/lib/adjacent.ts'));

      const legacyPlan = buildOrchestrationPlan({
        repoRoot,
        sessionName: 'legacy-seeded',
        launcherCommand: 'echo run',
        seedPaths: ['commands/multi-plan.md'],
        workers: [
          {
            name: 'Docs',
            task: 'Keep the legacy seeded flow available',
            seedPaths: ['commands/multi-execute.md']
          }
        ]
      });
      assert.strictEqual(legacyPlan.preparedContext, null);
      assert.ok(legacyPlan.workerPlans[0].seedPaths.includes('commands/multi-plan.md'));
      assert.ok(legacyPlan.workerPlans[0].seedPaths.includes('commands/multi-execute.md'));

      recordContextObservation({
        repoRoot,
        commandName: 'legacy-test',
        phase: 'compatibility',
        contextMode: 'legacy',
        backwardCompatibilityFallback: true,
        broadSearchTriggered: true,
        repeatedRediscovery: true,
        fallbackReason: 'legacy-config-without-context'
      }, {
        cacheRoot
      });

      const summary = summarizeContextObservability(repoRoot, { cacheRoot });
      assert.ok(summary.totals.tasksEnteredWithPreparedContext >= 1);
      assert.ok(summary.totals.expansionsApproved >= 1);
      assert.ok(summary.totals.backwardCompatibilityFallbacks >= 1);
      assert.ok(summary.totals.broadSearches >= 1);
      assert.ok(summary.totals.retrievalAvoidedEstimate > 0);

      const reportResult = spawnSync('node', [
        path.join(REPO_ROOT, 'scripts', 'context-observability-report.js'),
        '--repo', repoRoot,
        '--cache-root', cacheRoot
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      assert.strictEqual(reportResult.status, 0, reportResult.stderr);
      const reportPayload = JSON.parse(reportResult.stdout);
      assert.ok(reportPayload.totals.expansionRequests >= 1);
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  console.log('\nCommand contract:');

  test('multi commands describe prepared context as the preferred path', () => {
    const multiPlan = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'multi-plan.md'), 'utf8');
    const multiExecute = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'multi-execute.md'), 'utf8');
    const multiWorkflow = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'multi-workflow.md'), 'utf8');

    assert.ok(multiPlan.includes('PreparedContextPackage'));
    assert.ok(multiPlan.includes('context-expand.js'));
    assert.ok(multiExecute.includes('Working Set Transport First'));
    assert.ok(multiExecute.includes('compatibility-only'));
    assert.ok(multiWorkflow.includes('contextTask'));
    assert.ok(multiWorkflow.includes('Broad search is never the default operational path'));
  });

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
