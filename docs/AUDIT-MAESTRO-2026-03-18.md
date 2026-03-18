# AUDIT MAESTRO — Sistema de Agentes, Skills y Dashboard

**Fecha:** 18 de Marzo de 2026
**Auditor:** Cascade (AI Architect)
**Repos:** programing-app + claude-dashboard
**Version del sistema:** v8-history-2026

---

## 1. Resumen Ejecutivo

El sistema actual tiene dos repositorios:

- **programing-app**: 15 agentes reales + 36 skills de conocimiento, todos con nombres en espanol
- **claude-dashboard**: Frontend Next.js que gestiona proyectos, tickets y ejecucion via Claude API

**Lo que funciona hoy:**
- Dashboard descubre proyectos del filesystem
- Crea tickets y asigna UN agente por ticket
- Ejecuta herramientas REALES sobre el filesystem (leer, escribir, buscar)
- Streamea respuestas en vivo via SSE
- Persiste todo en PostgreSQL (sesiones, logs, mensajes, memorias)
- Auth con login/password para acceso remoto via ngrok
- Modo "operador" que simula multi-agente en una sola sesion

**Bug critico activo:**
El `agent-manager.ts` tiene un switch-case (lineas 413-426) que usa nombres VIEJOS en ingles para asignar system prompts a los agentes. Como los archivos ahora se llaman en espanol, NINGUN agente matchea — todos reciben un prompt generico identico. Los `.md` de cada agente tienen prompts completos y detallados que NUNCA se inyectan.

**Brechas principales:**
- No hay equipos multiagente (1 ticket = 1 agente)
- Los skills nunca se cargan como contexto
- No hay mecanismo de escalamiento al cliente (el agente decide todo solo)
- No hay fases, handoffs ni validaciones entre pasos
- No hay distincion de tipos de ticket (feature, fix, audit, cotizacion)

---

## 2. Como Entendi el Sistema Actual

### Arquitectura de dos repos

```
programing-app/              claude-dashboard/
├── agents/                  ├── src/lib/
│   ├── planificador/        │   ├── agent-manager.ts  ← motor de ejecucion
│   │   ├── agent.md         │   ├── store.ts          ← lee agentes y skills
│   │   └── descripcion.md   │   └── prisma.ts         ← acceso a DB
│   └── ... (15 carpetas)    ├── src/app/
│                            │   ├── api/chat/         ← crea tickets
├── .agents/skills/          │   ├── api/agents/stream/ ← SSE en vivo
│   ├── patrones-backend/    │   ├── api/ecc/agents/   ← lista agentes+skills
│   │   ├── SKILL.md         │   └── project/[id]/     ← UI del proyecto
│   │   ├── descripcion.md   ├── prisma/
│   │   └── agents/          │   └── schema.prisma     ← Session, Log, Memory, etc
│   │       └── openai.yaml  └── .env
│   └── ... (36 carpetas)
```

### Flujo de ejecucion real hoy

```
1. Usuario abre dashboard → ve lista de proyectos (descubiertos del filesystem)
2. Entra a un proyecto → ve historial de tickets (sesiones) desde DB
3. Escribe directiva + opcionalmente selecciona agente del dropdown
4. POST /api/chat/{projectId} → { message, agent }
5. Si no eligio agente → default "operator"
6. commandCenter.launchSession() crea sesion en memoria + DB
7. runAPISession() construye systemPrompt:
   a. Rol del agente (switch-case ROTO — cae a generico)
   b. Info del proyecto (nombre, path, branch, framework)
   c. Memorias globales + proyecto (desde DB)
   d. Si es operator → instrucciones de orquestacion simulada
   e. 4 herramientas: search_files, read_file, list_dir, write_file
8. Llama a Claude API (claude-sonnet-4-6) con loop hasta 10-20 iteraciones
9. Claude puede responder con texto O llamar herramientas (ejecutadas REALES)
10. Output se streamea via SSE al frontend en tiempo real
11. Al terminar: persiste sesion, logs, responseText en PostgreSQL
12. Frontend muestra ticket con respuesta, logs, archivos modificados
```

---

## 3. Inventario Real de Agentes (15)

Cada agente es una carpeta en `/agents/` con `agent.md` (system prompt + frontmatter YAML) y `descripcion.md` (perfil en espanol).

