# AI Context Rollout Audit — Phases 1 & 2

## 1. Executive summary

Se implementó una capa determinista de contexto bajo `scripts/lib/context/` y una fase operativa de `workingSet` + expansión controlada reutilizando `seedPaths` del orquestador existente.

Sí cumple:

- indexación determinista por repo bajo `data/project-cache/<repoSlug>/`
- `NormalizedIntent`
- `PreparedContextPackage`
- `WorkingSet` formal persistido como artifact
- transporte de `WorkingSet` hacia workers vía `seedPaths`
- política de expansión con budget y rechazo de repo-wide por default
- logging persistido de expansiones aprobadas y rechazadas
- backward compatibility con planes viejos de orquestación sin `preparedContext`

No cumple todavía:

- no hay integración full con `commands/multi-plan.md`, `commands/multi-execute.md`, `commands/multi-workflow.md`
- no existe loop runtime que intercepte cada intento de rediscovery del worker y lo fuerce a pasar por `context-expansion-service`
- `AI_CONTEXT` updater/validator no fue tocado
- el top-level `allowedExpansion` del `PreparedContextPackage` sigue duplicando el estado que realmente vive en `workingSet.budget`

Veredicto actual para Iteration 3: `READY_WITH_GAPS`.

Motivo: la base operativa ya existe y el enforcement mínimo ya corre en orquestación basada en `orchestrate-worktrees`, pero todavía faltan puntos de acoplamiento con flows más altos para que el sistema completo deje de depender de adopción manual del `preparedContext`.

## 2. Iteration 1 implemented scope

### Archivos creados

- `scripts/lib/context/cache-paths.js`
  - paths deterministas para cache por repo, task-context y task-artifacts
- `scripts/lib/context/project-cache-store.js`
  - store de JSON para index, task-context y task-artifacts
- `scripts/lib/context/repo-fingerprint.js`
  - fingerprint de repo, files, hashes y commit actual
- `scripts/lib/context/intent-rules.js`
  - clasificación base de intención, scope, riesgo y domains
- `scripts/lib/context/intent-normalizer.js`
  - wrapper estable para producir `NormalizedIntent`
- `scripts/lib/context/context-package-schema.js`
  - validación del envelope `PreparedContextPackage`
- `scripts/lib/context/repo-map-builders.js`
  - tree summary, modules, routes, api map, db map, symbols map
- `scripts/lib/context/repo-index-service.js`
  - indexación deterministic-first con reuse de cache
- `scripts/lib/context/context-preparer-ai.js`
  - stub/fallback acotado de refinamiento AI
- `scripts/lib/context/context-preparer.js`
  - preparación principal del contexto
- `scripts/context-index.js`
  - CLI de indexación
- `scripts/context-prepare.js`
  - CLI de preparación
- `tests/lib/context-layer.test.js`
  - test dirigido de la nueva capa

### Archivos modificados

- `package.json`
  - scripts npm y `files` para distribución
- `scripts/lib/context/context-preparer.js`
  - extendido para leer session artifacts canónicos y luego para usar `WorkingSetManager`
- `tests/lib/context-layer.test.js`
  - ampliado durante el cierre de la fase

### Responsabilidades implementadas por archivo

- `cache-paths.js`
  - resuelve `repoSlug`, cache root, `task-context/`, `task-artifacts/`
- `project-cache-store.js`
  - persistencia y rehidratación básica de artifacts JSON
- `repo-index-service.js`
  - produce `repoMeta`, `fingerprints`, `projectProfile`, `treeSummary`, `modules`, `routes`, `apiMap`, `dbMap`, `symbols`
- `context-preparer.js`
  - combina intent + index + AI_CONTEXT + artifacts previos en un paquete preparado

### Desviaciones respecto al plan original

- `ContextPreparer` quedó enriquecido antes de cerrar Iteration 1 para reutilizar session artifacts desde el recording dir, no solo desde `task-context/`
- el schema del paquete no se versionó a `v2`; se mantuvo `ecc.context-package.v1` y se amplió su validación

## 3. Iteration 2 implemented scope

### Archivos creados

- `scripts/lib/context/working-set-budget.js`
- `scripts/lib/context/working-set-manager.js`
- `scripts/lib/context/working-set-transport.js`
- `scripts/lib/context/expansion-policy.js`
- `scripts/lib/context/context-expansion-service.js`

### Archivos modificados

