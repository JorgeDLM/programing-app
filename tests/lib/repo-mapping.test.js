'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');

const {
  REPO_MAPPING_STEPS,
  buildCache,
  finalizeMappingStatus,
  fingerprintRepo,
  resolveRepo,
  seedAiContextStep,
  validateMapping
} = require('../../scripts/lib/context/repo-mapping-service');

console.log('=== Testing repo-mapping.js ===\n');

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
  writeFile(repoRoot, 'app/api/users/route.ts', 'export async function GET() { return Response.json({ ok: true }); }\n');
  writeFile(repoRoot, 'src/components/home-card.tsx', 'export function HomeCard() { return null; }\n');
  writeFile(repoRoot, 'src/services/user-service.ts', 'export async function getUser() { return { ok: true }; }\n');
  writeFile(repoRoot, 'prisma/schema.prisma', 'generator client { provider = "prisma-client-js" }\ndatasource db { provider = "postgresql" url = env("DATABASE_URL") }\nmodel User { id String @id }\n');
}

function run() {
  test('repo mapping steps expose the expected contract', () => {
    assert.deepStrictEqual(REPO_MAPPING_STEPS, [
      'resolve_repo',
      'fingerprint_repo',
      'build_cache',
      'seed_ai_context',
      'validate_mapping',
      'finalize_status'
    ]);
  });

  test('deterministic repo mapping builds cache, seeds AI_CONTEXT and validates successfully', () => {
    const repoRoot = createTempDir('ecc-repo-map-repo-');
    const cacheRoot = createTempDir('ecc-repo-map-cache-');

    try {
      seedRepo(repoRoot);

      const resolved = resolveRepo(repoRoot, { cacheRoot });
      assert.strictEqual(resolved.repoRoot, repoRoot);
      assert.strictEqual(resolved.aiContextExists, false);

      const fingerprint = fingerprintRepo(repoRoot, { cacheRoot });
      assert.ok(fingerprint.fileCount >= 4);
      assert.ok(typeof fingerprint.aggregateHash === 'string' && fingerprint.aggregateHash.length > 0);

      const built = buildCache(repoRoot, { cacheRoot });
      assert.strictEqual(built.cacheFiles.every(entry => entry.exists === true), true);
      assert.ok(built.indexPayload.routes.routes.some(route => route.path === 'app/api/users/route.ts'));

      const seeded = seedAiContextStep(repoRoot, { indexPayload: built.indexPayload }, {
        cacheRoot,
        createAiContextIfMissing: true
      });
      assert.strictEqual(seeded.skipped, false);
      assert.ok(seeded.created.includes('AI_CONTEXT/00-START-HERE.md'));
      assert.ok(fs.existsSync(path.join(repoRoot, 'AI_CONTEXT', '06-API-CONTRACTS.md')));

      const validated = validateMapping(repoRoot, { indexPayload: built.indexPayload }, {
        cacheRoot,
        createAiContextIfMissing: true
      });
      assert.strictEqual(validated.valid, true);
      assert.strictEqual(validated.issues.length, 0);
      assert.ok(!validated.warnings.includes('optional-ai-enrichment-unavailable-using-evidence-enrichment'));
      assert.ok(['ready', 'partial', 'needs_enrichment'].includes(validated.readiness));

      const finalized = finalizeMappingStatus(repoRoot, { validation: validated }, { cacheRoot });
      assert.ok(['mapped', 'mapped_with_warnings'].includes(finalized.status));
      assert.ok(!finalized.warnings.includes('optional-ai-enrichment-unavailable-using-evidence-enrichment'));
      if (finalized.status === 'mapped_with_warnings') {
        assert.ok(finalized.warnings.every(warning => warning.startsWith('critic:') || warning.startsWith('doc-') || warning.startsWith('ai-context-doc-missing-seed-metadata:')));
      }
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  test('optional AI flag does not create fake warnings when evidence enrichment is available', () => {
    const repoRoot = createTempDir('ecc-repo-map-optional-ai-repo-');
    const cacheRoot = createTempDir('ecc-repo-map-optional-ai-cache-');

    try {
      seedRepo(repoRoot);
      const built = buildCache(repoRoot, { cacheRoot, forceRefresh: true, mode: 'balanced' });
      seedAiContextStep(repoRoot, { indexPayload: built.indexPayload }, {
        cacheRoot,
        createAiContextIfMissing: true,
        enableAiEnrichment: true,
        forceRemap: true
      });
      const validated = validateMapping(repoRoot, { indexPayload: built.indexPayload }, {
        cacheRoot,
        createAiContextIfMissing: true,
        enableAiEnrichment: true
      });
      assert.ok(!validated.warnings.includes('optional-ai-enrichment-unavailable-using-evidence-enrichment'));
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  test('context-map CLI runs build_cache and seed_ai_context step outputs as JSON', () => {
    const repoRoot = createTempDir('ecc-repo-map-cli-repo-');
    const cacheRoot = createTempDir('ecc-repo-map-cli-cache-');

    try {
      seedRepo(repoRoot);

      const buildResult = spawnSync('node', [
        path.join(REPO_ROOT, 'scripts', 'context-map.js'),
        '--step', 'build_cache',
        '--repo', repoRoot,
        '--cache-root', cacheRoot
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      assert.strictEqual(buildResult.status, 0);
      const buildPayload = JSON.parse(buildResult.stdout);
      assert.strictEqual(buildPayload.step, 'build_cache');
      assert.strictEqual(Array.isArray(buildPayload.cacheFiles), true);

      const seedResult = spawnSync('node', [
        path.join(REPO_ROOT, 'scripts', 'context-map.js'),
        '--step', 'seed_ai_context',
        '--repo', repoRoot,
        '--cache-root', cacheRoot,
        '--create-ai-context-if-missing'
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      assert.strictEqual(seedResult.status, 0);
      const seedPayload = JSON.parse(seedResult.stdout);
      assert.strictEqual(seedPayload.step, 'seed_ai_context');
      assert.ok(seedPayload.created.includes('AI_CONTEXT/00-START-HERE.md'));
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  test('context-map CLI accepts --input-file for seed_ai_context', () => {
    const repoRoot = createTempDir('ecc-repo-map-input-file-repo-');
    const cacheRoot = createTempDir('ecc-repo-map-input-file-cache-');
    const inputFilePath = path.join(cacheRoot, 'seed-input.json');

    try {
      seedRepo(repoRoot);

      const buildResult = spawnSync('node', [
        path.join(REPO_ROOT, 'scripts', 'context-map.js'),
        '--step', 'build_cache',
        '--repo', repoRoot,
        '--cache-root', cacheRoot
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      assert.strictEqual(buildResult.status, 0);
      const buildPayload = JSON.parse(buildResult.stdout);
      fs.writeFileSync(inputFilePath, JSON.stringify({ indexPayload: buildPayload.indexPayload }), 'utf8');

      const seedResult = spawnSync('node', [
        path.join(REPO_ROOT, 'scripts', 'context-map.js'),
        '--step', 'seed_ai_context',
        '--repo', repoRoot,
        '--cache-root', cacheRoot,
        '--create-ai-context-if-missing',
        '--input-file', inputFilePath
      ], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
      });
      assert.strictEqual(seedResult.status, 0);
      const seedPayload = JSON.parse(seedResult.stdout);
      assert.strictEqual(seedPayload.step, 'seed_ai_context');
      assert.ok(seedPayload.created.includes('AI_CONTEXT/00-START-HERE.md'));
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
