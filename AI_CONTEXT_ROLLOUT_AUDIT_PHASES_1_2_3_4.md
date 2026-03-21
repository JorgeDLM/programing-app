# AI Context Rollout Audit — Phases 1, 2, 3 & 4

## 1. Executive summary

El rollout 1-4 sí dejó una capa operativa usable para que nuevas tasks entren por contexto preparado, para que `WorkingSet` viaje por la orquestación real, y para que `multi-plan`, `multi-execute` y `multi-workflow` dejen explícitamente de tratar el broad search como camino por defecto.

Estado real al cierre de Iteration 4:

- sí existe `PreparedContextPackage`
- sí existe `WorkingSet` formal con budget y metadata
- sí existe expansión controlada con policy + logs persistidos
- sí existe transporte real del `WorkingSet` por `seedPaths`
- sí existe adopción mínima en la orquestación real (`orchestrate-worktrees`)
- sí existen CLIs operativas para entrada, expansión y reporte de observabilidad
- sí quedaron los `commands/multi-*` alineados con el nuevo stack como camino principal
- sí quedó un contrato útil para snapshots/canonical sessions consumibles después por `claude-dashboard`

Límites reales que siguen abiertos:

- no existe enforcement total sobre búsquedas manuales hechas dentro de un worker ya corriendo
- los `commands/multi-*` quedaron integrados como contrato operativo/documentado, no como runtime autónomo fuera de Claude
- la observabilidad ya registra adopción/expansión/fallbacks, pero en este repo todavía no había eventos históricos reales previos al cierre de la fase
- `validate-commands.js` sigue fallando por referencias rotas preexistentes ajenas a Iteration 4

Veredicto final del rollout:

**READY_WITH_GAPS**

## 2. Qué se implementó realmente en Iteration 4

### Adopción sistémica mínima real

Se añadió una capa operativa nueva para resolver contexto de ejecución/orquestación:

- `scripts/lib/context/context-orchestration.js`
- resolución de `preparedContext` desde:
  - `preparedContext` inline
  - `preparedContextPath`
  - `contextTask` / `taskDescription` / `task`
- construcción de `contextRuntime` con:
  - `contextMode`
  - `taskContextId`
  - `workingSetId`
  - docs recomendados
  - artifacts previos
  - budget y protocolo de expansión
  - flags de backward compatibility fallback

### Orquestación real integrada

`scripts/orchestrate-worktrees.js` ahora:

- prepara contexto automáticamente si el plan trae `contextTask`
- acepta `preparedContextPath`
- registra observabilidad de plan / execute
- expone `contextRuntime` en dry run

`scripts/lib/tmux-worktree-orchestrator.js` ahora:

- propaga `preparedContext` hasta cada worker plan
- mantiene el `WorkingSet` como source principal de `seedPaths`
- materializa task files con:
  - `Prepared Context`
  - `Enforced Working Set`
  - `Recommended AI_CONTEXT`
  - `Previous Context Artifacts`
  - `Expansion Protocol`

### Expansión controlada operativa

Se añadió:

- `scripts/context-expand.js`

Ese CLI usa el stack ya existente de Iteration 2-3 para:

- cargar un `PreparedContextPackage`
- evaluar una request narrow/broad bajo budget real
- devolver `ExpansionResult`
- registrar observabilidad adicional

### Observabilidad útil real

Se añadió:

- `scripts/lib/context/context-observability.js`
- `scripts/context-observability-report.js`

Observabilidad disponible:

- cuántas entradas ocurrieron con prepared context
- cuántas veces se usó working set sin expansión
- cuántas expansiones se solicitaron
- cuántas fueron aprobadas / rechazadas
- cuántos broad-search fallbacks ocurrieron
- dónde persiste rediscovery repetitivo
- estimación de retrieval avoided vs retrieval used

### Contrato listo para snapshots y dashboard futuro

Se extendió:

- `scripts/lib/orchestration-session.js`
- `scripts/lib/session-adapters/canonical-session.js`

Ahora un snapshot canónico de sesión orquestada puede exponer por worker:

- `contextMode`
- `taskContextId`
- `workingSetId`
- `basedOnCommit`
- `recommendedDocs`
- `relatedArtifacts`
- `expansionProtocol`

