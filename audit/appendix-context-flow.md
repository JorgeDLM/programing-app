# Appendix — Context Flow

## Goal of this appendix

Explain how context flows today in `programing-app`, where it is lost, where it is duplicated, and where the new layer should intercept it.

## Current context flow

## Layer 1 — Session continuity context

### Source

- `scripts/hooks/session-start.js`
- `scripts/hooks/session-end.js`
- `scripts/lib/session-manager.js`
- `scripts/lib/session-aliases.js`

### What flows

- previous session summary
- project type detection
- notes for next session
- context-to-load block from session tmp files

### Strength

- cheap
- cross-session continuity exists
- useful for recent work recall

### Weakness

- not repo-structured
- not task-scoped enough
- not validated against current codebase state
- easy to become stale or generic

## Layer 2 — Prompt-level retrieval context

### Source

- `commands/multi-plan.md`
- `commands/multi-execute.md`
- `commands/multi-workflow.md`
- `agents/equipo-desarrollo/implementador/agent.md`

### What flows

- broad repo search results
- discovered files
- ad hoc excerpts
- recursive retrieval outputs

### Strength

- flexible
- can discover unknown areas

### Weakness

- most expensive layer
- repeated across phases
- not bounded by prior prepared context
- not persisted as reusable repo intelligence

## Layer 3 — Orchestrated worker context

### Source

- `scripts/lib/tmux-worktree-orchestrator.js`
- `scripts/lib/orchestration-session.js`

### What flows

- worker task
- `seedPaths`
- status
- handoff summary
- worktree path
- repo root

### Strength

- explicit artifact files
- path-bounded seed overlay exists
- best current basis for working-set transport

### Weakness

- `seedPaths` are optional and caller-supplied
- no automatic generation from a repo cache or prep stage
- no budget or expansion model

## Layer 4 — Canonical snapshot context

### Source

- `scripts/lib/session-adapters/canonical-session.js`
- `scripts/lib/session-adapters/claude-history.js`
- `scripts/lib/session-adapters/dmux-tmux.js`

### What flows

- normalized session state
- worker intents
- worker outputs
- artifacts
- aggregates
- repo root metadata

### Strength

- machine-readable
- reusable for future task artifact storage

### Weakness

- happens after or around execution snapshots
- not used as a prepared repo context source before task execution

## Where context is lost

## 1. Between session summary and actual repo state

- `session-end.js` records summaries from transcript
- but there is no check against current repo diff, commit, or file freshness

Result:

- session memory may help narrative continuity
- but not precise repo understanding

## 2. Between plan generation and execution

- `multi-plan` discovers context broadly
- `multi-execute` retrieves again instead of consuming a persisted prepared context object

Result:

- context discovered during planning is not promoted into a stable reusable artifact

## 3. Between worker handoff and future tasks

- worker artifacts exist in coordination dirs
- but they are not promoted into a repo-level task artifact cache by default

Result:

- useful findings can remain stranded in per-session folders

## Where context is duplicated

## 1. Planning retrieval vs execution retrieval

- `multi-plan.md` Phase 1
- `multi-execute.md` Phase 1

This is the clearest duplication.

## 2. Research workflow vs implementation workflow

- `multi-workflow.md` research phase
- `implementador` search behavior

The implementation role can rediscover what research already found.

## 3. Review phase rereads adjacent code

- `code-reviewer` correctly rereads surroundings
- but with no prepared touched-file package, it still performs another local discovery pass

## Where context should be intercepted in the new design

## Intercept 1 — Before broad retrieval starts

### Why

This is the highest-cost point.

### What to inject

- normalized intent
- repo cache summary
- `AI_CONTEXT/00-START-HERE.md`
- recommended docs
- initial working set
- budget envelope

### Target abstraction

- `ContextPreparer`

## Intercept 2 — Before worker launch

### Why

This is where context can become enforceable rather than advisory.

### What to inject

- `workingSet.files` -> `seedPaths`
- task artifact references
- allowed expansion policy

### Target abstraction

- `WorkingSetManager`
- `working-set-transport`

## Intercept 3 — When a specialist asks for more context

### Why

Without this, free broad search returns.

### What to enforce

- reason for expansion
- budget check
- delta-only additions
- expansion log

### Target abstraction

- `ContextExpansionService`

## Intercept 4 — After meaningful code changes

### Why

To prevent `AI_CONTEXT` drift while avoiding unnecessary updates.

### What to use

- changed files
- git diff
- working set
- task intent
- repo cache

### Target abstraction

- `ContextImpactClassifier`
- `ContextUpdater`
- `ContextValidator`

## Recommended steady-state context flow

```text
Task input
  -> IntentNormalizer
  -> ContextPreparer
      -> Repo cache
      -> AI_CONTEXT start doc
      -> Previous task artifacts
  -> WorkingSetManager
  -> Director / planner
  -> Specialists on working set only
  -> Controlled expansion if needed
  -> Code changes
  -> Context impact classification
  -> Selective AI_CONTEXT update
  -> Validation
  -> Persist task artifacts
```

## Summary of losses/duplications

- **Lost**
  - plan-time discoveries are not promoted into reusable repo artifacts
  - session summaries are not commit-aware
  - worker findings are not turned into repo cache intelligence

- **Duplicated**
  - planning retrieval
  - execution retrieval
  - review rereads without prepared touched-file package

- **Best interception points**
  - before broad retrieval
  - before worker launch
  - on expansion request
  - after meaningful diff

## Final conclusion

Current context flow is good enough for session continuity and lightweight orchestration, but not for efficient multi-repo local work at scale.

The missing piece is a prepared, reusable, repo-scoped context contract that sits before exploration, not after it.
