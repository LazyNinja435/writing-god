# Write Scene Protocol

## Flow
1. Resolve book
2. Load scene card from planning/scenes/
3. **Skill:** load-book-context (scene-write mode)
4. Load applicable canon, derived state, genre guidance
5. **Agent:** prose-writer → write-scene skill
6. **Skill:** extract-scene-events (draft deltas)
7. **Agent:** continuity-editor → check-continuity, check-character-knowledge, check-timeline, check-thread-consistency
8. **Agent:** developmental-editor → developmental-review
9. **Skill:** prose-review (if configured)
10. Revise if FAIL or major findings → revise-scene skill
11. Final verification against scene card outcomes
12. Save approved scene to manuscript/scenes/
13. **Skill:** extract-scene-events → write immutable event
14. **Skill:** build-story-state → npm run fold
15. Human approval if configured for scenes

## Change Requests
If prose-writer blocked: CHANGE_REQUEST → story-architect/orchestrator

## Rules
- canon/no-silent-retcon.md
- artifacts/state-events.md
