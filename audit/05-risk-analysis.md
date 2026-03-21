# Risk Analysis

## 1. Turning Context Preparer into a bottleneck

### Risk

Every task waits on a heavy prep step that becomes slow, expensive, or overly smart.

### Why this repo is vulnerable

- current repo has no central backend engine to hide prep latency
- if prep is model-heavy, every task pays that cost up front
- prompt workflows already spend too much on research phases

### Mitigation

- make prep deterministic-first
- read only:
  - repo cache metadata
  - `AI_CONTEXT/00-START-HERE.md`
  - minimal task artifacts
- use AI only when:
  - intent ambiguity remains
  - cache confidence is low
  - requested task type is architectural or cross-domain
- cache prep results per task
- expose `needsDiscovery` instead of forcing discovery every time

## 2. Overloading the Directora de Operaciones

### Risk

The director prompt becomes responsible for:

- intent normalization
- repo discovery
- cache lookup
- working set creation
- expansion decisions
- workflow planning
- execution supervision

### Why this is bad here

`agents/equipo-direccion/director-de-operaciones/agent.md` is already the planning brain at prompt level. It should not become a repo indexing subsystem.

### Mitigation

- move all deterministic prep into a service before orchestration
- director consumes prepared context object, not raw repo
- director only decides:
  - phases
  - agents
  - sequencing
  - escalation

## 3. Letting specialists keep searching freely

### Risk

You add cache and `AI_CONTEXT`, but specialists still call broad `Glob/Grep/Read` out of habit.

### Evidence in repo

- `implementador` explicitly asks for `search_files`
- `multi-plan`, `multi-execute`, `multi-workflow` all allow broad retrieval fallbacks

### Mitigation

- do not rely on prompt wording alone
- add a runtime context contract:
  - specialists start with `workingSet`
  - free search disabled by default in orchestrated flows
- expansion must go through centralized `ContextExpansionService`
- keep per-task counters:
  - broad expansion count
  - file additions count
  - total files read budget

## 4. `AI_CONTEXT` becoming stale or misleading

### Risk

Prepared docs drift away from actual code and become a new source of hallucination.

### Why this matters here

This repo already uses docs/prompts heavily. A stale context layer would be worse than none.

### Mitigation

Every `AI_CONTEXT` doc should carry metadata such as:

```yaml
lastUpdatedAt:
basedOnCommit:
sourceFingerprint:
updatedBy:
confidence:
```

Validation rules:

- if `basedOnCommit` differs from current HEAD by more than threshold, downgrade trust
- if changed files intersect domain and doc is stale, mark `needsRefresh`
- never silently present stale doc as authoritative

## 5. Too many context files becoming unmaintainable

### Risk

The folder grows into a mini wiki nobody maintains.

### Mitigation

- keep fixed file set only
- no auto-proliferation of domain docs in v1
- allow minimal placeholders for non-applicable domains
- default update cap: 2 files per task
- only update ADR for actual decision changes

## 6. Fragmenting the system and increasing latency

### Risk

You add too many micro-layers:
 
* intent normalizer
* context preparer
* indexer
* validator
* updater
* expansion manager
* planner

and each performs its own I/O or model call.

### Mitigation

- deterministic services share one repo scan artifact
- prep phase reads from cache, not raw filesystem, whenever cache is fresh
- validator should be lightweight and local
- updater should run only on relevant changed tasks
- first implementation should not add networked services; keep local module calls

## 7. Spending expensive models on context update unnecessarily

### Risk

Savings from better retrieval get erased by expensive summarization after every task.

### Mitigation

- do not update `AI_CONTEXT` on every task
- use deterministic impact detection first
- use Haiku-class model only for small selective rewrites
- use Sonnet only for:
  - ambiguous architecture impact
  - cross-domain summaries
  - ADR-worthy changes
- never use a strong model for trivial doc freshness updates

## 8. Final phase rediscovering the repo again

### Risk

After implementation, final validation/audit does another wide search.

### Evidence in repo

- `code-reviewer` rereads surrounding code
- `multi-execute` audit phase can reread changed diff and target files

### Mitigation

- final review consumes:
  - applied diff
  - final working set
  - explicit touched-files list
  - cached neighboring call-site references if needed
- allow one narrow contextual reread around touched files
- forbid repo-wide search in final review unless a finding requires it

## 9. Central cache desynchronizing from real repo

### Risk

`data/project-cache/<repo>/` says one thing, repo says another.

### Mitigation

- cache root metadata must include:
  - `repoRoot`
  - `repoSlug`
  - `basedOnCommit`
  - `lastIndexedAt`
  - `indexVersion`
- maintain per-file fingerprints
- invalidate cache when:
  - HEAD changed
  - tracked file hashes changed
  - `AI_CONTEXT` source fingerprint changed

## 10. Duplicating similar logic already present

### Risk

You accidentally create:

- another snapshot format besides canonical session
- another path-seeding mechanism besides `seedPaths`
- another persistence silo besides state store
- another documentation generator besides codemap flow

### Mitigation

- reuse `seedPaths` as transport basis for working sets
- reuse `canonical-session.js` conventions for task artifacts
- reuse `state-store` migration discipline for new persistence
- reuse codemap scanner ideas for deterministic file classification
- do not create a new “agent” if service/module suffices

## Explicit rules for when NOT to update `AI_CONTEXT`

- change is formatting-only
- change is whitespace-only
- change is comment-only
- change is test-only with no behavioral impact on product/domain
- change is local refactor with no external contract, architecture, or domain shift
- change is build/lint/type fix with no domain meaning
- change affects only temporary scripts or local developer tooling

## Retrieval budgets by task type

These are recommended starting budgets for the new layer.

## Audit rápido

- broad searches: max 1
- initial files: max 8
- expansions: max 1
- total working set: max 12 files
- repo-wide expansion: forbidden

## Audit focalizado

- broad searches: max 2
- initial files: max 12
- expansions: max 2
- total working set: max 20 files
- repo-wide expansion: only with explicit reason

## Bugfix

- broad searches: max 2
- initial files: max 10
- expansions: max 2
- total working set: max 18 files
- neighbor call-site expansion: allowed once

## Feature

- broad searches: max 3
- initial files: max 15
- expansions: max 3
- total working set: max 28 files
- cross-domain expansion: allowed if plan says fullstack

## Refactor

- broad searches: max 2
- initial files: max 20
- expansions: max 2
- total working set: max 30 files
- repo-wide expansion: forbidden in iteration 1-2

## Bottom line

The biggest operational risk is not technical impossibility. It is implementing a smart-looking layer that remains optional.

If working sets and expansion control are not enforced technically, the current broad-search behavior will survive and absorb the intended savings.
