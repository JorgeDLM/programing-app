# Plan - Multi-Model Collaborative Planning

Multi-model collaborative planning - Context retrieval + Dual-model analysis → Generate step-by-step implementation plan.

$ARGUMENTS

---

## Core Protocols

- **Language Protocol**: Use **English** when interacting with tools/models, communicate with user in their language
- **Mandatory Parallel**: Codex/Gemini calls MUST use `run_in_background: true` (including single model calls, to avoid blocking main thread)
- **Code Sovereignty**: External models have **zero filesystem write access**, all modifications by Claude
- **Stop-Loss Mechanism**: Do not proceed to next phase until current phase output is validated
- **Planning Only**: This command allows reading context and writing to `.claude/plan/*` plan files, but **NEVER modify production code**
- **Prepared Context First**: For new tasks, prepare or load a `PreparedContextPackage` before any repo exploration
- **Working Set First**: Start from `WorkingSet`, recommended `AI_CONTEXT` docs, and previous artifacts, not the whole repo
- **Controlled Expansion Only**: If context is insufficient, request expansion explicitly before any broad search
- **Backward Compatibility**: Legacy retrieval remains available only as a compatibility fallback, never as the default path

---

## Multi-Model Call Specification

**Call Syntax** (parallel: use `run_in_background: true`):

```
Bash({
  command: "~/.claude/bin/codeagent-wrapper {{LITE_MODE_FLAG}}--backend <codex|gemini> {{GEMINI_MODEL_FLAG}}- \"$PWD\" <<'EOF'
ROLE_FILE: <role prompt path>
<TASK>
Requirement: <enhanced requirement>
Context: <PreparedContextPackage + WorkingSet + recommended docs + previous artifacts>
</TASK>
OUTPUT: Step-by-step implementation plan with pseudo-code. DO NOT modify any files.
EOF",
  run_in_background: true,
  timeout: 3600000,
  description: "Brief description"
})
```

**Model Parameter Notes**:
- `{{GEMINI_MODEL_FLAG}}`: When using `--backend gemini`, replace with `--gemini-model gemini-3-pro-preview` (note trailing space); use empty string for codex

**Role Prompts**:

| Phase | Codex | Gemini |
|-------|-------|--------|
| Analysis | `~/.claude/.ccg/prompts/codex/analyzer.md` | `~/.claude/.ccg/prompts/gemini/analyzer.md` |
| Planning | `~/.claude/.ccg/prompts/codex/architect.md` | `~/.claude/.ccg/prompts/gemini/architect.md` |

**Session Reuse**: Each call returns `SESSION_ID: xxx` (typically output by wrapper), **MUST save** for subsequent `/ccg:execute` use.

**Wait for Background Tasks** (max timeout 600000ms = 10 minutes):

```
TaskOutput({ task_id: "<task_id>", block: true, timeout: 600000 })
```

**IMPORTANT**:
- Must specify `timeout: 600000`, otherwise default 30 seconds will cause premature timeout
- If still incomplete after 10 minutes, continue polling with `TaskOutput`, **NEVER kill the process**
- If waiting is skipped due to timeout, **MUST call `AskUserQuestion` to ask user whether to continue waiting or kill task**

---

## Execution Workflow

**Planning Task**: $ARGUMENTS

### Phase 1: Prepared Context Bootstrap

`[Mode: Research]`

#### 1.1 Prompt Enhancement (MUST execute first)

**If ace-tool MCP is available**, call `mcp__ace-tool__enhance_prompt` tool:

```
mcp__ace-tool__enhance_prompt({
  prompt: "$ARGUMENTS",
  conversation_history: "<last 5-10 conversation turns>",
  project_root_path: "$PWD"
})
```

Wait for enhanced prompt, **replace original $ARGUMENTS with enhanced result** for all subsequent phases.

**If ace-tool MCP is NOT available**: Skip this step and use the original `$ARGUMENTS` as-is for all subsequent phases.

#### 1.2 Context Bootstrap (Primary Path)

