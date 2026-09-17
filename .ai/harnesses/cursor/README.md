# Cursor Adapter

**Harness:** Cursor
**Compatibility:** Drop-in via `AGENTS.md`

## Canonical Entry

1. `AGENTS.md` — root dispatcher
2. `.ai/manifest.json` — index
3. Dispatchers: rules, protocols, genres

## Semantic Agents

Agents are role contracts. Implement by:
- Native subagents (if available)
- Sequential role context switching
- Same model, different loaded agent definition

## Parallel Review

Map manuscript-review panel to parallel subagents or sequential role adoption.

## Important

- Do **not** duplicate `.ai/` instructions in harness config
- Harness files are thin pointers only
- Source of truth: `.ai/`


## Cursor Setup

Create minimal `.cursor/rules/author-orchestration.mdc` pointing to `AGENTS.md`:

```markdown
---
description: AI Author Orchestration entrypoint
alwaysApply: true
---
Read and follow AGENTS.md as the root dispatcher. Load .ai/ selectively via dispatchers only.
```

