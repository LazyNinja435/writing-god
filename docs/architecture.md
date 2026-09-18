# Architecture Overview

See `README.md` and `AGENTS.md` for the full model.

## Core Hierarchy

```text
.ai/           — How AI participants behave
books/<book>/  — What the book is and contains
scripts/       — Deterministic tooling (fold, validate)
```

## Three authorities

| Layer | Path | Role |
|-------|------|------|
| Canon | `canon/` | Permanent established truth |
| Narrative history | `state/events/` | Immutable what-happened |
| Derived state | `state/derived/` | Fold output; never hand-edit |

Optional bootstrap: `state/initial.json`.

## Approvals

`approvals/` records bind human decisions to artifact content hashes. Required gates block promote/event/fold until a non-stale approval exists.

## Immutable History + Deterministic Reconstruction

`initial.json` + active events → fold → `state/derived/`

Corrections supersede prior events; old files remain immutable.

`fold:check` and `validate` are read-only.
