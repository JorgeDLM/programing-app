# Appendix — Repo Access Flow

## Current reality

`programing-app` does not expose a confirmed internal API server for repo operations.

Repo access happens today through a mix of:

- harness-native tools described in prompts
- local helper scripts
- worktree orchestration helpers
- hooks that inspect current working directory and transcripts

## Flow 1 — Generic harness-native repo access

### Step 1

A command or agent prompt asks for repo context.

Main prompt sources:

- `commands/multi-plan.md`
- `commands/multi-execute.md`
- `commands/multi-workflow.md`
- `agents/equipo-desarrollo/implementador/agent.md`

### Step 2

The harness is instructed to use tools such as:

- `Glob`
- `Grep`
- `Read`
- `Task` / Explore
- optional MCP search like `mcp__ace-tool__search_context`

### Step 3

Context is gathered ad hoc from the raw repo.

### Problem

There is no enforced cache-first or working-set-first stage.

## Flow 2 — Deterministic repo introspection from local scripts

### `scripts/lib/project-detect.js`

Reads repo markers such as:

- `package.json`
- `tsconfig.json`
- `go.mod`
- `Cargo.toml`
- `requirements.txt`
- `pyproject.toml`
- framework-specific config files

Purpose today:

- lightweight project typing

### `scripts/codemaps/generate.ts`

Walks the repo and classifies files into areas.

Purpose today:

- high-level codemap generation

### `scripts/lib/utils.js`

Provides generic helpers:

- `findFiles()`
- `grepFile()`
- `readFile()`
- `getGitModifiedFiles()`

Purpose today:

- low-level helper functions, not a repo-index pipeline

## Flow 3 — Worktree-based isolated repo access

### Entry

- `scripts/orchestrate-worktrees.js`
- `scripts/lib/tmux-worktree-orchestrator.js`

### Flow

1. load plan JSON
2. resolve `repoRoot`
3. compute worker plan
4. normalize `seedPaths`
5. create git worktrees
6. overlay selected repo paths into worker worktrees
7. create coordination files
8. launch workers in tmux panes

### Why this matters

This is the best existing mechanism to carry a bounded repo subset into execution.

### What is missing

- automatic generation of `seedPaths` from task prep
- working-set budgets
- controlled expansion after launch

## Flow 4 — Repo metadata persistence through session snapshots

### Entry

- `scripts/session-inspect.js`
- `scripts/lib/session-adapters/*.js`

### Flow

1. open a session target
2. normalize to canonical snapshot
3. persist fallback recording or write into state-store-related backends when available

### What it captures

- `repoRoot`
- worker intent
- seeded paths
- outputs
- artifacts

### What it does not capture

- repo index
- repo cache freshness
- task-specific working-set budgets

## Current repo access control level

### Confirmed restrictions today

- `normalizeSeedPaths()` prevents overlay paths escaping repo root
- `runCommand()` in `scripts/lib/utils.js` allowlists command prefixes
- hooks are gated by profiles in `hooks/hooks.json`

### Missing restrictions today

- no mandatory prepared-context step before repo search
- no mandatory working set
- no centralized expansion gate
- no task-type retrieval budgets
- no per-repo prepared cache contract

## Best place to intercept future access

## First interception point

Before a task enters prompt-level retrieval.

Meaning:

- run `ContextPreparer`
- attach `workingSet`
- attach `recommendedDocs`
- attach `allowedExpansion`

## Second interception point

When building worker plans in `tmux-worktree-orchestrator.js`.

Meaning:

- translate `workingSet.files` into `seedPaths`
- refuse execution if task has no working set for applicable task types

## Third interception point

During any explicit expansion request.

Meaning:

- expansion is not a raw `Glob` habit
- expansion is an approved delta to the working set

## Final conclusion

Today repo access is mostly raw and prompt-driven.

The strongest reusable enforcement primitive already present is `seedPaths`. That should become the transport layer for working sets.
