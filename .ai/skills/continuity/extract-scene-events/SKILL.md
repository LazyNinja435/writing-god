# Extract Scene Events

## Purpose

Derive a story-state event from an **approved** scene (or proposed deltas during review).

## When to Use

- After scene approval (persist event)
- During write-scene review (proposed deltas only — do not write yet)

## Required Inputs

- Scene prose (draft or approved) on disk
- Scene card
- Approval record when `human_approval.scenes` is true
- Next free `event_id` / recorded `sequence` for the book (audit order; unique)

## Workflow

1. Identify state changes: location, relationships, knowledge, threads, inventory, world
2. Put knowledge only under `changes.knowledge.<id>.*`
3. Build event JSON per schema (`event_id` like `evt-000001`, `event_type: scene`, mandatory unique recorded `sequence`)
4. Compute `provenance` from **file bytes on disk** — never trust chat memory or prior message hashes:
   - `manuscript`: book-relative path to the promoted scene (e.g. `manuscript/scenes/scene-0001.md`)
   - `manuscript_hash`: `sha256:` + hex of the manuscript file bytes (re-read the file)
   - `scene_card`: book-relative path to the scene card YAML
   - `approval_id`: from the durable approval record when scenes approval is required
5. For corrections: `supersedes` exactly one prior `event_id` (only `event_type: correction` may set `supersedes`); recorded sequence must exceed the superseded event's sequence; use full replacement deltas; include provenance per continuity-repair (reuse vs revise)
6. Do **not** include `canon_facts` — emit separate canon proposals if needed
7. Validate against schema and run `npm run validate` / provenance cross-checks
8. Write only after approval gate: `state/events/evt-NNNNNN-scene-NNNN-approved.json`

## Output

Immutable event file + optional canon proposal stubs under `canon/proposals/`

## Forbidden

- Mutating existing events
- Using `scene_id` as `event_id`
- Establishing permanent CANON from the event
- Writing events before required human approval
- Embedding knowledge on character deltas
- Copying a hash from conversation memory instead of hashing file bytes
- Emitting a scene event without `provenance.manuscript` / `manuscript_hash` / `scene_card`

## Related

- Templates: `.ai/templates/state-event.template.json`
- Schemas: `.ai/schemas/story-event.schema.json`
- Rules: `.ai/rules/artifacts/state-events.md`
- Rules: `.ai/rules/canon/canon-authority.md`
- Protocol: `.ai/protocols/continuity/continuity-repair.md`
