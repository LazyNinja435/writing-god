# Initialize Book Protocol

## Trigger
User requests a new novel/novella or provides a fresh concept.

## Flow
1. **Collect** concept, genre preferences, audience
2. **Skill:** `orchestration/initialize-book` — create workspace
3. **Skill:** `orchestration/resolve-active-book`
4. **Configure** `book.yaml` from template
5. **Load** genre packs per book.yaml
6. **Skill:** `story/create-premise`
7. **Gate:** human approval if `human_approval.premise`
8. **Skill:** `story/define-themes`
9. **Skill:** `story/create-story-bible`
10. **Gate:** human approval if `human_approval.story_bible`

## Agents
- orchestrator (coordinate)
- story-architect, character-architect, world-architect (as needed)

## Outputs
- `books/<slug>/` workspace
- premise, themes, initial bible structure
