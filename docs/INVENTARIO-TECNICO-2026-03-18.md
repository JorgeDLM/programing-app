# INVENTARIO TÉCNICO COMPLETO — Sistema Multiagente

**Fecha:** 18 de Marzo de 2026
**Estado:** Post Fase 4+5

---

## 1. LISTA REAL DE AGENTES EXISTENTES (16)

| # | Carpeta | Archivos | Rol | Usado en templates | Estado actual |
|---|---|---|---|---|---|
| 1 | `arquitecto` | agent.md, descripcion.md | Diseña arquitectura, evalúa trade-offs | feature(no), new_module(discovery), architecture_change(discovery), quotation(discovery) | Existe, agent.md se carga dinámicamente via loadAgentPrompt() |
| 2 | `consultor-tecnico` | agent.md, descripcion.md | Busca docs actualizadas via Context7 MCP | research(discovery, finalization) | Existe, operativo |
| 3 | `disenador-de-base-de-datos` | agent.md, descripcion.md | Optimiza queries, schemas, índices, RLS | NO usado en ningún template | Existe pero no asignado a ningún template |
| 4 | `doctor-de-errores` | agent.md, descripcion.md | Fix de build/tipos con cambios mínimos | small_fix(implementation) | Existe, operativo |
| 5 | `documentador` | agent.md, descripcion.md | Genera codemaps, actualiza READMEs | NO usado en ningún template | Existe pero no asignado |
| 6 | `guardian-de-seguridad` | agent.md, descripcion.md | Audita seguridad OWASP, secrets, auth | architecture_change(review), qa_review(review) | Existe, operativo |
| 7 | `implementador` | agent.md, descripcion.md | Construye y modifica código nuevo | NO usado en ningún template (BUG: templates usan inspector-de-codigo en fases implementation) | Existe pero NO asignado donde debería estar |
| 8 | `inspector-de-codigo` | agent.md, descripcion.md | Revisa calidad, seguridad, patrones | feature(implementation, review), new_module(implementation, review), architecture_change(implementation, qa), qa_review(review, finalization) | Existe, operativo — pero MAL asignado como implementador |
| 9 | `inspector-python` | agent.md, descripcion.md | Revisa Python: PEP 8, seguridad, types | NO usado en ningún template | Existe pero no asignado |
| 10 | `jefe-de-personal` | agent.md, descripcion.md | Gestiona comunicaciones multi-canal | NO usado en ningún template | Existe, no aplica al flujo actual |
| 11 | `maestro-de-pruebas` | agent.md, descripcion.md | TDD, cobertura 80%+, test-first | feature(qa), new_module(qa), qa_review(qa) | Existe, operativo |
| 12 | `optimizador-de-codigo` | agent.md, descripcion.md | Limpia código muerto, duplicados | NO usado en ningún template | Existe pero no asignado |
| 13 | `optimizador-de-ia` | agent.md, descripcion.md | Optimiza config del sistema de agentes | NO usado en ningún template | Existe, contenido insuficiente (0.9KB) |
| 14 | `planificador` | agent.md, descripcion.md | Crea planes de implementación detallados | feature(planning), new_module(planning), architecture_change(planning), quotation(planning, client_validation) | Existe, operativo |
| 15 | `supervisor-de-procesos` | agent.md, descripcion.md | Monitorea loops autónomos | NO usado en ningún template | Existe, contenido insuficiente (0.9KB) |
| 16 | `tester-de-flujos` | agent.md, descripcion.md | E2E con Playwright, anti-flaky | NO usado en ningún template (templates usan maestro-de-pruebas en qa) | Existe pero no asignado |

### Issues detectados en agentes

- **implementador existe pero NO se usa** en ningún template. Las fases de `implementation` en templates asignan `inspector-de-codigo` que es un REVISOR, no un implementador.
- **6 agentes no asignados** a ningún template: disenador-de-base-de-datos, documentador, inspector-python, optimizador-de-codigo, tester-de-flujos, jefe-de-personal.
- **2 agentes esqueleto** con contenido insuficiente: optimizador-de-ia, supervisor-de-procesos.