- `scripts/lib/context/context-preparer.js`
  - ahora construye `WorkingSet` formal con reasons, budget y metadata
- `scripts/lib/context/context-package-schema.js`
  - ahora valida shapes ricos de `WorkingSet` y budget
- `scripts/lib/tmux-worktree-orchestrator.js`
  - integra `preparedContext` / `workingSet` y lo transporta por `seedPaths`
- `scripts/orchestrate-worktrees.js`
  - dry-run ahora muestra `workingSetId`, budget y allowed expansion por worker
- `tests/lib/context-layer.test.js`
  - valida budgets, `WorkingSet`, transporte y expansión aprobada/rechazada
- `tests/lib/tmux-worktree-orchestrator.test.js`
  - valida aplicación de `preparedContext.workingSet` a workers vía `seedPaths`

### Responsabilidades implementadas por archivo

- `working-set-budget.js`
  - profiles deterministas:
    - `audit_quick`
    - `audit_focused`
    - `bugfix`
    - `feature`
    - `refactor`
    - `research`
    - `unknown`
  - helpers:
    - `getBudgetForIntent(intentType, normalizedIntent?)`
    - `clampBudgetToPolicy(input)`
    - `createBudgetState(...)`
- `working-set-manager.js`
  - creación, normalización, budget actual, reasons, persistencia, expansión y rehidratación
- `working-set-transport.js`
  - convierte `WorkingSet` en `seedPaths` reutilizando `normalizeSeedPaths`
- `expansion-policy.js`
  - decisión de aprobación/rechazo, budget delta, bloqueo repo-wide default, bloqueo cross-domain no autorizado, wildcard rejection
- `context-expansion-service.js`
  - recolecta candidatos, llama política, actualiza `WorkingSet`, persiste expansion logs y devuelve resultado explícito
- `tmux-worktree-orchestrator.js`
  - si recibe `preparedContext` o `workingSet`, impone el `WorkingSet` en cada worker sin abrir un canal paralelo de transporte

### Desviaciones respecto al plan original

- el `NormalizedIntent` sigue produciendo `intentType: 'audit'`; la distinción `audit_quick` vs `audit_focused` se resuelve en `working-set-budget.js`, no en el intent normalizer
- el top-level `allowedExpansion` del paquete preparado es el budget state completo, no solo el bloque booleano de permisos
- el enforcement de expansión existe como servicio y contrato, pero no se inyectó todavía en los prompts ni en los comandos `multi-*`

## 4. Final contract shapes

### 4.1 `NormalizedIntent`

Shape real implementado:

```json
{
  "intentType": "bugfix",
  "riskLevel": "medium",
  "expectedDomains": ["backend", "api"],
  "requiresWrite": true,
  "likelyScope": "narrow",
  "ambiguity": "low",
  "initialBudgetClass": "small"
}
```

Notas:

- `audit_quick` y `audit_focused` no salen aquí como `intentType`
- esa subdivisión ocurre después, al construir budgets

### 4.2 `PreparedContextPackage`

Shape real implementado:

