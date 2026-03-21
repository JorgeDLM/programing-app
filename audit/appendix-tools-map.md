# Appendix — Tools Map

## Important distinction

This appendix separates:

- tools described in prompts
- deterministic helpers actually implemented in code
- runtime control points where retrieval can be restricted

## 1. Prompt-level tools declared in agent/command files

## Broad repo exploration tools referenced repeatedly

- `Glob`
- `Grep`
- `Read`
- `Task` / Explore
- `Bash`
- optional MCP:
  - `mcp__ace-tool__search_context`
  - `mcp__ace-tool__enhance_prompt`

## Main files that encourage their use

- `commands/multi-plan.md`
- `commands/multi-execute.md`
- `commands/multi-workflow.md`
- `agents/equipo-desarrollo/implementador/agent.md`

## 2. Deterministic helper functions actually implemented in repo code

## `scripts/lib/utils.js`

### File and search helpers

- `findFiles(dir, pattern, options)`
- `readFile(filePath)`
- `writeFile(filePath, content)`
- `appendFile(filePath, content)`
- `replaceInFile(filePath, search, replace, options)`
- `countInFile(filePath, pattern)`
- `grepFile(filePath, pattern)`

### System helpers

- `runCommand(cmd, options)`
- `commandExists(cmd)`
- `isGitRepo()`
- `getGitModifiedFiles(patterns)`

### Context/session helpers

- `getSessionsDir()`
- `getLearnedSkillsDir()`
- `getSessionIdShort()`
- `getProjectName()`
- `readStdinJson()`

## What this means

There is no single repo-aware `search_files` implementation here.

The closest code-level equivalents are:

- `findFiles()`
- `grepFile()`
- `readFile()`
- plus harness-native `Glob/Grep/Read` when these prompts run in Claude Code

## 3. Worktree/task-scoping tools already present

## `scripts/lib/tmux-worktree-orchestrator.js`

Relevant functions:

- `normalizeSeedPaths(seedPaths, repoRoot)`
- `overlaySeedPaths({ repoRoot, seedPaths, worktreePath })`
- `buildOrchestrationPlan(config)`
- `executePlan(plan)`

## Why these matter

This is the strongest existing foundation for a future working-set system because it already:

- validates repo-relative paths
- rejects path escape outside repo root
- transports a bounded set of files/dirs into worker environments

## 4. Session and snapshot tools

## `scripts/lib/orchestration-session.js`

Relevant functions:

- `loadWorkerSnapshots(coordinationDir)`
- `buildSessionSnapshot(...)`
- `collectSessionSnapshot(targetPath, cwd)`

## `scripts/lib/session-adapters/*.js`

Relevant adapters:

- `claude-history`
- `dmux-tmux`

## `scripts/lib/session-adapters/canonical-session.js`

Relevant functions:

- `normalizeDmuxSnapshot()`
- `normalizeClaudeHistorySession()`
- `persistCanonicalSnapshot()`

## Why these matter

They are good places to persist task-artifact references and later correlate expansions/working sets.

## 5. Persistence tools

## `scripts/lib/state-store/index.js`

- `createStateStore()`
- `resolveStateStorePath()`

## `scripts/lib/state-store/queries.js`

- `upsertSession()`
- `insertSkillRun()`
- `insertDecision()`
- `upsertInstallState()`
- `insertGovernanceEvent()`
- `getStatus()`
- `getSessionDetail()`

## Why these matter

If you later want:

- repo-level analytics
- task-context references
- expansion logs
- context freshness events

this is the structured persistence layer to extend, not replace.

## 6. Hooks that affect context/cost today

## `hooks/hooks.json`

Key events:

- `SessionStart`
- `PreToolUse`
- `PostToolUse`
- `Stop`
- `SessionEnd`

## Relevant hook scripts

- `scripts/hooks/session-start.js`
- `scripts/hooks/session-end.js`
- `scripts/hooks/cost-tracker.js`
- `scripts/hooks/evaluate-session.js`
- `scripts/hooks/suggest-compact.js`
- `scripts/hooks/pre-compact.js`

## Why these matter

They already capture:

- session continuity
- compaction hints
- token/cost metrics
- modified files in transcripts

but they do not yet enforce repo-scoped retrieval.

## 7. Tools most responsible for cost today

## High-cost retrieval pattern

Prompt-level tools used broadly and repeatedly:

- `Glob`
- `Grep`
- `Read`
- `Task` / Explore
- `mcp__ace-tool__search_context`

## Why costly

- they are invoked before working sets exist
- they can recurse
- they are repeated across planning, execution and review

## 8. Best future control points

## Restrict broad search

Best future control point:

- a wrapper service before prompts/tool use are assembled

Second-best:

- route all worker/task creation through prepared context and `seedPaths`

## Enforce working set

Best future control point:

- `WorkingSetManager` -> `seedPaths` transport

## Expansion control

Best future control point:

- central service/module, not a free specialist tool

## Context update

Best future control point:

- post-change CLI/service, not generic Stop hook at first

## Final conclusion

The repo already has many low-level primitives.

What it does not have is a single tool or service that says:

- here is the repo cache
- here is the initial working set
- here are your budgets
- here is how to expand safely

That missing contract is the real gap.
