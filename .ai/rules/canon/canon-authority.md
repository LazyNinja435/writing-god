# Canon Authority

## Who May Establish Canon

| Role | May Propose | May Establish |
|------|-------------|---------------|
| prose-writer | Yes (proposals only) | No |
| story-architect | Yes | Planning only (not permanent CANON files) |
| canon-curator | Yes | Yes (via canon-update workflow) |
| orchestrator | Route only | No |

## Promotion Path

Approved scene → **state event** + zero or more **canon proposals** (`PROPOSED`) → canon-curator → `continuity/canon-update` → permanent `CANON` (with human approval when configured).

Scene state events **must not** write permanent CANON via `canon_facts` or any equivalent field. Narrative history and canon are separate authorities.

Writers may add **non-canon texture** (gestures, weather, incidental detail) that does not contradict canon.
