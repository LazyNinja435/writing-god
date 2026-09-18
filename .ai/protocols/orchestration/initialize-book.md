# Initialize Book Protocol

## Trigger

User requests a new novel/novella or provides a fresh concept.

## Critical ordering

This is a **new-book** protocol. Do **not** resolve an existing active book (including example books) before initialization.

## Flow

1. **Collect** concept, genre preferences, audience
2. **Skill:** `orchestration/select-authoring-workflow` — confirm initialize-book
3. **Skill:** `orchestration/initialize-book` — create `books/<slug>/` workspace (ignore sole example books)
4. **Skill:** `orchestration/resolve-active-book` — resolve the **newly created** book only
5. **Configure** `book.yaml` from template (including `human_approval`)
6. Create empty `approvals/`, `manuscript/drafts/`, `manuscript/scenes/`, `state/events/`, and optional `state/initial.json`
7. **Load** genre packs per book.yaml
8. **Skill:** `story/create-premise`
9. **Gate:** human approval if `human_approval.premise` → durable approval record
10. **Skill:** `story/define-themes`
11. **Skill:** `story/create-story-bible`
12. **Gate:** human approval if `human_approval.story_bible`

## Agents

- orchestrator (coordinate)
- story-architect, character-architect, world-architect (as needed)

## Outputs

- `books/<slug>/` workspace
- premise, themes, initial bible structure
