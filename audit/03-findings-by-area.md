# Findings by Area

## 1. Núcleo de agentes y orquestación

### Confirmado

- **Agent definitions are prompt contracts, not runtime code**
  - `agents/**/agent.md`
  - `AGENTS.md`
  - Examples:
    - `agents/equipo-direccion/director-de-operaciones/agent.md`
    - `agents/equipo-direccion/project-manager/agent.md`
    - `agents/equipo-desarrollo/implementador/agent.md`
  - These define roles, tools, models, handoffs and expected behavior.

- **A real executable orchestration helper exists, but it is narrow**
  - `scripts/lib/tmux-worktree-orchestrator.js`
  - `scripts/orchestrate-worktrees.js`
  - This is not a general task orchestrator.
  - It is a worktree/tmux launcher with coordination artifacts.

- **Current machine-readable worker lifecycle is file-based**
  - `task.md`
  - `status.md`
  - `handoff.md`
  - built in `buildWorkerArtifacts()` inside `scripts/lib/tmux-worktree-orchestrator.js`

### Implication

The new context layer should plug into:

- orchestration helpers
- session adapters
- prompt assembly or task launch wrappers

It should **not** assume there is already a code-level phase orchestrator service in this repo.

## 2. Trabajo sobre repos locales

### Confirmado

- **Repo access today is mostly generic and broad**
  - `Glob`, `Grep`, `Read`, `Task` are referenced in command flows.
  - `scripts/lib/utils.js` exposes deterministic helpers:
    - `findFiles()`
    - `grepFile()`
    - `readFile()`
    - `writeFile()`
    - `getGitModifiedFiles()`

- **There is already path-constrained overlay transport**
  - `normalizeSeedPaths(seedPaths, repoRoot)`
  - `overlaySeedPaths({ repoRoot, seedPaths, worktreePath })`
  - in `scripts/lib/tmux-worktree-orchestrator.js`
  - This already enforces “path must stay inside repo root”.

- **There is no confirmed repo-scoped retrieval policy layer**
  - no working set manager
  - no expansion gate
  - no repo index
  - no repo-aware cache

### Cost/efficiency finding

The system is currently optimized for **ad hoc exploration**, not **prepared context reuse**.

## 3. Persistencia, artifacts y contexto

### Confirmado

- **State store exists and is reusable**
  - `scripts/lib/state-store/index.js`
  - `scripts/lib/state-store/migrations.js`
  - `scripts/lib/state-store/queries.js`
  - `schemas/state-store.schema.json`

- **Current SQLite schema stores**
  - `sessions`
  - `skill_runs`
  - `skill_versions`
  - `decisions`
  - `install_state`
  - `governance_events`

- **Current session continuity is file-based in `~/.claude`**
  - `~/.claude/sessions/*.tmp`
  - `~/.claude/session-aliases.json`
  - `~/.claude/metrics/costs.jsonl`

- **Canonical session normalization already exists**
  - `scripts/lib/session-adapters/canonical-session.js`
  - useful for future task-context/task-artifacts persistence

### Missing

- per-repo cache structure
- per-repo fingerprints
- working-set persistence
- repo documentation freshness tracking
- `AI_CONTEXT` version metadata

## 4. Costos, providers y routing

### Confirmado

- **Simple real cost logging exists**
  - `scripts/hooks/cost-tracker.js`
  - estimates cost from token usage and model name
  - writes JSONL metrics

- **Model routing currently exists mostly as docs/prompt policy**
  - `docs/MODEL-ROUTING-CONFIG.md`
  - `commands/model-route.md`
  - agent frontmatter fields like:
    - `model`
    - `provider`
    - `fallbackmodel`
    - `escalationmodel`

- **There is no confirmed runtime model router module in code**
  - no central `routeModel(task)` implementation found in `scripts/lib/`

### Implication

For the new context stack:

- deterministic layers should not consume a model at all
- prep/update/validation layers need their own explicit router, not just docs

## 5. Integración con `claude-dashboard`

### Confirmado

- **This repo exposes no confirmed HTTP endpoint for dashboard integration**
  - no internal API server found
  - `.claude-plugin/plugin.json` is manifest metadata, not runtime transport
  - `.claude-plugin/README.md` explicitly says ECC does not override Claude Code transport settings

