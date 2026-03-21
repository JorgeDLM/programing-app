'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildCache, seedAiContextStep } = require('../../scripts/lib/context/repo-mapping-service');

console.log('=== Testing ai-context-generation.js ===\n');

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

function readDoc(repoRoot, name) {
  return fs.readFileSync(path.join(repoRoot, 'AI_CONTEXT', name), 'utf8');
}

function seedRepo(repoRoot) {
  writeFile(repoRoot, 'package.json', JSON.stringify({
    name: 'generic-billing-platform',
    description: 'Fullstack billing workspace with dashboard, API routes and Prisma models.',
    dependencies: {
      next: '16.0.0',
      react: '19.0.0',
      '@prisma/client': '6.0.0',
      '@anthropic-ai/sdk': '0.79.0',
      jspdf: '3.0.0'
    }
  }, null, 2));
  writeFile(repoRoot, 'README.md', '# Generic Billing Platform\n\nThis repo manages invoices, customers and internal billing operations.\n');
  writeFile(repoRoot, 'tsconfig.json', '{}');
  writeFile(repoRoot, 'next.config.mjs', 'export default {}\n');
  writeFile(repoRoot, 'src/app/layout.tsx', 'export default function RootLayout({ children }) { return children; }\n');
  writeFile(repoRoot, 'src/app/dashboard/page.tsx', 'import { InvoiceForm } from "@/components/invoice-form";\nexport default function DashboardPage() { return <InvoiceForm />; }\n');
  writeFile(repoRoot, 'src/components/invoice-form.tsx', 'export function InvoiceForm() { return <form><input name="amount" /></form>; }\n');
  writeFile(repoRoot, 'src/lib/db.ts', 'export const prisma = { invoice: { create: async () => ({ id: "inv_1" }) } };\n');
  writeFile(repoRoot, 'src/services/invoice-service.ts', 'import { prisma } from "@/lib/db";\nexport async function createInvoice(input) { return prisma.invoice.create({ data: input }); }\n');
  writeFile(repoRoot, 'src/app/api/billing/route.ts', 'import { prisma } from "@/lib/db";\nfunction requireAuth(request) { return request.headers.get("authorization"); }\nexport async function POST(request) {\n  requireAuth(request);\n  const { customerId, amount, status } = await request.json();\n  const invoice = await prisma.invoice.create({ data: { customerId, amount, status } });\n  return Response.json({ ok: true, invoice });\n}\n');
  writeFile(repoRoot, 'prisma/schema.prisma', 'generator client { provider = "prisma-client-js" }\ndatasource db { provider = "postgresql" url = env("DATABASE_URL") }\n\nenum InvoiceStatus {\n  DRAFT\n  SENT\n  PAID\n}\n\nmodel Customer {\n  id        String    @id @default(cuid())\n  email     String    @unique\n  invoices  Invoice[]\n  createdAt DateTime  @default(now())\n}\n\nmodel Invoice {\n  id         String        @id @default(cuid())\n  customerId String\n  amount     Int\n  status     InvoiceStatus @default(DRAFT)\n  customer   Customer      @relation(fields: [customerId], references: [id])\n  createdAt  DateTime      @default(now())\n}\n');
}