---

## 2. LISTA REAL DE SKILLS EXISTENTES (36)

| # | Carpeta | Archivos | Propósito | Agentes compatibles | Estado |
|---|---|---|---|---|---|
| 1 | `api-de-x` | SKILL.md, descripcion.md | X/Twitter API integration | motor-de-contenido, publicación | Disponible, no conectado |
| 2 | `aprendizaje-continuo` | SKILL.md, descripcion.md, config.json, evaluate-session.sh | Extracción automática de patrones v1 | optimizador-de-ia | Disponible, no conectado |
| 3 | `aprendizaje-continuo-v2` | SKILL.md, descripcion.md, config.json, scripts/, hooks/ | Instincts con scoring v2.1 | optimizador-de-ia | Disponible, no conectado |
| 4 | `busqueda-neural` | SKILL.md, descripcion.md | Exa neural search | consultor-tecnico | Usado en template: research |
| 5 | `calidad-de-codigo` | SKILL.md, descripcion.md | Auto-formato y linting | inspector-de-codigo | Disponible, no conectado |
| 6 | `ciclo-de-verificacion` | SKILL.md, descripcion.md | Build+lint+tests+security pipeline | inspector-de-codigo, maestro-de-pruebas | Usado en template: architecture_change(qa) |
| 7 | `compactacion-estrategica` | SKILL.md, descripcion.md | Gestión de contexto en sesiones | todos | Disponible, no conectado |
| 8 | `configuracion-del-sistema` | SKILL.md, descripcion.md | Instalador interactivo del sistema | optimizador-de-ia | Disponible, no conectado |
| 9 | `consulta-de-documentacion` | SKILL.md, descripcion.md | Docs via Context7 MCP | consultor-tecnico | Disponible, no conectado |
| 10 | `contacto-con-inversores` | SKILL.md, descripcion.md | Cold emails, follow-ups inversores | planificador | Disponible, no conectado |
| 11 | `desarrollo-guiado-por-tests` | SKILL.md, descripcion.md | TDD workflow Red-Green-Refactor | maestro-de-pruebas | Usado en templates: feature(qa), qa_review(qa) |
| 12 | `diseno-de-apis` | SKILL.md, descripcion.md, agents/openai.yaml | Patrones REST, status codes | arquitecto, implementador | Usado en template: new_module(discovery) |
| 13 | `edicion-de-video` | SKILL.md, descripcion.md | Pipeline FFmpeg/Remotion/fal.ai | ninguno actualmente | Disponible, no conectado |
| 14 | `ejemplo-de-guias` | SKILL.md, descripcion.md | Template para skills de proyecto | ninguno | Referencia/template |
| 15 | `escaneo-de-seguridad` | SKILL.md, descripcion.md | Audit de config de agentes | guardian-de-seguridad | Disponible, no conectado |
| 16 | `escritura-de-articulos` | SKILL.md, descripcion.md, agents/openai.yaml | Redacción con voz personalizada | ninguno actualmente | Disponible, no conectado |
| 17 | `estandares-de-codigo` | SKILL.md, descripcion.md, agents/openai.yaml | Convenciones TS/JS/React | inspector-de-codigo | Usado en templates: small_fix(review), feature(implementation), new_module(implementation), qa_review(review) |
| 18 | `evaluacion-de-sesiones` | SKILL.md, descripcion.md, agents/openai.yaml | Eval-driven development | optimizador-de-ia | Disponible, no conectado |
| 19 | `generacion-de-medios` | SKILL.md, descripcion.md, agents/openai.yaml | fal.ai: imágenes, video, audio | ninguno actualmente | Disponible, no conectado |
| 20 | `integracion-claude` | SKILL.md, descripcion.md, agents/openai.yaml | Claude API: streaming, tools, caching | implementador, arquitecto | Disponible, no conectado |
| 21 | `inventario-de-skills` | SKILL.md, descripcion.md, scripts/ | Audit de calidad de skills | optimizador-de-ia | Disponible, no conectado |
| 22 | `investigacion-de-mercado` | SKILL.md, descripcion.md | Market sizing, competidores | arquitecto, planificador | Usado en templates: quotation(discovery) |
| 23 | `investigacion-profunda` | SKILL.md, descripcion.md, agents/openai.yaml | Research con firecrawl/exa MCPs | consultor-tecnico | Usado en template: research(discovery) |
| 24 | `materiales-para-inversores` | SKILL.md, descripcion.md, agents/openai.yaml | Pitch decks, one-pagers | planificador | Usado en template: quotation(planning) |
| 25 | `migraciones-de-base-de-datos` | SKILL.md, descripcion.md | Schema changes, rollbacks, Prisma | disenador-de-base-de-datos | Sugerido en templates pero no asignado a fases |
| 26 | `motor-de-contenido` | SKILL.md, descripcion.md, agents/openai.yaml | Contenido multiplataforma | ninguno actualmente | Disponible, no conectado |
| 27 | `nextjs-y-turbopack` | SKILL.md, descripcion.md | Next.js 16+ Turbopack config | implementador, arquitecto | Disponible, no conectado |
| 28 | `orquestacion-multi-agente` | SKILL.md, descripcion.md, agents/openai.yaml | Workflows paralelos con dmux | operador | Disponible, no conectado |
| 29 | `patrones-backend` | SKILL.md, descripcion.md, agents/openai.yaml | Arquitectura Node.js/Next.js/Express | arquitecto, implementador | Usado en templates: feature(planning), new_module(discovery), architecture_change(discovery) |
| 30 | `patrones-frontend` | SKILL.md, descripcion.md, agents/openai.yaml | React/Next.js patterns | implementador, arquitecto | Usado en templates: feature(planning), architecture_change(discovery) |
| 31 | `patrones-postgresql` | SKILL.md, descripcion.md | PostgreSQL queries, índices, RLS | disenador-de-base-de-datos | Disponible, no conectado |
| 32 | `patrones-python` | SKILL.md, descripcion.md | Idiomas Python, PEP 8, type hints | inspector-python | Disponible, no conectado |
| 33 | `presentaciones-html` | SKILL.md, descripcion.md, STYLE_PRESETS.md, agents/openai.yaml | Slides HTML animadas | ninguno actualmente | Disponible, no conectado |
| 34 | `pruebas-end-to-end` | SKILL.md, descripcion.md, agents/openai.yaml | Playwright patterns | tester-de-flujos, maestro-de-pruebas | Disponible, no conectado |
| 35 | `publicacion-multiplataforma` | SKILL.md, descripcion.md, agents/openai.yaml | Crosspost X/LinkedIn/Threads | ninguno actualmente | Disponible, no conectado |
| 36 | `revision-de-seguridad` | SKILL.md, descripcion.md | Checklist OWASP completo | guardian-de-seguridad | Usado en templates: architecture_change(review), qa_review(review) |

