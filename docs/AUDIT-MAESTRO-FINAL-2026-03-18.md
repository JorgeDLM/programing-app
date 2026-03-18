# AUDIT MAESTRO FINAL — Sistema Multiagente Completo

**Fecha:** 18 de Marzo de 2026
**Tipo:** Audit profundo y operativo post Fase 12

---

## 1. Resumen Ejecutivo

El sistema tiene una arquitectura seria con 82 agentes en 11 equipos, 37 skills, pipeline multiagente, Mesa de Trabajo consultiva, servicios compartidos, SSE por fase y conversión workspace→ticket/cotización. La base es sólida pero hay **3 problemas sistémicos que impiden operación real**:

1. **DOS PARSERS DE OUTPUT** — `phase-result-parser.ts` (pipeline) y `structured-output-parser.ts` (shared) coexisten sin convergencia real. El pipeline NO usa el parser compartido.
2. **client-question-service existe pero NO se usa** — El orchestrator sigue haciendo queries directas a DB. El servicio compartido es código muerto para tickets.
3. **El sistema nunca se ha ejecutado end-to-end en producción** — Todo el pipeline multiagente es teórico. No hay evidencia de una sola ejecución real exitosa de un pipeline de 4+ fases con handoffs, waiting_client y completion.

---

## 2. Estado Actual vs Objetivos Finales

| # | Objetivo | Estado | Score |
|---|---|---|---|
| 1 | Operar proyectos reales | PARCIAL — pipeline-first existe pero no probado en producción | 6/10 |
| 2 | Equipos multiagente por ticket | SÍ en templates, PARCIAL en runtime (solo 19 de 82 agentes conectados) | 7/10 |
| 3 | Flujo real con fases/handoffs | SÍ en código, NO probado end-to-end | 6/10 |
| 4 | Mesa de Trabajo separada | SÍ — funcional con equipos consultivos y salida estructurada | 8/10 |
| 5 | Conversión workspace→ticket/cotización | SÍ — API existe y funciona | 7/10 |
| 6 | Agentes + skills correctos | SÍ — separación clara, carga dinámica | 9/10 |
| 7 | Sonnet/Opus routing | SÍ — model-router funciona | 8/10 |
| 8 | Pausar y consultar al cliente | PARCIAL — política inyectada pero waiting_client no probado en producción | 6/10 |
| 9 | Dashboard con estado real | PARCIAL — timeline rica existe, SSE por fase existe, pero gaps de visualización | 7/10 |
| 10 | Escalabilidad futura | SÍ — arquitectura preparada para crecer | 8/10 |

**Score general: 7.2/10** — Base sólida, falta prueba en fuego real.

---

## 3. Qué Ya Está Realmente Bien

| Pieza | Por qué está bien |
|---|---|
| **Estructura de agentes** | 82 agentes en 11 equipos con agent.md profundizado. Búsqueda dinámica por grupos |
| **Skills separados** | 37 skills con SKILL.md. Carga on-demand. No mezclados con agentes |
| **Pipeline-first flow** | Chat route auto-clasifica, construye pipeline, corre via runPipelineUntilBlocked |
| **Team templates** | 7 templates con agentes y skills correctos por fase |
| **Template specializer** | Heurísticas auditables para backend/frontend detection |
| **Model routing** | resolveModel() funciona con Sonnet default + Opus para complex |
| **Prompt assembler** | Bloques XML estructurados con escalation policy obligatoria |
| **Mesa de Trabajo** | Entidad separada, equipos consultivos reales, salida estructurada |
| **Servicios compartidos** | agent-team-resolver, client-question-service, structured-output-parser creados |
| **Conversión workspace** | API funcional para crear ticket o cotización desde workspace |
| **SSE por fase** | phase-events.ts emite eventos, stream route los retransmite, UI los maneja |
| **Polling automático** | 5s refresh para tickets activos |
| **QuotationDraft model** | Prisma model con campos útiles |

---

## 4. Qué Ya Existe Pero Sigue Frágil