### No confirmado

- exact RPC/API/file contract currently used by `claude-dashboard` to invoke this repo
- whether the dashboard reads agent files directly, shells out to scripts, or uses copied prompts elsewhere

### Safe conclusion

From `programing-app` alone, the integration surfaces you can rely on are:

- files
- CLI scripts
- hook scripts
- agent/command markdown definitions
- state-store/session outputs

## 6. Restricciones y puntos de control

### Confirmado insertion points

- **Restrict broad search**
  - best current insertion candidates:
    - wrapper before task launch into `director-de-operaciones`
    - wrapper before `multi-plan` retrieval phase
    - wrapper before `multi-execute` retrieval phase
    - wrapper around worktree plan creation when workers are spawned

- **Force a working set**
  - strongest reusable primitive today: `seedPaths`
  - convert to required task input, not optional overlay

- **Intercept context expansion**
  - best place: new deterministic service called before any free-form `Glob/Grep/Read` instruction is emitted
  - second-best: wrap runtime calls that build worker plans

- **Store artifacts by repo/task**
  - extend SQLite or write JSON cache under repo-local cache path
  - current persistence models can be extended safely

- **Update `AI_CONTEXT`**
  - nothing existing directly does this
  - closest reusable helper is `scripts/codemaps/generate.ts`, but it is too broad and too generic to use as-is

## 7. Exact hotspots of retrieval cost and repetition

### Hotspot A: `multi-plan` full retrieval

- File: `commands/multi-plan.md`
- Trigger: Phase 1.2 Context Retrieval
- Why expensive:
  - starts broad
  - allows recursive retrieval
  - seeks “complete definitions and signatures” before moving on
  - can expand again if insufficient

### Hotspot B: `multi-execute` retrieval before implementation

- File: `commands/multi-execute.md`
- Trigger: Phase 1 Quick Context Retrieval
- Why repetitive:
  - reruns retrieval even when plan already contains key files
  - allows additional recursive retrievals
  - does not consume a persisted working set artifact

### Hotspot C: `multi-workflow` research phase

- File: `commands/multi-workflow.md`
- Trigger: Phase 1 Research & Analysis
- Why repetitive:
  - yet another research-first retrieval pass
  - same fallback pattern: `Glob`, `Grep`, `Read`, `Task`

### Hotspot D: implementador prompt

- File: `agents/equipo-desarrollo/implementador/agent.md`
- Trigger: “Identifica archivos relevantes con search_files”
- Why costly:
  - pushes discovery into implementation phase itself
  - no budget, no scope guard, no required precomputed context

### Hotspot E: review phase reread

- File: `agents/equipo-calidad/inspector-de-codigo/agent.md`
- Trigger:
  - `git diff --staged`
  - `git diff`
  - read surrounding code and dependencies
- Why repetitive:
  - necessary for quality
  - but still re-reads context with no reuse of prepared repo/task artifacts

## 8. Existing pieces worth reusing

- `scripts/lib/project-detect.js`
  - for deterministic repo profiling
- `scripts/lib/tmux-worktree-orchestrator.js`
  - for constrained seeded path transport
- `scripts/lib/session-adapters/canonical-session.js`
  - for normalized task/session artifacts
- `scripts/lib/state-store/*`
  - for structured persistence and migrations
- `scripts/codemaps/generate.ts`
  - for deterministic structural scanning patterns
- `commands/update-codemaps.md`
  - for freshness metadata and diff-sensitive update policy ideas

## 9. Existing pieces that should not be duplicated

- `director-de-operaciones` as planning brain
- `project-manager` as phase/task structuring role
- `session-end.js` as session continuity updater
- `canonical-session.js` as normalized snapshot layer
- `state-store` as persistent schema owner

## 10. Overall diagnosis

The repo already contains enough primitives to support a strong context/retrieval redesign, but the redesign must be **infrastructure-first**.

Today the highest-cost problem is not missing intelligence. It is the absence of a hard technical contract that says:

- what context is allowed first
- what must be reused
- what must be cached
- when expansion is allowed
- what gets updated after changes
