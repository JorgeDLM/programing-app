# File-by-File Plan

## Files to create

## `scripts/lib/context/intent-normalizer.js`

- Propósito: clasificar intención y riesgo base.
- Tipo: determinista.
- Razón: evitar gastar modelo antes de tiempo.

## `scripts/lib/context/intent-rules.js`

- Propósito: reglas declarativas para mapear task text a:
  - intent type
  - likely domains
  - write/read mode
  - initial budget class
- Tipo: determinista.

## `scripts/lib/context/cache-paths.js`

- Propósito: resolver paths bajo `data/project-cache/<repoSlug>/`.
- Tipo: determinista.

## `scripts/lib/context/project-cache-store.js`

- Propósito: lectura/escritura de cache técnica por repo.
- Tipo: determinista.

## `scripts/lib/context/repo-fingerprint.js`

- Propósito: hashes, mtimes, commit, fingerprint manifest.
- Tipo: determinista.

## `scripts/lib/context/repo-map-builders.js`

- Propósito: construir:
  - tree summary
  - module map
  - route map
  - api map
  - db map
  - symbols summary
- Tipo: determinista.

## `scripts/lib/context/repo-index-service.js`

- Propósito: coordinar indexación incremental de repo.
- Tipo: determinista.

## `scripts/lib/context/context-package-schema.js`

- Propósito: shape estable del output de `ContextPreparer`.
- Tipo: determinista.

## `scripts/lib/context/context-preparer.js`

- Propósito: ensamblar contexto preparado.
- Tipo: mixto, pero deterministic-first.

## `scripts/lib/context/context-preparer-ai.js`

- Propósito: resolver ambigüedad residual solo cuando haga falta.
- Tipo: AI opcional.

## `scripts/lib/context/working-set-budget.js`

- Propósito: budgets por tipo de tarea.
- Tipo: determinista.

## `scripts/lib/context/working-set-manager.js`

- Propósito: crear, persistir y ampliar working sets.
- Tipo: determinista.

## `scripts/lib/context/working-set-transport.js`

- Propósito: traducir `workingSet` a `seedPaths` y otros formatos.
- Tipo: determinista.

## `scripts/lib/context/expansion-policy.js`

- Propósito: reglas de aprobación/rechazo de expansión.
- Tipo: determinista.

## `scripts/lib/context/context-expansion-service.js`

- Propósito: aplicar política de expansión controlada.
- Tipo: determinista primero.

## `scripts/lib/context/ai-context-files.js`

- Propósito: resolver targets estándar de `AI_CONTEXT/`.
- Tipo: determinista.

## `scripts/lib/context/context-impact-classifier.js`

- Propósito: detectar qué docs de `AI_CONTEXT` podrían requerir update.
- Tipo: determinista.

## `scripts/lib/context/context-updater.js`

- Propósito: escribir updates selectivos a `AI_CONTEXT`.
- Tipo: mixto.

## `scripts/lib/context/context-validator.js`

- Propósito: validar doc update contra diff real y cache.
- Tipo: determinista.

## `scripts/lib/context/context-freshness.js`

- Propósito: marcar staleness, `basedOnCommit`, `lastUpdatedAt`.
- Tipo: determinista.

## `scripts/context-index.js`

- Propósito: CLI para indexar repos.
- Tipo: entrypoint.

## `scripts/context-prepare.js`

- Propósito: CLI para preparar contexto para una task.
- Tipo: entrypoint.

## `scripts/context-update.js`

- Propósito: CLI para actualizar `AI_CONTEXT` selectivamente.
- Tipo: entrypoint.

## `scripts/context-validate.js`

- Propósito: CLI para validar freshness/consistencia.
- Tipo: entrypoint.

## `data/project-cache/.gitkeep`

- Propósito: reservar root de cache local si decides versionarlo.
- **Supuesto**: quizá prefieras no versionar `data/`; si no se versiona, omitir.

## Files to modify

## `package.json`

- Agregar scripts opcionales como:
  - `context:index`
  - `context:prepare`
  - `context:update`
  - `context:validate`
- No tocar dependencias si no hace falta.

## `scripts/lib/project-detect.js`

- Solo si quieres exportar helpers reutilizables para el indexador.
- Mantener cambio mínimo.

## `scripts/lib/tmux-worktree-orchestrator.js`

- Reutilizar `seedPaths` como transporte de working set.
- No romper comportamiento actual de plan/worktree.

## `scripts/orchestrate-worktrees.js`

- Aceptar input enriquecido con working set preparado.
- Mantener compatibilidad con planes actuales.

## `commands/multi-plan.md`

- Reemplazar broad retrieval por consumo de contexto preparado.
- Mantener fallback explícito, no libre.

## `commands/multi-execute.md`

- Reemplazar quick retrieval amplio por working set + expansión controlada.

## `commands/multi-workflow.md`

- Ajustar fase research para que primero use `ContextPreparer`.

## `agents/equipo-desarrollo/implementador/agent.md`

- Eliminar dependencia implícita de `search_files` libre.
- Cambiar a “trabaja primero sobre working set”.
- Hacer esto solo cuando el runtime contract ya exista.

## `scripts/lib/state-store/migrations.js`

- **Opcional**.
- Solo si quieres agregar tablas para:
  - repo cache pointers
  - task context records
  - expansion logs
- Mi recomendación inicial: no tocarlo en iteración 1.

## `schemas/state-store.schema.json`

- **Opcional**.
- Solo si el state store se extiende.

## Files intentionally not modified in early iterations

- `scripts/hooks/session-start.js`
- `scripts/hooks/session-end.js`
- `scripts/hooks/cost-tracker.js`
- `scripts/lib/session-adapters/canonical-session.js`
- `scripts/lib/state-store/index.js`
- `.claude-plugin/plugin.json`

## Why avoid those early

- they already hold stable runtime responsibilities
- they are cross-cutting and easier to break
- they are not the first leverage point for repo retrieval efficiency

## Mapping old pieces to new layer

| Existing piece | Reuse strategy |
|---|---|
| `project-detect.js` | seed `project-profile.json` |
| `seedPaths` | transport `workingSet` |
| `canonical-session.js` | shape task/session artifacts |
| `state-store` | optional metadata bridge later |
| `codemaps/generate.ts` | borrow scanning patterns |
| `update-codemaps.md` | borrow freshness/diff policy ideas |

## Strong recommendation

Do not start by editing prompt files.

Start by creating the deterministic modules and CLIs first. Otherwise you will have a beautiful prompt story with no enforcement.
