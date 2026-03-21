# Model Strategy

## Principle for this repo

Use models only where they improve outcome more than they increase cost.

Because this repo lacks a confirmed internal backend engine, the safest savings come from:

- deterministic indexing
- deterministic cache reuse
- deterministic working-set restriction
- selective AI only at ambiguity boundaries

## 1. Intent normalization

### Recommendation

- default: deterministic rules
- fallback AI: Claude Haiku

### Why

- most tasks can be classified from words like:
  - bug
  - fix
  - audit
  - refactor
  - add feature
  - update docs
- paying Sonnet here by default would be wasteful

### When to escalate

Escalate from deterministic to Haiku only if:

- task mixes audit + implementation + architecture in one request
- ambiguity is high
- routing changes budgets significantly

### When NOT to use a stronger model

Do not use Sonnet/Opus just to label intent type.

## 2. Context preparation

### Recommendation

- deterministic first
- Haiku only when cache + `AI_CONTEXT` still leave ambiguity
- Sonnet only for broad architectural ambiguity

### Hard stance

**No conviene** usar un modelo caro por defecto en preparación de contexto.

### Why

Your expected savings disappear if every task starts with a large AI prep pass.

### Best split

Deterministic should do:

- read `AI_CONTEXT/00-START-HERE.md`
- read repo cache metadata
- infer likely domain
- build initial working set
- assign expansion budget

AI should only do:

- resolve ambiguity
- compress mixed signals
- flag that discovery is still needed

## 3. Directora de Operaciones

### Recommendation

- keep on strong reasoning tier
- for your own target stack, Sonnet-class Claude is the safest default

### Repo-specific note

- **Confirmado**: in this repo, `director-de-operaciones` exists only as prompt definition.
- So the model recommendation is architectural guidance for the future runtime that consumes that prompt.

### Why not Haiku here

The director decides:

- sequencing
- escalation
- ambiguity handling
- scope discipline
- team mix

This is exactly where cheap misclassification becomes expensive downstream.

## 4. Specialists

### Recommendation

- implementation, review, DB, bug fixing: Sonnet-class Claude
- documentation updater after deterministic selection: Haiku can work for narrow doc updates
- pure deterministic retrieval/indexing: no model

### Why

Once working sets are enforced, specialists no longer need huge repo-discovery effort. That lets you reduce tokens without weakening code quality.

## 5. Context update

### Recommendation

- deterministic impact detection first
- Haiku for compact selective rewrite
- Sonnet only for:
  - major architecture updates
  - cross-domain summaries
  - ADR-worthy decisions

### When NOT to use a strong model

Do not use Sonnet/Opus for:

- updating timestamps
- refreshing a recent-changes bullet list from a tiny diff
- rewriting placeholders after trivial fixes

## 6. Context validation

### Recommendation

- deterministic by default
- no model in iteration 1-3
- optional Haiku later if you want semantic contradiction checks

### Why

Most validation can be done by checking:

- changed files
- commit hash
- affected domain
- doc target mapping
- existence of claimed modules/routes/files

## Critical view on “cheap model for context prep”

## When it is good

A cheap model is useful only if:

- deterministic prep has already narrowed the candidate scope
- the model sees a very small input
- the task is classification/summarization, not architecture

## When it is bad

A cheap model is a bad idea if:

- it receives raw repo excerpts from broad search
- it has to infer system architecture from scratch
- it decides cross-domain scope on its own
- it controls expansion approval directly

## Rule

Cheap model should refine a bounded context package, not discover the repo.

## When to escalate to a stronger model

Use Sonnet when:

- prep confidence is low after deterministic pass
- task spans multiple domains with unclear boundaries
- task implies architecture or contract shifts
- `AI_CONTEXT` and cache disagree materially

Use Opus only when:

- architectural reasoning is critical and large-context evidence must be reconciled
- security/architecture stakes are unusually high
- there is no acceptable deterministic reduction path

## When NOT to escalate even if strong model is available

Do not escalate for:

- narrow bugfix in already indexed file cluster
- audit focused on touched files only
- trivial refactor with known scope
- selective `08-RECENT-CHANGES.md` refresh

## How to avoid AI layers eating the savings

- keep indexing deterministic
- cache prep outputs per task
- never let prep start from broad repo reads if cache is fresh
- expansion requests must return deltas, not fresh full packs
- context updater should be skip-heavy, not eager
- validator should be local-first

## Recommended model matrix

| Layer | Default | Escalate to | Avoid by default |
|---|---|---|---|
| Intent normalization | Deterministic | Claude Haiku | Sonnet, Opus |
| Context preparation | Deterministic | Haiku, then Sonnet if needed | Sonnet-first, Opus-first |
| Directora de Operaciones | Claude Sonnet | Claude Opus for architecture/security-heavy cases | Haiku |
| Specialists | Claude Sonnet | Opus only for rare critical reasoning | Cheap models for code change core |
| Context update | Deterministic + Haiku | Sonnet for architecture/ADR | Opus |
| Context validation | Deterministic | Optional Haiku later | Sonnet/Opus by default |

## Final recommendation

The savings will not come from “using cheaper models everywhere”.

They will come from:

- making most of prep/index/validation deterministic
- narrowing specialist context before inference
- preventing repeated discovery
- using stronger models only once the problem is already bounded
