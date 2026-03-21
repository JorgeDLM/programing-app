# Current System Map

## Scope warning

- **Confirmado**: este mapa describe el sistema real encontrado dentro de `programing-app`.
- **No confirmado**: un runtime adicional externo que viva en `claude-dashboard` o en otra capa no incluida en este workspace.

## High-level architecture found in this repo

### 1. Prompt and command layer

- `agents/**/agent.md`
- `commands/*.md`
- `AGENTS.md`

What they are today:

- Mostly prompt contracts and workflow instructions.
- They describe roles such as:
  - `director-de-operaciones`
  - `project-manager`
  - `implementador`
  - `code-reviewer`
- They also describe workflows such as:
  - planning
  - retrieval
  - execution
  - audit

What they are not:

- Not an executable orchestrator implementation inside this repo.
- Not a server-side pipeline runtime.

### 2. CLI and helper runtime layer

- `scripts/ecc.js`
- `scripts/claw.js`
- `scripts/orchestrate-worktrees.js`
- `scripts/orchestration-status.js`
- `scripts/session-inspect.js`
- `scripts/status.js`
- `scripts/sessions-cli.js`

This is the main executable layer actually present in the repo.

### 3. Hook automation layer

- `hooks/hooks.json`
- `scripts/hooks/*.js`

This layer reacts to Claude Code lifecycle/tool events and provides:

- session start context injection
- session summaries
- cost logging
- compaction hints
- quality gates
- security wrappers

### 4. Persistence and snapshot layer

- `scripts/lib/state-store/*`
- `scripts/lib/session-adapters/*`
- `scripts/lib/orchestration-session.js`

This layer persists and normalizes:

- sessions
- skill runs
- decisions
- install state
- governance events
- canonical session snapshots

## Current flow from user instruction to outcome

## Flow A: Claude Code / harness-native flow

### Step 1: User issues a task in the harness

- Entry is **outside this repo's code**.
- This repo contributes behavior through installed assets:
  - `agents/**`
  - `commands/**`
  - `hooks/hooks.json`
  - `.claude-plugin/plugin.json`

### Step 2: Session lifecycle hooks fire

- `hooks/hooks.json` wires events like:
  - `SessionStart`
  - `PreToolUse`
  - `PostToolUse`
  - `Stop`
  - `SessionEnd`

Relevant context-related hooks:

- `scripts/hooks/session-start.js`
  - loads latest session summary from `~/.claude/sessions`
  - calls `detectProjectType()` from `scripts/lib/project-detect.js`
  - outputs lightweight context into the new session
- `scripts/hooks/session-end.js`
  - parses transcript JSONL
  - extracts user messages, tools used, files modified
  - updates `~/.claude/sessions/<date>-<id>-session.tmp`
- `scripts/hooks/cost-tracker.js`
  - appends token/cost estimates to `~/.claude/metrics/costs.jsonl`

### Step 3: Agent/command prompt instructs retrieval

This is where broad retrieval is currently triggered most often.

Primary files:

- `commands/multi-plan.md`
- `commands/multi-execute.md`
- `commands/multi-workflow.md`
- `agents/equipo-desarrollo/implementador/agent.md`

Current behavior described there:

- use `Glob`
- use `Grep`
- use `Read`
- recurse if context insufficient
- use `Task`/Explore for broader search
- optionally call `mcp__ace-tool__search_context` if available

### Step 4: Orchestration or execution happens

There are two different realities here.

#### 4A. Prompt-level orchestration

- `agents/equipo-direccion/director-de-operaciones/agent.md`
- `commands/multi-workflow.md`
- `commands/multi-plan.md`
- `commands/multi-execute.md`

These describe phases such as:

- research
- ideation
- planning
- execute
- optimize
- review

But inside this repo they are **instructions**, not a fully implemented Node orchestrator.

#### 4B. Actual executable external orchestration helper

- `scripts/orchestrate-worktrees.js`
- `scripts/lib/tmux-worktree-orchestrator.js`

This part is executable and real.

Actual flow there:

1. load JSON plan
2. resolve `repoRoot`
3. build worker plans
4. validate and normalize `seedPaths`
5. create worktrees
6. copy seed overlays into worktrees with `overlaySeedPaths()`
7. create coordination artifacts:
   - `task.md`
   - `handoff.md`
   - `status.md`
8. launch workers in tmux panes

### Step 5: Handoffs between phases/workers

Current handoff forms found:

- prompt-level handoffs declared in agent frontmatter:
  - `handoffExpects`
  - `handoffProduces`
