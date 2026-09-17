# Build Story State

## Purpose

Regenerate derived state from events.

## When to Use

- After new event committed
- Before context load

## Required Inputs

- Event files in order

## Workflow

1. Run scripts/story-state/fold.ts
2. Verify derived JSON
3. Use --check in CI

## Output

state/derived/*.json

## Forbidden

- Hand-editing derived state
- Reordering events

## Related

- Scripts: scripts/story-state/fold.ts
