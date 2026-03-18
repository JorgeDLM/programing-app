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

### TIER 2: CORE DEVELOPMENT — Claude Sonnet + GPT-5.4
> Código de producción, planning, DB design. Calidad alta, costo moderado.

| Agente | Modelo | Justificación |
|---|---|---|
| **planificador** | `claude-sonnet-4.6` | Planning necesita intent understanding — Sonnet 79.6% SWE-bench es suficiente |
| **implementador** | `claude-sonnet-4.6` | Generación de código se beneficia del estilo Claude + patterns del proyecto |
| **disenador-de-base-de-datos** | `claude-sonnet-4.6` | Diseño de schemas necesita razonamiento cuidadoso sobre relaciones |
| **consultor-tecnico** | `gpt-5.4` | Research técnico se beneficia del 1M context + tool search (-47% tokens) |
| **optimizador-de-codigo** | `gpt-5.4` | Optimización de código se beneficia de Terminal-Bench strength (75.1%) |
| **doctor-de-errores** | `gpt-5.4-mini` | Bug fixes con errores claros son tasks estructuradas — mini con thinking excels |

### TIER 3: REVIEW & QA — GPT-5.4-mini (thinking)
> Code review, tests, QA. Tasks estructuradas donde mini con thinking rinde igual que frontier.

| Agente | Modelo | Justificación |
|---|---|---|
| **inspector-de-codigo** | `gpt-5.4-mini` | Code review es pattern-matching — mini (thinking) a $0.75/$4.50 cubre >90% de reviews |
| **maestro-de-pruebas** | `gpt-5.4-mini` | Test writing es estructurado — mini genera tests sólidos |
| **tester-de-flujos** | `gpt-5.4-mini` | E2E test generation es template-driven, no necesita frontier |

### TIER 4: SUPPORT — DeepSeek / GPT-5.4-nano
> Validación, documentación, comunicación. Tasks simples donde el costo mínimo es viable.

| Agente | Modelo | Justificación |
|---|---|---|
| **validador-de-salida** | `deepseek-v3.2-chat` | Validación de output es straightforward — DeepSeek a $0.28/$0.42 es suficiente |
| **documentador** | `deepseek-v3.2-chat` | Documentación técnica no requiere frontier — DeepSeek maneja bien markdown/docs |
| **defensor-del-cliente** | `gpt-5.4-nano` | Comunicación con cliente es formateo simple — nano a $0.20/$1.25 basta |

### Candidatos (no conectados aún)

| Agente | Modelo Recomendado | Justificación |
|---|---|---|
| arquitecto-backend | `claude-sonnet-4.6` | Backend architecture necesita Claude reasoning |
| arquitecto-frontend | `gpt-5.4-mini` (thinking) | Frontend patterns son más template-driven |
| desarrollador-backend | `claude-sonnet-4.6` | Backend code generation con Prisma/Next.js — Claude excels |
| desarrollador-frontend | `gpt-5.4-mini` (thinking) | Frontend components son estructurados |
| analista-de-negocio | `deepseek-v3.2-reasoner` | Análisis de negocio a bajo costo con reasoning |
| project-manager | `gpt-5.4-nano` | Project management es coordinación simple |

---

## Escalamiento de Modelos

### Reglas de escalamiento automático
1. Si un agente TIER 2-4 falla 2 veces → escalar un tier arriba
2. Si la task tiene tag `security` o `architecture` → siempre TIER 1
3. Si el contexto supera 200K tokens → usar modelo con 1M context (Opus o GPT-5.4)
4. Si la task es `architecture_change` → todos los agentes mínimo TIER 2

### Override por ticket type
| Ticket Type | Override |
|---|---|
| `architecture_change` | Todos los agentes → mínimo `claude-sonnet-4.6` |
| `research` | consultor-tecnico → `gpt-5.4` (1M context) |
| `small_fix` | doctor-de-errores → `gpt-5.4-mini`, inspector → `gpt-5.4-nano` |
| `qa_review` | Mantener tiers asignados |

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
