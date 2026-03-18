# PAQUETE DE CONTEXTO TÉCNICO — Estado Real del Sistema

**Fecha:** 18 de Marzo de 2026

---

## 1. SSE / STREAMING ACTUAL

### Endpoint SSE
- **Ruta:** `GET /api/agents/[id]/stream` (donde `id` = projectId)
- **Archivo:** `src/app/api/agents/[id]/stream/route.ts`

### Cómo funciona
1. Frontend abre `EventSource(/api/agents/${projectId}/stream)` al entrar a un proyecto
2. El stream consulta `commandCenter.getSessionsForProject(id)` para enviar historial
3. Escucha eventos del `commandCenter` EventEmitter: `output`, `close`, `launched`, `error`, `log`
4. Filtra eventos solo del proyecto actual via `isSessionForProject()`
5. Heartbeat cada 15s para mantener conexión viva

### Eventos que emite hoy
| Evento | Datos | Cuándo |
|---|---|---|
| `session_info` | sessionId, directive, agentName, status, createdAt | Al conectar (historial) |
| `history_for` | sessionId, data (texto completo) | Al conectar (output previo) |
| `logs` | sessionId, logs[] | Al conectar (logs previos) |
| `launched` | sessionId, projectId, directive, agentName | Al crear sesión nueva |
| `output` | sessionId, data (chunk de texto) | Durante ejecución (streaming) |
| `log` | sessionId, log | Al agregar log |
| `close` | sessionId, code, hasChanges | Al terminar sesión |
| `error` | sessionId, error | Al fallar |
| `status` | status: "idle" | Si no hay sesiones |

### Cómo se registra una sesión para streaming
- `commandCenter.registerSession()` (nuevo, pipeline flow) — registra en memory Map + emite `launched`
- `commandCenter.launchSession()` (legacy) — registra + emite `launched` + ejecuta runAPISession

### Flujo pipeline vs SSE
**PROBLEMA CRÍTICO:** El pipeline flow usa `registerSession()` que emite `launched`, pero el `phase-runner.ts` ejecuta Claude API directamente SIN emitir eventos `output` al commandCenter. Los chunks de texto del pipeline NO llegan al SSE.

El SSE hoy solo funciona para:
- Eventos de lifecycle (launched, close)
- El flujo legacy `runAPISession()` que sí emite `output` chunks

### Limitaciones actuales
| Limitación | Impacto |
|---|---|
| phase-runner NO emite eventos output al commandCenter | Pipeline execution es invisible en SSE |
| Solo 1 output buffer por sesión (no por fase) | No se puede distinguir output de fase 1 vs fase 2 |
| No hay evento de "phase_started" o "phase_completed" | UI no sabe qué fase está corriendo |
| Heartbeat cada 15s puede causar timeouts en proxies | Posible desconexión en ngrok |

### Qué habría que tocar para SSE por fase
1. **phase-runner.ts** — emitir eventos al commandCenter durante ejecución
2. **pipeline-orchestrator.ts** — emitir `phase_started`, `phase_completed`, `phase_waiting`
3. **stream/route.ts** — agregar listeners para nuevos eventos de fase
4. **page.tsx** — manejar nuevos eventos en el handler de SSE

---

## 2. TIMELINE ACTUAL DEL TICKET / PIPELINE EN UI

### Archivo
- `src/app/project/[id]/page.tsx` (líneas ~478-592)

### Qué muestra hoy el ticket expandido