| Pieza | Fragilidad |
|---|---|
| **Pipeline orchestrator** | Nunca probado con ejecución real de Claude API en pipeline completo |
| **Phase runner SSE** | Emite chunks pero sin delay — pueden llegar como bloque. No hay buffer por fase |
| **waiting_client en pipeline** | El parser detecta [REQUIERE_APROBACION] pero nunca se ha verificado que Claude realmente lo produce con el prompt actual |
| **waiting_review en pipeline** | requiresReview flag funciona pero el flujo completo approve→auto-continue nunca verificado en producción |
| **Handoffs entre fases** | Se persisten en JSON pero no se ha verificado que la fase siguiente realmente usa el handoff como contexto efectivo |
| **Auto-classify** | getDefaultTicketType() usa keywords básicas. "Quiero mejorar el login" → "feature" por default, no "small_fix" aunque sea un fix |
| **convertToTicket UX** | Usa prompt() del browser para pedir projectId — hack temporal |

---

## 5. Qué Sigue Duplicado o Mal Convergido

| Duplicación | Dónde | Impacto |
|---|---|---|
| **DOS PARSERS DE OUTPUT** | `phase-result-parser.ts` (pipeline) vs `structured-output-parser.ts` (shared) | ALTO — el parser compartido NO se usa en pipeline. Son dos lógicas distintas para lo mismo |
| **Queries directas a DB en orchestrator** | `pipeline-orchestrator.ts` hace db.clientQuestion.create() directamente | MEDIO — ignora el client-question-service compartido |
| **loadMemories() duplicado** | Existe en orchestrator Y en agent-manager.ts | BAJO — misma lógica en dos archivos |
| **resolveProjectPath() local** | En orchestrator, hardcoded parcial | BAJO — no usa un project-context-resolver compartido |
| **Agent finder duplicado** | findAgentFile() en agent-manager.ts + loop en phase-runner.ts + loop en store.ts | MEDIO — 3 implementaciones distintas de la misma búsqueda |

---

## 6. Qué Existe Pero No Está Bien Conectado

| Pieza | Existe en | No conectado a |
|---|---|---|
| **client-question-service** | src/lib/shared/ | Pipeline orchestrator (sigue usando queries directas) |
| **structured-output-parser** | src/lib/shared/ | Pipeline phase-result-parser (sigue usando su propio parser) |
| **63 agentes** | /agents/ en 11 equipos | Ningún template ni flujo real. Son archivos .md sin uso runtime |
| **politica-de-escalamiento SKILL** | /.agents/skills/ | Se carga en prompt-assembler pero NO se valida que los agentes la sigan |
| **emitPhaseCompleted/WaitingClient/WaitingReview** | phase-events.ts | Orchestrator importa pero NO emite completed/waiting/failed al final de cada fase |
| **QuotationDraft model** | Prisma schema | No hay UI para ver cotizaciones creadas. No hay listado |

---

## 7. Qué Partes No Escalan

| Pieza | Problema de escala |
|---|---|
| **Pipeline como JSON en Session** | No queryable por fase individual. Con 50+ tickets, buscar "fases fallidas" es imposible |
| **Output buffer por sesión** | Un solo array de strings. Con múltiples fases, el output de fase 1 y fase 5 se mezcla |
| **Polling cada 5s por ticket activo** | Con 20 tickets activos = 20 fetches cada 5s al lifecycle API |
| **Agent finder escanea filesystem** | Lee todos los directorios en cada llamada. Con 100+ agentes puede ser lento |
| **Skills loading por nombre** | Lee SKILL.md del filesystem en cada fase. Sin cache |

---

## 8. Auditoría de Agentes y Skills

### Agentes

| Categoría | Cantidad | Estado |
|---|---|---|
| En templates (participan en flujos reales) | 14 | Operativos |
| Via specializer (se activan por heurística) | 5 | Operativos condicionalmente |
| En equipos consultivos (Mesa de Trabajo) | ~25 únicos | Operativos en workspace |
| Solo como archivos .md | ~38 | Código muerto operativo |
| Archivo/legacy | 3 | Deprecated |

### Skills

| Categoría | Cantidad |
|---|---|
| Usados en templates | 15 |
| politica-de-escalamiento (auto-inyectado) | 1 |
| Disponibles pero no mapeados a templates | 21 |

### Relación agentes ↔ skills
- **Bien resuelto:** Templates tienen skills correctos por fase
- **Falta:** No hay mapping agente→skills default fuera de templates
- **Falta:** Los agentes consultivos en workspace NO cargan skills — solo se nombran en el prompt

