# AI Author Orchestration

A **harness-agnostic, repository-driven AI operating system** for planning, writing, reviewing, revising, and maintaining long-form fiction.

This is not a prompt collection. The repository teaches any capable AI harness how to collaborate on novels and novellas while preserving plot, character, world, POV, knowledge, timeline, and thread consistency.

---

## Why Repository-Driven Authoring?

Long-form fiction exceeds model context windows. Conversation history is fragile. This framework externalizes:

- **Canon** — what is true
- **Planning** — what should happen
- **State** — what has happened (event-sourced)
- **Manuscript** — narrative prose
- **Reviews** — structured findings

The repo is the operating system. Any harness that reads files can participate.

---

## Architectural Model

```text
User request
    ↓
AGENTS.md
    ↓
.ai/manifest.json
    ↓
rules dispatcher
    ↓
protocol dispatcher
    ↓
book configuration
    ↓
genre dispatcher
    ↓
skill matching
    ↓
specialist roles
    ↓
artifact generation
    ↓
review gates
    ↓
canon/state validation
    ↓
approved manuscript/state
```

### Source Hierarchy

```text
.ai/                      How AI participants behave
books/<book>/book.yaml    What the specific book is
books/<book>/canon/       What is established as true
books/<book>/planning/    What is intended to happen
books/<book>/state/events/    Immutable narrative events
books/<book>/state/derived/ Reconstructed current state (generated)
books/<book>/manuscript/  Narrative prose
books/<book>/reviews/     Review artifacts
books/<book>/research/    Book-specific research
```

---

## Harness Independence

All canonical instructions live under `.ai/`. Adapters in `.ai/harnesses/` are thin pointers for Cursor, Claude Code, Codex, Gemini CLI, GitHub Copilot, and OpenCode.

**Agents are semantic roles**, not separate processes. A harness may implement `continuity-editor` via subagents or sequential role adoption—the contract is the same.

```json
{
  "harness_agnostic": true,
  "dispatchers_before_details": true,
  "semantic_agents": true,
  "tool_specific_config_is_canonical": false
}
```

---

## Rules, Skills, Agents, Protocols

| Concept | What it is | Example |
|---------|------------|---------|
| **Rules** | Hard constraints (laws) | no-silent-retcon, character-knowledge |
| **Skills** | Reusable procedures | write-scene, check-continuity |
| **Agents** | Specialist role contracts | prose-writer, canon-curator |
| **Protocols** | Multi-step orchestration | write-scene, concept-to-bible |

Do not conflate these. Protocols reference skills; agents enforce boundaries.

---

## Canon vs Planning vs State vs Manuscript

| Layer | Mutability | Purpose |
|-------|------------|---------|
| Canon | Changes only via canon workflow | Established truth |
| Planning | Revised during architecture | Intent, scene cards |
| State events | Immutable once committed | What narratively happened |
| Manuscript | Revised through review | Prose |

Not every prose detail becomes canon. See `.ai/rules/canon/canon-lifecycle.md`.

---

## Event-Sourced Story State

Approved scenes emit immutable JSON events:

```text
books/my-book/state/events/scene-0047.json
```

Regenerate derived views deterministically:

```bash
npm run fold -- books/my-book
```

**Principle:** `immutable narrative history + deterministic reconstruction = current story state`

Pattern adapted from [AstrAI](https://github.com/LazyNinja435/astrai) event-sourced memory design (MIT License).

---

## Genre Packs

Composable guidance packs under `.ai/genres/` — not separate frameworks.

```yaml
genre:
  primary: science-fiction
  secondary: [mystery, romance]
```

Load only matching packs via `.ai/genres/genres.md`.

---

## Quick Start

### 1. Initialize a book

Follow `.ai/protocols/orchestration/initialize-book.md` or ask your harness:

> Create a new adult fantasy novel about...

Skill: `orchestration/initialize-book`

### 2. Write a scene

1. Ensure scene card exists in `planning/scenes/`
2. Run `authoring/write-scene` protocol
3. Reviews → approve → event → fold

### 3. Review

Reviews diagnose; revision is separate. Template: `.ai/templates/review.template.yaml`

---

## Example Book

See `books/memory-echo/` — a minimal science-fiction mystery demonstrating:

- book.yaml, canon, planning, threads, scene cards
- sample scene, state event, review, derived state

Walkthrough: `.ai/examples/end-to-end-flow.md`

---

## Repository Structure

```text
AGENTS.md                 Root dispatcher
.ai/                      AI operating system
books/                    Book workspaces
scripts/story-state/      Event fold reducer
scripts/validate.ts       Reference validation
docs/                     Architecture notes
```

---

## Development Commands

```bash
npm install
npm run validate      # manifest, dispatchers, references, example fold
npm test              # fold + validate tests
npm run fold -- books/memory-echo
npm run fold:check -- books/memory-echo
```

---

## AstrAI Attribution

Architectural inspiration from **[AstrAI](https://github.com/LazyNinja435/astrai)** (MIT License):

- Dispatcher-before-details loading
- `AGENTS.md` + `manifest.json` entry pattern
- Semantic agents with Allowed/Not Allowed boundaries
- Skill directory structure and templates
- Harness adapter philosophy
- Event-sourced state with deterministic fold

**Major differences from AstrAI:**

- Domain is fiction authoring, not software development
- Book workspaces with canon/planning/state/manuscript separation
- Genre composable packs
- Character knowledge and plot thread models
- Scene cards and CHANGE_REQUEST workflow
- Story-state fold for narrative events (not team memory)

---

## V1 Limitations

- Publishing protocols are lightweight placeholders
- No LLM API integration or web UI
- Schema validation is structural, not full JSON Schema runtime
- Single-book fold CLI; no cross-book operations
- Human approval gates are configured but enforced by harness discipline

---

## License

MIT — see [LICENSE](LICENSE)
