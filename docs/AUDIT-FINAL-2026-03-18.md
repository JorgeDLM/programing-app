# AUDIT FINAL — Estado Real del Sistema Multiagente

**Fecha:** 18 de Marzo de 2026
**Tipo:** Verificacion dirigida post-iteracion

---

## 1. Resumen Ejecutivo

El sistema tiene 82 agentes definidos en 11 equipos, 37 skills, pipeline con ejecucion por fases, orquestador con auto-run, waiting_client, waiting_review, y un dashboard funcional. La estructura de agentes es solida y world-class.

**Lo que SI opera hoy de verdad:**
- Agentes se cargan dinamicamente desde agent.md (loadAgentPrompt con busqueda en grupos)
- Skills se cargan como contexto (loadSkills)
- Pipeline se persiste en DB como JSON en Session
- Orchestrator ejecuta fases secuencialmente con runPipelineUntilBlocked
- Templates asignan equipos por tipo de ticket
- waiting_client y waiting_review existen en el modelo

**Lo que NO opera todavia:**
- El flujo team_pipeline nunca se ha ejecutado end-to-end en produccion
- La politica de escalamiento existe como skill pero NO se inyecta automaticamente
- La mayoria de los 82 agentes existen solo como archivos .md — no estan conectados a ningun template
- No hay auto-clasificacion de tickets
- No hay SSE durante ejecucion de fases del pipeline
- La UI no hace polling automatico del estado del ticket

---

## 2. Estado Actual vs Objetivos Finales

| # | Objetivo | Estado | Detalle |
|---|---|---|---|
| 1 | Operar proyectos reales desde dashboard | **PARCIAL** | Funciona para single_agent. Pipeline team_pipeline existe pero no probado end-to-end |
| 2 | Equipos de agentes por ticket | **PARCIAL** | Templates definen equipos. Orchestrator puede ejecutar fases. Pero solo 8 agentes de 82 estan en templates |
| 3 | Flujo real con fases/handoffs/validaciones | **PARCIAL** | Modelo existe. runPipelineUntilBlocked funciona. Handoffs se persisten. Pero no probado en produccion |
| 4 | Pausar y consultar al cliente | **PARCIAL** | ClientQuestion en DB. UI tiene card de waiting_client. Pero questionId no se resuelve bien en UI |
| 5 | Evitar implementacion a lo loco | **PARCIAL** | Politica de escalamiento creada como skill. Regla 6 en prompt. Pero NO se inyecta automaticamente en todos los agentes |
| 6 | Agentes + Skills separados correctamente | **SI** | Separacion clara. store.ts lista por separado. UI tiene dropdowns independientes |
| 7 | Autonomia controlada del pipeline | **SI** | runPipelineUntilBlocked implementado. Para en waiting_client/review/failed/completed |
| 8 | Dashboard refleja estado real | **PARCIAL** | Pipeline phases view existe. Waiting cards existen. Pero no hay polling automatico ni SSE por fase |
| 9 | Routing Sonnet vs Opus | **SI** | model-router.ts funciona. Templates definen recommendedModel por fase |
| 10 | Sistema escalable | **SI** | findAgentFile busca en grupos. Agregar agentes = crear carpeta. Templates extensibles |

---

## 3. Que Ya Quedo Bien