---

## 9. Auditoría de Templates

| Template | Fases | Estado |
|---|---|---|
| small_fix | 2 (impl→review) | OK — simple y funcional |
| feature | 5 (plan→impl→review→qa→final) | OK — validador-de-salida como cierre |
| new_module | 7 (discovery→plan→impl→review→db-review→qa→final) | OK — incluye disenador-de-base-de-datos |
| architecture_change | 7 (discovery→plan→sec-review→impl→code-review→qa→final) | OK — Opus en discovery/planning |
| research | 2 (discovery→final) | OK — documentador cierra |
| quotation | 4 (analyst→architect→plan→client-validation) | OK — analista-de-negocio primero |
| qa_review | 5 (code→security→qa→optimization→final) | OK — optimizador-de-codigo incluido |

**Issues detectados:**
- `feature` planning no tiene requiresClientApproval en implementation si el plan cambia mucho
- `architecture_change` tiene 7 fases — si todas requieren Claude API call, el costo es alto
- Ningún template tiene fase de "documentation" post-implementation

---

## 10. Auditoría de Runtime / Pipeline

### Lo que funciona
- runPipelineUntilBlocked() itera fases correctamente
- savePipeline() persiste estado
- runCurrentPhase() carga agente, skills, modelo, ejecuta
- approveReview() marca completed y auto-continúa
- retryPhase() incrementa counter y re-ejecuta

### Lo que NO se ha verificado en producción
- Pipeline de 4+ fases ejecutando secuencialmente con Claude API real
- Handoff de fase N pasando como contexto a fase N+1
- Claude produciendo [REQUIERE_APROBACION] con el prompt actual
- Resume después de waiting_client usando la respuesta como contexto
- El costo real de un pipeline completo (tokens × fases)

### Fragilidades detectadas
- **Sin timeout por fase** — si Claude tarda 5 minutos, no hay timeout
- **Sin retry automático por rate limit en pipeline** — el phase-runner tiene retry por 429 pero el loop puede quedar colgado
- **projectPath depende de projectName** — si projectName no matchea la carpeta real, el agente no puede ejecutar tools

---

## 11. Auditoría de Mesa de Trabajo

### Lo que funciona bien
- Entidad separada de tickets
- 9 tipos de sesión definidos
- Equipos consultivos con agentes reales validados
- Salida estructurada con <workspace_update>
- Insights panel con summary, risks, questions, options
- Conversión a ticket y cotización

### Lo que falta o es frágil
- **No hay consulta secuencial real de agentes** — el Director de Operaciones "consulta mentalmente" con el equipo. En realidad es 1 sola llamada a Claude con los nombres de los agentes en el prompt. No hay ejecución real de cada agente
- **No carga los agent.md reales** — solo nombra agentes en el prompt pero no inyecta su expertise real
- **waiting_client en workspace** — el structured-output-parser puede setear status "waiting_client" pero NO crea una pregunta formal con client-question-service
- **Sin SSE** — workspace es request-response, no streaming

---

## 12. Auditoría de Conversión Workspace → Ticket/Cotización

### Ticket conversion
- **Funciona:** Crea Session con pipeline desde workspace context
- **Frágil:** projectId se pide con prompt() del browser
- **Falta:** No hay preview antes de crear. No hay edición del directive precargado
- **Falta:** El ticket creado no hereda el historial de la sesión consultiva como contexto del agente

### Cotización conversion
- **Funciona:** Crea QuotationDraft con datos del workspace
- **Falta:** No hay UI para listar/ver cotizaciones creadas
- **Falta:** No hay flujo de review de cotización
- **Falta:** scopeDraft se llena con summary (poco útil como scope real)

---

## 13. Auditoría de Servicios Compartidos

| Servicio | Estado | Conectado a | No conectado a |
|---|---|---|---|
| agent-team-resolver | BIEN | Workspace creation, workspace messages | Pipeline templates (usan su propia definición en team-templates.ts) |
| client-question-service | EXISTE PERO NO SE USA | Definido | Pipeline orchestrator (queries directas), Workspace message (auto waiting_client sin usar el servicio) |
| structured-output-parser | PARCIAL | Workspace messages | Pipeline phase-result-parser (usa su propio parser distinto) |
| model-router | BIEN | Pipeline + Workspace | — |
| prompt-assembler | BIEN | Pipeline | Workspace (workspace tiene su propio prompt inline) |