| # | Carpeta | Rol | Tools | Model | Tam | Docs |
|---|---|---|---|---|---|---|
| 1 | planificador | Crea planes de implementacion detallados | Read, Grep, Glob | opus | 7.2KB | Completa |
| 2 | arquitecto | Disena arquitectura y evalua trade-offs | Read, Grep, Glob | opus | 8.1KB | Completa |
| 3 | inspector-de-codigo | Revisa calidad, seguridad, patrones | Read, Grep, Glob, Bash | sonnet | 8.8KB | Completa |
| 4 | guardian-de-seguridad | Audita seguridad OWASP, secrets, auth | Read, Grep, Glob, Bash | sonnet | 4.5KB | Completa |
| 5 | maestro-de-pruebas | TDD, cobertura 80%+, test-first | Read, Write, Edit, Bash, Grep, Glob | sonnet | 2.9KB | Completa |
| 6 | doctor-de-errores | Fix de build/tipos con cambios minimos | Read, Write, Edit, Bash, Grep, Glob | sonnet | 3.8KB | Completa |
| 7 | optimizador-de-codigo | Limpia codigo muerto, duplicados | Read, Grep, Glob, Bash | sonnet | 2.7KB | Completa |
| 8 | disenador-de-base-de-datos | Optimiza queries, schemas, indices, RLS | Read, Write, Edit, Bash, Grep, Glob | sonnet | 4.3KB | Completa |
| 9 | tester-de-flujos | E2E con Playwright, anti-flaky | Read, Write, Edit, Bash, Grep, Glob | sonnet | 4.1KB | Completa |
| 10 | documentador | Genera codemaps, actualiza READMEs | Read, Write, Edit, Bash, Grep, Glob | haiku | 3.4KB | Completa |
| 11 | consultor-tecnico | Busca docs actualizadas via Context7 MCP | Read, Grep, Glob, Bash | sonnet | 3.6KB | Completa |
| 12 | inspector-python | Revisa Python: PEP 8, seguridad, types | Read, Grep, Glob, Bash | sonnet | 3.4KB | Completa |
| 13 | optimizador-de-ia | Optimiza config del sistema de agentes | Read, Grep, Glob | sonnet | 0.9KB | INSUFICIENTE |
| 14 | supervisor-de-procesos | Monitorea loops autonomos | Read, Grep, Glob, Bash | sonnet | 0.9KB | INSUFICIENTE |
| 15 | jefe-de-personal | Gestiona comunicaciones multi-canal | Read, Grep, Glob, Bash, Edit, Write | opus | 5.6KB | Completa |

### Observaciones criticas sobre agentes

- **Bug activo:** El agent-manager.ts NO lee los agent.md como system prompt. Tiene un switch-case hardcoded con nombres viejos en ingles que ya no matchean. TODOS los agentes se comportan igual hoy.
- **2 agentes esqueleto:** optimizador-de-ia (0.9KB) y supervisor-de-procesos (0.9KB) no tienen contenido operativo real.
- **No existe un agente Implementador** que construya codigo nuevo — el doctor solo arregla, el inspector solo revisa.
- **jefe-de-personal** gestiona email/Slack/LINE — puede no aplicar al flujo actual del dashboard.

---

## 4. Inventario Real de Skills (36)

Cada skill es una carpeta en `/.agents/skills/` con `SKILL.md` (conocimiento), `descripcion.md` (perfil en espanol), y algunos con `agents/openai.yaml` (metadata UI).

**Un skill NO es un agente.** Es conocimiento cargable que enriquece al agente en turno.

### Skills de Stack Tecnico (referencia)

| # | Carpeta | Aporta |
|---|---|---|
| 1 | diseno-de-apis | Patrones REST, status codes, paginacion |
| 2 | patrones-backend | Arquitectura Node.js/Next.js/Express |
| 3 | patrones-frontend | React/Next.js components, state, performance |
| 4 | patrones-postgresql | PostgreSQL queries, indices, RLS, Supabase |
| 5 | patrones-python | Idiomas Python, PEP 8, type hints |
| 6 | estandares-de-codigo | Convenciones universales TS/JS/React |
| 7 | nextjs-y-turbopack | Next.js 16+ Turbopack config |
| 8 | runtime-bun | Bun vs Node, migracion |
| 9 | integracion-claude | Claude API: streaming, tools, caching |
| 10 | servidores-mcp | Build MCP servers con Node/TS |
| 11 | migraciones-de-base-de-datos | Schema changes, rollbacks, Prisma |

