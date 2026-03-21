# Appendix — Agent Map

## Important framing

- **Confirmado**: los agentes en este repo son principalmente definiciones Markdown con frontmatter + prompt.
- **No confirmado**: un runtime que materialice todos esos agentes dentro de `programing-app`.

## Agents directly relevant to context/retrieval redesign

## `director-de-operaciones`

- File: `agents/equipo-direccion/director-de-operaciones/agent.md`
- Role:
  - operational brain
  - chooses teams, order, escalation
- Tools declared:
  - `Read`
  - `Grep`
  - `Glob`
  - `Bash`
- Relevance:
  - should consume prepared context
  - should not own repo indexing
- Competes with:
  - any attempt to make `Preparador de Contexto` another planner agent

## `project-manager`

- File: `agents/equipo-direccion/project-manager/agent.md`
- Role:
  - phases, tasks, dependencies, priorities
- Relevance:
  - downstream consumer of prepared scope
- Competes with:
  - any context component that also tries to produce full workflow plans

## `implementador`

- File: `agents/equipo-desarrollo/implementador/agent.md`
- Role:
  - code changes
- Current retrieval problem:
  - asks to identify relevant files with `search_files`
- Relevance:
  - should be forced onto `workingSet`
- Biggest change needed:
  - move from free discovery to constrained execution

## `code-reviewer`

- File: `agents/equipo-calidad/inspector-de-codigo/agent.md`
- Role:
  - diff review + surrounding code review
- Relevance:
  - should receive touched-file context package, not rediscover repo broadly
- Competes with:
  - final-phase free broad search if not constrained

## `docs-lookup`

- File: `agents/equipo-desarrollo/consultor-tecnico/agent.md`
- Actual identity in file:
  - `name: docs-lookup`
- Role:
  - external documentation lookup via Context7 MCP
- Relevance:
  - useful for library docs, not for repo-local retrieval
- Should NOT be confused with repo index/discovery

## `documentador`

- File: `agents/equipo-desarrollo/documentador/agent.md`
- Role:
  - documentation and codemaps
- Relevance:
  - could eventually consume `ContextUpdater` outputs
- Should not own selective `AI_CONTEXT` update logic by itself in v1

## `validador-de-salida`

- File: `agents/equipo-direccion/validador-de-salida/agent.md`
- Role:
  - final validation / verdict
- Relevance:
  - later consumer of validated context artifacts

## Agents that should not be overloaded with context-system responsibilities

- `director-de-operaciones`
- `project-manager`
- `implementador`
- `code-reviewer`

## Why

They are role prompts for orchestration or task execution. The new context layer should serve them, not live inside them.

## Existing handoff contract fields worth preserving

Found in agent frontmatter:

- `handoffExpects`
- `handoffProduces`
- `requiresClientApprovalOn`
- `fallbackmodel`
- `escalationmodel`

These are useful for later wiring, but currently they are prompt metadata, not enforced runtime fields.

## Which agent partially overlaps with “Context Preparer”

### Closest conceptual overlap

- `director-de-operaciones`

### Why only partial

- understands goals and scope
- decides sequencing
- but does not currently own deterministic cache lookup or working-set generation

## Which agent partially overlaps with “Context Updater”

### Closest conceptual overlap

- `documentador`

### Why only partial

- docs/codemap concern
- but no selective diff-based `AI_CONTEXT` maintenance exists in runtime

## Recommendation on creating new agents

### `Preparador de Contexto`

- Recommendation: **do not create as a new agent initially**
- Better classification:
  - `mejor_como_capacidad_de_otro_agente` or more precisely a system capability/service

### `Actualizador de Contexto`

- Recommendation: **do not create as a new agent initially**
- Better classification:
  - system service with optional doc-writing assist later

## Bottom line

The prompt agent layer already has enough planning/execution roles.

What it lacks is not one more agent. It lacks a hard repo-context substrate beneath those agents.