| Area | Que funciona |
|---|---|
| **Estructura de agentes** | 82 agentes en 11 equipos con agent.md + descripcion.md, busqueda dinamica por grupos |
| **Skills** | 37 skills en /.agents/skills/ con SKILL.md + descripcion.md, carga on-demand |
| **Agent loader** | loadAgentPrompt() busca en agents/{grupo}/{agente}/agent.md automaticamente |
| **Skill loader** | loadSkills() lee SKILL.md y concatena como contexto |
| **Team templates** | 7 templates definidos: small_fix, feature, new_module, architecture_change, research, quotation, qa_review |
| **Pipeline model** | PipelinePhase con status, handoffNotes, tokensUsed, durationMs, retryCount |
| **Orchestrator** | runCurrentPhase + runPipelineUntilBlocked + resume + approve + reject + retry |
| **Model routing** | resolveModel() decide Sonnet vs Opus por fase, ticket, contexto |
| **Prompt assembler** | buildPhasePrompt() con bloques estructurados |
| **Phase result parser** | Parsea [REQUIERE_APROBACION], [RESUMEN EJECUTIVO], archivos, riesgos |
| **DB schema** | Session con pipeline JSON, currentPhase, ticketType, executionMode, ClientQuestion |
| **Lifecycle API** | 10 acciones: classify, respond, ask_client, advance, run_phase, run_pipeline, resume, approve_review, reject_review, retry_phase, cancel |
| **Escalation policy** | Skill politica-de-escalamiento creado con reglas claras |
| **AI optimizer** | Agente optimizador-de-ai creado con prompt optimization + model routing expertise |

---

## 4. Que Ya Esta Implementado DE VERDAD (en codigo, no solo en docs)

| Pieza | Archivo | Funciona |
|---|---|---|
| Agent loader dinamico | agent-manager.ts (findAgentFile + loadAgentPrompt) | SI |
| Skill loader | agent-manager.ts (loadSkills) | SI |
| Pipeline builder | pipeline-builder.ts (buildPipeline) | SI |
| Phase runner | phase-runner.ts (runPhase) | SI |
| Phase result parser | phase-result-parser.ts (parsePhaseResult) | SI |
| Orchestrator auto-run | pipeline-orchestrator.ts (runPipelineUntilBlocked) | SI |
| Model router | model-router.ts (resolveModel) | SI |
| Prompt assembler | prompt-assembler.ts (buildPhasePrompt) | SI |
| Escalation policy | escalation-policy.ts (checkEscalation) | SI pero no conectado automaticamente |
| Lifecycle API | tickets/[id]/lifecycle/route.ts | SI |
| ClientQuestion model | prisma schema | SI |
| Pipeline UI | page.tsx (pipeline timeline, waiting cards, controls) | SI pero sin polling |
| Team templates | team-templates.ts | SI |
| Store agents+skills | store.ts (listECCAgents, listECCSkills, listAllAgents) | SI |

---

## 5. Que Existe Pero NO Esta Conectado

| Pieza | Existe en | Problema |
|---|---|---|
| **74 de 82 agentes** | /agents/ como .md | Solo 8 estan en team templates (planificador, arquitecto, implementador, inspector-de-codigo, guardian-de-seguridad, maestro-de-pruebas, tester-de-flujos, consultor-tecnico, doctor-de-errores). Los otros 74 existen como archivos pero ningun template los usa |
| **politica-de-escalamiento** | /.agents/skills/ | Existe como skill pero NO se inyecta automaticamente. Hay que seleccionarla manualmente o cargarla en el prompt-assembler |
| **optimizador-de-ai** | /agents/equipo-direccion/ | Existe como agente pero no hay logica que lo use para routing automatico |
| **defensor-del-cliente** | /agents/equipo-direccion/ | Existe pero no hay fase de "client validation" que lo invoque |
| **validador-de-salida** | /agents/equipo-direccion/ | Existe pero no hay fase de "finalization review" que lo use |
| **project-manager** | /agents/equipo-analisis/ | Existe pero no es el planificador de los templates — los templates usan planificador |
| **Auto-clasificacion** | getDefaultTicketType() en team-templates.ts | La funcion existe pero NO se llama automaticamente al crear ticket. El usuario debe seleccionar tipo o hacer POST classify manualmente |
| **SSE por fase** | NO existe | El phase-runner ejecuta pero no emite eventos SSE. El frontend no ve progreso en vivo durante pipeline |
| **Polling de estado** | page.tsx refreshTicketState() | La funcion existe pero solo se llama despues de acciones manuales. No hay polling periodico |

