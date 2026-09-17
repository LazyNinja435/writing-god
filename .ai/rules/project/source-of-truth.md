# Source of Truth

## Hierarchy

1. **`.ai/`** — AI operating instructions (rules, skills, protocols, agents)
2. **`AGENTS.md`** — Root dispatcher
3. **`books/<book>/book.yaml`** — Book configuration
4. **`books/<book>/canon/`** — Established truth (CANON status)
5. **`books/<book>/planning/`** — Intent (not yet happened)
6. **`books/<book>/state/events/`** — Immutable narrative history
7. **`books/<book>/manuscript/`** — Prose (may include non-canon texture)

Harness adapters are **not** source of truth. They point into `.ai/`.

*Adapted from AstrAI source-of-truth pattern.*