```json
{
  "schemaVersion": "ecc.context-package.v1",
  "createdAt": "2026-03-20T23:00:00.000Z",
  "repo": {
    "root": "C:/repo",
    "slug": "repo",
    "cacheDir": "C:/repo/data/project-cache/repo"
  },
  "intentType": "feature",
  "riskLevel": "medium",
  "expectedDomains": ["backend", "api", "data"],
  "requiresWrite": true,
  "likelyScope": "medium",
  "ambiguity": "low",
  "initialBudgetClass": "medium",
  "scopeHypothesis": "feature:backend+api+data",
  "recommendedDocs": [
    "AI_CONTEXT/00-START-HERE.md",
    "AI_CONTEXT/03-BACKEND.md",
    "AI_CONTEXT/06-API-CONTRACTS.md"
  ],
  "workingSet": {
    "schemaVersion": "ecc.working-set.v2",
    "workingSetId": "ws-1710990000000-a1b2c3d4e5f6",
    "id": "ws-1710990000000-a1b2c3d4e5f6",
    "repoSlug": "repo",
    "repo": {
      "root": "C:/repo",
      "slug": "repo",
      "cacheDir": "C:/repo/data/project-cache/repo"
    },
    "intentType": "feature",
    "scopeHypothesis": "feature:backend+api+data",
    "files": [
      "app/api/users/route.ts",
      "prisma/schema.prisma"
    ],
    "docs": [
      "AI_CONTEXT/00-START-HERE.md",
      "AI_CONTEXT/03-BACKEND.md",
      "AI_CONTEXT/06-API-CONTRACTS.md"
    ],
    "artifacts": [
      "task-context-...",
      "task-artifact-..."
    ],
    "relatedArtifacts": [
      "task-context-...",
      "task-artifact-..."
    ],
    "reasons": [
      {
        "path": "app/api/users/route.ts",
        "reason": "scope_hypothesis_api"
      },
      {
        "path": "prisma/schema.prisma",
        "reason": "scope_hypothesis_data"
      }
    ],
    "seedPaths": [
      "app/api/users/route.ts",
      "prisma/schema.prisma",
      "AI_CONTEXT/00-START-HERE.md",
      "AI_CONTEXT/03-BACKEND.md",
      "AI_CONTEXT/06-API-CONTRACTS.md"
    ],
    "budget": {
      "schemaVersion": "ecc.working-set-budget.v2",
      "profileName": "feature",
      "budgetClass": "medium",
      "intentType": "feature",
      "broadSearchesMax": 3,
      "broadSearchesUsed": 0,
      "broadSearchesRemaining": 3,
      "initialFilesMax": 15,
      "initialFilesLimit": 15,
      "expansionsMax": 3,
      "expansionsUsed": 0,
      "expansionsRemaining": 3,
      "totalFilesMax": 28,
      "maxFiles": 28,
      "currentFilesCount": 2,
      "repoWideExpansionAllowed": false,
      "crossDomainExpansionAllowed": "true_if_plan_says_fullstack",
      "neighborCallsiteExpansionAllowed": true,
      "allowedExpansion": {
        "repoWide": false,
        "crossDomain": true,
        "neighborCallsite": true
      }
    },
    "allowedExpansion": {
      "repoWide": false,
      "crossDomain": true,
      "neighborCallsite": true
    },
    "taskMetadata": {
      "taskId": null,
      "taskText": "Implement a new API endpoint for user billing and persist the data model changes",
      "callerMetadata": {}
    },
    "createdAt": "2026-03-20T23:00:00.000Z"
  },
  "allowedExpansion": {
    "schemaVersion": "ecc.working-set-budget.v2",
    "profileName": "feature",
    "budgetClass": "medium",
    "intentType": "feature",
    "broadSearchesMax": 3,
    "broadSearchesUsed": 0,
    "broadSearchesRemaining": 3,
    "initialFilesMax": 15,
    "initialFilesLimit": 15,
    "expansionsMax": 3,
    "expansionsUsed": 0,
    "expansionsRemaining": 3,
    "totalFilesMax": 28,
    "maxFiles": 28,
    "currentFilesCount": 2,
    "repoWideExpansionAllowed": false,
    "crossDomainExpansionAllowed": "true_if_plan_says_fullstack",
    "neighborCallsiteExpansionAllowed": true,
    "allowedExpansion": {
      "repoWide": false,
      "crossDomain": true,
      "neighborCallsite": true
    }
  },
  "confidence": 0.75,
  "needsDiscovery": false,
  "cache": {
    "hit": false,
    "indexVersion": "ecc.repo-index.v1",
    "basedOnCommit": "unknown",
    "lastIndexedAt": "2026-03-20T23:00:00.000Z"
  },
  "artifacts": {
    "previousTaskContexts": [],
    "previousTaskArtifacts": [
      "ws-1710990000000-a1b2c3d4e5f6"
    ],
    "previousSessionArtifacts": []
  }
}
```

Diferencia respecto a lo esperado:

- `allowedExpansion` no es solo un bloque booleano; hoy es el budget state completo
- el estado autorizado de expansión más simple vive en `workingSet.allowedExpansion`

### 4.3 `WorkingSet`

Shape real implementado:

```json
{
  "schemaVersion": "ecc.working-set.v2",
  "workingSetId": "ws-1710990000000-a1b2c3d4e5f6",
  "repoSlug": "repo",
  "intentType": "bugfix",
  "files": [
    "src/foo.ts",
    "src/bar.ts"
  ],
  "docs": [
    "AI_CONTEXT/00-START-HERE.md"
  ],
  "artifacts": [],
  "reasons": [
    {
      "path": "src/foo.ts",
      "reason": "mentioned_in_task"
    },
    {
      "path": "src/bar.ts",
      "reason": "scope_hypothesis"
    }
  ],
  "seedPaths": [
    "src/foo.ts",
    "src/bar.ts",
    "AI_CONTEXT/00-START-HERE.md"
  ],
  "budget": {
    "broadSearchesMax": 2,
    "broadSearchesUsed": 0,
    "broadSearchesRemaining": 2,
    "expansionsMax": 2,
    "expansionsUsed": 0,
    "expansionsRemaining": 2,
    "totalFilesMax": 18,
    "currentFilesCount": 2
  },
  "allowedExpansion": {
    "repoWide": false,
    "crossDomain": false,
    "neighborCallsite": true
  },
  "createdAt": "2026-03-20T23:00:00.000Z"
}
```

Notas:

- además incluye `repo`, `scopeHypothesis`, `relatedArtifacts`, `taskMetadata`
- el sistema conserva `id` como alias de compatibilidad para `workingSetId`

### 4.4 `ExpansionDecision`

Shape real implementado:

```json
{
  "schemaVersion": "ecc.context-expansion-policy.v2",
  "approved": true,
  "deniedReason": null,
  "reason": "Need UI callsite impacted by the API change",
  "request": {
    "mode": "narrow",
    "domains": ["frontend"],
    "paths": ["src/components/user-card.tsx"],
    "reason": "Need UI callsite impacted by the API change"
  },
  "additions": {
    "files": ["src/components/user-card.tsx"],
    "docs": [],
    "relatedArtifacts": [],
    "reasons": [
      {
        "path": "src/components/user-card.tsx",
        "reason": "explicit_path_request"
      }
    ]
  },
  "budgetDelta": {
    "broadSearchesUsedDelta": 0,
    "expansionsUsedDelta": 1,
    "filesAdded": 1
  },
  "nextBudget": {
    "broadSearchesRemaining": 2,
    "expansionsRemaining": 2,
    "currentFilesCount": 3
  }
}
```

Rechazo real posible:

```json
{
  "schemaVersion": "ecc.context-expansion-policy.v2",
  "approved": false,
  "deniedReason": "repo-wide-expansion-not-allowed-by-default",
  "request": {
    "mode": "repo-wide",
    "domains": ["backend", "frontend"],
    "paths": []
  },
  "additions": {
    "files": [],
    "docs": [],
    "relatedArtifacts": [],
    "reasons": []
  },
  "budgetDelta": {
    "broadSearchesUsedDelta": 0,
    "expansionsUsedDelta": 0,
    "filesAdded": 0
  }
}
```

### 4.5 `ExpansionResult`

Shape real implementado:

```json
{
  "schemaVersion": "ecc.context-expansion.v2",
  "approved": true,
  "deniedReason": null,
  "decision": {
    "approved": true
  },
  "expansionLogId": "expansion-log-1710990000000-abcdef123456",
  "result": {
    "workingSetId": "ws-1710990000000-a1b2c3d4e5f6",
    "addedFiles": ["src/components/user-card.tsx"],
    "addedDocs": [],
    "budgetDelta": {
      "broadSearchesUsedDelta": 0,
      "expansionsUsedDelta": 1,
      "filesAdded": 1
    },
    "updatedBudget": {
      "expansionsRemaining": 2,
      "currentFilesCount": 3
    }
  },
  "preparedContext": {
    "workingSet": {
      "files": [
        "app/api/users/route.ts",
        "prisma/schema.prisma",
        "src/components/user-card.tsx"
      ]
    }
  }
}
```

## 5. End-to-end flow

Flujo actual real:

`raw task -> intent-normalizer -> normalizedIntent -> context-preparer -> preparedContext -> working-set-manager -> execution transport -> expansion request -> expansion result`

### Producción y consumo por módulo

- raw task
  - input externo
- `intent-normalizer.js`
  - produce `NormalizedIntent`
- `context-preparer.js`
  - consume task + repo index + AI_CONTEXT + artifacts previos
  - produce `PreparedContextPackage`
- `working-set-manager.js`
  - es llamado por `context-preparer.js`
  - produce `WorkingSet` formal
- `working-set-transport.js`
  - convierte `WorkingSet` a `seedPaths`
- `tmux-worktree-orchestrator.js`
  - consume `preparedContext` o `workingSet`
  - mezcla `seedPaths` globales + worker + `WorkingSet`
  - aplica overlays en worktrees con `overlaySeedPaths`
- `context-expansion-service.js`
  - consume `PreparedContextPackage` + request + `indexPayload`
  - llama `expansion-policy.js`
  - produce `ExpansionResult`

