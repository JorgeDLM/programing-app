# Model Routing Configuration — Multi-Provider Strategy

**Fecha:** 18 de Marzo de 2026
**Objetivo:** Optimizar costo por task sin sacrificar calidad en tareas críticas.

---

## Pricing Matrix (Marzo 2026)

### LLM Providers

| Modelo | Input/1M | Output/1M | Context | Fortaleza Principal |
|---|---|---|---|---|
| Claude Opus 4.6 | $5.00 | $25.00 | 1M | Razonamiento profundo, arquitectura, seguridad, Agent Teams |
| Claude Sonnet 4.6 | $3.00 | $15.00 | 200K | Coding (79.6% SWE-bench), intent understanding |
| Claude Haiku 4.5 | $1.00 | $5.00 | 200K | Tasks rápidas, clasificación con calidad Claude |
| GPT-5.4 | $2.50 | $15.00 | 1M | Terminal (75.1%), DevOps, tool search (-47% tokens), velocidad |
| GPT-5.4-mini (thinking) | $0.75 | $4.50 | 400K | Code review, tests, reasoning estructurado (54.4% SWE-bench Pro) |
| GPT-5.4-nano | $0.20 | $1.25 | 128K | Clasificación, validación, tasks simples de alto volumen |
| DeepSeek V3.2 chat | $0.28 | $0.42 | 128K | Bulk coding, docs, multi-language (83.3% LiveCodeBench) |
| DeepSeek V3.2 reasoner | $0.50 | $2.18 | 128K | Reasoning a ultra-bajo costo, 90% cache discount |

### Image Generation

| Servicio | Precio | Fortaleza |
|---|---|---|
| NANO Banana Pro (fal.ai) | $0.15/img | Alta calidad, text rendering, edición, basado en Gemini 3 Pro |
| Seedream 5.0 Lite (BytePlus) | $0.035/img | Budget, web search integrado, deep reasoning |

### Media Storage

| Servicio | Uso |
|---|---|
| Cloudinary | Upload → auto-convert WebP → compress q_auto → CDN delivery |

---

## Benchmarks Clave (Marzo 2026)

| Modelo | SWE-bench Verified | SWE-bench Pro | Terminal-Bench | LiveCodeBench | GPQA Diamond |
|---|---|---|---|---|---|
| Claude Opus 4.6 | 80.8% | ~46% | 65.4% | — | 91.3% |
| Claude Sonnet 4.6 | 79.6% | — | — | — | 74.1% |
| GPT-5.4 | ~80% | 57.7% | **75.1%** | — | — |
| GPT-5.4-mini | — | 54.4% | — | — | — |
| DeepSeek V3.2 | 72-74% | — | — | **83.3%** | — |
| Gemini 3.1 Pro | **80.6%** | — | 68.5% | Leader | — |

**Conclusiones de benchmarks:**
- Coding general: Top 6 modelos dentro de 1.3 puntos — la diferencia es ruido
- Terminal/DevOps: GPT-5.4 domina con 9.7 puntos sobre el siguiente
- Reasoning profundo: Opus 4.6 líder absoluto (GPQA 91.3%)
- Costo mínimo viable: DeepSeek V3.2 a ~$0.35 promedio maneja 72-74% de tareas

---

## Agent → Model Mapping

### TIER 1: CRITICAL — Solo Anthropic
> Arquitectura, seguridad, decisiones irreversibles. Aquí NO se ahorra.

| Agente | Modelo | Justificación |
|---|---|---|
| **arquitecto** | `claude-opus-4.6` | Decisiones de arquitectura requieren máximo reasoning + 1M context para análisis de codebase completo |
| **guardian-de-seguridad** | `claude-opus-4.6` | Auditorías de seguridad son CRITICAL — Opus lidera en detección de vulnerabilidades sutiles (91.3% GPQA) |

