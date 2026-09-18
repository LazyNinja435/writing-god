# Extract Scene Events

## Purpose

Derive a story-state event from an **approved** scene (or proposed deltas during review).

## When to Use

- After scene approval (persist event)
- During write-scene review (proposed deltas only — do not write yet)

## Required Inputs

- Scene prose (draft or approved)
- Scene card
- Next free `event_id` / recorded `sequence` for the book (audit order; unique)

## Workflow

1. Identify state changes: location, relationships, knowledge, threads, inventory, world
2. Put knowledge only under `changes.knowledge.<id>.*`
3. Build event JSON per schema (`event_id` like `evt-000001`, `event_type: scene`, mandatory unique recorded `sequence`)
4. For corrections: `supersedes` exactly one prior `event_id`; recorded sequence must exceed the superseded event's sequence; use full replacement deltas
5. Do **not** include `canon_facts` — emit separate canon proposals if needed
6. Validate against schema
7. Write only after approval gate: `state/events/evt-NNNNNN-scene-NNNN-approved.json`

## Output

Immutable event file + optional canon proposal stubs under `canon/proposals/`

## Forbidden

- Mutating existing events
- Using `scene_id` as `event_id`
- Establishing permanent CANON from the event
- Writing events before required human approval
- Embedding knowledge on character deltas

## Related

- Templates: `.ai/templates/state-event.template.json`
- Schemas: `.ai/schemas/story-event.schema.json`
- Rules: `.ai/rules/artifacts/state-events.md`
- Rules: `.ai/rules/canon/canon-authority.md`
