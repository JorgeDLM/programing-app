# FASE 6 — Autonomía Operativa + Mapa del Equipo Ideal

**Fecha:** 18 de Marzo de 2026

---

## PARTE 1: CAMBIOS DE AUTONOMÍA IMPLEMENTADOS

### 1A. Auto-ejecución secuencial: `runPipelineUntilBlocked()`
- **Archivo:** `src/lib/pipeline/pipeline-orchestrator.ts`
- **Comportamiento:** Ejecuta fases secuencialmente hasta encontrar un bloqueo
- **Stop conditions:** waiting_client, waiting_review, completed, failed, cancelled
- **Safety limit:** máximo 20 iteraciones
- **Después de approve/resume:** auto-continúa ejecutando fases restantes

### 1B. waiting_client blindado
- **Fix:** handleClientRespond ahora busca el questionId REAL desde la lifecycle API
- **Flujo:** fetch lifecycle → find pending question → respond con questionId real → resume → auto-run
- **Archivo:** `page.tsx` líneas 254-266

### 1C. waiting_review blindado
- **Flujo:** approve → marca fase completed → auto-continúa con runPipelineUntilBlocked
- **Reject:** marca fase failed con comentario persistido en handoffNotes
- **UI refresh:** automático después de approve/reject

### 1D. Project path dinámico
- **Fix:** `resolveProjectPath()` usa `PROJECTS_ROOT + projectName` en vez de path hardcodeado
- **Archivo:** `pipeline-orchestrator.ts` línea 41-43

### 1E. Rebalanceo de templates
- **feature:** implementation ahora usa `implementador` (antes usaba inspector-de-codigo)
- **new_module:** implementation usa `implementador`, discovery incluye patrones-postgresql
- **architecture_change:** implementation usa `implementador`
- **qa_review:** qa usa `tester-de-flujos` con pruebas-end-to-end (antes usaba maestro-de-pruebas)
- **Más skills conectados:** estandares-de-codigo, ciclo-de-verificacion, migraciones-de-base-de-datos

### 1F. UI refresh
- `refreshTicketState()` actualiza pipeline, status, currentPhase después de cada acción
- Todas las acciones (run, approve, reject, respond, cancel) llaman refresh

### 1G. Lifecycle API
- Nueva acción `run_pipeline` que ejecuta `runPipelineUntilBlocked()`
- `run_phase` se mantiene para ejecución manual de 1 sola fase

---

## PARTE 2: MAPA BASE DEL EQUIPO IDEAL

### Grupo 1: Dirección y Orquestación

| Agente | Propósito | Core/On-demand |
|---|---|---|
| **Operador** | Orquesta pipelines, decide equipos, supervisa ejecución | Core |
| **Triaje** | Clasifica tickets, asigna tipo, prioridad y equipo | Core |

### Grupo 2: Discovery / Research / Cotización

| Agente | Propósito | Core/On-demand |
|---|---|---|
| **Investigador** | Research profundo con múltiples fuentes, due diligence | Core |
| **Analista de Negocio** | Discovery comercial, alcance, requisitos, cotización | Core |
| **Consultor Técnico** | Consulta docs actualizadas, evalúa tecnologías | Core |

### Grupo 3: Arquitectura y Construcción

| Agente | Propósito | Core/On-demand |
|---|---|---|
| **Arquitecto** | Diseña estructura, evalúa trade-offs, define patrones | Core |
| **Planificador** | Desglosa en fases, identifica dependencias, estima | Core |
| **Implementador** | Construye código nuevo, modifica existente | Core |
| **Diseñador de BD** | Schema design, queries, migraciones, RLS | Core |
| **Diseñador Frontend** | UI/UX, componentes, responsive, accesibilidad | On-demand |

### Grupo 4: Validación / QA / Seguridad

| Agente | Propósito | Core/On-demand |
|---|---|---|
| **Inspector de Código** | Code review: calidad, patrones, bugs | Core |
| **Guardián de Seguridad** | Audit OWASP, secrets, auth, vulnerabilidades | Core |
| **Maestro de Pruebas** | TDD, unit tests, cobertura 80%+ | Core |
| **Tester de Flujos** | E2E con Playwright, flujos críticos | Core |

### Grupo 5: Documentación / Operaciones

| Agente | Propósito | Core/On-demand |
|---|---|---|
| **Documentador** | READMEs, codemaps, guías técnicas | Core |
| **Optimizador de Código** | Limpieza, dead code, refactoring | On-demand |
| **Doctor de Errores** | Fix rápido de build/tipos | Core |

