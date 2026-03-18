# Everything Claude Code (ECC) — Instrucciones de Agentes

Este es un **plugin de IA para desarrollo de software listo para producción** que provee 25 agentes especializados, 108 skills, 57 comandos y flujos de hooks automatizados.

## Principios Fundamentales

1. **Primero los Agentes** — Delega a agentes especializados para tareas de dominio
2. **Test-Driven** — Escribe tests antes de la implementación, cobertura mínima 80%
3. **Seguridad Primero** — Nunca comprometas la seguridad; valida todos los inputs
4. **Inmutabilidad** — Siempre crea objetos nuevos, nunca mutes los existentes
5. **Planifica Antes de Ejecutar** — Planifica features complejos antes de escribir código

---

## Agentes Disponibles

### Agentes Principales

| Nombre Interno | Nombre Descriptivo | Para qué sirve | Cuándo usarlo |
|---|---|---|---|
| `planner` | **Planificador de Tareas** | Crea planes de implementación detallados, divide features complejos en fases y pasos concretos con rutas de archivos, dependencias y riesgos | Antes de implementar cualquier feature complejo o refactor grande |
| `architect` | **Arquitecto de Software** | Diseña la estructura del sistema, evalúa trade-offs técnicos, recomienda patrones y anticipa cuellos de botella de escalabilidad | Al tomar decisiones de arquitectura o diseñar sistemas nuevos |
| `tdd-guide` | **Guía de Pruebas (TDD)** | Guía el ciclo Red-Green-Refactor, escribe tests antes del código y asegura cobertura mínima del 80% en unit, integration y E2E | Al escribir features nuevos, corregir bugs o refactorizar |
| `code-reviewer` | **Revisor de Código** | Revisa calidad, seguridad, patrones de React/Next.js y backend. Detecta code smells, errores de lógica y vulnerabilidades con niveles CRITICAL/HIGH/MEDIUM/LOW | Inmediatamente después de escribir o modificar código |
| `security-reviewer` | **Auditor de Seguridad** | Detecta vulnerabilidades OWASP Top 10, secretos hardcodeados, SQL injection, XSS, CSRF, auth bypasses y dependencias inseguras | Antes de cada commit con código sensible (auth, APIs, pagos, uploads) |
| `build-error-resolver` | **Reparador de Build** | Resuelve errores de TypeScript, compilación, imports rotos y configuración. Solo hace cambios mínimos para que el build pase, sin refactorizar | Cuando el build falla o hay errores de tipos |
| `e2e-runner` | **Tester de Flujos Reales** | Crea y ejecuta tests end-to-end con Playwright/Agent Browser, administra tests inestables, captura screenshots/videos y asegura que los flujos críticos funcionen | Para validar flujos críticos de usuario antes de deployar |
| `refactor-cleaner` | **Limpiador de Código Muerto** | Detecta y elimina código sin usar, dependencias innecesarias, duplicados y exports obsoletos usando herramientas como knip, depcheck y ts-prune | Para mantenimiento periódico y limpieza del proyecto |
| `doc-updater` | **Actualizador de Documentación** | Genera y actualiza codemaps arquitecturales, READMEs y guías directamente desde el código fuente. Mantiene la documentación sincronizada con la realidad | Después de cambios de arquitectura, nuevas rutas API o features importantes |
| `database-reviewer` | **Especialista en Base de Datos** | Optimiza queries PostgreSQL, diseña schemas eficientes, configura RLS (Row Level Security), detecta N+1 queries y problemas de performance en la DB | Al escribir SQL, crear migraciones o diseñar schemas |
| `docs-lookup` | **Consultor de Documentación** | Busca y responde preguntas sobre librerías, frameworks y APIs usando documentación actualizada en tiempo real vía Context7 MCP, no memoria de entrenamiento | Al tener dudas sobre cómo usar una librería o API específica |

---

### Agentes de Operaciones

