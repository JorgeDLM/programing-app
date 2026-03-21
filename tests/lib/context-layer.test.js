'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { normalizeIntent } = require('../../scripts/lib/context/intent-normalizer');
const { indexRepository } = require('../../scripts/lib/context/repo-index-service');
const { prepareContext } = require('../../scripts/lib/context/context-preparer');
const { expandPreparedContext } = require('../../scripts/lib/context/context-expansion-service');
const { getBudgetForIntent } = require('../../scripts/lib/context/working-set-budget');
const { createWorkingSet } = require('../../scripts/lib/context/working-set-manager');
const { toSeedPaths } = require('../../scripts/lib/context/working-set-transport');
const { createProjectCacheStore } = require('../../scripts/lib/context/project-cache-store');
const { getRepoSlug } = require('../../scripts/lib/context/cache-paths');

console.log('=== Testing context-layer.js ===\n');

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

function seedNextRepo(repoRoot) {
  writeFile(repoRoot, 'package.json', JSON.stringify({
    dependencies: {
      next: '16.0.0',
      react: '19.0.0',
      '@prisma/client': '6.0.0',
      '@anthropic-ai/sdk': '0.79.0',
      jspdf: '3.0.0'
    }
  }, null, 2));
  writeFile(repoRoot, 'tsconfig.json', '{}');
  writeFile(repoRoot, 'next.config.mjs', 'export default {}\n');
  writeFile(repoRoot, 'app/api/users/route.ts', 'import { getUser, createUser } from "@/src/services/user-service";\nexport async function GET(request) {\n  const auth = request.headers.get("authorization");\n  const user = await getUser(auth);\n  return Response.json({ ok: true, user });\n}\nexport async function POST(request) {\n  const auth = request.headers.get("authorization");\n  const body = await request.json();\n  const user = await createUser({ ...body, auth });\n  return Response.json({ ok: true, user });\n}\n');
  writeFile(repoRoot, 'src/services/user-service.ts', 'import { prisma } from "@/src/lib/db";\nexport async function getUser(auth) {\n  return prisma.user.findFirst({ where: { auth } });\n}\nexport async function createUser(input) {\n  return prisma.user.create({ data: input });\n}\n');
  writeFile(repoRoot, 'src/lib/db.ts', 'export const prisma = {\n  user: {\n    findFirst: async ({ where }) => ({ id: "user_1", auth: where.auth }),\n    create: async ({ data }) => ({ id: "user_2", ...data })\n  }\n};\n');
  writeFile(repoRoot, 'src/components/user-card.tsx', 'export function UserCard() { return null; }\n');
  writeFile(repoRoot, 'src/app/users/page.tsx', 'export default async function UsersPage() {\n  const response = await fetch("/api/users");\n  const payload = await response.json();\n  return <div>{payload.user?.id}</div>;\n}\n');
  writeFile(repoRoot, 'src/app/admin/users/page.tsx', 'export default async function AdminUsersPage() {\n  const response = await fetch("/api/users");\n  const payload = await response.json();\n  return <section data-admin="true">{payload.user?.id}</section>;\n}\n');
  writeFile(repoRoot, 'src/lib/ai-client.ts', 'import Anthropic from "@anthropic-ai/sdk";\nexport function createAiClient() { return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "test" }); }\n');
  writeFile(repoRoot, 'src/lib/pdf-report.ts', 'import jsPDF from "jspdf";\nexport function buildUserPdf() { return new jsPDF(); }\n');
  writeFile(repoRoot, 'prisma/schema.prisma', 'generator client { provider = "prisma-client-js" }\ndatasource db { provider = "postgresql" url = env("DATABASE_URL") }\nmodel User {\n  id String @id\n  auth String?\n}\n');
  writeFile(repoRoot, 'AI_CONTEXT/00-START-HERE.md', '# Start\n');
  writeFile(repoRoot, 'AI_CONTEXT/03-BACKEND.md', '# Backend\n');
  writeFile(repoRoot, 'AI_CONTEXT/05-DATA-MODELS.md', '# Data\n');
  writeFile(repoRoot, 'AI_CONTEXT/06-API-CONTRACTS.md', '# API\n');
}