### Resumen de conexión

- **12 skills usados** en al menos un template
- **24 skills disponibles** pero no conectados a ningún flujo

---

## 3. TEAM TEMPLATES ACTUALES (7)

### small_fix
- **ticketType:** small_fix
- **defaultMode:** single_agent
- **defaultModel:** claude-sonnet-4-6
- **Fases:**
  1. implementation → `doctor-de-errores` | skills: [] | review: no | approval: no
  2. review → `inspector-de-codigo` | skills: [estandares-de-codigo] | review: no | approval: no
- **Issues:** Ninguno crítico

### feature
- **ticketType:** feature
- **defaultMode:** team_pipeline
- **defaultModel:** claude-sonnet-4-6
- **Fases:**
  1. planning → `planificador` | skills: [patrones-backend, patrones-frontend] | review: no | approval: **sí**
  2. implementation → `inspector-de-codigo` | skills: [estandares-de-codigo] | review: no | approval: no
  3. review → `inspector-de-codigo` | skills: [] | review: **sí** | approval: no
  4. qa → `maestro-de-pruebas` | skills: [desarrollo-guiado-por-tests] | review: no | approval: no
- **Issues:** **Fase implementation usa inspector-de-codigo en vez de implementador**

### new_module
- **ticketType:** new_module
- **defaultMode:** team_pipeline
- **defaultModel:** claude-sonnet-4-6
- **Fases:**
  1. discovery → `arquitecto` | skills: [diseno-de-apis, patrones-backend] | review: no | approval: **sí** | model: opus
  2. planning → `planificador` | skills: [] | review: no | approval: **sí**
  3. implementation → `inspector-de-codigo` | skills: [estandares-de-codigo] | review: no | approval: no
  4. review → `inspector-de-codigo` | skills: [] | review: **sí** | approval: no
  5. qa → `maestro-de-pruebas` | skills: [] | review: no | approval: no
