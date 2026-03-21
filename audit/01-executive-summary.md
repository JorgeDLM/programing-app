# Executive Summary

## What is actually solid today

- **Harness utilities are real and reusable**
  - `scripts/lib/tmux-worktree-orchestrator.js`
  - `scripts/lib/orchestration-session.js`
  - `scripts/lib/session-adapters/*.js`
  - `scripts/lib/state-store/*.js`
  - These already give you:
    - worktree isolation
    - coordination artifacts
    - session snapshots
    - repo root tracking
    - lightweight persistence

- **There is already a weak precursor to working sets**
  - `seedPaths` in `scripts/lib/tmux-worktree-orchestrator.js`
  - `normalizeSeedPaths()` and `overlaySeedPaths()` already constrain copied context to paths inside `repoRoot`.
  - This is the closest existing primitive to an enforced initial working set.

- **There is already a weak precursor to per-repo technical profiling**
  - `scripts/lib/project-detect.js`
  - It deterministically infers languages, frameworks, and a primary type.
  - It is shallow, but reusable for `project-profile.json`.

- **There is already a weak precursor to normalized context snapshots**
  - `scripts/lib/session-adapters/canonical-session.js`
  - `normalizeDmuxSnapshot()`
  - `normalizeClaudeHistorySession()`
  - These already standardize session context into a machine-readable shape.

- **There is already persistence you can extend instead of replacing**
  - `scripts/lib/state-store/index.js`
  - `scripts/lib/state-store/migrations.js`
  - `scripts/lib/state-store/queries.js`
  - SQLite path defaults to `~/.claude/ecc/state.db`.

## What is structurally wrong for your target use case

- **This repo is not currently a central runtime engine server**
  - **Confirmado**: no internal HTTP server or API endpoint was found in `programing-app`.
  - The repo is primarily a harness toolkit: CLI, hooks, prompts, command docs, agent definitions, state helpers.
  - That means your new context/retrieval layer should **not** be designed as if there were already a stable server-side orchestrator inside this repo.

- **Retrieval is described in prompts, not enforced in runtime code**
  - `commands/multi-plan.md`
  - `commands/multi-execute.md`
  - `commands/multi-workflow.md`
  - `agents/equipo-desarrollo/implementador/agent.md`
  - These explicitly encourage broad retrieval through `Glob`, `Grep`, `Read`, recursive retrieval, and `Task`/Explore fallback.
  - Today the system does not technically enforce a working set before these searches happen.

- **The most expensive behavior is repeated research-phase rediscovery**
  - `multi-plan` does full retrieval before planning.
  - `multi-execute` does quick retrieval again before implementation.
  - `multi-workflow` does research retrieval again in its own phase flow.
  - `code-reviewer` then rereads diff + surrounding code.
  - Result: the same repo can be rediscovered three to five times in one user task.

- **The current persistence layer stores sessions, not repo intelligence**
  - Current tables cover sessions, skill runs, decisions, install state, governance.
  - There is no repo cache table, no repo profile, no file fingerprint table, no working-set artifact table.

- **The current “context update” layer is not project-context update**
  - `scripts/hooks/session-end.js` updates `~/.claude/sessions/*-session.tmp`.
  - That is useful for cross-session continuity, but it is not `AI_CONTEXT/` maintenance and not repo documentation freshness.

## What is urgent

- **Do not create “Preparador de Contexto” as a new agent first**
  - In this repo, that would be the wrong abstraction.
  - Best first form is a **deterministic service/module** plus an optional thin AI layer.
  - Reason:
    - this repo does not have an internal agent runtime that would naturally host a new core agent
    - there is already prompt-level orchestration pressure from `director-de-operaciones`
    - agentizing too early would duplicate orchestration and increase cost

- **You need an enforced context contract before another smart planner**
  - The main problem is not lack of planning prompts.
  - The main problem is lack of:
    - repo index
    - repo-scoped cache
    - working set contract
    - expansion gate
    - selective context update

- **You need to reuse `seedPaths` and canonical snapshots instead of inventing a second mechanism**
  - `seedPaths` should evolve into working-set transport.
  - canonical snapshots should evolve into machine-readable task/repo artifacts.
  - SQLite state store should absorb repo/task metadata or at least index pointers.

## What I would do first

- **First move**
  - Add a deterministic repo indexing/cache layer under `scripts/lib/context/` and `data/project-cache/<repo>/`.
  - Do not touch agent definitions yet.
  - Do not change the dashboard yet.
  - Do not create `AI_CONTEXT` auto-write yet.

- **Second move**
  - Insert a `ContextPreparer` service before broad retrieval happens.
  - For this repo, the most practical insertion points are:
    - future CLI/service entrypoints under `scripts/`
    - prompt-generation or orchestration wrappers that feed `director-de-operaciones`
    - `multi-plan` / `multi-execute` / `multi-workflow` flows if you keep them alive

- **Third move**
  - Convert `seedPaths` into enforced `workingSet` transport.
  - Specialists should receive only:
    - working set
    - recommended docs
    - cached technical artifacts
  - Broad search should require explicit expansion.

- **Fourth move**
  - Only after that, add selective `AI_CONTEXT` update and validation.

## Hard conclusion

The proposed design direction is good, but **it must be adapted to the real nature of this repo**.

The biggest correction is this:

- **Do not treat `programing-app` like an existing multiagent backend runtime with internal phases/services already wired in code.**
- Treat it as a **harness toolkit with reusable runtime primitives**.
- Build the new context layer as an **incremental runtime substrate** that future orchestrators, CLIs, or `claude-dashboard` can call.

If you try to implement this as if `director-de-operaciones` and phase orchestration already lived in executable Node services inside this repo, you will duplicate logic that is currently only present as prompts and command docs.
