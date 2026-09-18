# Human Approval Config

`book.yaml` → `human_approval` maps artifact classes to booleans.

## Common keys

| Key | Typical use |
|-----|-------------|
| `premise` | Gate premise persistence |
| `story_bible` | Gate bible persistence |
| `macro_outline` | Gate macro outline |
| `act_outline` | Gate act outlines |
| `chapters` | Gate chapter promotion |
| `scenes` | Gate scene promote + state event |
| `canon_retcon` | Gate explicit canon retcons |

## Unknown keys

Additional keys are allowed (`additionalProperties: true` on the schema). Harnesses **must preserve** unknown keys and **must not** silently treat an unrecognized key as `false` when a workflow depends on it — ask the human when unsure.

## Enforcement

See `.ai/rules/artifacts/approvals.md` and `authoring/write-scene` protocol ordering.