- **Issues:** **Fase implementation usa inspector-de-codigo en vez de implementador. No incluye disenador-de-base-de-datos.**

### architecture_change
- **ticketType:** architecture_change
- **defaultMode:** team_pipeline
- **defaultModel:** claude-opus-4-6
- **Fases:**
  1. discovery → `arquitecto` | skills: [patrones-backend, patrones-frontend] | approval: **sí** | model: opus
  2. planning → `planificador` | skills: [] | approval: **sí** | model: opus
  3. review → `guardian-de-seguridad` | skills: [revision-de-seguridad] | review: **sí** | approval: **sí**
  4. implementation → `inspector-de-codigo` | skills: [] | review: no | approval: no
  5. qa → `inspector-de-codigo` | skills: [ciclo-de-verificacion] | review: no | approval: no
- **Issues:** **Fase implementation usa inspector-de-codigo en vez de implementador**

### research
- **ticketType:** research
- **defaultMode:** single_agent
- **defaultModel:** claude-opus-4-6
- **Fases:**
  1. discovery → `consultor-tecnico` | skills: [investigacion-profunda, busqueda-neural] | model: opus
  2. finalization → `consultor-tecnico` | skills: []
- **Issues:** Ninguno crítico

### quotation
- **ticketType:** quotation
- **defaultMode:** team_pipeline
- **defaultModel:** claude-opus-4-6
- **Fases:**
  1. discovery → `arquitecto` | skills: [investigacion-de-mercado] | approval: **sí** | model: opus
  2. planning → `planificador` | skills: [materiales-para-inversores] | approval: **sí** | model: opus
  3. client_validation → `planificador` | skills: [] | approval: **sí**
- **Issues:** Ninguno crítico

### qa_review
- **ticketType:** qa_review
- **defaultMode:** team_pipeline
- **defaultModel:** claude-sonnet-4-6
- **Fases:**
  1. review → `inspector-de-codigo` | skills: [estandares-de-codigo]
  2. review → `guardian-de-seguridad` | skills: [revision-de-seguridad]
  3. qa → `maestro-de-pruebas` | skills: [desarrollo-guiado-por-tests]
  4. finalization → `inspector-de-codigo` | skills: []
- **Issues:** Ninguno crítico

### Issue global en templates
**El agente `implementador` que se creó en Fase 4 NO está asignado en ningún template.** Todas las fases de tipo `implementation` siguen usando `inspector-de-codigo`.

---

## 4. MODELO ACTUAL DE PIPELINE / FASES

### Archivos clave
- `src/lib/pipeline/types.ts` — PipelinePhase interface
- `src/lib/pipeline/pipeline-builder.ts` — buildPipeline()
- `src/lib/pipeline/pipeline-orchestrator.ts` — runCurrentPhase(), resume, approve, reject, retry

### Persistencia
- Pipeline se guarda como **campo JSON** en Session (`pipeline Json?`)
- `currentPhase` es un **Int** en Session
- No hay tabla separada para fases — todo vive dentro del JSON de la Session

### Campos de fase persistidos (dentro del JSON)
```
id, phaseIndex, phaseType, agentName, skillNames[],
status, model, startedAt, completedAt, outputSummary,
requiresReview, requiresClientApproval, handoffNotes,
tokensUsed, durationMs, retryCount
```

### Estados de ticket
`draft | triage | ready | running | waiting_client | waiting_review | completed | failed | cancelled`