### TIER 2: CORE — Claude Sonnet 4.6 ($3/$15 per MTok)
> Todo agente que participa en el runtime principal. Claude-first obligatorio.

| Agente | Modelo | Policy | Justificación |
|---|---|---|---|
| **planificador** | `claude-sonnet-4.6` | claude_preferred | Planning necesita intent understanding. Escala a Opus via template para architecture/quotation |
| **implementador** | `claude-sonnet-4.6` | claude_preferred | Modifica código — Claude obligatorio por calidad y consistency |
| **disenador-de-base-de-datos** | `claude-sonnet-4.6` | claude_preferred | Schemas + migrations necesitan razonamiento cuidadoso |
| **inspector-de-codigo** | `claude-sonnet-4.6` | claude_preferred | Agente más usado (en casi todos los templates) — Claude para confiabilidad |
| **maestro-de-pruebas** | `claude-sonnet-4.6` | claude_preferred | QA normal en runtime principal → Sonnet |
| **tester-de-flujos** | `claude-sonnet-4.6` | claude_preferred | E2E testing en runtime principal → Sonnet |
| **doctor-de-errores** | `claude-sonnet-4.6` | claude_preferred | Modifica código (fixes) — Claude obligatorio |
| **consultor-tecnico** | `claude-sonnet-4.6` | claude_preferred | Research — escala a Opus via template recommendedModel |
| **optimizador-de-codigo** | `claude-sonnet-4.6` | claude_preferred | Modifica código (refactor) — Claude obligatorio |
| **defensor-del-cliente** | `claude-sonnet-4.6` | claude_preferred | Client-safe reasoning + business rules en quotation flow |

### TIER 3: SUPPORT — Claude Haiku 4.5 ($1/$5 per MTok)
> Agentes de cierre/documentación. Cheapest Claude, mantiene ecosistema unificado.

| Agente | Modelo | Policy | Justificación |
|---|---|---|---|
| **validador-de-salida** | `claude-haiku-4.5` | claude_preferred | Finalization en casi todos los templates — parte del core pipeline, no periférico |
| **documentador** | `claude-haiku-4.5` | claude_preferred | Finalization en research template — parte del pipeline |

### Candidatos (no conectados aún) — Claude-first aplica

| Agente | Modelo Recomendado | Justificación |
|---|---|---|
| arquitecto-backend | `claude-sonnet-4.6` | Backend architecture necesita Claude reasoning |
| arquitecto-frontend | `claude-sonnet-4.6` | Frontend patterns en runtime → Claude-first |
| desarrollador-backend | `claude-sonnet-4.6` | Backend code generation — modifica código |
| desarrollador-frontend | `claude-sonnet-4.6` | Frontend code generation — modifica código |
| analista-de-negocio | `claude-sonnet-4.6` | Participa en quotation (business rules) → Claude-first |
| project-manager | `claude-haiku-4.5` | Coordinación simple, no modifica código |

### GPT / DeepSeek — Reservados para futuro
> Solo se activarán para agentes PERIFÉRICOS una vez que el pipeline esté probado en producción.
> Candidatos futuros: workers de clasificación, extractores de metadata, normalizadores de datos.

---

## Escalamiento de Modelos

### Reglas de escalamiento
1. Si un agente falla 2 veces → escalar al `escalationModel` declarado en su frontmatter
2. Si la task tiene tag `security` o `architecture` → siempre TIER 1 (Opus)
3. Si el contexto supera 200K tokens → `claude-opus-4.6` (1M context)
4. Si la task es `architecture_change` → todos los agentes mínimo `claude-sonnet-4.6`
5. El `fallbackModel` de cada agente siempre apunta a un Claude inferior
6. El `escalationModel` de cada agente siempre apunta a un Claude superior

