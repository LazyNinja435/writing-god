# Framework Memory

This directory documents **framework-level** durable context — not book canon.

Book-specific truth lives under `books/<book>/canon/` and `books/<book>/state/`.

## vs Book State

| Framework memory | Book state |
|------------------|------------|
| How the OS works | What happened in the story |
| Rarely changes | Grows with each scene |
| `.ai/memory/` | `books/<book>/state/events/` |

## Event-Sourced Book State

See `story_state_model` in `.ai/manifest.json` and `scripts/story-state/fold.ts`.

*Event-sourced memory pattern adapted from AstrAI.*