### Skills de Workflow y Calidad

| # | Carpeta | Aporta |
|---|---|---|
| 12 | desarrollo-guiado-por-tests | TDD workflow Red-Green-Refactor |
| 13 | pruebas-end-to-end | Playwright patterns, Page Object Model |
| 14 | revision-de-seguridad | Checklist OWASP completo |
| 15 | ciclo-de-verificacion | Build+lint+tests+security pipeline |
| 16 | testing-python | pytest, fixtures, mocking, cobertura |
| 17 | testing-de-regresion-ia | Detectar puntos ciegos de IA |
| 18 | calidad-de-codigo | Auto-formato y linting en tiempo real |
| 19 | evaluacion-de-sesiones | Eval-driven development |
| 20 | recuperacion-iterativa | Contexto progresivo para multi-agente |
| 21 | escaneo-de-seguridad | Audit de config de agentes con AgentShield |
| 22 | inventario-de-skills | Audit de calidad de skills |
| 23 | ejemplo-de-guias | Template para skills de proyecto |

### Skills de IA y Operaciones

| # | Carpeta | Aporta |
|---|---|---|
| 24 | investigacion-profunda | Research con firecrawl/exa MCPs |
| 25 | busqueda-neural | Exa neural search web/codigo/empresas |
| 26 | consulta-de-documentacion | Docs via Context7 MCP |
| 27 | aprendizaje-continuo | Extraccion automatica de patrones v1 |
| 28 | aprendizaje-continuo-v2 | Instincts con scoring de confianza |
| 29 | compactacion-estrategica | Gestion de contexto en sesiones largas |
| 30 | orquestacion-multi-agente | Workflows paralelos con dmux |
| 31 | configuracion-del-sistema | Instalador interactivo del sistema |

### Skills de Contenido y Negocio

| # | Carpeta | Aporta |
|---|---|---|
| 32 | escritura-de-articulos | Redaccion con voz personalizada |
| 33 | motor-de-contenido | Contenido multiplataforma |
| 34 | publicacion-multiplataforma | Crosspost X/LinkedIn/Threads |
| 35 | api-de-x | X/Twitter API integration |
| 36 | investigacion-de-mercado | Market sizing, competidores |
| 37 | materiales-para-inversores | Pitch decks, one-pagers |
| 38 | contacto-con-inversores | Cold emails, follow-ups |
| 39 | generacion-de-medios | fal.ai: imagenes, video, audio |
| 40 | presentaciones-html | Slides HTML animadas |
| 41 | edicion-de-video | Pipeline FFmpeg/Remotion/fal.ai |

### Observaciones sobre skills

- **NINGUN skill se carga hoy.** El agent-manager.ts no tiene codigo para leer SKILL.md ni inyectarlo. Son documentacion inerte.
- **4 skills duplican agentes existentes:** consulta-de-documentacion (= consultor-tecnico), pruebas-end-to-end (= tester-de-flujos), desarrollo-guiado-por-tests (= maestro-de-pruebas), revision-de-seguridad (= guardian-de-seguridad). Esto no es problema — el skill da el conocimiento, el agente da la ejecucion.
- **12 skills podrian convertirse en agentes futuros** (escritura-de-articulos, investigacion-profunda, generacion-de-medios, etc.) porque describen workflows ejecutables completos.

---

## 5. Que Hace Cada Agente HOY (Realidad)

**Realidad dura:** Hoy TODOS los agentes hacen exactamente lo mismo porque el switch-case en agent-manager.ts no matchea los nombres en espanol. Todos reciben: *"Eres un agente de desarrollo experto."*

Lo que DEBERIAN hacer (segun su agent.md que no se lee):

