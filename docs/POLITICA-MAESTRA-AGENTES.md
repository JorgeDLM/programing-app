# Política Maestra para Creación de Nuevos Agentes

**Fecha:** 18 de Marzo de 2026
**Estado:** OBLIGATORIA — Aplica a todo agente nuevo sin excepción.

---

## 1. Regla de Necesidad Real

Antes de crear cualquier agente, analizar si:

- Ya existe uno equivalente
- Ya existe uno que cubra parcialmente ese rol
- El rol debería ser un **skill** y no un agente
- El rol debería ser **on-demand** y no core
- El rol debería ser una **especialización** de un agente existente
- El rol realmente aporta valor operativo o solo "suena bien"

### Clasificación obligatoria

| Clasificación | Significa |
|---|---|
| `nuevo_agente_necesario` | No existe nada que cubra este gap. Se crea. |
| `cubierto_parcialmente_por_otro` | Ya hay un agente que cubre 60%+. Mejor extender ese. |
| `mejor_como_skill` | El valor está en conocimiento/reglas, no en autonomía. Crear skill. |
| `mejor_como_capacidad_de_otro_agente` | Agregar como tool o instrucción a un agente existente. |
| `no_conviene_crearlo_todavia` | Tiene sentido futuro pero hoy no hay runtime ni volumen. |

**Si la clasificación NO es `nuevo_agente_necesario`, NO se crea.**

---

## 2. Contrato Obligatorio

Cada nuevo agente debe definirse con TODOS estos campos:

```yaml
# --- Identidad ---
name: ""
display_name: ""
group: ""                    # equipo-desarrollo, equipo-calidad, equipo-analisis, etc.
purpose: ""                  # 1 línea: qué hace
problemSolved: ""            # Qué gap real cubre que hoy no está cubierto
coreOrOnDemand: ""           # core | on-demand

# --- Cuándo usar ---
whenToUse: []                # Lista concreta de situaciones
whenNotToUse: []             # Lista concreta de anti-patterns

# --- I/O ---
inputs: []                   # Qué recibe (directive, handoff, context)
outputs: []                  # Qué produce (summary, files, recommendations)

# --- Tools ---
allowedTools: []             # Read, Write, Edit, Bash, Grep, Glob, etc.

# --- Modelo ---
defaultProvider: ""          # anthropic | openai | deepseek
defaultModel: ""             # claude-sonnet-4-6, gpt-5.4-mini, etc.
allowedProviders: []
allowedModels: []
fallbackModel: ""
escalationModel: ""
modelPolicy: ""              # claude_only | claude_preferred | hybrid_candidate | cheap_model_candidate

# --- Criticidad ---
criticalityLevel: ""         # critical | high | medium | low
whenToEscalateToClaude: ""
whenToEscalateToOpus: ""
whenToAskClient: []

# --- Skills ---
defaultSkills: []
optionalSkills: []
forbiddenSkills: []
missingSkillsToCreate: []

# --- Handoffs ---
handoffInput: ""             # Qué espera recibir del agente anterior
handoffOutput: ""            # Qué deja al siguiente agente

# --- Escalamiento al cliente ---
requiresClientApprovalOn: []
mustAskBefore: []
neverAssume: []

# --- Restricciones ---
forbiddenActions: []
successCriteria: []

# --- Justificación ---
whyThisAgentExists: ""
whyThisShouldNotBeJustASkill: ""
```

---

## 3. Política de Selección de Modelo

### Regla Claude-First

> Si hay duda → Claude. Preferentemente Sonnet 4.6. Opus 4.6 si el razonamiento es crítico.
> NO optimizar costos a costa de romper el flow principal. Claude es el sistema nervioso central.

### Reglas por tipo

**A. Claude Sonnet 4.6** — Default para agentes que:
- Ejecutan trabajo frecuente
- Modifican código
- Participan en runtime principal
- Hacen review o QA normal
- Trabajan de forma repetida con costo/latencia razonables

**B. Claude Opus 4.6** — Para agentes que:
- Toman decisiones críticas o irreversibles
- Hacen arquitectura o discovery complejo
- Resuelven ambigüedad alta
- Pueden causar retrabajo caro si fallan
- Hacen research profundo o synthesis de alto impacto

**C. GPT-5.4** — Solo si el agente es candidato real a tareas secundarias importantes pero no núcleo crítico.

**D. GPT-5.4-mini / nano** — Solo si el agente:
- Clasifica, extrae, rankea, resume, sugiere
- Normaliza o procesa metadata
- Hace trabajo de alto volumen y bajo riesgo

**E. DeepSeek** — Solo si:
- El trabajo es periférico
- El riesgo es bajo
- El costo manda
- Habrá validación posterior
- No toca decisiones críticas del core

