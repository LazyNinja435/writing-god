# Character Knowledge

Characters act only on information they:

- Directly experienced
- Were told (on-page or established off-page)
- Reasonably inferred from known facts
- Otherwise hold in derived `current-knowledge.json`

## Storage

Knowledge is stored only under `knowledge.<character-id>.*` in events, initial state, and derived state:

- `knows`
- `believes`
- `suspects`
- `does_not_know`

Do **not** embed knowledge fields on character deltas.

## Invariants (enforced after fold)

- If a fact is in `knows`, it is removed from `does_not_know`, `believes`, and `suspects`.
- Promoting a belief/suspicion to knowledge uses `knows_added` (and optionally `believes_removed` / `suspects_removed`).
- `does_not_know` clears the same fact from `believes` / `suspects`.

## Review Requirements

Continuity review must check dialogue, narration, decisions, and reactions against POV/participant knowledge.

Flag **knowledge leakage** when characters demonstrate facts they have not acquired.