Before any repo exploration, load context through the new stack:

1. Generate or load a `PreparedContextPackage`
2. Read the `WorkingSet`
3. Read recommended `AI_CONTEXT` docs first
4. Reuse previous task/session artifacts when they are relevant
5. Carry forward the current budget and expansion policy

Preferred helper:

```bash
node scripts/context-prepare.js --task "$ARGUMENTS" --write .claude/plan/task-context.json
```

Use the resulting `PreparedContextPackage` as the context source for all planning analysis.

#### 1.3 Controlled Expansion (Only If Needed)

If the initial `WorkingSet` is insufficient:

1. Identify the missing context precisely
2. Request controlled expansion
3. Re-read the updated `WorkingSet`
4. Continue planning from the expanded bounded context

Preferred helper:

```bash
node scripts/context-expand.js --prepared-context .claude/plan/task-context.json --request '{"mode":"narrow","paths":["path/to/file.ts"],"reason":"Need adjacent implementation detail"}' --write .claude/plan/task-context-expanded.json
```

#### 1.4 Compatibility Retrieval (Not Default)

**If ace-tool MCP is available**, call `mcp__ace-tool__search_context` tool:

```
mcp__ace-tool__search_context({
  query: "<semantic query based on enhanced requirement>",
  project_root_path: "$PWD"
})
```

- Build semantic query using natural language (Where/What/How)
- **NEVER answer based on assumptions**
- Only use this after the prepared context path is exhausted or expansion is explicitly denied

**If ace-tool MCP is NOT available**, use Claude Code built-in tools as fallback:
1. **Glob**: Find relevant files by pattern (e.g., `Glob("**/*.ts")`, `Glob("src/**/*.py")`)
2. **Grep**: Search for key symbols, function names, class definitions (e.g., `Grep("className|functionName")`)
3. **Read**: Read the discovered files to gather complete context
4. **Task (Explore agent)**: For deeper exploration, use `Task` with `subagent_type: "Explore"` to search across the codebase

Legacy retrieval is compatibility-only. It is not the preferred route for a new task.

#### 1.5 Completeness Check

- Must obtain **complete definitions and signatures** for relevant classes, functions, variables
- If context insufficient, trigger **recursive retrieval**
- Prioritize output: entry file + line number + key symbol name; add minimal code snippets only when necessary to resolve ambiguity

#### 1.6 Requirement Alignment

- If requirements still have ambiguity, **MUST** output guiding questions for user
- Until requirement boundaries are clear (no omissions, no redundancy)

### Phase 2: Multi-Model Collaborative Analysis

`[Mode: Analysis]`

#### 2.1 Distribute Inputs

**Parallel call** Codex and Gemini (`run_in_background: true`):

Distribute **original requirement** (without preset opinions) to both models:

1. **Codex Backend Analysis**:
   - ROLE_FILE: `~/.claude/.ccg/prompts/codex/analyzer.md`
   - Focus: Technical feasibility, architecture impact, performance considerations, potential risks
   - OUTPUT: Multi-perspective solutions + pros/cons analysis

2. **Gemini Frontend Analysis**:
   - ROLE_FILE: `~/.claude/.ccg/prompts/gemini/analyzer.md`
   - Focus: UI/UX impact, user experience, visual design
   - OUTPUT: Multi-perspective solutions + pros/cons analysis

Both models should receive the bounded context package first:

- `PreparedContextPackage`
- `WorkingSet`
- recommended docs
- previous artifacts
- current expansion budget

Wait for both models' complete results with `TaskOutput`. **Save SESSION_ID** (`CODEX_SESSION` and `GEMINI_SESSION`).

#### 2.2 Cross-Validation

Integrate perspectives and iterate for optimization:

1. **Identify consensus** (strong signal)
2. **Identify divergence** (needs weighing)
3. **Complementary strengths**: Backend logic follows Codex, Frontend design follows Gemini
4. **Logical reasoning**: Eliminate logical gaps in solutions