**Veredicto:** Los servicios compartidos se crearon pero **2 de 3 no se usan donde deberían**. Es convergencia en papel, no en runtime.

---

## 14. Auditoría de UI / Dashboard

### Lo que funciona
- Listado de proyectos
- Tickets colapsables con timeline rica (modelo, tokens, duración, skills, handoff)
- Pipeline phases con status visual
- Waiting client card con pregunta real de ClientQuestion
- Waiting review card con contexto de fase
- Polling cada 5s
- Mesa de Trabajo con chat, insights panel, agent badges
- Botones Crear Ticket y Crear Cotización

### Gaps detectados
- **No hay listado de cotizaciones** — se crean pero no se ven
- **No hay listado de tickets creados desde workspace** — el linkedTicketId se muestra pero no linkea a la página del proyecto
- **El polling no refresca questions en workspace** — solo refresca tickets
- **El SSE por fase actualiza pipeline en vivo pero NO actualiza responseText** — el output de fase va al buffer general
- **No hay indicador de costo acumulado del ticket** — tokensUsed existe en Session pero no se muestra

---

## 15. Auditoría de SSE / Observabilidad

### Lo que funciona
- phase-events.ts emite eventos al commandCenter
- phase-runner emite phase_output chunks durante API loop
- stream route retransmite phase_event al frontend
- UI maneja phase_started/completed/waiting/failed
- Polling como fallback

### Lo que falta
- **Orchestrator NO emite phase_completed/waiting_client/waiting_review** — solo importa las funciones pero la mayoría no se llama
- **No hay evento pipeline_completed** — el UI no sabe cuándo terminó todo
- **Output buffer es por sesión** — chunks de todas las fases se mezclan
- **Workspace no tiene SSE** — solo request-response

---

## 16. Auditoría de Sonnet 4.6 / Opus 4.6

### Routing actual
- **Sonnet default** para: small_fix, feature, qa_review, implementation, review, qa
- **Opus** para: architecture_change discovery/planning, new_module discovery, research, quotation discovery/planning
- **Workspace:** Opus para architecture_review, quotation_discovery, risk_review

### Evaluación
- **Correcto:** Opus donde hay razonamiento profundo
- **Correcto:** Sonnet para ejecución frecuente
- **Falta:** No hay escalamiento dinámico (si Sonnet produce output pobre, no escala a Opus automáticamente)
- **Falta:** No hay tracking de costo real por modelo ($3/MTok input Sonnet vs $15/MTok Opus)

---

## 17. Legacy / Deuda Técnica / Riesgos

| Issue | Severidad | Detalle |
|---|---|---|
| **launchSession() + runAPISession() siguen existiendo** | MEDIO | Marcados @deprecated pero el código sigue ahí. Si alguien los llama, entra por el viejo flujo |
| **DOS PARSERS** | ALTO | phase-result-parser y structured-output-parser hacen lo mismo de forma distinta |
| **client-question-service no conectado** | ALTO | El servicio compartido es código muerto para tickets |
| **Agent finder en 3 lugares** | MEDIO | agent-manager.ts, phase-runner.ts, store.ts — cada uno busca agentes por su cuenta |
| **Pipeline como JSON blob** | MEDIO | No queryable, no indexable, difícil de auditar a escala |
| **Sin tests** | ALTO | CERO tests automáticos. Todo se verifica manualmente |
| **Sin error boundaries** | MEDIO | Si una fase falla con error no esperado, el pipeline puede quedar en estado inconsistente |
| **3 archivos con ECC_ROOT hardcoded** | BAJO | Debería ser config centralizada |

---

## 18. Top 15 Gaps Reales Priorizados

