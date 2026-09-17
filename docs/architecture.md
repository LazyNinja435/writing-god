# Architecture Overview

See README.md and AGENTS.md for the full model.

## Core Hierarchy

```text
.ai/           — How AI participants behave
books/<book>/  — What the book is and contains
scripts/       — Deterministic tooling (fold, validate)
```

## Immutable History + Deterministic Reconstruction

`state/events/` + fold → `state/derived/`

Do not hand-edit derived files.