#### 2.3 (Optional but Recommended) Dual-Model Plan Draft

To reduce risk of omissions in Claude's synthesized plan, can parallel have both models output "plan drafts" (still **NOT allowed** to modify files):

1. **Codex Plan Draft** (Backend authority):
   - ROLE_FILE: `~/.claude/.ccg/prompts/codex/architect.md`
   - OUTPUT: Step-by-step plan + pseudo-code (focus: data flow/edge cases/error handling/test strategy)

2. **Gemini Plan Draft** (Frontend authority):
   - ROLE_FILE: `~/.claude/.ccg/prompts/gemini/architect.md`
   - OUTPUT: Step-by-step plan + pseudo-code (focus: information architecture/interaction/accessibility/visual consistency)

Wait for both models' complete results with `TaskOutput`, record key differences in their suggestions.

#### 2.4 Generate Implementation Plan (Claude Final Version)

Synthesize both analyses, generate **Step-by-step Implementation Plan**:

```markdown
## Implementation Plan: <Task Name>

### Task Type
- [ ] Frontend (→ Gemini)
- [ ] Backend (→ Codex)
- [ ] Fullstack (→ Parallel)

### Technical Solution
<Optimal solution synthesized from Codex + Gemini analysis>

### Implementation Steps
1. <Step 1> - Expected deliverable
2. <Step 2> - Expected deliverable
...

### Key Files
| File | Operation | Description |
|------|-----------|-------------|
| path/to/file.ts:L10-L50 | Modify | Description |

### Risks and Mitigation
| Risk | Mitigation |
|------|------------|

### SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: <session_id>
- GEMINI_SESSION: <session_id>
```

### Phase 2 End: Plan Delivery (Not Execution)

**`/ccg:plan` responsibilities end here, MUST execute the following actions**:

1. Present complete implementation plan to user (including pseudo-code)
2. Save plan to `.claude/plan/<feature-name>.md` (extract feature name from requirement, e.g., `user-auth`, `payment-module`)
3. Output prompt in **bold text** (MUST use actual saved file path):

   ---
   **Plan generated and saved to `.claude/plan/actual-feature-name.md`**

   **Please review the plan above. You can:**
   - **Modify plan**: Tell me what needs adjustment, I'll update the plan
   - **Execute plan**: Copy the following command to a new session

   ```
   /ccg:execute .claude/plan/actual-feature-name.md
   ```
   ---

   **NOTE**: The `actual-feature-name.md` above MUST be replaced with the actual saved filename!

4. **Immediately terminate current response** (Stop here. No more tool calls.)

**ABSOLUTELY FORBIDDEN**:
- Ask user "Y/N" then auto-execute (execution is `/ccg:execute`'s responsibility)
- Any write operations to production code
- Automatically call `/ccg:execute` or any implementation actions
- Continue triggering model calls when user hasn't explicitly requested modifications

---

## Plan Saving

After planning completes, save plan to:

- **First planning**: `.claude/plan/<feature-name>.md`
- **Iteration versions**: `.claude/plan/<feature-name>-v2.md`, `.claude/plan/<feature-name>-v3.md`...

Plan file write should complete before presenting plan to user.

---

## Plan Modification Flow

If user requests plan modifications:

1. Adjust plan content based on user feedback
2. Update `.claude/plan/<feature-name>.md` file
3. Re-present modified plan
4. Prompt user to review or execute again

---

## Next Steps

After user approves, **manually** execute:

```bash
/ccg:execute .claude/plan/<feature-name>.md
```

---

## Key Rules

1. **Plan only, no implementation** – This command does not execute any code changes
2. **No Y/N prompts** – Only present plan, let user decide next steps
3. **Trust Rules** – Backend follows Codex, Frontend follows Gemini
4. External models have **zero filesystem write access**
5. **SESSION_ID Handoff** – Plan must include `CODEX_SESSION` / `GEMINI_SESSION` at end (for `/ccg:execute resume <SESSION_ID>` use)