| Nombre Interno | Nombre Descriptivo | Para qué sirve | Cuándo usarlo |
|---|---|---|---|
| `chief-of-staff` | **Gestor de Comunicaciones** | Clasifica y gestiona emails, Slack, LINE y Messenger en un pipeline unificado. Prioriza mensajes en 4 niveles (ignorar, info, reunión, acción) y genera borradores de respuesta con el tono correcto | Para gestionar bandejas de entrada multi-canal |
| `loop-operator` | **Operador de Loops Autónomos** | Ejecuta y monitorea loops de agentes autónomos, detecta estancamientos, gestiona reintentos y escala cuando hay fallas repetidas o deriva de costos | Para orquestar procesos automatizados de larga duración |
| `harness-optimizer` | **Optimizador de Configuración** | Analiza y mejora la configuración del harness de agentes (hooks, evals, routing, contexto) para aumentar confiabilidad, reducir costos y mejorar throughput | Para afinar el rendimiento y costo del sistema de agentes |

---

### Revisores por Lenguaje

| Nombre Interno | Nombre Descriptivo | Para qué sirve | Cuándo usarlo |
|---|---|---|---|
| `go-reviewer` | **Revisor de Go** | Revisa código Go para idioms correctos, manejo de errores, patrones de concurrencia (goroutines/channels), seguridad y performance | En todos los cambios de archivos `.go` |
| `go-build-resolver` | **Reparador de Build Go** | Resuelve errores de compilación Go, `go vet`, `staticcheck` y problemas de módulos con cambios mínimos | Cuando falla `go build` o `go vet` |
| `python-reviewer` | **Revisor de Python** | Revisa código Python para cumplimiento PEP 8, type hints, seguridad, idioms pythónicos y patrones de Django/FastAPI/Flask | En todos los cambios de archivos `.py` |
| `java-reviewer` | **Revisor de Java/Spring** | Revisa código Java y Spring Boot para arquitectura en capas, patrones JPA, seguridad, concurrencia y anti-patrones como N+1 queries o inyección de dependencias incorrecta | En todos los cambios de archivos `.java` |
| `java-build-resolver` | **Reparador de Build Java** | Resuelve errores de compilación Java, problemas de Maven/Gradle, conflictos de dependencias y errores de procesadores de anotaciones (Lombok, MapStruct) | Cuando falla `mvn compile` o `./gradlew build` en proyectos Java |
| `kotlin-reviewer` | **Revisor de Kotlin/Android** | Revisa Kotlin para idioms correctos, seguridad de coroutines, anti-patrones de Compose, arquitectura limpia y bugs específicos de Android/KMP | En todos los cambios de archivos `.kt` |
| `kotlin-build-resolver` | **Reparador de Build Kotlin** | Resuelve errores de compilación Kotlin, configuraciones Gradle y conflictos de dependencias en proyectos Android/KMP con cambios mínimos | Cuando falla `./gradlew build` en proyectos Kotlin |
| `rust-reviewer` | **Revisor de Rust** | Revisa Rust para seguridad de memoria, ownership/lifetimes, manejo de errores, uso justificado de `unsafe` y patrones idiomáticos | En todos los cambios de archivos `.rs` |
| `rust-build-resolver` | **Reparador de Build Rust** | Resuelve errores del borrow checker, problemas de tipos, errores de Cargo.toml y conflictos de dependencias con cambios mínimos | Cuando falla `cargo build` o `cargo check` |
| `cpp-reviewer` | **Revisor de C++** | Revisa C++ moderno para seguridad de memoria (RAII, smart pointers), concurrencia, performance y anti-patrones como raw new/delete | En todos los cambios de archivos `.cpp`/`.hpp` |
| `cpp-build-resolver` | **Reparador de Build C++** | Resuelve errores de compilación C++, configuración CMake, errores de linker y errores de templates con cambios mínimos | Cuando falla `cmake --build` en proyectos C++ |

---

## Orquestación de Agentes

Usa los agentes de forma proactiva sin esperar que el usuario lo pida:

- Feature complejo solicitado → **Planificador de Tareas**
- Código recién escrito o modificado → **Revisor de Código**
- Bug fix o feature nuevo → **Guía de Pruebas (TDD)**
- Decisión de arquitectura → **Arquitecto de Software**
- Código sensible (auth, pagos, inputs) → **Auditor de Seguridad**
- Comunicación multi-canal → **Gestor de Comunicaciones**
- Loop autónomo / monitoreo → **Operador de Loops Autónomos**
- Costo/confiabilidad del harness → **Optimizador de Configuración**

Usa ejecución paralela para operaciones independientes — lanza múltiples agentes simultáneamente.

---

## Guías de Seguridad

