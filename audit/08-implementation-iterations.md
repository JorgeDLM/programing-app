# Implementation Iterations

## Iteration 1 — Base mínima sin romper nada

## Objective

Create the deterministic substrate for repo-aware context without changing current prompt flows yet.

## Files to create

- `scripts/lib/context/intent-normalizer.js`
- `scripts/lib/context/intent-rules.js`
- `scripts/lib/context/cache-paths.js`
- `scripts/lib/context/project-cache-store.js`
- `scripts/lib/context/repo-fingerprint.js`
- `scripts/lib/context/repo-index-service.js`
- `scripts/lib/context/repo-map-builders.js`
- `scripts/context-index.js`
- `scripts/context-prepare.js`

## Files to modify

- `package.json`
  - add scripts for indexing/preparation if desired
- `scripts/lib/project-detect.js`
  - only if extraction helpers should be reused/exported more cleanly

## Work order

1. create cache path conventions
2. build repo fingerprinting
3. build deterministic repo indexer
4. build intent normalizer
5. build context prepare CLI/service
6. output JSON only, no orchestration mutation yet

## Risks

- overscoping symbol extraction in v1
- trying to solve `AI_CONTEXT` generation too early

## Dependencies

- existing `project-detect.js`
- existing deterministic scan patterns from `scripts/codemaps/generate.ts`

## Definition of done

- can index a repo into `data/project-cache/<repo>/`
- can emit a deterministic prep payload for a task
- no current command/hook flow is broken

## Do NOT touch yet

- `agents/**/agent.md`
- `hooks/hooks.json`
- `AI_CONTEXT` auto-update
- dashboard integration contract

## Iteration 2 — Working sets and controlled expansion

## Objective

Make prepared context operational by enforcing working sets and expansion budgets.

## Files to create

- `scripts/lib/context/working-set-manager.js`
- `scripts/lib/context/working-set-budget.js`
- `scripts/lib/context/working-set-transport.js`
- `scripts/lib/context/context-expansion-service.js`
- `scripts/lib/context/expansion-policy.js`

## Files to modify

- `scripts/lib/tmux-worktree-orchestrator.js`
  - evolve `seedPaths` use into formal working-set transport
- `scripts/orchestrate-worktrees.js`
  - optionally accept prepared context / working-set payload
- future orchestration wrapper under `scripts/`

## Work order

1. define working-set schema
2. implement budgets by task type
3. map working set onto `seedPaths`
4. add expansion request/approval logic
5. add logging/artifacts for expansions

## Risks

- leaving expansion path too permissive
- making working sets optional

## Dependencies

- Iteration 1 cache + prep payload
- existing `seedPaths` mechanism

## Definition of done

- prepared tasks carry initial working set
- expansion is recorded and budgeted
- a task can proceed without repo-wide broad search by default

## Do NOT touch yet

- selective `AI_CONTEXT` updater
- doc rewrite automation
- heavy model routing changes

## Iteration 3 — `AI_CONTEXT` selective update and validation

## Objective

Add selective project-context maintenance only for meaningful changes.

## Files to create

- `scripts/lib/context/ai-context-files.js`
- `scripts/lib/context/context-impact-classifier.js`
- `scripts/lib/context/context-updater.js`
- `scripts/lib/context/context-validator.js`
- `scripts/lib/context/context-freshness.js`
- `scripts/context-update.js`
- `scripts/context-validate.js`

## Files to modify

- maybe `scripts/codemaps/generate.ts`
  - only if shared scanners/helpers are extracted

## Work order

1. define standard `AI_CONTEXT` metadata contract
2. build deterministic impact classifier from changed files
3. implement skip rules
4. implement selective updater
5. implement validator against diff + cache

## Risks

- doc churn
- accidental over-update
- weak validation leading to misleading docs

## Dependencies

- Iteration 1 repo cache
- Iteration 2 working-set and touched-file artifacts

## Definition of done

- updater can decide when to skip
- updater touches at most targeted docs
- validator can reject stale or unsupported updates

## Do NOT touch yet

- aggressive automatic hook-based updates
- full repo-wide `AI_CONTEXT` rewrites after every task

## Iteration 4 — Cost control, restrictions and ergonomics

## Objective

Integrate the layer into real task flows and reduce retrieval waste consistently.

## Files to create

- orchestration wrapper or adapter entrypoint under `scripts/`
- optional reporting script for cache health / expansion metrics

## Files to modify

- `commands/multi-plan.md`
- `commands/multi-execute.md`
- `commands/multi-workflow.md`
- possibly `agents/equipo-desarrollo/implementador/agent.md`
- possibly dashboard integration code outside this repo

## Work order

1. rewrite prompt docs to consume prepared context instead of broad search by default
2. add task-type budgets
3. add cache freshness reporting
4. tighten specialist search rules
5. define dashboard caller contract

## Risks

- prompt/runtime mismatch if prompts are updated before runtime contract exists
- external consumers still bypassing prep layer

## Dependencies

- Iteration 1-3 complete
- agreed caller contract from the dashboard side

## Definition of done

- new tasks enter through prepared context
- specialists operate on working sets first
- expansions are measurable
- `AI_CONTEXT` updates are selective and validated
- retrieval cost becomes observable and budgeted

## Do NOT touch yet

- rewriting all legacy commands at once
- replacing session store
- replacing worktree orchestrator

## Final sequencing recommendation

- **First** build deterministic substrate
- **Then** enforce working-set contract
- **Then** add selective context maintenance
- **Last** retrofit prompt workflows and dashboard ergonomics

Anything more ambitious than that becomes a rewrite, not an incremental integration.