### Estados de fase
`pending | running | waiting_client | waiting_review | completed | failed | skipped`

### Telemetría persistida por fase
- `tokensUsed` (input + output combinados)
- `durationMs`
- `retryCount`
- `model` (se guarda al crear la fase desde pipeline-builder)

### Telemetría persistida por sesión
- `modelUsed` (último modelo usado)
- `tokensUsed` (acumulado)
- `durationMs` (acumulado)

### Limitaciones
- Pipeline es JSON embebido — no es queryable por fase individual
- No hay `tokensUsedInput` y `tokensUsedOutput` separados por fase (solo combinados)
- `model` en fase se setea al crear pipeline pero el orchestrator puede cambiarlo en runtime
- No hay `estimatedCost` todavía

---

## 5. MODELO REAL DE ClientQuestion

### Schema Prisma
```
model ClientQuestion {
  id             String    @id @default(cuid())
  sessionId      String
  session        Session   @relation(...)
  phaseIndex     Int       @default(0)
  questionType   String    // clarification|approval|decision|risk_warning|scope_confirmation
  question       String    @db.Text
  context        String?   @db.Text
  status         String    @default("pending")  // pending|answered|dismissed
  response       String?   @db.Text
  createdAt      DateTime  @default(now())
  answeredAt     DateTime?
}
```

### Relaciones
- Pertenece a Session via `sessionId`
- Session tiene `questions ClientQuestion[]`

### Capacidades
- Sí guarda `phaseIndex`
- Sí guarda `questionType` (5 tipos)
- Sí guarda `status` (pending/answered/dismissed)
- Sí guarda respuesta del cliente
- Sí permite múltiples preguntas por ticket
- No tiene mecanismo para evitar duplicados

### Uso actual
- **Backend:** El orchestrator (`pipeline-orchestrator.ts`) crea ClientQuestion cuando el phase-result-parser detecta `[REQUIERE_APROBACION]` en el output
- **Backend:** La lifecycle API tiene acciones `respond` y `ask_client`
- **UI:** page.tsx tiene un waiting_client card con input para responder
- **UI:** handleClientRespond llama a lifecycle con `respond` + `resume`

### Huecos
- El UI pasa `questionId: ""` (string vacío) en handleClientRespond — no resuelve el questionId real de la pregunta pendiente
- No hay polling automático para detectar nuevas preguntas
- No hay notificación push

---

## 6. LÓGICA ACTUAL DE requiresReview

### Origen de la regla
1. **Del template:** Cada PhaseDefinition tiene `requiresReview: boolean` definido estáticamente
2. **Del output del agente:** El phase-result-parser detecta `[REQUIERE_REVISION]` o `[REQUIERE_REVIEW]` en el output de Claude

### Flujo actual
1. Phase-runner ejecuta la fase
2. Phase-result-parser parsea output y setea `result.requiresReview` si detecta marcador
3. Orchestrator verifica: `if (result.requiresReview || phase.requiresReview)`
4. Si true → fase pasa a `waiting_review`, ticket pasa a `waiting_review`
5. UI muestra card violeta con botones "Aprobar" / "Devolver"
6. `approve_review` → marca fase completed, avanza
7. `reject_review` → marca fase failed

### Archivos involucrados
- `team-templates.ts` — define `requiresReview` por fase
- `phase-result-parser.ts` — detecta marcadores en output
- `pipeline-orchestrator.ts` — decide si pausar
- `lifecycle/route.ts` — actions `approve_review`, `reject_review`
- `page.tsx` — UI card + handlers

### Limitaciones
- Funciona de punta a punta en teoría, pero **no se ha probado end-to-end** con una ejecución real del pipeline
- No hay campo para comentarios de review (reject recibe comment pero solo lo guarda en handoffNotes)
- No hay historial de reviews por fase

---

## 7. CAPACIDAD REAL DEL ORQUESTADOR