| Dato | Se muestra | Dónde |
|---|---|---|
| Directiva (mensaje original) | SÍ | Sección "Directiva" |
| ticketType badge | SÍ | Badge violeta junto a directiva |
| executionMode badge ("pipeline") | SÍ | Badge púrpura |
| skillNames count | SÍ | Badge verde "N skills" |
| Pipeline phases timeline | SÍ | Lista con phaseType, agentName, status badge |
| Fase actual highlighted | SÍ | Border accent en la fase current |
| outputSummary por fase | SÍ (truncado a 40 chars) | Al final de cada fase |
| Waiting client card | SÍ | Card amber con input de respuesta |
| Waiting review card | SÍ | Card violet con botones aprobar/devolver |
| Execution controls (run/retry/cancel) | SÍ | Botones para tickets ready/failed |
| Response text (streaming) | SÍ | Sección "Respuesta" con MdLine rendering |
| Action logs timeline | SÍ | Agrupado por agente con tool calls |
| Files modified | SÍ | Badges verdes con filenames |
| In-ticket reply | SÍ | Input para responder al agente (solo running) |
| Summary bullets | SÍ | Resumen profesional para completed |

### Datos que YA existen en backend pero NO se muestran

| Dato disponible | Dónde está | Por qué no se muestra |
|---|---|---|
| `model` por fase | PipelinePhase.model | No hay columna en el timeline |
| `tokensUsed` por fase | PipelinePhase.tokensUsed | No se renderiza |
| `durationMs` por fase | PipelinePhase.durationMs | No se renderiza |
| `retryCount` por fase | PipelinePhase.retryCount | No se renderiza |
| `handoffNotes` por fase | PipelinePhase.handoffNotes | No se renderiza |
| `startedAt`/`completedAt` | PipelinePhase timestamps | No se renderiza |
| `skillNames` por fase | PipelinePhase.skillNames | No se renderiza |
| `requiresReview`/`requiresClientApproval` | PipelinePhase flags | No se renderiza |
| ClientQuestion question text | ClientQuestion.question | Waiting card muestra texto genérico, no la pregunta real |
| ClientQuestion type | ClientQuestion.questionType | No se muestra |
| `modelUsed` acumulado | Session.modelUsed | No se muestra |
| `tokensUsed` acumulado | Session.tokensUsed | No se muestra |
| `durationMs` acumulado | Session.durationMs | No se muestra |

### Gaps de la UI del timeline
1. No muestra la pregunta real del ClientQuestion — dice texto genérico
2. No muestra modelo, tokens ni duración por fase
3. No muestra skills cargados por fase
4. No muestra handoff notes entre fases
5. No hay indicador de si se escaló de Sonnet a Opus

---

## 3. TEAM TEMPLATES ACTUALES

### small_fix
```
ticketType: small_fix | mode: team_pipeline | model: sonnet
Fases:
  1. implementation → doctor-de-errores | skills: [] | review: NO | approval: NO
  2. review → inspector-de-codigo | skills: [estandares-de-codigo] | review: NO | approval: NO
```

### feature
```
ticketType: feature | mode: team_pipeline | model: sonnet
Fases:
  1. planning → planificador | skills: [patrones-backend, patrones-frontend] | review: NO | approval: SÍ
  2. implementation → implementador | skills: [estandares-de-codigo, integracion-claude] | review: NO | approval: NO
  3. review → inspector-de-codigo | skills: [estandares-de-codigo] | review: SÍ | approval: NO
  4. qa → maestro-de-pruebas | skills: [desarrollo-guiado-por-tests] | review: NO | approval: NO
  5. finalization → validador-de-salida | skills: [ciclo-de-verificacion] | review: NO | approval: NO
```

### new_module
```
ticketType: new_module | mode: team_pipeline | model: sonnet
Fases:
  1. discovery → arquitecto | skills: [diseno-de-apis, patrones-backend, patrones-postgresql] | approval: SÍ | model: opus
  2. planning → planificador | skills: [migraciones-de-base-de-datos] | approval: SÍ
  3. implementation → implementador | skills: [estandares-de-codigo]
  4. review → inspector-de-codigo | skills: [estandares-de-codigo] | review: SÍ
  5. review → disenador-de-base-de-datos | skills: [patrones-postgresql, migraciones-de-base-de-datos]
  6. qa → maestro-de-pruebas | skills: [desarrollo-guiado-por-tests]
  7. finalization → validador-de-salida | skills: [ciclo-de-verificacion]
```