### Grupo 6: Comercial / Growth

| Agente | Propósito | Core/On-demand |
|---|---|---|
| **Redactor** | Artículos, newsletters, contenido largo | On-demand |
| **Estratega de Contenido** | Campañas multiplataforma, calendarios | On-demand |
| **Diseñador de Presentaciones** | Pitch decks, slides HTML | On-demand |

### Grupo 7: Especialistas de Dominio

| Agente | Propósito | Core/On-demand |
|---|---|---|
| **Inspector Python** | Review especializado para proyectos Python | On-demand |
| **Generador de Medios** | Imágenes, video, audio via fal.ai | On-demand |

---

## PARTE 3: COMPARATIVA EQUIPO IDEAL VS SISTEMA ACTUAL

| Agente ideal | Estado actual | Acción |
|---|---|---|
| Operador | Existe como modo "operator" en agent-manager.ts (no es agente en /agents/) | CREAR como agente formal |
| Triaje | NO EXISTE | CREAR — es crítico para auto-clasificación |
| Investigador | NO EXISTE como agente (hay skills: investigacion-profunda, busqueda-neural) | CREAR — usar skills como base |
| Analista de Negocio | NO EXISTE | CREAR — cubre discovery/cotización |
| Consultor Técnico | YA EXISTE: `consultor-tecnico` | OK — funciona bien |
| Arquitecto | YA EXISTE: `arquitecto` | OK — bien documentado |
| Planificador | YA EXISTE: `planificador` | OK — bien documentado |
| Implementador | YA EXISTE: `implementador` | OK — recién creado, ahora en templates |
| Diseñador de BD | YA EXISTE: `disenador-de-base-de-datos` | MEJORAR — no estaba en templates, ahora parcial |
| Diseñador Frontend | NO EXISTE como tal (documentador cubre parcialmente) | CREAR — separar de documentador |
| Inspector de Código | YA EXISTE: `inspector-de-codigo` | OK — bien documentado |
| Guardián de Seguridad | YA EXISTE: `guardian-de-seguridad` | OK — bien documentado |
| Maestro de Pruebas | YA EXISTE: `maestro-de-pruebas` | OK — en templates |
| Tester de Flujos | YA EXISTE: `tester-de-flujos` | OK — ahora en qa_review template |
| Documentador | YA EXISTE: `documentador` | MEJORAR — no en templates, rol ambiguo |
| Optimizador de Código | YA EXISTE: `optimizador-de-codigo` | OK — on-demand, no necesita template |
| Doctor de Errores | YA EXISTE: `doctor-de-errores` | OK — en small_fix template |
| Redactor | NO EXISTE (hay skill: escritura-de-articulos) | CREAR más adelante |
| Estratega de Contenido | NO EXISTE (hay skill: motor-de-contenido) | CREAR más adelante |
| Inspector Python | YA EXISTE: `inspector-python` | OK — on-demand |
| Generador de Medios | NO EXISTE (hay skill: generacion-de-medios) | CREAR más adelante |

### Agentes actuales que SOBRAN o necesitan acción

| Agente actual | Veredicto |
|---|---|
| `optimizador-de-ia` (0.9KB) | REESCRIBIR o ELIMINAR — esqueleto sin contenido |
| `supervisor-de-procesos` (0.9KB) | REESCRIBIR o ELIMINAR — esqueleto sin contenido |
| `jefe-de-personal` | ARCHIVAR — gestiona email/Slack/LINE, no aplica al flujo actual |

---

## PARTE 4: TOP AGENTES FALTANTES PRIORIZADOS

### Crear AHORA (próxima implementación)

| # | Nombre | Grupo | Problema que resuelve | Model |
|---|---|---|---|---|
| 1 | `triaje` | Dirección | Auto-clasifica tickets por tipo, prioridad y equipo | Sonnet |
| 2 | `investigador` | Discovery | Research profundo que hoy no tiene agente real | Opus |
| 3 | `analista-de-negocio` | Discovery | Discovery comercial, alcance, cotización profesional | Opus |
| 4 | `disenador-frontend` | Construcción | UI/UX que hoy mezcla con documentador | Sonnet |

### Crear en siguiente ola

