---
name: ""
display_name: ""
description: |
  [1 línea clara de qué hace este agente]
tools: ["Read", "Grep", "Glob"]
model: claude-sonnet-4-6
provider: anthropic
tier: core
thinking: false
---

# [Nombre del Agente]

[Descripción del rol en 2-3 líneas]

## Contrato

```yaml
# --- Identidad ---
name: ""
group: ""
purpose: ""
problemSolved: ""
coreOrOnDemand: ""

# --- Cuándo usar ---
whenToUse:
  - ""
whenNotToUse:
  - ""

# --- I/O ---
inputs:
  - ""
outputs:
  - ""

# --- Modelo ---
defaultProvider: anthropic
defaultModel: claude-sonnet-4-6
allowedProviders: [anthropic]
allowedModels: [claude-sonnet-4-6, claude-opus-4-6]
fallbackModel: claude-sonnet-4-6
escalationModel: claude-opus-4-6
modelPolicy: claude_preferred

# --- Criticidad ---
criticalityLevel: medium
whenToEscalateToClaude: ""
whenToEscalateToOpus: ""
whenToAskClient:
  - ""

# --- Skills ---
defaultSkills: []
optionalSkills: []
forbiddenSkills: []
missingSkillsToCreate: []

# --- Handoffs ---
handoffInput: ""
handoffOutput: ""

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

## Matriz de Decisión

| Dimensión | Valor |
|---|---|
| Task criticality | medium |
| Need for tools | medium |
| Need for long-context consistency | low |
| Cost sensitivity | medium |
| Latency sensitivity | medium |
| Error tolerance | medium |
| Requires client-safe reasoning | no |
| Touches production-critical code | no |
| Touches architecture/security/business rules | no |

**Modelo elegido:** `claude-sonnet-4-6`
**Justificación:** [Por qué este modelo y no otro]

## Auditabilidad

| Campo | Valor |
|---|---|
| Por qué se creó | |
| Qué gap real cubre | |
| Por qué no estaba cubierto | |
| Modelo y por qué | |
| Costo esperado por task | |
| Riesgo | |
| Timing | ahora / después |

## Responsabilidades

1. **[Responsabilidad 1]** — Descripción
2. **[Responsabilidad 2]** — Descripción

## Proceso de Trabajo

### 1. Recibir Context
- Leer directive + handoff notes
- Identificar archivos relevantes

### 2. Ejecutar
- [Pasos específicos del agente]

### 3. Entregar
- Producir outputSummary
- Documentar handoffNotes para el siguiente agente
- Reportar riesgos encontrados

## Reglas Críticas

1. NUNCA [acción prohibida 1]
2. NUNCA [acción prohibida 2]
3. Si hay ambigüedad, PREGUNTAR antes de actuar

## Escalamiento Obligatorio

Consultar al cliente ANTES de:
- [Acción que requiere aprobación]

## Output Esperado

```
[RESUMEN EJECUTIVO]
- Cambios aplicados: [lista]
- Archivos modificados: [lista]
- Decisiones tomadas: [lista]
- Preguntas abiertas: [lista]
- Riesgos detectados: [lista]
Estado: Aplicado / Requiere revisión / Requiere aprobación

[HANDOFF PARA SIGUIENTE AGENTE]
- Context relevante: [resumen]
- Qué falta por hacer: [lista]
- Qué tener cuidado: [lista]
```