**Antes de CUALQUIER commit:**
- Sin secretos hardcodeados (API keys, contraseñas, tokens)
- Todos los inputs de usuario validados
- Prevención de SQL injection (queries parametrizados)
- Prevención de XSS (HTML sanitizado)
- Protección CSRF habilitada
- Autenticación/autorización verificadas
- Rate limiting en todos los endpoints
- Los mensajes de error no filtran datos sensibles

**Gestión de secretos:** NUNCA hardcodees secretos. Usa variables de entorno o un secret manager. Valida secretos requeridos al inicio. Rota cualquier secreto expuesto inmediatamente.

**Si encuentras un problema de seguridad:** DETÉN → usa el agente **Auditor de Seguridad** → corrige issues CRITICAL → rota secretos expuestos → revisa el codebase para issues similares.

---

## Estilo de Código

**Inmutabilidad (CRÍTICO):** Siempre crea objetos nuevos, nunca mutes. Retorna nuevas copias con los cambios aplicados.

**Organización de archivos:** Muchos archivos pequeños sobre pocos archivos grandes. 200-400 líneas típico, 800 máximo. Organiza por feature/dominio, no por tipo. Alta cohesión, bajo acoplamiento.

**Manejo de errores:** Maneja errores en cada nivel. Provee mensajes amigables al usuario en código UI. Loguea contexto detallado en el servidor. Nunca silencies errores.

**Validación de inputs:** Valida todos los inputs en los límites del sistema. Usa validación basada en esquemas. Falla rápido con mensajes claros. Nunca confíes en datos externos.

**Checklist de calidad de código:**
- Funciones pequeñas (<50 líneas), archivos enfocados (<800 líneas)
- Sin nesting profundo (>4 niveles)
- Manejo correcto de errores, sin valores hardcodeados
- Identificadores legibles y bien nombrados

---

## Requerimientos de Testing

**Cobertura mínima: 80%**

Tipos de tests (todos requeridos):
1. **Unit tests** — Funciones individuales, utilidades, componentes
2. **Integration tests** — Endpoints API, operaciones de base de datos
3. **E2E tests** — Flujos críticos de usuario

**Flujo TDD (obligatorio):**
1. Escribe el test primero (RED) — el test DEBE FALLAR
2. Escribe la implementación mínima (GREEN) — el test DEBE PASAR
3. Refactoriza (IMPROVE) — verifica cobertura 80%+

---

## Flujo de Desarrollo

1. **Planifica** — Usa el **Planificador de Tareas**, identifica dependencias y riesgos, divide en fases
2. **TDD** — Usa la **Guía de Pruebas**, escribe tests primero, implementa, refactoriza
3. **Revisa** — Usa el **Revisor de Código** inmediatamente, resuelve issues CRITICAL/HIGH
4. **Captura conocimiento en el lugar correcto**
   - Notas de debugging personales, preferencias y contexto temporal → memoria automática
   - Conocimiento de equipo/proyecto (decisiones de arquitectura, cambios de API, runbooks) → estructura de docs existente del proyecto
5. **Commit** — Formato de commits convencionales, PRs con summaries completos

---

## Git Workflow

**Formato de commit:** `<tipo>: <descripción>` — Tipos: feat, fix, refactor, docs, test, chore, perf, ci

**Flujo de PR:** Analiza historial de commits completo → redacta summary completo → incluye plan de testing → push con flag `-u`.

---

## Patrones de Arquitectura

**Formato de respuesta API:** Envelope consistente con indicador de éxito, payload de datos, mensaje de error y metadata de paginación.

**Patrón Repository:** Encapsula acceso a datos detrás de una interfaz estándar (findAll, findById, create, update, delete). La lógica de negocio depende de la interfaz abstracta, no del mecanismo de almacenamiento.

---

## Estructura del Proyecto

```
agents/          — 25 subagentes especializados
skills/          — 102 skills de flujo de trabajo y conocimiento de dominio
commands/        — 57 slash commands
hooks/           — Automatizaciones basadas en triggers
rules/           — Guías siempre-activas (comunes + por lenguaje)
scripts/         — Utilidades Node.js cross-platform
mcp-configs/     — 14 configuraciones de servidor MCP
tests/           — Suite de tests
```

---

## Métricas de Éxito

- Todos los tests pasan con cobertura 80%+
- Sin vulnerabilidades de seguridad
- El código es legible y mantenible
- El rendimiento es aceptable
- Los requerimientos del usuario están cumplidos