- orchestration handoffs in files created by `tmux-worktree-orchestrator.js`:
  - `task.md`
  - `handoff.md`
  - `status.md`
- session continuity handoffs in `~/.claude/sessions/*.tmp`

The strongest machine-readable handoff shape today is not in the agent prompts. It is in:

- `scripts/lib/session-adapters/canonical-session.js`

That normalizes sessions into:

- session metadata
- worker intents
- worker outputs
- artifacts
- aggregate state

### Step 6: Task closure

Closure paths found:

- `scripts/hooks/session-end.js`
  - persists summarized session context
- `scripts/hooks/evaluate-session.js`
  - signals learning evaluation conditions
- `scripts/hooks/cost-tracker.js`
  - logs costs
- `scripts/status.js`
  - reports state-store summary
- `scripts/sessions-cli.js`
  - exposes recent sessions / details
- `scripts/session-inspect.js`
  - emits canonical snapshots

## Current retrieval map

## Where `search_files` or equivalent is triggered

### Explicit prompt-level triggers

- `agents/equipo-desarrollo/implementador/agent.md`
  - literally says: `Identifica archivos relevantes con search_files`
  - **Important**: this names the behavior, but no concrete `search_files` implementation was found in repo runtime code.

### Documented equivalents actually available in current workflows

- `Glob`
- `Grep`
- `Read`
- `Task` / Explore
- `mcp__ace-tool__search_context`

Main prompt sources:

- `commands/multi-plan.md`
  - Phase 1.2 Full Context Retrieval
  - allows recursive retrieval
- `commands/multi-execute.md`
  - Phase 1 Quick Context Retrieval
  - allows 1-2 recursive retrievals
- `commands/multi-workflow.md`
  - Phase 1 Research & Analysis
  - broad retrieval again before ideation/planning

### Deterministic local equivalents in code

- `scripts/lib/utils.js`
  - `findFiles()`
  - `grepFile()`
  - `readFile()`
  - `getGitModifiedFiles()`

Important distinction:

- These utilities exist in runtime code.
- They are not wired as a repo-aware retrieval policy layer.
- They do not enforce working sets, budgets, or expansion control.

## Most repetitive retrieval patterns found

- **Planning rediscovery**
  - `multi-plan` starts from broad retrieval.
- **Execution rediscovery**
  - `multi-execute` retrieves again even when a plan already contains key files.
- **Workflow rediscovery**
  - `multi-workflow` starts research retrieval again.
- **Review reread**
  - `code-reviewer` reads diff plus surrounding code again.
- **Session summaries are too weak to stop rediscovery**
  - `session-end.js` stores general summaries, not repo intelligence.

## Current equivalents of requested future components

### Partial equivalent of “Context Preparer”

Closest existing pieces:

- `scripts/hooks/session-start.js`
- `scripts/lib/project-detect.js`
- retrieval phase instructions in:
  - `commands/multi-plan.md`
  - `commands/multi-execute.md`
  - `commands/multi-workflow.md`

Why partial only:

- no per-task structured output like:
  - `intentType`
  - `scopeHypothesis`
  - `recommendedDocs`
  - `workingSet`
  - `allowedExpansion`
  - `confidence`
  - `needsDiscovery`
- no enforced cache lookup before search
- no repo-level prepared context contract

### Partial equivalent of “Context Updater”

Closest existing pieces:

- `scripts/hooks/session-end.js`
- `commands/update-codemaps.md`
- `scripts/codemaps/generate.ts`

Why partial only:

- `session-end.js` updates session memory, not repo docs
- `generate.ts` creates broad codemaps, not selective domain updates
- nothing currently updates `AI_CONTEXT/07-09` selectively from code diffs

### Current pieces that would compete if duplicated

- `director-de-operaciones/agent.md`
  - prompt-level operational planner
- `multi-plan.md`
  - research + planning workflow
- `multi-workflow.md`
  - research + ideation + plan + review workflow
- `scripts/lib/tmux-worktree-orchestrator.js`
  - already owns seeded path transport
- `scripts/lib/session-adapters/canonical-session.js`
  - already owns normalized session snapshot shape
- `scripts/lib/state-store/*`
  - already owns persistence discipline and schema validation

## Bottom-line system map

The current system is best described as:

- **prompt-defined orchestration**
- **hook-assisted session context continuity**
- **CLI/runtime helpers for worktrees, sessions, state, and codemaps**
- **no confirmed internal backend engine that centrally enforces retrieval policy**

That is why the new design must be inserted as a reusable runtime substrate, not as a giant rewrite of a server that does not exist here.