| # | Gap | Impacto | Prioridad |
|---|---|---|---|
| 1 | **Sistema nunca probado end-to-end en producción** | No hay certeza de que funcione de verdad | CRÍTICO |
| 2 | **Dos parsers de output (duplicación activa)** | Inconsistencia entre pipeline y workspace parsing | ALTO |
| 3 | **client-question-service no conectado a pipeline** | Servicio compartido es código muerto | ALTO |
| 4 | **Orchestrator no emite SSE de completion/waiting** | UI no recibe eventos clave del pipeline | ALTO |
| 5 | **Workspace no carga agent.md real de los consultores** | Equipos consultivos son nombres, no expertise real | ALTO |
| 6 | **CERO tests automáticos** | Todo cambio puede romper algo sin detectarse | ALTO |
| 7 | **convertToTicket usa prompt() del browser** | UX mala para acción crítica | MEDIO |
| 8 | **No hay listado de cotizaciones** | Se crean pero no se ven | MEDIO |
| 9 | **Output buffer por sesión (no por fase)** | Chunks de fases distintas se mezclan | MEDIO |
| 10 | **63 agentes sin uso runtime** | Inversión masiva sin ROI operativo | MEDIO |
| 11 | **Sin timeout por fase** | Pipeline puede colgar indefinidamente | MEDIO |
| 12 | **Auto-classify con keywords básicas** | Puede clasificar mal tickets ambiguos | BAJO |
| 13 | **Sin tracking de costo real** | No se sabe cuánto cuesta cada ticket | BAJO |
| 14 | **Sin cache de agent/skill loading** | Lee filesystem en cada fase | BAJO |
| 15 | **prompt-assembler no se reusar en workspace** | Workspace tiene prompt inline distinto | BAJO |

---

## 19. Orden Exacto Recomendado de Implementación

### INMEDIATO (antes de seguir agregando features)

**Paso 1: PRUEBA END-TO-END REAL**
Ejecutar un pipeline completo de 3+ fases con Claude API real. Verificar que todo el flujo funciona: classify → build pipeline → run phase 1 → handoff → run phase 2 → waiting_client → respond → run phase 3 → complete. Sin esto, todo lo demás es teórico.

**Paso 2: UNIFICAR PARSERS**
Reemplazar phase-result-parser con structured-output-parser compartido. Un solo parser para ambos mundos.

**Paso 3: CONECTAR CLIENT-QUESTION-SERVICE A PIPELINE**
Que el orchestrator use createClientQuestion() del servicio compartido en vez de queries directas.

**Paso 4: COMPLETAR SSE DEL ORCHESTRATOR**
Emitir emitPhaseCompleted/WaitingClient/WaitingReview/PipelineCompleted en los puntos correctos del orchestrator.

### SIGUIENTE ITERACIÓN

**Paso 5:** Cargar agent.md real en consultas de workspace (no solo nombrar agentes)
**Paso 6:** Fix convertToTicket UX (select de proyectos en vez de prompt)
**Paso 7:** Listado de cotizaciones en UI
**Paso 8:** Tests automáticos para pipeline core (al menos 5 tests)

### DESPUÉS

**Paso 9:** Cache de agents/skills loading
**Paso 10:** Output buffer por fase
**Paso 11:** Timeout por fase
**Paso 12:** Prompt inspector / debug panel

---

## 20. Qué NO Conviene Tocar Todavía

| No tocar | Por qué |
|---|---|
| **Paralelismo de agentes** | El flujo secuencial ni siquiera está probado en producción |
| **Conectar los 63 agentes restantes** | Primero estabilizar los 19 conectados |
| **Cotizador enterprise** | QuotationDraft es suficiente por ahora |
| **Auto-classify con IA** | Las keywords funcionan; mejorarlo después |
| **Pipeline como tabla separada en DB** | El JSON blob funciona para el volumen actual |
| **Memoria compartida entre sesiones** | Los handoffs dentro del pipeline son suficientes |
| **Voting/consensus entre agentes** | Over-engineering para el estado actual |

---

**Conclusión brutal:** El sistema tiene una arquitectura impresionante en papel. 82 agentes, 37 skills, pipeline multiagente, Mesa de Trabajo, servicios compartidos, SSE, conversiones. Pero **nunca se ha ejecutado un pipeline completo de verdad con Claude API**. El paso #1 antes de TODO es una prueba de fuego real. Sin eso, estamos construyendo pisos sobre cimientos que no hemos verificado.

---

*Audit generado el 18 de Marzo de 2026 con base en código real verificado.*
