# AI Context Rollout Audit — Phase 3

## 1. Executive summary

Iteration 3 quedó orientada a **mantenimiento selectivo y validado de `AI_CONTEXT`** encima de la base ya existente de Iteration 1 y 2.

Esta fase sí añadió:

- preflight backward-compatible de provenance/correlation
- postura explícita de contrato para `PreparedContextPackage`
- mapping estándar de archivos `AI_CONTEXT`
- classifier de impacto por diff
- freshness metadata por doc
- updater selectivo
- validator de contexto
- CLIs para update y validate
- tests dirigidos

Esta fase no añadió:

- integración con `commands/multi-plan.md`, `commands/multi-execute.md`, `commands/multi-workflow.md`
- enforcement runtime total de rediscovery
- reescritura repo-wide de `AI_CONTEXT`
- dashboard integration

## 2. Objetivo real implementado

Después de cambios relevantes en código, el stack ahora puede:

- decidir si un cambio merece update de contexto
- inferir qué docs concretos de `AI_CONTEXT` son targets
- actualizar sólo esos docs
- adjuntar metadata de freshness/provenance por doc
- validar que el doc actualizado corresponde al diff y al repo actual

## 3. Preflight implementado antes del updater/validator

### 3.1 Provenance / correlation

Se endureció la correlación entre:

- `task-context`
- `workingSet`
- expansion logs
- update logs de `AI_CONTEXT`

Metadata mínima normalizada:

- `taskContextId`
- `workingSetId`
- `repoSlug`
- `basedOnCommit`
- `createdAt`
- `updatedAt`
- `provenance`

## 3.2 Contract normalization

Se dejó explícito que:

- `workingSet.budget` es el source of truth operativo
- `workingSet.allowedExpansion` es la vista simple de permisos
- `PreparedContextPackage.allowedExpansion` se mantiene por compatibilidad como alias derivado
- `allowedExpansionSource` queda fijado a `workingSet.budget`

## 3.3 Schema/version stance

Se decidió **no romper compatibilidad**.

Estrategia aplicada:

- se mantiene `ecc.context-package.v1`
- se añade `schemaStrategy: v1_extended_backward_compatible`
- se normalizan metadatos faltantes mediante fallback razonable

## 4. Archivos creados en Iteration 3

- `scripts/lib/context/ai-context-files.js`
- `scripts/lib/context/context-impact-classifier.js`
- `scripts/lib/context/context-freshness.js`
- `scripts/lib/context/context-updater.js`
- `scripts/lib/context/context-validator.js`
- `scripts/context-update.js`
- `scripts/context-validate.js`
- `tests/lib/context-maintenance.test.js`

## 5. Archivos modificados en Iteration 3

- `scripts/lib/context/context-package-schema.js`
- `scripts/lib/context/context-preparer.js`
- `scripts/lib/context/working-set-manager.js`
- `scripts/lib/context/context-expansion-service.js`
- `scripts/lib/context/project-cache-store.js`
- `package.json`
- `tests/lib/context-layer.test.js`

## 6. Responsabilidad por archivo

### `scripts/lib/context/ai-context-files.js`

Contrato central de docs `AI_CONTEXT`.

Expone:

- `getStandardAiContextFiles()`
- `resolveAiContextPath(repoRoot, docName)`
- `mapDomainToPrimaryDocs(domain)`
- `isAiContextFile(path)`
- `getDefaultDocTargetsForImpact(impact)`

Mapeo implementado:

- frontend -> `AI_CONTEXT/04-FRONTEND.md`
- backend -> `AI_CONTEXT/03-BACKEND.md`
- data -> `AI_CONTEXT/05-DATA-MODELS.md`
- api -> `AI_CONTEXT/06-API-CONTRACTS.md`
- architecture -> `AI_CONTEXT/02-ARCHITECTURE.md`
- decision -> `AI_CONTEXT/07-DECISIONS-ADR.md`
- recent changes -> `AI_CONTEXT/08-RECENT-CHANGES.md`

### `scripts/lib/context/context-impact-classifier.js`

Clasifica impacto usando:

- changed files
- resumen de diff / patch excerpt
- `PreparedContextPackage`
- `WorkingSet`
- `indexPayload`

Produce:

- `hasMeaningfulImpact`
- `impactLevel`
- `domains`
- `docTargets`
- `needsAdrUpdate`
- `needsRecentChangesUpdate`
- `shouldSkipUpdate`
- `skipReason`
- `basedOnCommit`
- `evidence.changedFiles`
- `evidence.signals`
- `evidence.fileClassifications`

### `scripts/lib/context/context-freshness.js`

Gestiona metadata y secciones controladas dentro de cada doc target.

Añade/utiliza:

- `## Context Freshness`
- `## Selective Sync`
- `## Latest Selective Update`
- `## Pending ADR Follow-up`

### `scripts/lib/context/context-updater.js`

Hace update selectivo de docs target.

Comportamiento real:

- resuelve impacto
- deriva `docTargets`
- actualiza sólo los docs mínimos
- inserta freshness metadata
- inserta sección de selective sync
- persiste artifact `ai-context-update`

### `scripts/lib/context/context-validator.js`

Valida que los docs target sigan alineados con:

- commit base
- `taskContextId`
- `workingSetId`
- `changedFiles`
- presencia de freshness metadata
- presencia de sección selectiva esperada

### `scripts/context-update.js`

CLI para update selectivo.

Inputs soportados:

- `--repo`
- `--prepared-context`
- `--changed-files`
- `--changed-files-file`
- `--doc-targets`
- `--diff-summary`
- `--patch-file`
- `--cache-root`
- `--write`
- `--force-refresh`
- `--no-persist`
- `--based-on-commit`
- `--task-context-id`
- `--working-set-id`

Fallback:

- si no se pasan changed files, usa `getGitModifiedFiles()`

### `scripts/context-validate.js`

CLI equivalente para validación.

## 7. Cambios concretos al contrato existente

### `PreparedContextPackage`

Sigue en `ecc.context-package.v1`, pero ahora se normaliza y valida con:

- `schemaStrategy`
- `taskContextId`
- `workingSetId`
- `repoSlug`
- `basedOnCommit`
- `updatedAt`
- `allowedExpansionSource`
- `provenance`

### `WorkingSet`

Ahora se espera/normaliza con:

- `taskContextId`
- `basedOnCommit`
- `createdAt`
- `updatedAt`
- `provenance`

### Expansion logs

Ahora cargan correlación explícita con:

- `taskContextId`
- `workingSetId`
- `basedOnCommit`

## 8. Freshness / provenance metadata por doc

Cada doc actualizado selectivamente puede contener metadata tipo:

```json
{
  "schemaVersion": "ecc.context-freshness.v1",
  "docPath": "AI_CONTEXT/06-API-CONTRACTS.md",
  "repoSlug": "repo",
  "basedOnCommit": "abc123",
  "taskContextId": "task-context-...",
  "workingSetId": "ws-...",
  "updatedAt": "2026-03-21T00:00:00.000Z",
  "impactLevel": "high",
  "domains": ["api", "data"],
  "sourcePaths": [
    "app/api/billing/route.ts",
    "prisma/schema.prisma"
  ],
  "signals": [
    "api_route_changed",
    "data_model_changed"
  ],
  "docTargets": [
    "AI_CONTEXT/06-API-CONTRACTS.md",
    "AI_CONTEXT/05-DATA-MODELS.md",
    "AI_CONTEXT/08-RECENT-CHANGES.md"
  ],
  "generatedBy": "context-updater"
}
```

## 9. Validación implementada

El validator revisa:

- doc conocido de `AI_CONTEXT`
- existencia del archivo
- `Context Freshness` presente y parseable
- sección selectiva correspondiente presente
- coincidencia de `docPath`
- coincidencia de `basedOnCommit`
- coincidencia de `taskContextId`
- coincidencia de `workingSetId`
- intersección razonable entre `changedFiles` y `sourcePaths`

## 10. Reglas de no inflación aplicadas

Para evitar inflar `AI_CONTEXT` innecesariamente:

- si no hay changed files -> skip
- si sólo cambió `AI_CONTEXT` -> skip
- si sólo cambian tests/docs sin impacto real -> skip
- `02-ARCHITECTURE.md` no se targetea sólo por impacto alto genérico
- `02-ARCHITECTURE.md` se targetea sólo con señal arquitectónica real
- `08-RECENT-CHANGES.md` sí se actualiza cuando el cambio es meaningful

## 11. Comandos disponibles

```bash
npm run context:update
npm run context:validate
```

Ejemplos directos:

```bash
node scripts/context-update.js --repo . --changed-files "app/api/billing/route.ts,prisma/schema.prisma"
```

```bash
node scripts/context-validate.js --repo . --changed-files "app/api/billing/route.ts,prisma/schema.prisma"
```

## 12. Tests y verificación ejecutada

Lint dirigido ejecutado:

```bash
npx eslint scripts/lib/context/*.js scripts/context-update.js scripts/context-validate.js tests/lib/context-layer.test.js tests/lib/context-maintenance.test.js
```

Tests ejecutados:

```bash
node tests/lib/context-layer.test.js
node tests/lib/context-maintenance.test.js
```

Cobertura concreta comprobada:

- provenance/correlation del package y expansion logs
- alias `allowedExpansion` derivado de `workingSet.budget`
- mapping estándar de `AI_CONTEXT`
- classifier de impacto
- updater selectivo
- validator
- parse de argumentos de CLIs
- ejecución real de CLIs `context-update` y `context-validate`

## 13. Gaps que siguen abiertos después de Iteration 3

- no hay integración aún con `multi-*`
- no existe enforcement runtime total del rediscovery del worker
- el updater hace mantenimiento selectivo mínimo, no síntesis semántica profunda de cada doc
- no hay reconciliación automática entre contenido previo del doc y cambios arquitectónicos complejos
- `AI_CONTEXT/07-DECISIONS-ADR.md` sigue marcado con seguimiento manual recomendado, no con generación ADR formal

## 14. Veredicto

Estado final de Iteration 3:

**IMPLEMENTED_WITH_INTENTIONAL_LIMITS**

Lectura práctica:

- sí quedó resuelto el maintenance stack selectivo y validado
- sí quedaron los preflights pedidos
- no se invadieron `multi-*`
- no se metió enforcement runtime total
- la fase quedó consistente con el alcance que pediste