async function run() {
  console.log('Intent normalization:');

  test('getBudgetForIntent maps audit scope to the expected Iteration 2 profiles', () => {
    const quick = getBudgetForIntent('audit', { likelyScope: 'narrow', initialBudgetClass: 'small' });
    const focused = getBudgetForIntent('audit', { likelyScope: 'broad', initialBudgetClass: 'large' });

    assert.strictEqual(quick.profileName, 'audit_quick');
    assert.strictEqual(quick.initialFilesMax, 8);
    assert.strictEqual(focused.profileName, 'audit_focused');
    assert.strictEqual(focused.totalFilesMax, 20);
  });

  test('normalizeIntent classifies feature work with bounded backend/api scope', () => {
    const normalized = normalizeIntent('Implement a new API endpoint for user billing in the backend service');
    assert.strictEqual(normalized.intentType, 'feature');
    assert.strictEqual(normalized.requiresWrite, true);
    assert.ok(normalized.expectedDomains.includes('backend'));
    assert.ok(normalized.expectedDomains.includes('api'));
    assert.strictEqual(normalized.ambiguity, 'low');
    assert.ok(['medium', 'large'].includes(normalized.initialBudgetClass));
  });

  test('normalizeIntent classifies audits as read-oriented and broad', () => {
    const normalized = normalizeIntent('Audit the repo architecture, AI_CONTEXT docs, and retrieval flow across the codebase');
    assert.strictEqual(normalized.intentType, 'audit');
    assert.strictEqual(normalized.requiresWrite, false);
    assert.ok(normalized.expectedDomains.includes('docs'));
    assert.strictEqual(normalized.likelyScope, 'broad');
  });

  test('normalizeIntent uses caller metadata to reduce ambiguity', () => {
    const normalized = normalizeIntent('Look into this issue', {
      callerMetadata: {
        selectedFiles: ['src/services/user-service.ts'],
        requiresWrite: true,
        intentType: 'bugfix'
      }
    });
    assert.strictEqual(normalized.intentType, 'bugfix');
    assert.strictEqual(normalized.requiresWrite, true);
    assert.ok(['low', 'medium'].includes(normalized.ambiguity));
  });

  console.log('\nRepo indexing:');

  await testAsync('indexRepository builds deterministic cache artifacts for a repo', async () => {
    const repoRoot = createTempDir('ecc-context-repo-');
    const cacheRoot = createTempDir('ecc-context-cache-');

    try {
      seedNextRepo(repoRoot);
      const indexed = indexRepository(repoRoot, { cacheRoot });
      const repoSlug = getRepoSlug(repoRoot);
      const cacheDir = path.join(cacheRoot, repoSlug);

      assert.strictEqual(indexed.projectProfile.primary, 'nextjs');
      assert.ok(indexed.routes.routes.some(route => route.path === 'app/api/users/route.ts'));
      assert.ok(indexed.dbMap.prismaFiles.includes('prisma/schema.prisma'));
      assert.ok(indexed.symbols.files.some(file => file.path === 'src/services/user-service.ts' && file.exports.includes('getUser')));
      assert.ok(fs.existsSync(path.join(cacheDir, 'repo-meta.json')));
      assert.ok(fs.existsSync(path.join(cacheDir, 'fingerprints.json')));
      assert.ok(fs.existsSync(path.join(cacheDir, 'project-profile.json')));
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  await testAsync('indexRepository builds structured maps with cross-map links and readiness', async () => {
    const repoRoot = createTempDir('ecc-structured-maps-repo-');
    const cacheRoot = createTempDir('ecc-structured-maps-cache-');

    try {
      seedNextRepo(repoRoot);
      const indexed = indexRepository(repoRoot, { cacheRoot, forceRefresh: true, mode: 'deep' });
      const structuredMaps = indexed.structuredMaps;

      assert.ok(structuredMaps);
      assert.strictEqual(structuredMaps.schemaVersion, 'ecc.structured-maps.v1');
      assert.ok(structuredMaps.routeToModelMap);
      assert.ok(structuredMaps.entityUsageMap);
      assert.ok(structuredMaps.hotspots);
      assert.ok(structuredMaps.screenToApiMap);
      assert.ok(structuredMaps.riskZones);
      assert.ok(structuredMaps.readiness);

      const routeLink = structuredMaps.routeToModelMap.entries.find(entry => entry.endpoint === '/users');
      assert.ok(routeLink);
      assert.ok(routeLink.entities.includes('User'));
      assert.ok(['ready', 'partial'].includes(routeLink.state));

      const userUsage = structuredMaps.entityUsageMap.entities.find(entry => entry.entity === 'User');
      assert.ok(userUsage);
      assert.ok(userUsage.endpoints.includes('/users'));
      assert.ok(userUsage.screens.includes('src/app/users/page.tsx'));
      assert.ok(userUsage.keyFiles.includes('prisma/schema.prisma'));

      const screenLink = structuredMaps.screenToApiMap.entries.find(entry => entry.screen === 'src/app/users/page.tsx');
      assert.ok(screenLink);
      assert.ok(screenLink.endpoints.includes('/users'));

      assert.ok(structuredMaps.hotspots.entries.some(entry => entry.target === 'app/api/users/route.ts'));
      assert.ok(structuredMaps.riskZones.zones.some(zone => zone.kind === 'auth'));
      assert.ok(structuredMaps.riskZones.zones.some(zone => zone.kind === 'pdf'));
      assert.ok(structuredMaps.riskZones.zones.some(zone => zone.kind === 'ai-integration'));
      assert.ok(['ready', 'partial', 'needs_review'].includes(structuredMaps.readiness.decision));
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  console.log('\nContext preparation:');

  await testAsync('prepareContext emits recommended docs, working set, and budgeted expansion', async () => {
    const repoRoot = createTempDir('ecc-context-prepare-repo-');
    const cacheRoot = createTempDir('ecc-context-prepare-cache-');

    try {
      seedNextRepo(repoRoot);
      const indexPayload = indexRepository(repoRoot, { cacheRoot });
      const prepared = await prepareContext({
        task: 'Implement a new API endpoint for user billing and persist the data model changes',
        repoRoot
      }, {
        cacheRoot
      });
      const cacheDir = path.join(cacheRoot, getRepoSlug(repoRoot));
      const taskContextDir = path.join(cacheDir, 'task-context');

      assert.ok(prepared.recommendedDocs.includes('AI_CONTEXT/00-START-HERE.md'));
      assert.ok(prepared.recommendedDocs.includes('AI_CONTEXT/03-BACKEND.md'));
      assert.ok(prepared.recommendedDocs.includes('AI_CONTEXT/06-API-CONTRACTS.md'));
      assert.ok(prepared.workingSet.files.includes('app/api/users/route.ts'));
      assert.ok(prepared.workingSet.files.includes('prisma/schema.prisma'));
      assert.ok(typeof prepared.taskContextId === 'string' && prepared.taskContextId.length > 0);
      assert.strictEqual(prepared.workingSet.taskContextId, prepared.taskContextId);
      assert.strictEqual(prepared.workingSet.provenance.taskContextId, prepared.taskContextId);
      assert.strictEqual(prepared.allowedExpansionSource, 'workingSet.budget');
      assert.strictEqual(prepared.basedOnCommit, prepared.cache.basedOnCommit);
      assert.strictEqual(prepared.provenance.workingSetId, prepared.workingSet.workingSetId);
      assert.ok(typeof prepared.workingSet.workingSetId === 'string' && prepared.workingSet.workingSetId.length > 0);
      assert.strictEqual(prepared.workingSet.id, prepared.workingSet.workingSetId);
      assert.ok(Array.isArray(prepared.workingSet.reasons));
      assert.ok(prepared.workingSet.reasons.some(reason => reason.path === 'app/api/users/route.ts'));
      assert.strictEqual(prepared.allowedExpansion.totalFilesMax, prepared.workingSet.budget.totalFilesMax);
      assert.strictEqual(prepared.allowedExpansion.currentFilesCount, prepared.workingSet.files.length);
      assert.strictEqual(prepared.workingSet.allowedExpansion.neighborCallsite, true);
      assert.ok(prepared.allowedExpansion.expansionsRemaining >= 1);
      assert.ok(prepared.allowedExpansion.totalFilesMax >= prepared.workingSet.files.length);
      assert.strictEqual(prepared.needsDiscovery, false);
      assert.ok(fs.existsSync(taskContextDir));
      assert.ok(fs.readdirSync(taskContextDir).length > 0);

      const taskArtifactsDir = path.join(cacheDir, 'task-artifacts');
      assert.ok(fs.readdirSync(taskArtifactsDir).some(entry => entry.includes(prepared.workingSet.workingSetId)));

      const transportSeedPaths = toSeedPaths(prepared.workingSet, repoRoot);
      assert.ok(transportSeedPaths.includes('app/api/users/route.ts'));
      assert.ok(transportSeedPaths.includes('AI_CONTEXT/00-START-HERE.md'));

      const expanded = expandPreparedContext(prepared, {
        mode: 'narrow',
        domains: ['frontend'],
        paths: ['src/components/user-card.tsx'],
        reason: 'Need UI callsite impacted by the API change'
      }, {
        cacheRoot,
        indexPayload
      });

      assert.strictEqual(expanded.approved, true);
      assert.strictEqual(expanded.decision.approved, true);
      assert.ok(typeof expanded.expansionLogId === 'string' && expanded.expansionLogId.length > 0);
      assert.ok(expanded.preparedContext.workingSet.files.includes('src/components/user-card.tsx'));
      assert.ok(expanded.result.addedFiles.includes('src/components/user-card.tsx'));
      assert.strictEqual(expanded.preparedContext.taskContextId, prepared.taskContextId);
      assert.strictEqual(expanded.preparedContext.workingSet.taskContextId, prepared.taskContextId);
      assert.strictEqual(expanded.preparedContext.allowedExpansionSource, 'workingSet.budget');
      assert.ok(expanded.preparedContext.allowedExpansion.expansionsRemaining < prepared.allowedExpansion.expansionsRemaining);
      assert.ok(fs.readdirSync(taskArtifactsDir).some(entry => entry.includes(expanded.expansionLogId)));

      const store = createProjectCacheStore(repoRoot, { cacheRoot });
      const expansionLog = store.readTaskArtifact(expanded.expansionLogId);
      assert.strictEqual(expansionLog.taskContextId, prepared.taskContextId);
      assert.strictEqual(expansionLog.workingSetId, prepared.workingSet.workingSetId);
      assert.strictEqual(expansionLog.basedOnCommit, prepared.basedOnCommit);

      const rejected = expandPreparedContext(prepared, {
        mode: 'repo-wide',
        domains: ['backend', 'frontend'],
        paths: [],
      }, {
        cacheRoot,
        indexPayload
      });

      assert.strictEqual(rejected.approved, false);
      assert.strictEqual(rejected.deniedReason, 'repo-wide-expansion-not-allowed-by-default');
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  await testAsync('prepareContext task-focused extends PreparedContextPackage with Task Audit Pack', async () => {
    const repoRoot = createTempDir('ecc-task-audit-repo-');
    const cacheRoot = createTempDir('ecc-task-audit-cache-');

    try {
      seedNextRepo(repoRoot);
      const prepared = await prepareContext({
        task: 'Refactor the user API flow and user screen without breaking auth-sensitive behavior',
        repoRoot
      }, {
        cacheRoot,
        prepareMode: 'task-focused',
        analysisMode: 'deep'
      });
      const cacheDir = path.join(cacheRoot, getRepoSlug(repoRoot));
      const taskArtifactsDir = path.join(cacheDir, 'task-artifacts');

      assert.strictEqual(prepared.prepareMode, 'task-focused');
      assert.ok(prepared.workingSet);
      assert.ok(prepared.taskAuditPack);
      assert.strictEqual(prepared.taskAuditPack.schemaVersion, 'ecc.task-audit-pack.v1');
      assert.strictEqual(prepared.taskAuditPack.taskType, 'refactor');
      assert.ok(prepared.taskAuditPack.affectedApis.includes('/users'));
      assert.ok(prepared.taskAuditPack.affectedEntities.includes('User'));
      assert.ok(prepared.taskAuditPack.affectedScreens.includes('src/app/users/page.tsx'));
      assert.ok(prepared.taskAuditPack.probableFiles.includes('app/api/users/route.ts'));
      assert.ok(prepared.taskAuditPack.initialWorkingSet.files.includes('app/api/users/route.ts'));
      assert.ok(prepared.taskAuditPack.initialWorkingSet.docs.includes('AI_CONTEXT/00-START-HERE.md'));
      assert.ok(['low', 'medium', 'high'].includes(prepared.taskAuditPack.riskSummary.level));
      assert.ok(['low', 'medium', 'high'].includes(prepared.taskAuditPack.confidenceSummary.overall));
      assert.ok(prepared.extendedReadiness);
      assert.ok(['ready', 'partial', 'needs_review'].includes(prepared.extendedReadiness.decision));
      assert.ok(typeof prepared.taskAuditPack.artifactId === 'string' && prepared.taskAuditPack.artifactId.length > 0);
      assert.ok(fs.readdirSync(taskArtifactsDir).some(entry => entry.includes(prepared.taskAuditPack.artifactId)));
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  await testAsync('createWorkingSet clamps files to initial budget and preserves explicit reasons', async () => {
    const repoRoot = createTempDir('ecc-working-set-repo-');
    const cacheRoot = createTempDir('ecc-working-set-cache-');

    try {
      seedNextRepo(repoRoot);
      const workingSet = createWorkingSet({
        repoRoot,
        intent: { intentType: 'bugfix', expectedDomains: ['backend'] },
        scopeHypothesis: 'bugfix:backend',
        files: [
          'app/api/users/route.ts',
          'src/services/user-service.ts',
          'src/components/user-card.tsx',
          'prisma/schema.prisma'
        ],
        docs: ['AI_CONTEXT/00-START-HERE.md'],
        reasons: [{ path: 'app/api/users/route.ts', reason: 'mentioned_in_scope_hypothesis' }]
      }, {
        cacheRoot
      });

      assert.strictEqual(workingSet.intentType, 'bugfix');
      assert.ok(workingSet.files.length <= workingSet.budget.initialFilesMax);
      assert.ok(workingSet.reasons.some(reason => reason.path === 'app/api/users/route.ts' && reason.reason === 'mentioned_in_scope_hypothesis'));
      assert.ok(workingSet.seedPaths.includes('AI_CONTEXT/00-START-HERE.md'));
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
