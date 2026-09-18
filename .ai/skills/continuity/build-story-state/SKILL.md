# Build Story State

## Purpose

Regenerate derived state from initial state + immutable events.

## When to Use

- After new event committed
- Before context load when derived may be stale

## Required Inputs

- Optional `state/initial.json`
- Event files in `state/events/`

## Workflow

1. Run `npm run fold -- <book-path>` to write derived state
2. Use `npm run fold:check -- <book-path>` in CI / verification (read-only; must not write)
3. Verify derived JSON and `_manifest.json` `source_hash`

## Output

`state/derived/*.json` (write mode only)

## Forbidden

- Hand-editing derived state
- Mutating event files
- Running fold:check as a write path

## Related

- Scripts: `scripts/story-state/fold.ts`
- Rules: `.ai/rules/artifacts/state-events.md`
