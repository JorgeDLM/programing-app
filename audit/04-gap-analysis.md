# Gap Analysis

## A. Context Preparation

## Target requirement

A `Preparador de Contexto` should:

- classify user intent
- read `AI_CONTEXT/00-START-HERE.md`
- query repo cache
- produce:
  - `intentType`
  - `scopeHypothesis`
  - `recommendedDocs`
  - `workingSet`
  - `allowedExpansion`
  - `confidence`
  - `needsDiscovery`

## What exists today

- `scripts/hooks/session-start.js`
  - injects previous session summary and project type
- `scripts/lib/project-detect.js`
  - deterministic language/framework detection
- `commands/multi-plan.md`
  - Phase 1 retrieval + completeness logic
- `commands/multi-execute.md`
  - retrieval before execution
- `commands/multi-workflow.md`
  - research phase retrieval

## What is missing

- no structured task-prep object
- no repo cache lookup before discovery
- no mandatory use of repo docs
- no confidence scoring
- no `needsDiscovery` flag
- no formal distinction between:
  - intent normalization
  - context preparation
  - orchestration planning

## Best insertion point

### Best option

A new deterministic service layer under `scripts/lib/context/`.

Why:

- this repo already centralizes runtime helpers under `scripts/lib/`
- it avoids creating a fake “agent runtime” abstraction
- it can later be called by:
  - CLI wrappers
  - dashboard integration
  - future orchestrator code

### Suggested first insertion callers

- future task-launch wrapper in `scripts/`
- `scripts/orchestrate-worktrees.js` plan-building path when used for repo tasks
- any future wrapper that assembles `director-de-operaciones` input

## Duplication risk with `director-de-operaciones`

High if you implement it as a planning agent.

Low if you implement it as:

- deterministic intent normalization
- deterministic repo cache lookup
- deterministic working-set recommendation
- optional cheap AI classifier only when ambiguity remains

## Conclusion

The `Preparador de Contexto` should be a **service**, not a primary agent.

## B. `AI_CONTEXT` per repo

## What exists today

Closest related pieces:

- `commands/update-codemaps.md`
- `scripts/codemaps/generate.ts`
- `scripts/hooks/session-end.js`

## What is missing

- no `AI_CONTEXT/` standard
- no per-repo start doc contract
- no domain docs split
- no freshness metadata tied to code state
- no selective updater

## How it could be generated

### Deterministic parts

Generate or seed these from code and repo inspection:

- `00-START-HERE.md` scaffold
- `01-PROJECT-OVERVIEW.md`
- `02-ARCHITECTURE.md`
- domain file placeholders
- freshness metadata:
  - `lastUpdatedAt`
  - `basedOnCommit`
  - `generatedBy`
  - `sourceFingerprint`

### AI-assisted parts

Use a model only to summarize selected deterministic artifacts into compact docs.

## Who should read it

- first: `ContextPreparer`
- second: orchestration layer before specialist routing
- third: specialists only through recommended-doc references, not by loading the entire folder automatically

## Who should update it

Not every agent.

Best owner:

- `ContextUpdater` service
- optionally called at the end of a task or by an explicit command

## When it should not be touched

- formatting-only change
- typo-only copy change
- test-only change without domain impact
- comment-only change
- tiny refactor with zero behavior/interface/structure effect
- build/lint fix with no domain consequence

## Conclusion

`AI_CONTEXT` is missing completely, but selective update policy can reuse codemap freshness ideas from `commands/update-codemaps.md`.

## C. Central technical cache

## What exists today

- state store in `~/.claude/ecc/state.db`
- canonical session recording fallback in temp dir from `canonical-session.js`
- project detection via `project-detect.js`

## What is missing

- no repo cache dir under repo root
- no `project-profile.json`
- no tree/module/route/db/api map
- no file hashes or commit linkage
- no incremental repo index

## Deterministic extraction candidates

Can be extracted without LLM:

- repo root
- package managers
- languages/frameworks via `project-detect.js`
- directory tree summary via codemap scanner patterns
- file lists and modification times
- route-like file discovery patterns
- DB marker discovery:
  - `prisma/`
  - `migrations/`
  - `schema.prisma`
  - `db/`
