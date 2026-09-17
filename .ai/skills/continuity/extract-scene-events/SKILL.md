# Extract Scene Events

## Purpose

Derive story-state event from approved scene.

## When to Use

- Scene approved after review
- End of write-scene protocol

## Required Inputs

- Approved scene prose
- Scene card

## Workflow

1. Identify state changes: location, knowledge, threads
2. Build event JSON per schema
3. Validate against schema
4. Write to state/events/

## Output

Immutable state/events/<scene-id>.json

## Forbidden

- Mutating existing events
- Inferring canon not supported by scene

## Related

- Templates: state-event.template.json
- Schemas: story-event.schema.json