### architecture_change
```
ticketType: architecture_change | mode: team_pipeline | model: opus
Fases:
  1. discovery → arquitecto | skills: [patrones-backend, patrones-frontend, patrones-postgresql] | approval: SÍ | model: opus
  2. planning → planificador | skills: [migraciones-de-base-de-datos] | approval: SÍ | model: opus
  3. review → guardian-de-seguridad | skills: [revision-de-seguridad] | review: SÍ | approval: SÍ
  4. implementation → implementador | skills: [estandares-de-codigo]
  5. review → inspector-de-codigo | skills: [estandares-de-codigo, ciclo-de-verificacion] | review: SÍ
  6. qa → tester-de-flujos | skills: [pruebas-end-to-end]
  7. finalization → validador-de-salida | skills: []
```

### research
```
ticketType: research | mode: team_pipeline | model: opus
Fases:
  1. discovery → consultor-tecnico | skills: [investigacion-profunda, busqueda-neural] | model: opus
  2. finalization → documentador | skills: []
```

### quotation
```
ticketType: quotation | mode: team_pipeline | model: opus
Fases:
  1. discovery → arquitecto | skills: [investigacion-de-mercado, diseno-de-apis] | approval: SÍ | model: opus
  2. planning → planificador | skills: [materiales-para-inversores] | approval: SÍ | model: opus
  3. client_validation → defensor-del-cliente | skills: [] | approval: SÍ
```

### qa_review
```
ticketType: qa_review | mode: team_pipeline | model: sonnet
Fases:
  1. review → inspector-de-codigo | skills: [estandares-de-codigo]
  2. review → guardian-de-seguridad | skills: [revision-de-seguridad, escaneo-de-seguridad]
  3. qa → tester-de-flujos | skills: [pruebas-end-to-end]
  4. review → optimizador-de-codigo | skills: [calidad-de-codigo]
  5. finalization → validador-de-salida | skills: [ciclo-de-verificacion]
```

### Agentes en templates vs pendientes

**14 agentes conectados:**
planificador, arquitecto, implementador, inspector-de-codigo, guardian-de-seguridad, maestro-de-pruebas, tester-de-flujos, consultor-tecnico, doctor-de-errores, disenador-de-base-de-datos, documentador, validador-de-salida, defensor-del-cliente, optimizador-de-codigo

**NO conectados todavía (candidatos):**
- `arquitecto-backend` → candidato para discovery en feature/new_module cuando es backend-heavy
- `arquitecto-frontend` → candidato para discovery cuando es frontend-heavy
- `desarrollador-backend` → candidato para implementation alternativa a implementador genérico
- `desarrollador-frontend` → candidato para implementation frontend-specific
- `analista-de-negocio` → candidato para discovery en quotation y new_module
- `project-manager` → candidato para planning como alternativa/complemento a planificador
- `inspector-python` → candidato para review en proyectos Python
- Los otros 68 agentes de equipos ventas, finanzas, legal, especialistas, research no aplican a templates de desarrollo

---

## 4. LISTA REAL DE AGENTES ACTUALES

82 agentes en 11 equipos. Los 14 que participan en templates están marcados con ✅.

### equipo-direccion (5)
| Agente | agent.md | descripcion.md | En templates | Estado |
|---|---|---|---|---|
| director-de-operaciones | ✅ | ✅ | NO | Definido, no conectado |
| defensor-del-cliente | ✅ | ✅ | ✅ quotation(client_validation) | Operativo |
| project-manager | ✅ | ✅ | NO | Definido, candidato |
| validador-de-salida | ✅ | ✅ | ✅ feature, new_module, arch, qa | Operativo |
| optimizador-de-ai | ✅ | ✅ | NO | Definido, no conectado |