- source fingerprints:
  - per-file hash
  - mtime
  - size
  - current git commit

## What likely needs model support

- module semantic summaries
- ADR condensation
- domain doc synthesis
- symbol-role explanation when naming is ambiguous

## Incremental indexing strategy

- maintain `repo-meta.json`
  - `repoRoot`
  - `repoSlug`
  - `lastIndexedAt`
  - `basedOnCommit`
  - `indexVersion`
- maintain per-file fingerprint manifest
- re-index only changed files since:
  - previous fingerprint
  - or previous commit

## Where to store hashes / timestamps / commit

### Recommended

- `data/project-cache/<repoSlug>/repo-meta.json`
- `data/project-cache/<repoSlug>/fingerprints.json`

### Optional mirror into SQLite later

If cross-repo reporting becomes necessary.

## Conclusion

This layer does not exist and should be built mostly deterministic-first.

## D. Working sets

## What exists today

Closest current mechanism:

- `seedPaths` in `scripts/lib/tmux-worktree-orchestrator.js`

Why it matters:

- already validated against repo root
- already carried into worker artifacts
- already copied into worker worktrees

## What is missing

- no formal `workingSet` entity
- no working-set persistence
- no mandatory passing between phases
- no hard restriction that specialists must stay inside it first

## Where to create them

- `ContextPreparer`
- based on:
  - intent type
  - repo cache
  - recommended docs
  - previous task artifacts

## How to pass them

- include in task artifact JSON
- include summarized references in worker/task payloads
- map them onto `seedPaths` when launching isolated workers

## How to restrict them

First pass rules:

- specialists may only read:
  - files in `workingSet`
  - docs in `recommendedDocs`
  - previous artifacts attached to task
- any broader lookup requires expansion request

## How to expand without chaos

- expansion should return a diff to the working set, not a fresh full context replacement
- each expansion should record:
  - why requested
  - what was added
  - whether budget remains

## E. Controlled expansion

## What exists today

- recursive retrieval instructions in:
  - `multi-plan.md`
  - `multi-execute.md`
- but no enforcement

## Best technical form

Best first form:

- **system service/module**, not a free tool exposed to every specialist

Reason:

- if exposed as a generic tool too early, you recreate today’s problem with a new name
- expansion needs centralized policy and budgeting

## Recommended interface

A service call such as:

- `requestContextExpansion(taskContext, reason, requestedKind)`

Returns:

- approved additions
- denied reasons
- budget impact
- updated `allowedExpansion`

## Limits it should have

- max broad expansions per task
- max files added per expansion
- max total files in working set by task type
- forbid repo-wide wildcard expansion unless task type explicitly allows it

## F. Context update

## What exists today

- `scripts/hooks/session-end.js` updates session summaries
- `commands/update-codemaps.md` suggests diff-aware documentation update
- `scripts/codemaps/generate.ts` broad deterministic codemap generation

## What is missing

- change-impact detector for domain docs
- selective doc update policy
- validator that checks doc claims against code diff
- rules for when to skip updates

## How to detect what docs to update

Deterministic first pass:

- inspect changed files
- classify changed paths by domain:
  - frontend
  - backend
  - data
  - API
  - architecture
- map changed files to doc targets
- only if threshold exceeded, invoke model summarization

## How to avoid drift

- record `basedOnCommit`
- record `lastUpdatedAt`
- record changed file list used to produce update
- validate that affected files actually changed in git diff

## How to validate written context vs real diff

- deterministic validation before write:
  - changed paths intersect claimed domain
  - claimed API files exist
  - claimed modules exist
- optional AI validation pass only on small selected inputs

## How to avoid touching too many files

Strict rule:

- default max updated docs per task: 2
- third doc only for architecture-impact changes
- ADR only when the decision changed, not just implementation detail

## Gap summary

The target architecture is feasible in this repo, but only if implemented as:

- deterministic repo intelligence layer
- enforced working-set transport
- centralized expansion policy
- selective context update

and **not** as another prompt-only planner.
