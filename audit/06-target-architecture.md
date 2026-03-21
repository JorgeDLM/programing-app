# Target Architecture

## Design principle for this repo

The new layer should be implemented as **runtime substrate**, not as a prompt-only workflow and not as a new top-level agent first.

## Why

- **Confirmado**: this repo has reusable runtime helpers under `scripts/lib/`.
- **Confirmado**: this repo does not expose a confirmed internal backend orchestrator service.
- **Therefore**: the safest architecture is local modules + cache + CLI entrypoints that future orchestrators can call.

## Architecture overview

```text
User task
  -> IntentNormalizer
  -> ContextPreparer
      -> RepoIndexService
      -> ProjectCacheStore
      -> AI_CONTEXT reader
      -> Previous task/session artifacts reader
  -> Operation Director / planner layer
  -> Specialist execution with WorkingSetManager contract
  -> ContextExpansionService when needed
  -> Code change execution
  -> ContextUpdateDecider
  -> ContextUpdater
  -> ContextValidator
```

## 1. Intent normalizer

### Purpose

Turn raw task text into a stable routing shape before retrieval.

### Input

- raw user task
- optional task metadata from caller
- repo identity

### Output

```json
{
  "intentType": "bugfix|feature|audit|refactor|research|unknown",
  "riskLevel": "low|medium|high",
  "expectedDomains": ["frontend", "backend", "data", "api", "docs"],
  "requiresWrite": true,
  "likelyScope": "narrow|medium|broad",
  "ambiguity": "low|medium|high"
}
```

### Dependencies

- none required beyond local rules

### Suggested files

- `scripts/lib/context/intent-normalizer.js`
- `scripts/lib/context/intent-rules.js`

### Type

- deterministic first
- optional AI fallback for ambiguous tasks

### Recommended model if AI is needed

- Haiku-class Claude

### Cost

- low

### Risks

- overfitting simplistic rules
- misclassifying mixed tasks

## 2. Context preparer

### Purpose

Build the initial context package without broad repo search by default.

### Input

- normalized intent
- repo root
- task text

### Output

```json
{
  "intentType": "feature",
  "scopeHypothesis": "API route + service + validation layer",
  "recommendedDocs": [
    "AI_CONTEXT/00-START-HERE.md",
    "AI_CONTEXT/03-BACKEND.md",
    "AI_CONTEXT/06-API-CONTRACTS.md"
  ],
  "workingSet": [
    "src/api/...",
    "src/services/..."
  ],
  "allowedExpansion": {
    "broadSearchesRemaining": 2,
    "expansionsRemaining": 2,
    "maxFiles": 18
  },
  "confidence": 0.82,
  "needsDiscovery": false
}
```

### Dependencies

- `IntentNormalizer`
- `RepoIndexService`
- `ProjectCacheStore`
- `AI_CONTEXT` reader
- task artifact reader

### Suggested files

- `scripts/lib/context/context-preparer.js`
- `scripts/lib/context/context-preparer-ai.js`
- `scripts/lib/context/context-package-schema.js`

### Type

- mixed

### Recommended model

- default deterministic
- Haiku only if ambiguity remains
- Sonnet only for high-ambiguity architectural tasks

### Cost

- low to medium

### Risks

- if AI path is overused, prep becomes the new cost center

## 3. Repo index service

### Purpose

Create and refresh deterministic repo intelligence.

### Input

- repo root
- optional previous fingerprints/cache

### Output

- project profile
- tree summary
- module map
- route map
- api map
- db map
- symbol inventory summary
- fingerprints

### Dependencies

- `scripts/lib/project-detect.js`
- deterministic file walkers inspired by `scripts/codemaps/generate.ts`
- `git` metadata when available

### Suggested files

- `scripts/lib/context/repo-index-service.js`
- `scripts/lib/context/repo-fingerprint.js`
- `scripts/lib/context/repo-classifiers.js`
- `scripts/lib/context/repo-map-builders.js`

### Type

- deterministic

### Recommended model

- none by default

### Cost

- very low after initial index

### Risks

- symbol extraction may be shallow in v1
- route detection will be convention-based, not perfect

## 4. Central technical cache

### Purpose

Persist repo intelligence locally inside `programing-app`.

### Recommended storage path

- `data/project-cache/<repoSlug>/`

### Why this path

- **Confirmado**: no existing `data/` dir was found in repo root
- avoids collision with existing `~/.claude/ecc/state.db`
- keeps repo intelligence in project-local storage, which matches your stated target design

### Suggested structure

```text
/data/project-cache/<repoSlug>/
  repo-meta.json
  fingerprints.json
  project-profile.json
  tree-summary.json
  modules.json
  routes.json
  api-map.json
  db-map.json
  symbols.json
  task-context/
  task-artifacts/
```

### Suggested files