| # | Nombre | Grupo | Problema que resuelve | Model |
|---|---|---|---|---|
| 5 | `redactor` | Comercial | Artículos, newsletters con voz personalizada | Sonnet |
| 6 | `estratega-de-contenido` | Comercial | Campañas multiplataforma, calendarios | Sonnet |
| 7 | `generador-de-medios` | Especialista | Imágenes, video, audio via fal.ai | Sonnet |
| 8 | `cotizador` | Discovery | Genera presupuestos formales con desglose | Opus |
| 9 | `disenador-de-presentaciones` | Comercial | Pitch decks, slides HTML animadas | Sonnet |
| 10 | `auditor-de-performance` | QA | Optimización de rendimiento, Core Web Vitals | Sonnet |

### Pueden esperar

| # | Nombre | Grupo | Razón para esperar |
|---|---|---|---|
| 11 | `integrador-de-apis` | Construcción | Solo cuando haya proyectos con muchas integraciones |
| 12 | `especialista-de-deploy` | Operaciones | Solo cuando haya CI/CD complejo |
| 13 | `analista-de-datos` | Especialista | Solo para proyectos data-heavy |
| 14 | `gestor-de-dependencias` | Operaciones | Baja prioridad, cubierto parcialmente por doctor-de-errores |
| 15 | `traductor` | Contenido | Solo si hay internacionalización |

---

## PARTE 5: SKILLS FALTANTES O A REORGANIZAR

### Skills nuevos sugeridos

| Skill | Tipo | Para qué | Agentes compatibles |
|---|---|---|---|
| `prisma-patterns` | reference | ORM principal del stack | implementador, disenador-de-base-de-datos |
| `supabase-patterns` | reference | Real-time, presence, RLS | arquitecto, disenador-de-base-de-datos |
| `zod-validation` | reference | Validación de inputs | implementador, inspector-de-codigo |
| `tailwind-patterns` | reference | Framework UI principal | implementador, disenador-frontend |
| `politica-de-escalamiento` | active | Cuándo consultar al cliente | TODOS los agentes |
| `flujos-de-equipo` | active | Qué equipo por tipo de ticket | triaje, operador |

### Skills actuales mal aprovechados

| Skill | Problema | Acción |
|---|---|---|
| patrones-postgresql | No estaba en ningún template | Ahora en new_module(discovery) |
| migraciones-de-base-de-datos | No estaba en fases | Ahora en new_module(planning) |
| pruebas-end-to-end | No conectado | Ahora en qa_review(qa) |
| ciclo-de-verificacion | Solo en 1 template | Ahora en qa_review(finalization) y architecture_change(qa) |
| calidad-de-codigo | No conectado a ningún flujo | Debería ir en review de inspector-de-codigo |
| integracion-claude | No conectado | Útil para implementador cuando trabaja con Claude API |

---

## PARTE 6: PRIORIZACIÓN REALISTA

### A. Implementado YA en esta fase
1. `runPipelineUntilBlocked()` — auto-ejecución secuencial
2. Fix de templates (implementador en implementation, tester-de-flujos en qa)
3. Fix de questionId real en waiting_client
4. Fix de projectPath dinámico
5. UI refresh después de cada acción
6. `run_pipeline` action en lifecycle API

### B. Crear inmediatamente después (próximos 4 agentes)
1. `triaje` — auto-clasificación de tickets
2. `investigador` — research real con skills como base
3. `analista-de-negocio` — discovery y cotización
4. `disenador-frontend` — separar de documentador

### C. Siguiente ola (5-10 agentes)
5-10. redactor, estratega-de-contenido, generador-de-medios, cotizador, disenador-de-presentaciones, auditor-de-performance

### D. Pueden esperar
11-15. integrador-de-apis, especialista-de-deploy, analista-de-datos, gestor-de-dependencias, traductor

### E. NO crear todavía
- Agentes paralelos simultáneos
- Votación entre agentes
- Memoria compartida cross-sesión
- Auto-clasificación 100% por IA sin control humano

---

## PARTE 7: PENDIENTES PARA SIGUIENTE FASE

| Pendiente | Prioridad |
|---|---|
| Crear agente `triaje` para auto-clasificación | Alta |
| SSE streaming durante ejecución de fases del pipeline | Alta |
| Polling automático en UI (cada 5s para tickets running) | Alta |
| Crear los 4 agentes faltantes inmediatos | Alta |
| Crear los 6 skills faltantes | Media |
| Telemetría de tokens input/output separados (requiere parsear usage de Claude API response) | Media |
| Reescribir optimizador-de-ia y supervisor-de-procesos o eliminarlos | Baja |
| Archivar jefe-de-personal | Baja |

---

*Documento generado el 18 de Marzo de 2026.*
