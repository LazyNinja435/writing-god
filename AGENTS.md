# AI Author Orchestration — AGENTS.md

**Repository-driven AI operating system for planning, writing, reviewing, and maintaining long-form fiction.**

This is the root dispatcher. Every AI agent entering this repository must start here.

---

## Mandatory Startup Sequence

Follow this sequence exactly. Do not skip steps. Do not load the entire `.ai/` directory.

1. **Read `AGENTS.md`** (you are here)
2. **Read `.ai/manifest.json`** — machine-readable index of the framework
3. **Read `.ai/rules/rules.md`** — rules dispatcher
4. **Load always-required project and canon rules** (see manifest `mandatory_startup_files`)
5. **Load only additional rules** applicable to the current task
6. **Read `.ai/protocols/protocols.md`** — protocol dispatcher
7. **Resolve the active book** (see Book Discovery below)
8. **Read `books/<book>/book.yaml`** — book configuration
9. **Read `.ai/genres/genres.md`** — genre dispatcher
10. **Load only applicable primary/secondary genre packs**
11. **Match relevant skills** via "When to Use" triggers in `.ai/skills/<category>/`
12. **Load only specialist agents** whose roles add value for this task
13. **Read only relevant** canon, planning, state, and manuscript context
14. **Execute the selected protocol**
15. **Perform required reviews**
16. **Persist only approved artifacts**
17. **Emit immutable story-state events** for canonical narrative changes
18. **Verify before declaring the task complete**

---

## Source of Truth

| Layer | Location | Responsibility |
|-------|----------|----------------|
| AI operating instructions | `.ai/` | Rules, skills, protocols, agents, templates, schemas |
| Root dispatcher | `AGENTS.md` | Entry point and startup sequence |
| Book identity & config | `books/<book>/book.yaml` | Genre, POV, approval gates, targets |
| Established truth | `books/<book>/canon/` | Approved canonical facts |
| Intent | `books/<book>/planning/` | Outlines, scene cards, threads |
| What happened | `books/<book>/state/events/` | Immutable narrative events |
| Current state | `books/<book>/state/derived/` | Deterministically reconstructed (regenerate, do not hand-edit) |
| Prose | `books/<book>/manuscript/` | Narrative text |
| Reviews | `books/<book>/reviews/` | Review artifacts |
| Research | `books/<book>/research/` | Factual notes (not fiction canon) |

Harness-specific files (Cursor rules, Claude config, etc.) are **thin adapters** pointing into `.ai/`. They are not canonical.

---

## Dispatchers Before Details

Do not load all rules, skills, protocols, agents, or genre packs by default.

Use dispatchers to select exact file paths:

- Rules: `.ai/rules/rules.md`
- Protocols: `.ai/protocols/protocols.md`
- Genres: `.ai/genres/genres.md`
- Skills: match by "When to Use" in each `SKILL.md`
- Agents: load only when delegation adds value

Context efficiency is a first-class requirement.

---

## Precedence Order

When instructions conflict:

1. **Explicit user request**
2. **Safety rules** (`.ai/rules/safety/`)
3. **Canon rules** (`.ai/rules/canon/`) — no silent retcons
4. **This file and dispatchers** (`AGENTS.md`, `rules.md`, `protocols.md`, `genres.md`)
5. **Book configuration** (`books/<book>/book.yaml`)
6. **Loaded category rules**
7. **Genre packs** (guidance only unless marked hard constraint)
8. **Skills** (procedures)
9. **Protocols** (orchestration)
10. **Templates** (output structure)
11. **General model behavior**

Genre guidance must not override explicit book configuration unless clearly marked as a hard compatibility constraint.

---

## Book Discovery & Active Book Resolution

1. List directories under `books/` (exclude hidden and template-only paths).
2. Check user request for explicit book slug or title.
3. Check environment variable `BOOK_SLUG` if set.
4. If exactly one book exists, use it.
5. If multiple books exist and none is specified, **ask the user**.
6. Never mix artifacts from different books in one task.

Skill: `.ai/skills/orchestration/resolve-active-book/SKILL.md`

---

## Genre Loading

After reading `book.yaml`:

1. Read `.ai/genres/genres.md`
2. Load **primary** genre pack files listed for `genre.primary`
3. Load **secondary** genre pack files only for genres in `genre.secondary`
4. Do not load unrelated genre packs

---

## Semantic Agent Model

An **agent** is a **role contract**, not a separate process or model.

Examples: `orchestrator`, `prose-writer`, `continuity-editor`

A harness may implement an agent by:

- Spawning a subagent with specialized context
- Switching role instructions in the same session
- Invoking a different model
- Sequential execution in one thread

