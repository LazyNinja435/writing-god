# Source of Truth

## Hierarchy

1. **`.ai/`** — AI operating instructions (rules, skills, protocols, agents)
2. **`AGENTS.md`** — Root dispatcher
3. **`books/<book>/book.yaml`** — Book configuration
4. **`books/<book>/canon/`** — Established truth (CANON status)
5. **`books/<book>/planning/`** — Intent (not yet happened)
6. **`books/<book>/state/events/`** — Immutable narrative history
7. **`books/<book>/state/initial.json`** — Optional bootstrap state
8. **`books/<book>/approvals/`** — Durable human approval records
9. **`books/<book>/manuscript/drafts/`** — Staging prose
10. **`books/<book>/manuscript/scenes/`** — Approved prose
11. **`books/<book>/state/derived/`** — Regenerated view (not an authority to edit)

`.ai/examples/books/` is example-only and is not an active book workspace.

Harness adapters are **not** source of truth. They point into `.ai/`.

*Adapted from AstrAI source-of-truth pattern.*