---

## 6. Que Sigue Mal o Fragil

| Issue | Severidad | Detalle |
|---|---|---|
| **single_agent sigue siendo el flujo principal** | ALTO | Cuando el usuario escribe una tarea sin seleccionar tipo, va a runAPISession() que es el viejo flujo de 1 agente. No pasa por pipeline. |
| **Dos motores de ejecucion paralelos** | ALTO | agent-manager.ts tiene runAPISession() (viejo, single) Y el pipeline tiene runCurrentPhase() (nuevo, multi). No estan unificados. Un ticket puede ir por un camino o por el otro dependiendo de si se clasifico o no. |
| **questionId vacio en handleClientRespond** | MEDIO | El UI ahora busca el questionId real via lifecycle API, pero si no hay pregunta pendiente, el respond falla silenciosamente |
| **Templates solo usan 8 de 82 agentes** | MEDIO | 90% del equipo esta definido pero no participa en ningun flujo |
| **politica-de-escalamiento no se inyecta automaticamente** | MEDIO | Esta en el prompt-assembler como getEscalationRulesForPrompt() pero es texto generico, no el skill completo |
| **No hay auto-classify al crear ticket** | MEDIO | El usuario debe seleccionar tipo manualmente o llamar classify despues |

---

## 7. Que Falta Para Cumplir Cada Objetivo Final

| Objetivo | Que falta |
|---|---|
| 1. Proyectos reales | Unificar flujo: que TODOS los tickets pasen por pipeline, no solo los que se clasifican manualmente |
| 2. Equipos por ticket | Expandir templates para usar mas de los 82 agentes. Templates actuales solo usan 8 |
| 3. Flujo real | Auto-classify al crear ticket. Eliminar dual-path (runAPISession vs pipeline) |
| 4. Consulta al cliente | Inyectar politica-de-escalamiento como skill obligatorio en TODAS las fases. Hacer que los agentes realmente usen [REQUIERE_APROBACION] |
| 5. No a lo loco | Mismo que 4. La politica existe pero no se inyecta automaticamente |
| 6. Agentes + Skills | Ya funciona correctamente |
| 7. Autonomia pipeline | Ya funciona con runPipelineUntilBlocked |
| 8. Dashboard refleja estado | Agregar polling automatico cada 5s para tickets running. SSE para progreso en vivo seria ideal pero polling es suficiente |
| 9. Sonnet vs Opus | Ya funciona con model-router |
| 10. Escalabilidad | Ya funciona. Agregar agente = crear carpeta con agent.md |

---

## 8. Top 10 Gaps Finales Priorizados

| # | Gap | Impacto | Prioridad | Area |
|---|---|---|---|---|
| 1 | **Dos motores de ejecucion (runAPISession vs pipeline)** | Tickets van por camino equivocado si no se clasifican | CRITICO | agent-manager.ts |
| 2 | **No hay auto-classify al crear ticket** | El usuario debe hacer classify manual despues de crear | ALTO | chat route |
| 3 | **politica-de-escalamiento no se inyecta automaticamente** | Agentes pueden tomar decisiones sensibles sin consultar | ALTO | prompt-assembler.ts |
| 4 | **74 agentes no conectados a templates** | Solo 8 de 82 participan en algun flujo real | ALTO | team-templates.ts |
| 5 | **No hay polling automatico en UI** | Despues de run_pipeline la UI no se actualiza sola | MEDIO | page.tsx |
| 6 | **No hay SSE durante fases del pipeline** | El usuario no ve progreso en vivo durante pipeline execution | MEDIO | phase-runner.ts |
| 7 | **Pipeline nunca probado end-to-end en produccion** | Todo el sistema team_pipeline es teorico hasta que se pruebe | MEDIO | Integracion |
| 8 | **Templates no usan agentes especializados nuevos** | desarrollador-backend, desarrollador-frontend, arquitecto-backend, tester-frontend etc. no se usan | MEDIO | team-templates.ts |
| 9 | **handleClientRespond puede fallar silenciosamente** | Si no encuentra questionId pendiente, no hace nada | BAJO | page.tsx |
| 10 | **Documentacion desactualizada** | INVENTARIO-TECNICO y REVIEW-EQUIPOS tienen datos pre-iteracion | BAJO | docs/ |

