# Write Scene Protocol

## Correct order

1. Resolve book (existing-book path only)
2. Load scene card from `planning/scenes/`
3. **Skill:** `load-book-context` (scene-write mode) — focused canon, derived state, genre
4. **Agent:** prose-writer → **Skill:** `write-scene` → stage draft under `manuscript/drafts/`
5. **Skill:** `extract-scene-events` — extract **PROPOSED** state deltas (do not write event yet)
6. **Agent:** continuity-editor → check-continuity, check-character-knowledge, check-timeline, check-thread-consistency
7. **Agent:** developmental-editor → developmental-review
8. **Skill:** prose-review (if configured)
9. Revision loop if FAIL or major findings → `revise-scene`
10. Final verification against scene card outcomes
11. **Human approval IF** `book.yaml` → `human_approval.scenes` — **Skill:** `verify-approval` / record under `approvals/`
12. **Only after approval (or if approval not required):**
    - Promote draft → `manuscript/scenes/`
    - **Skill:** `extract-scene-events` → write immutable event (`evt-NNNNNN`, not scene-id-as-event-id)
    - Emit canon proposals if permanent CANON may be warranted (do not auto-promote)
    - **Skill:** `build-story-state` → `npm run fold`
13. Verify completion (approval hash non-stale when required)

## Staging rule

Nothing canonical before the approval gate:

- No approved manuscript under `manuscript/scenes/`
- No immutable state event
- No permanent canon promotion
- Drafts and reviews may exist while waiting

## Change Requests

If prose-writer blocked: CHANGE_REQUEST → story-architect/orchestrator

## Rules

- `.ai/rules/canon/no-silent-retcon.md`
- `.ai/rules/canon/canon-authority.md`
- `.ai/rules/artifacts/state-events.md`
- `.ai/rules/artifacts/approvals.md`
