# Audit Index

## Purpose

Este folder documenta un audit técnico profundo y aterrizado a `programing-app`, enfocado en diseñar una nueva capa de contexto y retrieval optimizado para operar sobre múltiples repos locales sin romper el motor actual.

## Files

- `00-index.md`
  - Propósito: índice general y orden de lectura.
- `01-executive-summary.md`
  - Propósito: diagnóstico ejecutivo, urgencias y primera recomendación.
- `02-current-system-map.md`
  - Propósito: mapa del sistema actual y flujo operativo real.
- `03-findings-by-area.md`
  - Propósito: hallazgos por área auditada.
- `04-gap-analysis.md`
  - Propósito: comparación entre estado actual y diseño objetivo.
- `05-risk-analysis.md`
  - Propósito: riesgos concretos y mitigaciones.
- `06-target-architecture.md`
  - Propósito: arquitectura objetivo aterrizada a este repo.
- `07-model-strategy.md`
  - Propósito: estrategia de modelos por capa y reglas de ahorro.
- `08-implementation-iterations.md`
  - Propósito: plan incremental por iteraciones.
- `09-file-by-file-plan.md`
  - Propósito: plan de archivos exactos a crear o modificar.
- `10-open-questions.md`
  - Propósito: supuestos, no confirmados y dudas reales.
- `appendix-agent-map.md`
  - Propósito: mapa de agentes relevantes y solapes.
- `appendix-tools-map.md`
  - Propósito: mapa de tools y equivalentes actuales de retrieval.
- `appendix-repo-access-flow.md`
  - Propósito: cómo accede hoy el sistema a repos locales.
- `appendix-context-flow.md`
  - Propósito: cómo fluye hoy el contexto, dónde se pierde y dónde interceptar.

## Recommended Reading Order

1. `01-executive-summary.md`
2. `02-current-system-map.md`
3. `03-findings-by-area.md`
4. `04-gap-analysis.md`
5. `05-risk-analysis.md`
6. `06-target-architecture.md`
7. `07-model-strategy.md`
8. `08-implementation-iterations.md`
9. `09-file-by-file-plan.md`
10. `10-open-questions.md`
11. Apéndices

## Audit Scope Notes

- **Confirmado**: el repo auditado contiene runtime auxiliar real en `scripts/`, `scripts/hooks/`, `scripts/lib/state-store/`, `scripts/lib/session-adapters/` y `scripts/lib/tmux-worktree-orchestrator.js`.
- **Confirmado**: no se confirmó un servidor HTTP/API interno dentro de `programing-app` para operar como backend central multiagente.
- **Confirmado**: gran parte del sistema actual depende de prompts/commands/agent definitions más que de un orchestrator de código ejecutable dentro de este repo.
- **No confirmado**: el punto exacto de llamada desde `claude-dashboard` hacia `programing-app`, porque ese repo no forma parte del workspace auditado.