### equipo-analisis (7)
| Agente | En templates | Estado |
|---|---|---|
| analista-de-negocio | NO | Candidato para quotation/new_module |
| estratega-de-producto | NO | Definido |
| disenador-de-experiencia | NO | Definido |
| arquitecto | ✅ new_module, arch, quotation | Operativo |
| validador-de-arquitectura | NO | Definido |
| experto-en-analisis-estrategico | NO | Definido |
| planificador | ✅ feature, new_module, arch, quotation | Operativo |

### equipo-desarrollo (12)
| Agente | En templates | Estado |
|---|---|---|
| arquitecto-backend | NO | Candidato |
| arquitecto-frontend | NO | Candidato |
| desarrollador-backend | NO | Candidato |
| desarrollador-frontend | NO | Candidato |
| implementador | ✅ feature, new_module, arch | Operativo |
| disenador-de-base-de-datos | ✅ new_module(review) | Operativo |
| especialista-en-integraciones | NO | Definido |
| responsable-de-infraestructura | NO | Definido |
| consultor-tecnico | ✅ research | Operativo |
| doctor-de-errores | ✅ small_fix | Operativo |
| optimizador-de-codigo | ✅ qa_review(review) | Operativo |
| documentador | ✅ research(finalization) | Operativo |

### equipo-calidad (14)
| Agente | En templates | Estado |
|---|---|---|
| inspector-de-codigo | ✅ todos excepto research/quotation | Operativo |
| guardian-de-seguridad | ✅ arch(review), qa_review(review) | Operativo |
| maestro-de-pruebas | ✅ feature(qa), new_module(qa) | Operativo |
| tester-de-flujos | ✅ arch(qa), qa_review(qa) | Operativo |
| Otros 10 agentes de calidad | NO | Definidos world-class pero no conectados |

### Equipos 5-11 (ventas, finanzas, legal, especialistas, research, diseño, archivo)
Los 47 agentes de estos equipos están definidos con agent.md profundizado pero NO participan en templates de desarrollo. Son para flujos comerciales, financieros, legales y de industria.

---

## 5. RUNTIME PRINCIPAL ACTUAL

### Flujo paso a paso (pipeline-first, implementado en FASE 7)

| Paso | Archivo | Función | Core/Legacy |
|---|---|---|---|
| 1. Usuario envía directiva | `src/app/project/[id]/page.tsx` | handleSend → POST /api/chat | Core |
| 2. Chat route auto-clasifica | `src/app/api/chat/[projectId]/route.ts` | getDefaultTicketType(message) | **Core (NUEVO)** |
| 3. Construye pipeline | misma route | buildPipeline() | **Core (NUEVO)** |
| 4. Persiste sesión con pipeline en DB | misma route | db.session.create() | **Core (NUEVO)** |
| 5. Registra en memory para SSE | misma route | commandCenter.registerSession() | **Core (NUEVO)** |
| 6. Lanza pipeline async | misma route | runPipelineUntilBlocked() | **Core (NUEVO)** |
| 7. Orchestrator lee fase actual | `src/lib/pipeline/pipeline-orchestrator.ts` | runCurrentPhase() | Core |
| 8. Phase runner ejecuta con Claude API | `src/lib/pipeline/phase-runner.ts` | runPhase() | Core |
| 9. Prompt assembler construye prompt | `src/lib/pipeline/prompt-assembler.ts` | buildPhasePrompt() | Core |
| 10. Model router decide Sonnet vs Opus | `src/lib/pipeline/model-router.ts` | resolveModel() | Core |
| 11. Result parser interpreta output | `src/lib/pipeline/phase-result-parser.ts` | parsePhaseResult() | Core |
| 12. Orchestrator avanza o pausa | pipeline-orchestrator.ts | waiting_client/review/advance | Core |
| 13. UI polling actualiza estado | page.tsx | setInterval 5s → lifecycle API | Core |
| 14. Lifecycle API para acciones | `src/app/api/tickets/[id]/lifecycle/route.ts` | respond, approve, reject, retry, cancel | Core |