- `scripts/lib/context/project-cache-store.js`
- `scripts/lib/context/cache-paths.js`
- `scripts/lib/context/cache-version.js`

### Type

- deterministic

### Cost

- low

### Risks

- cache invalidation discipline is mandatory

## 5. Working set manager

### Purpose

Own creation, normalization, persistence and transport of working sets.

### Input

- context package
- task type
- repo cache

### Output

```json
{
  "workingSetId": "...",
  "files": ["..."],
  "docs": ["..."],
  "artifacts": ["..."],
  "budget": { ... }
}
```

### Dependencies

- `ContextPreparer`
- `ProjectCacheStore`
- existing `seedPaths` transport in `tmux-worktree-orchestrator.js`

### Suggested files

- `scripts/lib/context/working-set-manager.js`
- `scripts/lib/context/working-set-budget.js`
- `scripts/lib/context/working-set-transport.js`

### Type

- deterministic

### Cost

- low

### Risks

- if not used everywhere, it becomes optional theater

## 6. Controlled context expansion

### Purpose

Approve or deny context growth and record the delta.

### Input

- working set
- reason for expansion
- requested domain/kind
- current budget state

### Output

- approved additions
- rejected requests
- updated budget
- expansion record

### Dependencies

- `WorkingSetManager`
- `RepoIndexService`
- `ProjectCacheStore`

### Suggested files

- `scripts/lib/context/context-expansion-service.js`
- `scripts/lib/context/expansion-policy.js`

### Type

- deterministic first
- optional AI assistance for ambiguous expansion requests

### Recommended model

- Haiku only if the requested expansion reason is ambiguous

### Cost

- low

### Risks

- if exposed as a general free-form tool too early, abuse resumes

## 7. Context updater

### Purpose

Selectively update `AI_CONTEXT` after meaningful changes.

### Input

- changed files
- git diff
- working set
- task intent
- cache state

### Output

- selected doc targets
- selective updates
- update metadata

### Dependencies

- deterministic diff impact classifier
- `AI_CONTEXT` file manager
- optional summarization model

### Suggested files

- `scripts/lib/context/context-updater.js`
- `scripts/lib/context/context-impact-classifier.js`
- `scripts/lib/context/ai-context-files.js`

### Type

- mixed

### Recommended model

- deterministic target selection
- Haiku for compact doc rewrite
- Sonnet only for architecture/ADR-quality summaries

### Cost

- low if selective

### Risks

- over-updating docs
- drift if validator is weak

## 8. Context validator

### Purpose

Check that updated context aligns with actual changed code.

### Input

- proposed doc updates
- diff
- affected file list
- cache state

### Output

- valid / invalid
- warnings
- stale markers

### Dependencies

- diff parser
- repo cache
- doc metadata

### Suggested files

- `scripts/lib/context/context-validator.js`
- `scripts/lib/context/context-freshness.js`

### Type

- deterministic first
- optional AI critique pass later

### Recommended model

- none in iteration 1-3
- optional Haiku later

### Cost

- very low

### Risks

- false positives if rules are too strict

## 9. Integration with Directora de Operaciones

### Design rule

Do not replace the director.

### Integration shape

The director should receive a structured prep payload as part of input context:
* normalized intent
* scope hypothesis
* recommended docs

### Why

This preserves the director’s role:
* sequencing
* team selection
* escalation
* workflow decisions

while removing repo rediscovery burden.

## 10. Integration with current tools

### Reuse map

- `project-detect.js`
  - seeds `project-profile.json`
- `tmux-worktree-orchestrator.js`
  - carry working set through `seedPaths`
- `canonical-session.js`
  - normalize task artifacts
- `state-store/`
  - extend or reference for metadata persistence
- `codemaps/generate.ts`
  - reuse deterministic scanning patterns, not output format directly

## 11. Integration with current persistence

### Recommended split

- repo intelligence lives in:
  - `data/project-cache/<repoSlug>/...`
- session/governance/skill lifecycle remains in:
  - `~/.claude/ecc/state.db`

### Optional later bridge

Store pointers into SQLite for analytics and session correlation.

## Versioning and drift control for `AI_CONTEXT`

Every `AI_CONTEXT` doc should carry frontmatter like:

```yaml
version: 1
lastUpdatedAt: 2026-03-20T22:00:00Z
basedOnCommit: abc1234
sourceFingerprint: sha256:...
updatedBy: context-updater
confidence: 0.86
```

## Explicit recommendation on new agent creation

### Recommendation

- `Preparador de Contexto`: **mejor como capacidad del sistema**, no como agente nuevo en iteración 1
- `Actualizador de Contexto`: **mejor como servicio**, no como agente nuevo en iteración 1

### Why

- avoids duplicating `director-de-operaciones`
- aligns with real repo structure
- obeys incremental integration over agent proliferation