| Agente | Lo que DEBERIA hacer | Lo que HACE hoy |
|---|---|---|
| planificador | Plan detallado con fases y dependencias | Prompt generico |
| arquitecto | Disenho de sistemas con trade-offs | Prompt generico |
| inspector-de-codigo | Review con git diff, CRITICAL/HIGH/MEDIUM | Prompt generico |
| guardian-de-seguridad | Audit OWASP con checklist completo | Prompt generico |
| maestro-de-pruebas | TDD con ciclo Red-Green-Refactor | Prompt generico |
| doctor-de-errores | Fix minimo sin refactor | Prompt generico |
| Todos los demas | Rol especializado segun su .md | Prompt generico |

---

## 6. Que Aporta Cada Skill HOY (Realidad)

**Realidad:** NADA. Los skills no se cargan en ningun momento. Son archivos .md con conocimiento valioso que el sistema ignora completamente.

Lo que DEBERIAN aportar: contexto especializado cargado en el system prompt del agente que este trabajando, para que tome mejores decisiones basadas en patrones probados.

---

## 7. Documentacion — Estado

| Elemento | agent.md / SKILL.md | descripcion.md | openai.yaml |
|---|---|---|---|
| 15 agentes | 13 completos, 2 esqueletos | 15 de 15 | Ninguno tiene |
| 36 skills | 36 de 36 | 36 de 36 (13 recien creados) | ~18 de 36 tienen |

La documentacion es buena en contenido pero **el runtime la ignora** porque el agent-manager.ts no la lee.

---

## 8. Flow Real del Dashboard Hoy

### Modelo de datos (Prisma)

```
Session: id, projectId, projectName, directive, agentName, status, hasChanges, responseText
Log: id, sessionId, type, tool, file, summary, detail, timestamp
ChatMessage: id, projectId, sessionId, role, content, agent, timestamp
Memory: id, projectId (null=global), type, content, filePath, fileContent
User: id, username, passwordHash
```

### Codigo clave

- `store.ts` → `listAllAgents()` lee /agents/ (carpetas con agent.md) + /.agents/skills/ (SKILL.md) y los combina en un solo dropdown
- `chat/[projectId]/route.ts` → POST crea sesion, default agent = "operator"
- `agent-manager.ts` → `runAPISession()` construye prompt, llama Claude API en loop, ejecuta tools
- `agents/[id]/stream/route.ts` → SSE para streaming en vivo
- `agents/[id]/sessions/route.ts` → historial de sesiones desde DB
- `project/[id]/page.tsx` → UI con tickets colapsables, reply inline, memory popover

### Herramientas disponibles para los agentes

| Herramienta | Que hace | Impacto real |
|---|---|---|
| search_files | Busca texto en todos los archivos del proyecto | Solo lectura |
| read_file | Lee un archivo especifico | Solo lectura |
| list_dir | Lista estructura de directorios | Solo lectura |
| write_file | Crea o sobreescribe un archivo | MODIFICA FILESYSTEM REAL |

### Lo que el dashboard SI soporta hoy

- Descubrimiento de proyectos desde filesystem
- Historial completo de tickets desde DB
- Tickets colapsados por defecto, expandibles
- Reply inline dentro de un ticket activo
- Streaming de respuesta en vivo
- Panel de memorias (global + proyecto) como popover discreto
- Quick commands (/plan, /review, /tdd, /security)
- Selector de agente en dropdown (muestra agentes + skills)
- Auth con login/password + middleware
- Acceso remoto via ngrok

---

## 9. Limitaciones del Modelo 1 Agente por Ticket

| Limitacion | Consecuencia |
|---|---|
| Sin roles reales | Todos se comportan igual (bug del switch-case) |
| Sin validacion cruzada | Nadie revisa lo que hizo el agente |
| Sin escalamiento al cliente | El agente decide todo solo |
| Sin fases | Todo en un solo pass lineal de 10-20 iteraciones |
| Sin memoria entre agentes | No hay contexto compartido entre fases |
| Sin skills como contexto | Agentes sin acceso a conocimiento especializado |
| Sin tipos de ticket | Feature, fix, audit y cotizacion se tratan igual |

---

## 10. Que Falta para Equipos Multiagente

### A. Modelo de datos (Prisma)

Falta agregar al schema:

```
Pipeline: id, ticketId, type, status, phases[]
Phase: id, pipelineId, order, agentName, skills[], status, input, output
   status: pending | running | waiting_client | done | error
   Cada fase puede pausar con needs_client_input = true
```

### B. Orquestador real

