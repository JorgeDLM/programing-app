# Open Questions

## Confirmed facts

- `programing-app` contains runtime helpers in `scripts/`, `scripts/hooks/`, `scripts/lib/state-store/`, `scripts/lib/session-adapters/`, and `scripts/lib/tmux-worktree-orchestrator.js`.
- `agents/**/agent.md` are prompt definitions.
- `commands/*.md` are workflow/prompt instructions.
- No internal HTTP server or API endpoint was confirmed inside this repo.
- `seedPaths` already exists and is the best current primitive to evolve into working-set transport.

## No confirmado

- exact invocation path used today by `claude-dashboard` to consume `programing-app`
- whether the dashboard:
  - reads `agent.md` files directly
  - shells out to scripts in this repo
  - mirrors these assets elsewhere
  - or uses a separate runtime layer not present here
- whether there is already a private/out-of-repo retrieval/index service in your broader system
- whether `AI_CONTEXT` should be committed inside target repos or partially generated on demand and `.gitignore`d in some cases
- whether you want `data/project-cache/` versioned or ignored

## Supuestos used in this audit

- **Supuesto**: the future integration point from `claude-dashboard` can call local Node scripts or local modules from this repo.
- **Supuesto**: a repo-local cache under `programing-app/data/project-cache/` is acceptable for your workflow.
- **Supuesto**: `AI_CONTEXT/` should live inside target repos, not in `programing-app`.
- **Supuesto**: you prefer an incremental design that can later be called by a dashboard, rather than building a server in this repo immediately.

## Questions that materially affect implementation

- **[integration]**
  - Will `claude-dashboard` call this layer by:
    - importing Node modules
    - spawning CLI scripts
    - or via a future HTTP service?

- **[cache ownership]**
  - Do you want repo cache only in `programing-app`, or also mirrored into the target repo for portability?

- **[AI_CONTEXT ownership]**
  - Should `AI_CONTEXT` be user-editable source of truth, or generated-but-editable support docs?

- **[commit policy]**
  - Do you want `AI_CONTEXT` committed to git by default in target repos?

- **[task storage]**
  - Should `task-context/` and `task-artifacts/` be long-lived, or auto-pruned?

- **[dashboard contract]**
  - What exact payload can the dashboard provide at task start?
  - Example:
    - repo root
    - branch
    - selected files
    - user message
    - UI-selected task type

## Questions that do NOT block iteration 1

- final model mix for update/validation
- whether cache metadata eventually also lands in SQLite
- whether symbol extraction is AST-based or convention-based in v1

## Things I would not assume silently

- that `director-de-operaciones` already exists as executable runtime logic in this repo
- that current prompt workflows are enforced by code
- that `search_files` is an actual implemented tool in this repo
- that `claude-dashboard` already has a direct stable API contract with `programing-app`

## Recommended next clarification from you

If you want the implementation phase after this audit, the highest-value clarification is:

- **how you want `claude-dashboard` to invoke the new layer**
  - import modules
  - shell out to CLI
  - or future service

That single decision changes the thinnest safe integration shape.