---

## 9. Orden Exacto de Implementacion Recomendado

### Fase Siguiente: UNIFICACION (resolver gaps 1-3)

**Paso 1:** Auto-classify al crear ticket
- En chat route, despues de crear la sesion, llamar auto-classify con getDefaultTicketType()
- Crear pipeline automaticamente con buildPipeline()
- Cambiar status a "ready" en vez de "running"

**Paso 2:** Unificar motor de ejecucion
- Eliminar runAPISession() como flujo principal
- TODOS los tickets pasan por pipeline (single_agent crea pipeline de 1 fase)
- Un solo camino de ejecucion: chat → classify → pipeline → run_pipeline

**Paso 3:** Inyectar politica-de-escalamiento automaticamente
- En prompt-assembler.ts, cargar el SKILL.md de politica-de-escalamiento como bloque obligatorio
- Que TODOS los agentes reciban la politica sin tener que seleccionarla manualmente

**Paso 4:** Polling automatico en UI
- setInterval cada 5 segundos para tickets con status "running"
- Llamar refreshTicketState() automaticamente

### Fase Despues: EXPANSION

**Paso 5:** Expandir templates con agentes especializados
- feature: usar desarrollador-backend o desarrollador-frontend segun el proyecto
- new_module: agregar disenador-de-base-de-datos en discovery
- qa_review: usar tester-frontend + ingeniero-de-pruebas-backend en vez de generico

**Paso 6:** SSE streaming durante pipeline
- Integrar phase-runner con EventEmitter del commandCenter
- Emitir eventos de progreso por fase al frontend

---

## 10. Que NO Conviene Tocar Todavia

| No tocar | Por que |
|---|---|
| Paralelismo de agentes | El sistema secuencial funciona. Paralelismo agrega complejidad sin necesidad inmediata |
| Votacion entre agentes | Over-engineering para el estado actual |
| Auto-creacion de agentes | Demasiado pronto. Primero estabilizar los que existen |
| Clasificacion 100% automatica por IA | El heuristic getDefaultTicketType() es suficiente por ahora. Agregar IA clasificadora despues |
| Conectar los 82 agentes de golpe | Ir gradual. Expandir templates de a 2-3 agentes por iteracion |
| Memoria compartida entre sesiones | No necesario todavia. Los handoffs dentro del pipeline son suficientes |

---

## 11. Riesgos Si Seguimos Sin Arreglar los Gaps

| Riesgo | Si no se arregla |
|---|---|
| **Dual-path de ejecucion** | Los usuarios van a crear tickets que nunca pasan por pipeline. El sistema team_pipeline sera codigo muerto |
| **Sin auto-classify** | Nadie va a hacer el paso manual de classify. Los tickets se quedan como single_agent siempre |
| **Sin politica inyectada** | Los agentes van a implementar cambios de schema, auth, reglas de negocio sin consultar |
| **Sin polling** | Los usuarios van a pensar que el sistema esta roto porque la UI no se actualiza |
| **74 agentes sin usar** | Inversion masiva en definicion de agentes que nunca participan en el flujo real |

**Conclusion:** Los gaps 1-3 (unificar motor, auto-classify, inyectar politica) son BLOQUEANTES para que el sistema cumpla su objetivo. Sin resolverlos, el pipeline multiagente es codigo muerto y el sistema sigue operando como single-agent con un dropdown bonito.

---

*Audit generado el 18 de Marzo de 2026 con base en codigo real.*