### Funciones existentes
| Función | Archivo | Qué hace |
|---|---|---|
| `runCurrentPhase()` | pipeline-orchestrator.ts | Ejecuta la fase actual (1 sola), detecta waiting/review/complete, avanza currentPhase |
| `resumeAfterClientResponse()` | pipeline-orchestrator.ts | Cambia status a ready y llama runCurrentPhase |
| `approveReview()` | pipeline-orchestrator.ts | Marca fase completed, avanza a siguiente |
| `rejectReview()` | pipeline-orchestrator.ts | Marca fase failed, ticket failed |
| `retryPhase()` | pipeline-orchestrator.ts | Incrementa retryCount, llama runCurrentPhase |

### Capacidades reales
- **¿Auto-avanza?** SÍ — dentro de runCurrentPhase, si la fase completa sin waiting, el status cambia a `ready` y el `currentPhase` avanza. Pero NO ejecuta automáticamente la siguiente fase.
- **¿Depende de click manual?** SÍ — cada fase requiere un click en "Ejecutar fase" en la UI
- **¿Reanuda después de waiting_client?** SÍ — resumeAfterClientResponse() existe y funciona
- **¿Reanuda después de waiting_review?** SÍ — approveReview() existe y funciona
- **¿Ejecuta múltiples fases?** NO — solo ejecuta 1 fase por llamada
- **¿Auto-ejecuta todo el pipeline?** NO — no existe función que corra todas las fases secuencialmente

### Limitaciones reales
- No hay auto-run del pipeline completo
- No hay SSE streaming durante ejecución de fases del pipeline (el phase-runner ejecuta pero no emite eventos al frontend)
- No hay polling/refresh automático en la UI después de run_phase
- El projectPath en orchestrator está hardcodeado: `C:\Users\UsX\Desktop\Proyectos - Desarrollo web\${session.projectName}`

---

## 8. ENDPOINTS / RUTAS IMPORTANTES

| Ruta | Método | Propósito | Archivo |
|---|---|---|---|
| `/api/chat/[projectId]` | POST | Crear ticket (sesión) | `src/app/api/chat/[projectId]/route.ts` |
| `/api/chat/[projectId]` | GET | Historial de mensajes | `src/app/api/chat/[projectId]/route.ts` |
| `/api/tickets/[id]/lifecycle` | GET | Estado actual del ticket + pipeline + preguntas | `src/app/api/tickets/[id]/lifecycle/route.ts` |
| `/api/tickets/[id]/lifecycle` | POST `classify` | Clasificar ticket y crear pipeline | misma |
| `/api/tickets/[id]/lifecycle` | POST `respond` | Responder pregunta del cliente | misma |
| `/api/tickets/[id]/lifecycle` | POST `ask_client` | Crear pregunta al cliente | misma |
| `/api/tickets/[id]/lifecycle` | POST `advance` | Avanzar fase manualmente | misma |
| `/api/tickets/[id]/lifecycle` | POST `run_phase` | Ejecutar fase actual con orchestrator | misma |
| `/api/tickets/[id]/lifecycle` | POST `resume` | Reanudar después de waiting_client | misma |
| `/api/tickets/[id]/lifecycle` | POST `approve_review` | Aprobar review de fase | misma |
| `/api/tickets/[id]/lifecycle` | POST `reject_review` | Rechazar review de fase | misma |
| `/api/tickets/[id]/lifecycle` | POST `retry_phase` | Reintentar fase fallida | misma |
| `/api/tickets/[id]/lifecycle` | POST `cancel` | Cancelar ticket | misma |
| `/api/agents/[id]/stream` | GET | SSE streaming de sesión activa | `src/app/api/agents/[id]/stream/route.ts` |
| `/api/agents/[id]/sessions` | GET | Historial de sesiones desde DB | `src/app/api/agents/[id]/sessions/route.ts` |
| `/api/ecc/agents` | GET | Lista agentes + skills separados | `src/app/api/ecc/agents/route.ts` |

---

## 9. FLUJO REAL ACTUAL PASO A PASO