function run() {
  test('AI_CONTEXT generator builds useful docs from generic repo evidence', () => {
    const repoRoot = createTempDir('ecc-ai-context-generation-repo-');
    const cacheRoot = createTempDir('ecc-ai-context-generation-cache-');

    try {
      seedRepo(repoRoot);

      const built = buildCache(repoRoot, { cacheRoot, forceRefresh: true });
      const route = built.indexPayload.routes.routes.find(entry => entry.path === 'src/app/api/billing/route.ts');
      assert.ok(route);
      assert.strictEqual(route.kind, 'nextjs-app-route');
      assert.strictEqual(route.endpoint, '/billing');

      const backendArea = built.indexPayload.modules.areas.find(entry => entry.area === 'backend');
      const frontendArea = built.indexPayload.modules.areas.find(entry => entry.area === 'frontend');
      const dataArea = built.indexPayload.modules.areas.find(entry => entry.area === 'data');
      assert.ok(backendArea.files.includes('src/app/api/billing/route.ts'));
      assert.ok(frontendArea.files.includes('src/app/dashboard/page.tsx'));
      assert.ok(!frontendArea.files.includes('src/app/api/billing/route.ts'));
      assert.ok(dataArea.files.includes('prisma/schema.prisma'));

      const seeded = seedAiContextStep(repoRoot, { indexPayload: built.indexPayload }, {
        cacheRoot,
        createAiContextIfMissing: true,
        forceRemap: true
      });
      assert.strictEqual(seeded.skipped, false);

      const startDoc = readDoc(repoRoot, '00-START-HERE.md');
      const backendDoc = readDoc(repoRoot, '03-BACKEND.md');
      const frontendDoc = readDoc(repoRoot, '04-FRONTEND.md');
      const dataDoc = readDoc(repoRoot, '05-DATA-MODELS.md');
      const apiDoc = readDoc(repoRoot, '06-API-CONTRACTS.md');
      const issuesDoc = readDoc(repoRoot, '09-OPEN-ISSUES.md');

      assert.ok(startDoc.includes('frontend/ui'));
      assert.ok(startDoc.includes('backend/api'));
      assert.ok(startDoc.includes('data/db'));
      assert.ok(startDoc.includes('working set'));
      assert.ok(startDoc.includes('## Readiness'));
      assert.ok(startDoc.includes('## Agent Playbook'));
      assert.ok(startDoc.includes('### When To Use This Doc'));
      assert.ok(startDoc.includes('### Read Next'));
      assert.ok(startDoc.includes('### Verify In Code'));
      assert.ok(startDoc.includes('### Do Not Assume'));
      assert.ok(startDoc.includes('## Evidence Profile'));
      assert.ok(startDoc.includes('accuracyScore'));

      assert.ok(backendDoc.includes('src/app/api/billing/route.ts'));
      assert.ok(backendDoc.includes('/billing'));
      assert.ok(backendDoc.includes('POST'));
      assert.ok(!backendDoc.includes('No backend files detected'));
      assert.ok(backendDoc.includes('## Agent Playbook'));
      assert.ok(backendDoc.includes('Business logic may be outside route files.'));
      assert.ok(backendDoc.includes('Supporting Backend Files'));
      assert.ok(backendDoc.includes('Sensitive Operations and Risks'));

      assert.ok(frontendDoc.includes('src/app/dashboard/page.tsx'));
      assert.ok(frontendDoc.includes('src/components/invoice-form.tsx'));
      assert.ok(!frontendDoc.includes('src/app/api/billing/route.ts'));
      assert.ok(frontendDoc.includes('## Agent Playbook'));
      assert.ok(frontendDoc.includes('UI Hotspots and Partial Zones'));

      assert.ok(dataDoc.includes('Invoice'));
      assert.ok(dataDoc.includes('Customer'));
      assert.ok(dataDoc.includes('InvoiceStatus'));
      assert.ok(dataDoc.includes('customerId'));
      assert.ok(dataDoc.includes('## Agent Playbook'));
      assert.ok(dataDoc.includes('ownership'));
      assert.ok(dataDoc.includes('related endpoints'));

      assert.ok(apiDoc.includes('/billing'));
      assert.ok(apiDoc.includes('POST'));
      assert.ok(apiDoc.includes('customerId'));
      assert.ok(apiDoc.includes('invoice'));
      assert.ok(apiDoc.toLowerCase().includes('confidence'));
      assert.ok(apiDoc.includes('## Agent Playbook'));
      assert.ok(apiDoc.includes('Static auth inference is weaker than runtime middleware inspection.'));
      assert.ok(apiDoc.includes('gaps'));
      assert.ok(apiDoc.includes('request shape'));
      assert.ok(apiDoc.includes('response shape'));

      assert.ok(issuesDoc.toLowerCase().includes('low-confidence') || issuesDoc.toLowerCase().includes('contradiction') || issuesDoc.toLowerCase().includes('no unresolved'));
    } finally {
      cleanupDir(repoRoot);
      cleanupDir(cacheRoot);
    }
  });

  test('AI_CONTEXT analysis respects generation mode and exposes critic-backed readiness', () => {
    const repoRoot = createTempDir('ecc-ai-context-generation-mode-repo-');
    const cacheRoot = createTempDir('ecc-ai-context-generation-mode-cache-');

    try {
      seedRepo(repoRoot);

      const seedBuilt = buildCache(repoRoot, { cacheRoot, forceRefresh: true, mode: 'seed' });
      assert.strictEqual(seedBuilt.indexPayload.analysis.mode, 'seed');
      assert.ok(seedBuilt.indexPayload.analysis.critic);
      assert.ok(seedBuilt.indexPayload.analysis.critic.overall);

      const deepBuilt = buildCache(repoRoot, { cacheRoot, forceRefresh: true, mode: 'deep' });
      assert.strictEqual(deepBuilt.indexPayload.analysis.mode, 'deep');
      assert.ok(deepBuilt.indexPayload.analysis.critic.overall.decision);
      assert.ok(typeof deepBuilt.indexPayload.analysis.critic.overall.evidenceScore === 'number');

      const seeded = seedAiContextStep(repoRoot, { indexPayload: deepBuilt.indexPayload }, {
        cacheRoot,
        createAiContextIfMissing: true,
        forceRemap: true,
        mode: 'deep'
      });
      assert.strictEqual(seeded.mode, 'deep');
      assert.ok(['ready', 'partial', 'needs_enrichment', 'needs_review'].includes(seeded.overallReadiness));
      assert.ok(seeded.docReports.every(report => report.docScores && typeof report.docScores.evidenceScore === 'number'));
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