---

## 6. LEGACY TODAVÍA VIVO

| Archivo | Función legacy | ¿Se llama todavía? | Desde dónde | Riesgo | Recomendación |
|---|---|---|---|---|---|
| `agent-manager.ts` L371 | `launchSession()` | **NO desde chat route** (FASE 7 lo eliminó). Pero sigue existiendo como método público | Posible llamada desde otros lugares no verificados | MEDIO — alguien podría llamarlo directamente | Marcar como `@deprecated` o hacer private |
| `agent-manager.ts` L479 | `runAPISession()` | Solo desde `launchSession()` | Indirectamente si alguien llama launchSession | MEDIO — ejecuta el viejo flujo single-agent sin pipeline | Encapsular o eliminar cuando launchSession se deprece |
| `agent-manager.ts` L357 | `registerSession()` | **SÍ — es el nuevo flujo** | Chat route L64 | CORE — es el reemplazo correcto | Mantener |

### Diagnóstico
El chat route principal (`/api/chat/[projectId]`) YA NO llama a `launchSession()`. Usa `registerSession()` + `runPipelineUntilBlocked()`. El legacy sigue existiendo como código pero no se ejecuta en el flujo principal.

**Riesgo residual:** Si alguien construye un nuevo endpoint que llame directamente a `commandCenter.launchSession()`, entraría por el viejo flujo sin pipeline.

---

## 7. ARCHIVOS CLAVE — YA ENTREGADOS ARRIBA

Todos los archivos solicitados han sido leídos y documentados en las secciones anteriores. Las rutas correctas actuales son:

| Archivo | Ruta |
|---|---|
| Team templates | `src/lib/pipeline/team-templates.ts` |
| Chat route (principal) | `src/app/api/chat/[projectId]/route.ts` |
| Agent manager | `src/lib/agent-manager.ts` |
| SSE stream | `src/app/api/agents/[id]/stream/route.ts` |
| Project page (UI) | `src/app/project/[id]/page.tsx` |
| Pipeline orchestrator | `src/lib/pipeline/pipeline-orchestrator.ts` |
| Phase runner | `src/lib/pipeline/phase-runner.ts` |
| Prompt assembler | `src/lib/pipeline/prompt-assembler.ts` |
| Model router | `src/lib/pipeline/model-router.ts` |
| Phase result parser | `src/lib/pipeline/phase-result-parser.ts` |
| Pipeline builder | `src/lib/pipeline/pipeline-builder.ts` |
| Lifecycle API | `src/app/api/tickets/[id]/lifecycle/route.ts` |
| Types | `src/lib/pipeline/types.ts` |
| Escalation policy | `src/lib/pipeline/escalation-policy.ts` |
| Store (agents+skills listing) | `src/lib/store.ts` |
| Prisma schema | `prisma/schema.prisma` |

---

## 8. EJEMPLO REAL DE DATOS

### Ticket (Session) example
```json
{
  "id": "ses_1742284800000_a1b2",
  "projectId": "claude-dashboard",
  "projectName": "claude-dashboard",
  "directive": "Arregla el bug del login que no redirige correctamente",
  "agentName": "doctor-de-errores",
  "skillNames": [],
  "status": "completed",
  "ticketType": "small_fix",
  "executionMode": "team_pipeline",
  "priority": "medium",
  "currentPhase": 2,
  "modelUsed": "claude-sonnet-4-6",
  "tokensUsed": 4521,
  "durationMs": 18500,
  "hasChanges": true,
  "pipeline": "[...PipelinePhase array serialized as JSON...]",
  "responseText": "He encontrado el bug en middleware.ts..."
}
```