### Flujo single_agent (como funciona HOY la mayoría de tickets):
1. Usuario escribe directiva en el ChatInput
2. Opcionalmente selecciona agente, skills y ticketType
3. POST `/api/chat/{projectId}` → crea Session en DB con status "running"
4. `agent-manager.ts` → `launchSession()` → `runAPISession()`
5. Si agentName !== "operator": `loadAgentPrompt()` lee `/agents/{name}/agent.md` como system prompt
6. Si skillNames[]: `loadSkills()` lee SKILL.md de cada skill y concatena como contexto
7. Construye system prompt con agente + skills + memorias + herramientas + reglas
8. Llama Claude API (Sonnet 4.6) en loop de hasta 10-20 iteraciones
9. Claude ejecuta tools reales (search_files, read_file, write_file, list_dir)
10. Output se streamea via SSE al frontend
11. Al terminar: persiste responseText, logs, status en DB
12. Frontend muestra ticket con respuesta expandible

### Flujo team_pipeline (existe pero requiere clicks manuales):
1. Mismo paso 1-3 de arriba
2. POST `/api/tickets/{id}/lifecycle` con action=`classify` → genera pipeline con fases
3. Ticket pasa a status `ready`
4. Usuario clickea "Ejecutar fase" → POST action=`run_phase`
5. Orchestrator:
   a. Lee fase actual del pipeline JSON
   b. Carga agente y skills de esa fase
   c. Resuelve modelo (Sonnet/Opus)
   d. Ejecuta via phase-runner (Claude API + tools)
   e. Parsea resultado (summary, handoff, approval, review)
   f. Si [REQUIERE_APROBACION] → waiting_client + crea ClientQuestion
   g. Si requiresReview → waiting_review
   h. Si ok → marca completed, avanza currentPhase, status=ready
6. Si waiting_client: usuario responde → resume → ejecuta fase de nuevo con contexto
7. Si waiting_review: usuario aprueba → avanza; o rechaza → failed
8. Repite paso 4 para cada fase hasta completar
9. Última fase → status=completed

### Lo que NO pasa:
- No hay auto-clasificación al crear ticket
- No hay auto-ejecución del pipeline completo
- No hay SSE durante run_phase del pipeline
- No hay refresh automático de UI post-ejecución

---

## 10. GAPS MÁS IMPORTANTES

| # | Gap | Impacto | Prioridad | Área |
|---|---|---|---|---|
| 1 | **Templates usan inspector-de-codigo como implementador** | El agente implementador existe pero nunca se usa — las fases de implementación asignan un revisor en vez de un constructor | CRÍTICO | team-templates.ts |
| 2 | **No hay auto-run del pipeline** | Cada fase requiere click manual — impracticable para pipelines de 4-5 fases | ALTO | pipeline-orchestrator.ts |
| 3 | **No hay SSE durante run_phase** | El usuario no ve progreso en vivo durante ejecución de fases del pipeline | ALTO | phase-runner.ts, stream route |
| 4 | **handleClientRespond no pasa questionId real** | El UI envía questionId vacío — el respond action requiere questionId válido | ALTO | page.tsx |
| 5 | **No hay auto-clasificación de tickets** | El usuario debe seleccionar ticketType manualmente o no se crea pipeline | MEDIO | chat route, team-templates.ts |
| 6 | **6 agentes sin asignar a templates** | disenador-de-base-de-datos, documentador, inspector-python, optimizador-de-codigo, tester-de-flujos, jefe-de-personal no participan en ningún flujo | MEDIO | team-templates.ts |
| 7 | **24 skills no conectados** | 2/3 de los skills no se usan en ningún template | MEDIO | team-templates.ts |
| 8 | **No hay polling/refresh en UI post run_phase** | Después de ejecutar una fase, la UI no se actualiza automáticamente | MEDIO | page.tsx |
| 9 | **ProjectPath hardcodeado en orchestrator** | Asume ruta fija en vez de resolver desde project discovery | BAJO | pipeline-orchestrator.ts L89 |
| 10 | **No hay auto-advance entre fases** | Cuando una fase completa sin bloqueo, el sistema debería poder auto-avanzar a la siguiente sin click manual | MEDIO | pipeline-orchestrator.ts |

---

*Inventario generado el 18 de Marzo de 2026 con base en código real.*