## 3. Archivos creados/modificados

### Archivos creados en Iteration 4

- `scripts/lib/context/context-observability.js`
- `scripts/lib/context/context-orchestration.js`
- `scripts/context-expand.js`
- `scripts/context-observability-report.js`
- `tests/lib/context-iteration4.test.js`
- `AI_CONTEXT_ROLLOUT_AUDIT_PHASES_1_2_3_4.md`

### Archivos modificados en Iteration 4

- `scripts/context-prepare.js`
- `scripts/orchestrate-worktrees.js`
- `scripts/lib/tmux-worktree-orchestrator.js`
- `scripts/lib/orchestration-session.js`
- `scripts/lib/session-adapters/canonical-session.js`
- `commands/multi-plan.md`
- `commands/multi-execute.md`
- `commands/multi-workflow.md`
- `package.json`
- `tests/lib/orchestration-session.test.js`
- `tests/lib/session-adapters.test.js`

### Nota de continuidad de fases previas

Fases 1-2 ya habían dejado:

- indexación determinista
- `NormalizedIntent`
- `PreparedContextPackage`
- `WorkingSet`
- budgets
- expansión controlada
- transporte por `seedPaths`

Fase 3 ya había dejado:

- maintenance stack de `AI_CONTEXT`
- updater/validator selectivo
- metadata de freshness/provenance
- correlación `taskContextId` / `workingSetId` / `basedOnCommit`

## 4. Cómo quedó integrado `multi-plan`

`commands/multi-plan.md` ahora define como camino principal:

- bootstrap por `PreparedContextPackage`
- lectura del `WorkingSet`
- lectura de docs `AI_CONTEXT` recomendados
- reuse de artifacts previos
- expansión controlada antes de cualquier fallback

También quedó explicitado:

- `node scripts/context-prepare.js --task "$ARGUMENTS" --write .claude/plan/task-context.json`
- `node scripts/context-expand.js ...` como helper preferido cuando falta contexto
- ace-tool / built-in search pasan a ser compatibilidad, no default

Resultado real:

- el contrato del prompt ya no arranca desde rediscovery amplio
- el contexto que se envía a modelos queda definido como `PreparedContextPackage + WorkingSet + recommended docs + previous artifacts`

## 5. Cómo quedó integrado `multi-execute`

`commands/multi-execute.md` ahora arranca desde:

- `PreparedContextPackage`
- `WorkingSet`
- docs recomendados
- artifacts previos
- transporte real por `seedPaths`

Se dejó explícito que:

- la ejecución debe preferir el bounded execution surface derivado del working set
- si falta contexto, primero se pide expansión controlada
- broad search / rediscovery sólo queda como fallback de compatibilidad

Resultado real:

- el contrato documental ya obliga a que execution parta del bounded context
- el transporte real ya existe en `tmux-worktree-orchestrator.js`

## 6. Cómo quedó integrado `multi-workflow`

`commands/multi-workflow.md` ahora usa la nueva capa como camino principal.

Cambios relevantes:

- declara `PreparedContextPackage + WorkingSet` como contexto operativo primario
- declara que nuevas tasks deben entrar por `node scripts/context-prepare.js`
- declara `node scripts/context-expand.js` antes de cualquier broad search
- documenta contrato de plan externo con `contextTask`

Plan JSON preferido para orquestación:

```json
{
  "sessionName": "feature-billing-fix",
  "repoRoot": ".",
  "contextTask": "...",
  "launcherCommand": "...",
  "workers": [
    {
      "name": "Backend",
      "task": "Implement the bounded backend changes first"
    }
  ]
}
```

Resultado real:

- `orchestrate-worktrees` sí prepara contexto automáticamente cuando recibe `contextTask`
- `multi-workflow` ya puede describir un flujo real conectado a esa entrada

## 7. Cómo quedó integrado el uso real de `WorkingSet`

### Producción del `WorkingSet`

Sigue viniendo desde `context-preparer.js` + `working-set-manager.js`.

### Transporte real

Sigue ocurriendo en:

- `scripts/lib/context/working-set-transport.js`
- `scripts/lib/tmux-worktree-orchestrator.js`

### Uso real en workers

Cada worker ahora recibe:

- `seedPaths` derivados del working set
- `workingSetId`
- `Prepared Context` section en `task.md`
- `Enforced Working Set` section en `task.md`
- docs recomendados y artifacts previos

### Uso real en snapshots

`orchestration-session.js` parsea y `canonical-session.js` preserva:

- `contextMode`
- `workingSetId`
- docs recomendados
- artifacts previos
- protocolo de expansión

Resultado real:

- el `WorkingSet` ya no es solo artifact persistido; ya está en el camino real de task materialization y snapshotting

## 8. Cómo quedó integrada la expansión controlada

### Runtime disponible

El runtime de expansión controlada sigue en:

- `scripts/lib/context/context-expansion-service.js`
- `scripts/lib/context/expansion-policy.js`

### Nueva superficie operativa

Se añadió:

- `scripts/context-expand.js`

### Flujo real

1. cargar `PreparedContextPackage`
2. construir request narrow/broad
3. evaluar policy
4. si aprueba:
   - expandir `WorkingSet`
   - actualizar budget
   - persistir expansion log
5. si rechaza:
   - devolver `deniedReason`
   - persistir expansion log de rechazo

### Reglas que siguen activas

- repo-wide expansion sigue bloqueado por default
- wildcard paths siguen bloqueados
- broad search sólo consume budget si realmente se pide
- no hay free expansion

Resultado real:

- expansión sí quedó integrada al flujo operativo real vía CLI y vía contrato de comandos
- no existe todavía interceptación total de búsquedas manuales hechas adentro de un worker

## 9. Broad search / rediscovery audit

### Qué mejoró realmente

- broad search dejó de ser el default declarado en `multi-plan`
- broad search dejó de ser el default declarado en `multi-execute`
- broad search dejó de ser el default declarado en `multi-workflow`
- el plan externo con `contextTask` ya entra por contexto preparado automáticamente
- el `task.md` del worker ahora empuja explícitamente working set + docs + expansión controlada

### Qué sigue siendo parcial

- un worker humano/LLM todavía puede ignorar el `task.md` y explorar el repo manualmente
- no hay enforcement runtime que capture cada `Glob` / `Grep` manual y lo redirija a expansión
- el broad search todavía es técnicamente posible si el flujo decide usar compatibilidad

### Dónde sigue habiendo riesgo de rediscovery repetitivo

- flows viejos que no pasen por `contextTask`, `preparedContext`, ni `preparedContextPath`
- ejecución manual fuera del contrato de `multi-*`
- worker sessions que no respeten el bounded context entregado

### Conclusión honesta

- **sí** dejó de ser el default operativo documentado y orquestado
- **no** se puede afirmar enforcement universal todavía

## 10. Observability audit

### Superficies nuevas

- `scripts/lib/context/context-observability.js`
- `scripts/context-observability-report.js`
- registros desde:
  - `context-prepare`
  - `context-expand`
  - `orchestrate-worktrees` plan
  - `orchestrate-worktrees` execute
  - eventos manuales si se usan helpers directos

### Qué mide realmente

- prepared-context entries
- working-set use without expansion
- expansion requests / approvals / rejections
- broad-search fallbacks
- backward-compatibility fallbacks
- rediscovery hotspots
- retrieval avoided / used estimate

### Qué pasó al auditar este repo en frío

`node scripts/context-observability-report.js --repo .` devolvió cero eventos.

Eso no significa que el sistema no sirva. Significa que:

- esta observabilidad es nueva
- el repo base no traía eventos históricos previos para esta fase
- la evidencia real de funcionamiento quedó validada por tests dirigidos, no por tráfico histórico existente

### Validación real ejecutada

`tests/lib/context-iteration4.test.js` sí verificó que:

- se registra entrada por prepared context
- se registra expansión aprobada
- se registra fallback legacy
- el summary report devuelve métricas coherentes

## 11. Backward compatibility audit

Backward compatibility preservada realmente en:

- `PreparedContextPackage` mantiene `schemaVersion: ecc.context-package.v1`
- el orquestador sigue aceptando planes viejos basados sólo en `seedPaths`
- si no hay `preparedContext` ni `workingSet`, `buildOrchestrationPlan()` sigue funcionando
- `WorkingSet` sigue manteniendo alias `id` además de `workingSetId`

### Costo de compatibilidad

- `contextMode: legacy` sigue existiendo
- observabilidad reporta ese camino como fallback / rediscovery risk
- parte del sistema sigue dual-path, no single-path

Conclusión:

- la compatibilidad vieja no se rompió
- el camino nuevo ya es el preferido
- el viejo quedó degradado a fallback observable

## 12. Contrato final listo para `claude-dashboard`

### Entrada de task nueva

Opciones soportadas:

- `context-prepare.js --task ...`
- `orchestrate-worktrees` con `contextTask`
- `orchestrate-worktrees` con `preparedContextPath`
- `orchestrate-worktrees` con `preparedContext` inline

### Qué consume `multi-plan`

- `PreparedContextPackage`
- `WorkingSet`
- docs recomendados
- artifacts previos
- budget y protocolo de expansión

### Qué consume `multi-execute`

- `PreparedContextPackage`
- `WorkingSet`
- `seedPaths` transportados
- docs recomendados
- artifacts previos

### Qué consume `multi-workflow`

- el mismo contrato anterior
- con soporte explícito para `contextTask` en plan JSON externo

### Cómo se solicita expansión

Por request explícita hacia `context-expand.js`, por ejemplo:

```bash
node scripts/context-expand.js --prepared-context .claude/plan/task-context.json --request '{"mode":"narrow","paths":["src/lib/adjacent.ts"],"reason":"Need one adjacent dependency"}'
```

### Cómo se registra observabilidad

Artifacts `kind: context-observability` y `kind: expansion-log` bajo:

- `data/project-cache/<repoSlug>/task-artifacts/`

### Qué expone ya el snapshot canónico por worker

Bajo `worker.intent`:

- `objective`
- `seedPaths`
- `recommendedDocs`
- `relatedArtifacts`
- `contextMode`
- `taskContextId`
- `basedOnCommit`
- `workingSetId`
- `expansionProtocol`

Conclusión:

- el contrato ya es suficientemente claro y usable para consumo futuro desde `claude-dashboard`
- todavía faltaría que `claude-dashboard` lo lea y lo use, pero la forma ya quedó del lado de este repo

## 13. Gaps o deuda restante

- falta enforcement runtime sobre búsquedas manuales dentro del worker
- falta E2E de punta a punta con una sesión real `multi-*` disparando este contrato fuera de tests dirigidos
- la observabilidad todavía no tiene histórico real de producción dentro de este repo
- `validate-commands.js` sigue con errores preexistentes ajenos a esta fase:
  - `agents/e2e-runner.md`
  - `agents/planner.md`
  - `agents/python-reviewer.md`
- el contrato sigue mezclando ruta nueva y fallback legacy en paralelo
- el top-level `allowedExpansion` de `PreparedContextPackage` sigue cargando deuda de shape heredada de fases previas
- no hubo integración directa con `claude-dashboard`; solo se dejó el contrato listo del lado de `programing-app`

## 14. Veredicto final del rollout

**READY_WITH_GAPS**

### Qué sí justifica `READY`

- nuevas tasks ya pueden entrar por contexto preparado
- `multi-*` ya consume la nueva capa como camino principal a nivel de contrato operativo
- `WorkingSet` ya está en el camino real de ejecución/orquestación
- expansión controlada ya está integrada y usable por CLI
- ya existe observabilidad útil
- snapshots/canonical sessions ya exponen el contrato de contexto
- no se rompieron los flows existentes

### Qué impide `READY` pleno

- no hay enforcement universal contra rediscovery manual
- la evidencia en este repo es todavía mayormente por tests dirigidos, no por histórico de uso real acumulado
- siguen existiendo fallbacks legacy observables

### Lectura práctica

La fase 4 sí quedó implementada y sí cambia el camino operativo preferido.

Lo que no quedó hecho fue una reescritura total ni una interceptación total del runtime, y eso está alineado con el alcance que pediste.