### Persistencia real

- repo index
  - `data/project-cache/<repoSlug>/*.json`
- prepared context
  - `data/project-cache/<repoSlug>/task-context/<task-context-id>.json`
- working set
  - `data/project-cache/<repoSlug>/task-artifacts/<ws-id>.json`
- expansion logs
  - `data/project-cache/<repoSlug>/task-artifacts/<expansion-log-id>.json`

### Qué ya está enforced

- normalización de `seedPaths`
- transporte del `WorkingSet` al worker vía `seedPaths`
- budget y estado de expansión
- bloqueo de repo-wide por default
- bloqueo de wildcard paths
- logging de expansión

### Qué sigue siendo preparatorio

- adopción automática desde los comandos `multi-*`
- interceptar búsquedas del worker en runtime para forzar policy gate
- interacción con updater/validator de `AI_CONTEXT`

## 6. Enforcement audit

### Dónde se enforcea el `workingSet`

- `scripts/lib/tmux-worktree-orchestrator.js`
  - `resolveConfiguredWorkingSet(config, repoRoot)`
  - `buildOrchestrationPlan(config)`
  - cuando existe `preparedContext` o `workingSet`, el worker plan recibe `workingSet` y `workingSetId`

### Dónde se convierte a `seedPaths`

- `scripts/lib/context/working-set-transport.js`
  - `resolveWorkingSetSeedPaths(workingSet, repoRoot)`
  - `toSeedPaths(workingSet, repoRoot)`
  - `applyWorkingSetToWorker(worker, workingSet, repoRoot)`

### Dónde se aplica budget

- `scripts/lib/context/working-set-budget.js`
  - `getBudgetForIntent`
  - `createBudgetState`
  - `clampBudgetToPolicy`
- `scripts/lib/context/working-set-manager.js`
  - aplica `initialFilesMax` al crear
  - actualiza `currentFilesCount` al expandir
- `scripts/lib/context/expansion-policy.js`
  - consume `expansionsRemaining`, `broadSearchesRemaining`, `totalFilesMax`

### Dónde se bloquea repo-wide expansion por default

- `scripts/lib/context/expansion-policy.js`
  - `if (repoWideRequest && allowedExpansion.repoWide !== true)`

### Dónde se registran logs de expansión

- `scripts/lib/context/context-expansion-service.js`
  - `store.writeTaskArtifact(..., expansionLogId)`
  - se escribe tanto en rechazo como en aprobación

### Cómo se mantiene backward compatibility

- si no hay `preparedContext` ni `workingSet`, el orquestador sigue usando solo `seedPaths` heredados del plan
- `WorkingSet` mantiene alias `id` además de `workingSetId`
- `PreparedContextPackage` mantiene `schemaVersion: ecc.context-package.v1`

## 7. Broad search risk audit

### ¿Broad search sigue siendo posible?

Sí.

### ¿En qué condiciones?

- si alguien llama `expandPreparedContext()` con un request broad y todavía hay `broadSearchesRemaining`
- si el budget/allowed expansion del caso permite la operación
- si el flujo de ejecución no está usando este stack y sigue operando con lógica previa

### ¿Sigue siendo default en algún flujo?

Sí, parcialmente.

No es default dentro del nuevo `context-expansion-service`, pero sí puede seguir siendo el comportamiento real en flows viejos que todavía no consumen `preparedContext` ni llaman la policy explícitamente.

### ¿Qué partes siguen teniendo riesgo de rediscovery repetitivo?

- cualquier command/prompt flow que todavía no use `PreparedContextPackage`
- cualquier worker que, una vez lanzado, ignore el `task.md` y haga búsquedas manuales dentro del repo
- cualquier integración futura que use `PreparedContextPackage` pero no consulte `context-expansion-service`

Conclusión dura:

- **el broad search libre ya no es default dentro de la capa nueva**
- **todavía no se puede afirmar que dejó de ser default en todo el sistema**

## 8. Reuse vs duplication audit

### Reutilizado

- `seedPaths`
  - siguen siendo el mecanismo real de transporte a worktree
- `normalizeSeedPaths(seedPaths, repoRoot)`
  - reutilizado desde `working-set-transport.js`
- `overlaySeedPaths({ repoRoot, seedPaths, worktreePath })`
  - sigue siendo la materialización real del enforcement
- `project-detect.js`
  - reutilizado por el indexado del repo