Hoy el "operator" es role-play en UNA sesion de Claude. Se necesita un orquestador que:
- Analice la directiva y determine TIPO de ticket
- Seleccione el equipo de agentes apropiado
- Lance sesiones SEPARADAS por fase (cada una con su agent.md real)
- Pase el output de una fase como input de la siguiente
- Pause cuando una fase requiera aprobacion del cliente
- Genere resumen ejecutivo al completar todas las fases

### C. Handoffs

Mecanismo para transferir contexto entre fases:
- Output del planificador → input del implementador
- Output del implementador → input del inspector
- Si el inspector encuentra problemas → devuelve al implementador

### D. Carga de skills por contexto

Al iniciar cada fase, el orquestador deberia:
- Determinar que skills son relevantes para ese agente + esa tarea
- Leer los SKILL.md correspondientes
- Inyectarlos como contexto adicional en el system prompt

---

## 11. Que Falta para Usar Skills Sistematicamente

| Pieza | Estado |
|---|---|
| Loader que lea SKILL.md y lo inyecte en prompt | NO existe |
| Mapeo agente → skills por defecto | NO existe |
| Selector de skills por tipo de tarea | NO existe |
| Skills on-demand (usuario agrega skills extra) | NO existe |

### Mapeo sugerido agente → skills

| Agente | Skills que deberia cargar automaticamente |
|---|---|
| planificador | diseno-de-apis, patrones-backend, patrones-frontend |
| arquitecto | patrones-backend, patrones-frontend, patrones-postgresql |
| inspector-de-codigo | estandares-de-codigo, revision-de-seguridad |
| guardian-de-seguridad | revision-de-seguridad, escaneo-de-seguridad |
| maestro-de-pruebas | desarrollo-guiado-por-tests, pruebas-end-to-end |
| doctor-de-errores | (ninguno extra necesario) |
| disenador-de-base-de-datos | patrones-postgresql, migraciones-de-base-de-datos |
| inspector-python | patrones-python, testing-python |
| documentador | estandares-de-codigo |

---

## 12. Que Falta para Comunicacion Cliente-Agentes

| Pieza | Estado |
|---|---|
| UI para que el agente pregunte al cliente | Existe ticketReply pero NO pausa al agente |
| Estado "waiting_client" en sesion | NO existe en el modelo |
| Notificacion push cuando el agente pregunta | NO existe |
| Reanudar sesion tras respuesta del cliente | NO existe |
| Tipos de pregunta (validacion, aprobacion, clarificacion) | NO existe |
| Politica de cuando escalar | NO definida en el sistema |

---

## 13. Decisiones que Deben Escalar SIEMPRE al Cliente

| Tipo de decision | Escala |
|---|---|
| Cambio de schema/DB (tabla nueva, migracion) | SIEMPRE |
| Decision de arquitectura (patron, estructura) | SIEMPRE |
| Permisos, roles, autenticacion | SIEMPRE |
| Reglas de negocio | SIEMPRE |
| Cotizacion / alcance / presupuesto | SIEMPRE |
| Eliminacion de archivos o features | SIEMPRE |
| Dependencia nueva importante | SIEMPRE |
| Fix de bug menor o typo | No necesita |
| Refactor interno sin cambio de API | No necesita |
| Actualizacion de docs | No necesita |

**Ninguna de estas politicas esta implementada en el sistema hoy.**

---

## 14. Flujos por Tipo de Tarea

### Tipo 1: Feature nueva
```
Planificador → [APROBACION CLIENTE] → Implementador → Inspector → Maestro de Pruebas
Skills: patrones-backend, patrones-frontend, estandares-de-codigo
```

### Tipo 2: Modulo nuevo
```
Arquitecto → [APROBACION CLIENTE] → Planificador → Implementador → Inspector
Skills: diseno-de-apis, patrones-backend, patrones-postgresql
```

### Tipo 3: Cambio estructural
```
Arquitecto → [APROBACION CLIENTE] → Planificador → [APROBACION CLIENTE] → Implementacion
Skills: patrones-backend, migraciones-de-base-de-datos
```

### Tipo 4: Cotizacion / Discovery
```
Investigador → Planificador → Arquitecto → [PRESENTACION A CLIENTE]
Skills: investigacion-de-mercado, materiales-para-inversores
Consulta al cliente: SIEMPRE antes de cotizar
```

