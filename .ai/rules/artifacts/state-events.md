# State Events

## Identity

- `event_id` is independent of `scene_id` (e.g. `evt-000001`).
- Filenames may be descriptive: `evt-000001-scene-0001-approved.json`.
- Each event carries both `event_id` and (for scene/correction) `scene_id` as needed.
- `sequence` is **mandatory** and **unique** per book. Fold rejects missing/duplicate sequences. `event_id` is only a diagnostic sort tiebreaker.

## Types

| `event_type` | Role |
|--------------|------|
| `scene` | Approved scene narrative deltas |
| `correction` | Full supersession of prior event(s) + replacement deltas |
| `canon-change` | Narrative echo of an approved canon workflow change (optional) |
| `bootstrap` | Rare explicit bootstrap event (prefer `state/initial.json`) |

## Immutability & corrections

Never edit or delete committed event files. Corrections:

- `event_type: correction`
- `supersedes: [event_id, ...]`
- `reason`
- `changes` — **full replacement deltas** for the corrected outcome (not ambiguous status flags)

Fold loads all events → validates → builds supersession relationships → applies only **active** (non-superseded) events. Rejects missing targets, self-supersession, and cycles.

There is no `retconned` event status in V1 — supersession is the sole inactivation mechanism.

## Knowledge

All knowledge deltas live under `changes.knowledge.<id>.*` only. Character deltas must not carry `knowledge_*` fields.

## Canon

State events do not establish permanent CANON. Emit canon proposals separately.

## Initial state

Prefer `books/<book>/state/initial.json` for pre-event bootstrap. Fold reads it before applying active events.

## Derived state

`npm run fold -- <book>` writes `state/derived/`.  
`npm run fold:check -- <book>` is **read-only** and must never mutate derived files.  
Invalid events never fold (no write). Derived manifests use `source_hash` (content hashes), not wall-clock timestamps.