### Override por ticket type
| Ticket Type | Override |
|---|---|
| `architecture_change` | Todos → mínimo `claude-sonnet-4.6`, discovery/planning → `claude-opus-4.6` |
| `research` | consultor-tecnico → `claude-opus-4.6` (via template recommendedModel) |
| `small_fix` | Mantener Sonnet — modifica código |
| `qa_review` | Mantener Sonnet — review del core |
| `quotation` | discovery → `claude-opus-4.6`, defensor-del-cliente → `claude-sonnet-4.6` |

---

## Cloudinary — Configuración de Upload

Toda imagen que entre al sistema DEBE pasar por este pipeline:

```
Upload → f_webp → q_auto:good → Cloudinary CDN
```

### Transformaciones obligatorias
- **Formato:** `f_webp` — conversión automática a WebP (30-50% menor que JPEG sin pérdida visual)
- **Calidad:** `q_auto:good` — compresión inteligente sin pérdida perceptible
- **Eager transformations:** generar thumbnail (200x200) y medium (800x600) al subir

### Configuración de upload preset
```json
{
  "upload_preset": "agent_media",
  "folder": "agents/",
  "format": "webp",
  "quality": "auto:good",
  "eager": [
    { "width": 200, "height": 200, "crop": "fill", "format": "webp", "quality": "auto:good" },
    { "width": 800, "height": 600, "crop": "limit", "format": "webp", "quality": "auto:good" }
  ],
  "eager_async": true,
  "overwrite": false,
  "unique_filename": true,
  "resource_type": "image"
}
```

### URL de entrega
```
https://res.cloudinary.com/{cloud_name}/image/upload/f_webp,q_auto:good/{public_id}
```

---

## Image Generation — Pipeline

### NANO Banana Pro (fal.ai) — Calidad alta
- **Modelo:** Gemini 3 Pro foundation
- **Precio:** $0.15/imagen
- **Capacidades:** Text-to-image, editing, text rendering, character consistency, hasta 14 imágenes de referencia
- **Uso:** Generación de assets de UI, mockups, ilustraciones de calidad

### Seedream 5.0 Lite (BytePlus) — Budget
- **Modelo:** seedream-5-0-260128
- **Precio:** $0.035/imagen
- **Capacidades:** Web search integrado, deep reasoning, smart editing, text rendering
- **Uso:** Generación de alto volumen, thumbnails, placeholders, batch processing

### Pipeline de generación
```
1. Generar imagen (NANO Banana Pro o Seedream según calidad requerida)
2. Upload a Cloudinary con f_webp + q_auto:good
3. Guardar solo la URL de Cloudinary en DB (nunca base64 ni filesystem)
4. Generar eager transformations (thumb + medium) async
```

---

## Estimación de Costos

### Escenario: 100 tickets/mes (mix típico)

#### Antes (todo Claude Sonnet)
| Tickets | Modelo | Tokens promedio | Costo/ticket | Total |
|---|---|---|---|---|
| 100 | claude-sonnet-4.6 | ~15K in + 5K out | ~$0.12 | ~$1,200/mes |

#### Después (hybrid routing)
| Tier | Tickets | Modelo | Costo/ticket | Total |
|---|---|---|---|---|
| TIER 1 | 10 | claude-opus-4.6 | ~$0.18 | $1.80 |
| TIER 2 | 35 | claude-sonnet-4.6 | ~$0.12 | $4.20 |
| TIER 2 | 15 | gpt-5.4 | ~$0.11 | $1.65 |
| TIER 3 | 25 | gpt-5.4-mini | ~$0.035 | $0.88 |
| TIER 4 | 10 | deepseek-v3.2 | ~$0.004 | $0.04 |
| TIER 4 | 5 | gpt-5.4-nano | ~$0.002 | $0.01 |

**Costo mensual estimado: ~$86 vs ~$1,200 → ahorro ~93%**

*Nota: Estimación conservadora. El ahorro real depende del mix de tickets y tokens por task.*

---

*Configuración basada en benchmarks y pricing verificados al 18 de Marzo de 2026.*
