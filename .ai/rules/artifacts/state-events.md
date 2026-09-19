# State Events

## Identity

- `event_id` is independent of `scene_id` (e.g. `evt-000001`).
- Filenames may be descriptive: `evt-000001-scene-0001-approved.json`.
- Each event carries both `event_id` and (for scene/correction) `scene_id` as needed.

## Manuscript provenance

Scene events (and corrections that ultimately replace a scene root) carry structured `provenance`:

```json
{
  "provenance": {
    "manuscript": "manuscript/scenes/scene-0001.md",
    "manuscript_hash": "sha256:…",
    "approval_id": "apr-000001",
    "scene_card": "planning/scenes/scene-0001.yaml"
  }
}
```

| Field | Required |
|-------|----------|
| `manuscript` | Always for scene / scene-root correction |
| `manuscript_hash` | Always — SHA-256 of **file bytes** (`sha256:` + 64 lowercase hex) |
| `scene_card` | Always — must exist; `scene_id` must match the event |
| `approval_id` | Mandatory when `book.yaml` → `human_approval.scenes: true` |

Non-scene types (`canon-change`, `bootstrap`, corrections of non-scene roots) may omit manuscript provenance.

Validate hard-fails when the manuscript is missing, escapes the book workspace, hash mismatches, scene card mismatches, or (when scenes approval is required) approval record binding fails.

## Recorded sequence vs effective sequence

| Concept | Meaning |
|---------|---------|
| **Recorded sequence** (`event.sequence`) | Mandatory, unique per book. Audit/append order only. |
| **Effective sequence** | Story replay position used by fold. Derived during supersession resolution; not persisted. |

- Normal event: `effectiveSequence = event.sequence`
- Correction: `effectiveSequence =` recorded sequence of the **chain-root** event it ultimately replaces
- Example: evt1 seq1, evt2 seq2, evt3 corrects evt1 with recorded seq3 → fold order is evt3 then evt2 → final state from evt2, not the correction alone

`event_id` is only a diagnostic sort tiebreaker when effective sequences tie (should not occur for distinct roots).

## Types

| `event_type` | Role |
|--------------|------|
| `scene` | Approved scene narrative deltas |
| `correction` | Full supersession of exactly one prior event + replacement deltas |
| `canon-change` | Narrative echo of an approved canon workflow change (optional) |
| `bootstrap` | Rare explicit bootstrap event (prefer `state/initial.json`) |

## Immutability & corrections (V1)

Never edit or delete committed event files. Corrections:

- `event_type: correction`
- `supersedes: [exactly_one_event_id]` — **only** `correction` may have `supersedes` (scene/canon-change/bootstrap with `supersedes` are invalid)
- `reason`
- `changes` — **full replacement deltas** for the corrected outcome
- Recorded `sequence` must be **greater than** the superseded event's recorded sequence (including along chains)
- Must not bypass approval: see continuity-repair (extraction reuse vs manuscript revision)

**Chains** are valid: `A ← B ← C` means C occupies A's effective historical position.

**Multiple historical fixes** = multiple correction events in a chain, not one multi-target correction.

**Branching is rejected:** two active corrections of the same root (`A←B` and `A←C` both active) fail validation. Valid repair path is a single chain (`A←B←C`), not parallel tips. Fold also rejects unknown targets, self-supersession, cycles, and invalid sequence relationships.

There is no `retconned` event status in V1 — supersession is the sole inactivation mechanism.

## Fold pipeline

1. Load events + optional `initial.json`
2. JSON Schema validate (shared with `validate.ts`)
3. Structural validate (duplicate IDs/sequences)
4. Resolve correction chains → `EffectiveEvent[]` (`event`, `effectiveSequence`, `replacementRootId`)
5. Sort by effective historical position
6. Fold resolved history into derived state

`foldEvents` receives resolved effective history; it does not re-interpret correction semantics.

## Knowledge

All knowledge deltas live under `changes.knowledge.<id>.*` only. Character deltas must not carry `knowledge_*` fields.

## Canon

State events do not establish permanent CANON. Emit canon proposals separately.

## Initial state

Prefer `books/<book>/state/initial.json` for pre-event bootstrap. Fold reads it before applying effective events.

## Derived state

`npm run fold -- <book>` writes `state/derived/`.  
`npm run fold:check -- <book>` is **read-only** and must never mutate derived files.  
Invalid events never fold (no write).

`_manifest.json` fields (deterministic; no wall-clock timestamps):

- `source_hash`
- `total_event_count`
- `active_event_count`
- `superseded_event_count`
- `active_event_ids` — IDs in **effective replay order** (superseded excluded)
- `superseded_event_ids`
- `latest_recorded_event_id` / `latest_recorded_sequence` — tip of audit/append order
- `last_effective_event_id` — last event applied in effective replay order