---

## 4. Matriz de Decisión Obligatoria

Cada agente nuevo debe incluir esta evaluación:

| Dimensión | Valor | Opciones |
|---|---|---|
| Task criticality | | low / medium / high |
| Need for tools | | low / medium / high |
| Need for long-context consistency | | low / medium / high |
| Cost sensitivity | | low / medium / high |
| Latency sensitivity | | low / medium / high |
| Error tolerance | | low / medium / high |
| Requires client-safe reasoning | | yes / no |
| Touches production-critical code | | yes / no |
| Touches architecture/security/business rules | | yes / no |

El modelo elegido debe justificarse con base en esta matriz.

---

## 5. Regla de Skills

Cada agente nuevo debe analizar:

| Campo | Descripción |
|---|---|
| `defaultSkills` | Skills que siempre carga |
| `optionalSkills` | Skills que carga según contexto |
| `forbiddenSkills` | Skills que NUNCA debe usar |
| `missingSkillsToCreate` | Skills que necesita pero no existen todavía |

---

## 6. Regla de Escalamiento al Cliente

Cada agente debe declarar explícitamente cuándo debe preguntar y no actuar solo.

Obligatorio si toca:
- Arquitectura
- Base de datos / schemas
- Auth / permisos
- Reglas de negocio
- Cotización / alcance
- Eliminación de código o datos
- Decisiones sensibles o irreversibles

Campos:
- `requiresClientApprovalOn` — Acciones que requieren aprobación
- `mustAskBefore` — Acciones que SIEMPRE necesitan confirmación previa
- `neverAssume` — Cosas que NUNCA debe asumir sin validar

---

## 7. Regla de Handoffs

Cada agente debe definirse pensando en trabajo de equipo:

| Campo | Qué declara |
|---|---|
| Qué recibe | Del agente anterior (directive, plan, context) |
| Qué deja | Al siguiente (summary, files, recommendations) |
| Cómo resume | Formato de outputSummary esperado |
| Qué riesgos reporta | Issues encontrados que el siguiente debe saber |
| Qué preguntas abiertas deja | Decisiones pendientes |
| Qué artifacts produce | Archivos, configs, schemas creados/modificados |

---

## 8. Regla de Auditabilidad

Cada agente nuevo debe registrar:

| Campo | Qué documenta |
|---|---|
| Por qué se creó | Razón concreta del gap |
| Qué gap real cubre | Problema específico que resuelve |
| Por qué no estaba cubierto | Qué faltaba en agentes existentes |
| Modelo y por qué | Justificación deliberada |
| Costo esperado | Estimación por task |
| Riesgo | Qué puede salir mal |
| Timing | Ahora o después |

---

## 9. Salida Obligatoria al Proponer un Agente Nuevo

Cada vez que se proponga o cree un agente, entregar EXACTAMENTE:

1. Nombre del agente
2. Grupo
3. Problema real que resuelve
4. Por qué no basta con un skill o un agente existente
5. Core o on-demand
6. Contrato resumido completo
7. Modelo/proveedor elegido
8. Justificación del modelo (con matriz de decisión)
9. Skills requeridos
10. Cuándo preguntar al cliente
11. Handoff de entrada y salida
12. Riesgos de crear este agente
13. Si debe crearse ahora o después
14. Si reemplaza, mejora o complementa algo actual

---

## 10. Regla de No Creación

**NO crear un agente si:**

- Rol duplicado con nombre distinto
- Mejor como skill
- Mejor como subcapacidad de otro agente
- No hay runtime para aprovecharlo todavía
- Solo aporta complejidad sin valor operativo
- No tiene modelo claro
- No tiene valor operativo inmediato o futuro justificable
- No pasa la matriz de decisión

---

## Ejemplo: Evaluación de Agente Propuesto

```
PROPUESTA: "analista-de-rendimiento"

1. Clasificación: mejor_como_skill
   → El análisis de rendimiento es conocimiento + reglas, no requiere 
     autonomía de agente. Se puede crear como skill "optimizacion-de-rendimiento" 
     y cargarlo en el optimizador-de-codigo cuando sea necesario.

RESULTADO: NO SE CREA COMO AGENTE. Se crea como skill.
```

```
PROPUESTA: "guardian-de-migraciones"

1. Clasificación: cubierto_parcialmente_por_otro
   → El disenador-de-base-de-datos ya cubre review de migrations.
     Agregar skill "migraciones-de-base-de-datos" a ese agente.

RESULTADO: NO SE CREA. Se extiende el agente existente.
```

---

*Política creada el 18 de Marzo de 2026. Aplica sin excepción a toda creación futura de agentes.*
