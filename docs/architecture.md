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

## Event fold pipeline

```text
load → JSON Schema validate → structural validate
  → resolve correction chains (EffectiveEvent[])
  → sort by effective historical position
  → fold
```

- **Recorded sequence** = unique audit/append order (`event.sequence`)
- **Effective sequence** = story replay order (corrections use chain-root sequence)
- V1: only `correction` may have `supersedes`; exactly one target; chains OK; branching rejected
- Shared schemas: `scripts/lib/schema-validation.ts` (fold + validate)
- Scene events carry manuscript `provenance`; validate cross-checks hashes and approvals (`scripts/lib/provenance-validation.ts`)

Derived `_manifest.json` uses `total_event_count` / `active_event_count` / `superseded_event_count`, `source_hash`, `active_event_ids` (effective replay order), `latest_recorded_event_id` / `latest_recorded_sequence`, and `last_effective_event_id` (no wall-clock timestamps).

## Approvals

`approvals/` records bind human decisions to `source_artifact` content hashes, with optional `promotion_target`. Required gates block promote/event/fold until a non-stale approval exists. Target may be missing while awaiting promotion; once present it must match the approved hash. Scene events with `human_approval.scenes: true` must cite a matching `approval_id` in provenance.

## Immutable History + Deterministic Reconstruction

`initial.json` + effective active events → fold → `state/derived/`

Corrections supersede prior events; old files remain immutable.

`fold:check` and `validate` are read-only.
