# Protocol Dispatcher

> Do not load all protocols by default. Protocols orchestrate rules, skills, agents, templates, approval gates, and persistence.

## Orchestration (`.ai/protocols/orchestration/`)

| File | When |
|------|------|
| `initialize-book.md` | New book from concept |

## Authoring (`.ai/protocols/authoring/`)

| File | When |
|------|------|
| `concept-to-bible.md` | Premise → story bible |
| `bible-to-outline.md` | Bible → macro outline |
| `outline-to-scene-graph.md` | Outline → scene cards |
| `write-scene.md` | Execute one scene end-to-end |
| `write-chapter.md` | Coordinate multiple scenes |

## Continuity (`.ai/protocols/continuity/`)

| File | When |
|------|------|
| `canon-update.md` | Promote or change canon |
| `continuity-repair.md` | Resolve detected contradictions |

## Review (`.ai/protocols/review/`)

| File | When |
|------|------|
| `scene-review.md` | After scene draft |
| `chapter-review.md` | Chapter complete |
| `act-review.md` | Act milestone |
| `manuscript-review.md` | Full draft review |

## Publishing (`.ai/protocols/publishing/`) — V1 lightweight

| File | When |
|------|------|
| `developmental-pass.md` | Structural revision phase |
| `structural-revision.md` | Major restructuring |
| `line-edit.md` | Line-level polish |
| `copy-edit.md` | Grammar/consistency |
| `final-manuscript-verification.md` | Pre-submission check |

## Forbidden

- Duplicating skill workflows in protocols — reference skills by path
- Skipping review gates defined in write-scene
- Loading all protocols for simple tasks