- state/snapshot helpers
  - session recordings canónicos reutilizados por `ContextPreparer`
  - `project-cache-store` reutiliza el layout común de artifacts JSON

### Lógica nueva creada

- budget profiles y budget state
- formalización del `WorkingSet`
- expansión con policy gate
- expansion logs
- rehidratación del `WorkingSet`

### Duplicación accidental / deuda

- top-level `allowedExpansion` duplica bastante del estado que ya vive en `workingSet.budget`
- sigue existiendo `WORKING_SET_SIZE_BY_BUDGET` en `context-preparer.js`, aunque ya no gobierna el límite principal más importante
- la validación del paquete sigue bajo schema `v1` aunque el contrato creció de forma real

## 9. Persistence audit

### Dónde se guardan working sets

- `data/project-cache/<repoSlug>/task-artifacts/<ws-id>.json`

### Dónde se guardan expansion logs

- `data/project-cache/<repoSlug>/task-artifacts/<expansion-log-id>.json`

### Naming conventions

- working set id
  - `ws-<timestamp>-<hash>`
- expansion log id
  - `expansion-log-<timestamp>-<hash>`
- task context id
  - `task-context-<timestamp>-<hash>`

### Cómo se rehidratan

- `hydrateWorkingSet(payload, options)` en `working-set-manager.js`
- el orquestador rehidrata desde:
  - `config.preparedContext.workingSet`
  - `config.workingSet`

### Metadata faltante

- no hay `taskId` obligatorio ni correlación fuerte entre expansion logs y task-context específico
- no hay index formal de rehidratación por `workingSetId` más allá del directorio JSON
- no se persiste todavía un historial encadenado de revisiones del mismo `WorkingSet`

## 10. Testability / commands

### Comandos concretos

Indexación:

```bash
node scripts/context-index.js --repo . --no-persist
```

Preparación de contexto:

```bash
node scripts/context-prepare.js --repo . --task "Fix backend billing route regression" --no-persist
```

Creación de `WorkingSet` vía test dirigido:

```bash
node tests/lib/context-layer.test.js
```

Transporte a `seedPaths` y enforcement en worker plan:

```bash
node tests/lib/tmux-worktree-orchestrator.test.js
```

Dry-run de orquestación con working set visible:

```bash
node scripts/orchestrate-worktrees.js .claude/plan/example-plan.json
```

Aprobación de expansión:

- hoy se valida de forma dirigida en `tests/lib/context-layer.test.js` con request narrow hacia `src/components/user-card.tsx`

Rechazo de expansión:

- hoy se valida en `tests/lib/context-layer.test.js` con request `mode: repo-wide`

### Validación ejecutada durante esta fase

- `npx eslint scripts/lib/context/*.js scripts/lib/tmux-worktree-orchestrator.js scripts/orchestrate-worktrees.js tests/lib/context-layer.test.js tests/lib/tmux-worktree-orchestrator.test.js`
- `node tests/lib/context-layer.test.js`
- `node tests/lib/tmux-worktree-orchestrator.test.js`

## 11. Gaps and risks before Iteration 3

- falta integrar este stack a los comandos `multi-*`
- falta definir quién dispara `expandPreparedContext()` en runtime real
- falta endurecer correlación entre task context, working set y expansion logs
- `PreparedContextPackage` mantiene schema `v1` aunque el contrato ya no es pequeño
- el enforcement real hoy depende de que el flujo use `preparedContext` o `workingSet`
- un worker aún puede decidir explorar manualmente el repo completo; el sistema no intercepta eso todavía
- no hay test E2E que pruebe `context-prepare -> plan -> execute -> expansion -> rehydrate` de punta a punta
- no está confirmado todavía un mecanismo de “neighbor callsite expansion” más inteligente que domain/path level

## 12. Iteration 3 readiness verdict

**READY_WITH_GAPS**

### Justificación técnica

Listo para Iteration 3 porque:

- el stack base ya existe y es usable
- el `WorkingSet` ya es un artifact real, no implícito
- el transporte ya reutiliza `seedPaths`
- la expansión ya tiene policy, budget y logging
- el orquestador ya puede imponer el `WorkingSet`

Con gaps porque:

- la adopción todavía no es sistémica
- broad search todavía puede seguir ocurriendo en flows viejos
- falta wiring del expansion gate en tiempo de ejecución
- el contrato top-level del paquete todavía tiene deuda de shape/versionado