### Tipo 5: Research / Analisis
```
Investigacion Profunda → [RESUMEN A CLIENTE]
Skills: investigacion-profunda, busqueda-neural
```

### Tipo 6: QA / Auditoria
```
Inspector → Guardian de Seguridad → Maestro de Pruebas → [REPORTE A CLIENTE]
Skills: revision-de-seguridad, ciclo-de-verificacion, estandares-de-codigo
```

### Tipo 7: Fix rapido
```
Doctor de Errores → Inspector
Skills: (ninguno extra necesario)
```

---

## 15. Que Agentes Faltan, Que Skills Faltan, Que Sobra

### Agentes que faltan

| Agente | Por que |
|---|---|
| **Implementador** | No existe agente que CONSTRUYA codigo nuevo |
| **Cotizador** | Para generar presupuestos con base en analisis |
| **Investigador** | Agente real que use skills de investigacion |

### Skills que faltan

| Skill | Por que |
|---|---|
| **prisma-patterns** | Se usa Prisma como ORM principal |
| **supabase-patterns** | Se usa Supabase para real-time |
| **zod-validation** | Se usa Zod para validacion |
| **politica-de-escalamiento** | Define cuando consultar al cliente |
| **flujos-de-equipo** | Define que equipo entra segun tipo de ticket |
| **tailwind-patterns** | Se usa TailwindCSS como framework UI |

### Que sobra o necesita reescritura

| Elemento | Accion |
|---|---|
| optimizador-de-ia (0.9KB) | Reescribir — esqueleto sin contenido |
| supervisor-de-procesos (0.9KB) | Reescribir — esqueleto sin contenido |
| jefe-de-personal | Evaluar si aplica al flujo actual |
| AGENTS.md (12.4KB) | Actualizar — referencia nombres viejos en ingles |

---

## 16. Que Implementar Primero (Prioridades)

### P1 — FIX CRITICO: Agentes sin prompt real
Reemplazar el switch-case en agent-manager.ts por lectura dinamica del agent.md de cada agente. Esto solo haria que los 15 agentes funcionen con su prompt completo.

### P2 — Skills cargables
Implementar loader que lea SKILL.md e inyecte en el system prompt. Agregar mapeo agente → skills.

### P3 — Comunicacion con cliente
Agregar estado "waiting_client" a sesiones. Mecanismo de pausa/reanudacion. Politica de escalamiento en el prompt de todos los agentes.

### P4 — Equipos multiagente
Modelo Pipeline → Fases en Prisma. Orquestador real que lance sesiones por fase. Handoffs entre fases. Tipos de ticket que determinen el equipo.

### P5 — Agentes y skills nuevos
Crear agente Implementador. Crear skills faltantes (prisma-patterns, etc.). Reescribir los 2 agentes esqueleto.

---

## 17. Documentacion y Archivos Faltantes

| Que falta | Para que |
|---|---|
| agent-manager.ts fix del switch-case | Para que los agentes funcionen |
| Schema Prisma con Pipeline/Phase | Para equipos multiagente |
| Politica de escalamiento como skill | Para inyectar en todos los agentes |
| Mapeo agente→skills como config | Para carga automatica de contexto |
| Definicion de tipos de ticket | Para determinar que equipo entra |
| AGENTS.md actualizado | Para reflejar nombres y estructura actuales |
| agent.md del Implementador | Para completar el pipeline basico |

---

## Resumen de Numeros

| Categoria | Cantidad | Estado |
|---|---|---|
| Agentes definidos | 15 | 13 completos, 2 esqueletos |
| Skills definidos | 36 | Todos documentados, NINGUNO se carga |
| Herramientas de ejecucion | 4 | search_files, read_file, list_dir, write_file |
| Persistencia | OK | PostgreSQL via Prisma |
| Streaming | OK | SSE en tiempo real |
| Auth | OK | Middleware + login |
| Multi-agente real | NO | Solo simulado via operator |
| Escalamiento al cliente | NO | No implementado |
| Skills como contexto | NO | No implementado |
| Fases/handoffs | NO | No implementado |
| Tipos de ticket | NO | No implementado |
| Bug critico activo | SI | Switch-case no matchea nombres espanoles |

---

*Documento generado el 18 de Marzo de 2026.*