### Pipeline example (JSON inside Session.pipeline)
```json
[
  {
    "id": "phase_ses_1742284800000_a1b2_0_1742284800001",
    "phaseIndex": 0,
    "phaseType": "implementation",
    "agentName": "doctor-de-errores",
    "skillNames": [],
    "status": "completed",
    "model": "claude-sonnet-4-6",
    "startedAt": "2026-03-18T06:00:00.001Z",
    "completedAt": "2026-03-18T06:00:12.500Z",
    "outputSummary": "Corregido redirect en middleware.ts línea 24",
    "requiresReview": false,
    "requiresClientApproval": false,
    "handoffNotes": "Fix aplicado: redirect path corregido de /login a /dashboard",
    "tokensUsed": 3200,
    "durationMs": 12500,
    "retryCount": 0
  },
  {
    "id": "phase_ses_1742284800000_a1b2_1_1742284800002",
    "phaseIndex": 1,
    "phaseType": "review",
    "agentName": "inspector-de-codigo",
    "skillNames": ["estandares-de-codigo"],
    "status": "completed",
    "model": "claude-sonnet-4-6",
    "startedAt": "2026-03-18T06:00:14.500Z",
    "completedAt": "2026-03-18T06:00:20.000Z",
    "outputSummary": "Review OK: fix mínimo, sin side effects",
    "requiresReview": false,
    "requiresClientApproval": false,
    "handoffNotes": "Aprobado: cambio correcto y seguro",
    "tokensUsed": 1321,
    "durationMs": 6000,
    "retryCount": 0
  }
]
```

### ClientQuestion example
```json
{
  "id": "clq_abc123def456",
  "sessionId": "ses_1742284800000_x1y2",
  "phaseIndex": 0,
  "questionType": "approval",
  "question": "Necesito crear 2 tablas nuevas: Orders y OrderItems. ¿Apruebas este cambio de schema?",
  "context": "El módulo de pedidos requiere persistir órdenes con múltiples ítems",
  "status": "pending",
  "response": null,
  "createdAt": "2026-03-18T07:30:00.000Z",
  "answeredAt": null
}
```

### ClientQuestion answered example
```json
{
  "id": "clq_abc123def456",
  "sessionId": "ses_1742284800000_x1y2",
  "phaseIndex": 0,
  "questionType": "approval",
  "question": "Necesito crear 2 tablas nuevas: Orders y OrderItems. ¿Apruebas?",
  "context": "El módulo de pedidos requiere persistir órdenes",
  "status": "answered",
  "response": "Sí, aprobado. Usa UUID para los IDs y agrega timestamps.",
  "createdAt": "2026-03-18T07:30:00.000Z",
  "answeredAt": "2026-03-18T07:35:00.000Z"
}
```

---

## 9. RIESGOS Y LIMITACIONES DETECTADOS

| # | Riesgo | Severidad | Impacto |
|---|---|---|---|
| 1 | **Pipeline execution es invisible en SSE** — phase-runner no emite eventos al commandCenter | ALTO | El usuario no ve progreso en vivo durante pipeline. Solo ve resultado final via polling |
| 2 | **Waiting_client card no muestra la pregunta real** — muestra texto genérico en vez del ClientQuestion.question | MEDIO | El usuario no sabe qué le están preguntando |
| 3 | **Legacy launchSession() sigue público** — podría llamarse accidentalmente | BAJO | Alguien podría crear endpoint que use el viejo flujo |
| 4 | **Polling cada 5s puede ser pesado** — hace fetch por cada ticket activo | BAJO | Si hay 10 tickets activos, son 10 fetches cada 5s |
| 5 | **Output buffer es por sesión, no por fase** — chunks de múltiples fases se mezclan en un solo buffer | MEDIO | La respuesta en vivo no distingue entre fases |
| 6 | **68 agentes definidos pero no conectados a templates** — inversión en definición sin ROI operativo todavía | INFORMATIVO | Normal — expansión gradual planificada |

---

*Contexto técnico generado el 18 de Marzo de 2026 con base en código real verificado.*