The semantic contract (Purpose, Allowed, Not Allowed) remains identical across harnesses.

### Delegation

1. Attempt the task directly when no specialization is needed.
2. Load agent from `.ai/agents/<category>/<agent>.md`
3. Respect Allowed / Not Allowed boundaries
4. Use `prepare-agent-brief` skill to package inputs
5. Validate output before integration

---

## Canon Change Rules

- Established canon cannot change silently.
- Writers may **propose** facts; they may not **establish** canon without authorized workflow.
- On conflict: stop, identify contradiction, propose options, route through `canon-update` protocol.
- Retcons must be explicit with `RETCONNED` status and human approval when configured.

Rules: `.ai/rules/canon/no-silent-retcon.md`, `.ai/rules/canon/canon-authority.md`

---

## Protocol Selection

Match user intent to protocols via `.ai/protocols/protocols.md`:

| Intent | Protocol |
|--------|----------|
| New book | `orchestration/initialize-book.md` |
| Premise → bible | `authoring/concept-to-bible.md` |
| Bible → outline | `authoring/bible-to-outline.md` |
| Outline → scenes | `authoring/outline-to-scene-graph.md` |
| Write scene | `authoring/write-scene.md` |
| Write chapter | `authoring/write-chapter.md` |
| Canon change | `continuity/canon-update.md` |
| Fix contradiction | `continuity/continuity-repair.md` |
| Reviews | `review/*.md` |

Skill: `.ai/skills/orchestration/select-authoring-workflow/SKILL.md`

---

## Story-State Event Handling

Narrative progression is **event-sourced**:

1. Approved scenes produce immutable events in `books/<book>/state/events/<scene-id>.json`
2. Never edit or delete committed events (retcons add new explicit events)
3. Regenerate derived state: `npm run fold -- books/<book>`
4. Use derived state for context loading; use events as historical authority

Do not let multiple agents rewrite shared state JSON files directly.

---

## Writer Change Requests

If a prose writer cannot execute a scene card as planned, they must produce a **CHANGE_REQUEST** — not silently alter plot outcomes.

Template: `.ai/templates/change-request.template.md`

Route to story-architect or orchestrator for evaluation.

---

## Human Approval Gates

Check `books/<book>/book.yaml` → `human_approval` before persisting:

- Premise, story bible, macro outline may require approval
- Major canon retcons typically require approval
- Scene/chapter work may proceed automatically once architecture is approved

When approval is required, present artifacts and wait for explicit user confirmation.

---

## Context Loading Discipline

Before writing or reviewing a scene, load only:

- Scene card
- POV and participant character canon
- Relevant location and world rules
- Current relationship and knowledge state (from derived state)
- Active threads touched by the scene
- Previous scene summary (not full manuscript)
- `narrative-style.md` and applicable genre guidance

Skill: `.ai/skills/orchestration/load-book-context/SKILL.md`

---

## Completion Verification

Before declaring a task complete:

1. Verify work against loaded rules
2. Run applicable review protocols
3. Ensure artifacts match templates/schemas
4. Emit story-state events if narrative canon changed
5. Run `npm run fold -- books/<book>` if events were added
6. Run `npm run validate` when modifying framework files
7. Summarize what was done and what requires human approval

---

## What Is Forbidden

- Loading every `.ai/` file "just in case"
- Treating harness adapter docs as source of truth
- Silent canon retcons or knowledge leakage
- Prose writers changing approved plot outcomes without CHANGE_REQUEST
- Hand-editing `state/derived/` files
- Mutating immutable `state/events/` files
- Resolving threads or deaths without explicit events
- Loading the full manuscript for routine scene work
- Duplicating skill workflows inside protocols or agents

---

## Quick Reference

| What | Where | When |
|------|-------|------|
| Root dispatcher | `AGENTS.md` | Always, first |
| Manifest | `.ai/manifest.json` | After AGENTS.md |
| Rules dispatcher | `.ai/rules/rules.md` | After manifest |
| Protocol dispatcher | `.ai/protocols/protocols.md` | After rules |
| Genre dispatcher | `.ai/genres/genres.md` | After book.yaml |
| Skills | `.ai/skills/<category>/<name>/SKILL.md` | Match "When to Use" |
| Agents | `.ai/agents/<category>/<name>.md` | When delegating |
| Templates | `.ai/templates/` | Structured output |
| Schemas | `.ai/schemas/` | Validation |
| Harness info | `.ai/harnesses/` | Informational only |
| Example flow | `.ai/examples/end-to-end-flow.md` | Learning the system |
