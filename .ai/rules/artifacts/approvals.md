# Approvals

Durable human approval records live in `books/<book>/approvals/`.

## Required fields

See `.ai/schemas/approval.schema.json`:

- `approval_id` (`apr-NNNNNN`)
- `artifact_type`
- `source_artifact` (book-relative path whose bytes were hashed — usually a draft)
- `artifact_hash` (`sha256:` + hex of **source** bytes at approval time)
- `decision`, `approved_at`, `approved_by` (`human`)
- optional `promotion_target`, `revision`, `notes`

## Source vs promotion target

| Field | Role |
|-------|------|
| `source_artifact` | Artifact presented for approval; hash binding target |
| `promotion_target` | Optional post-approval destination (e.g. `manuscript/scenes/…`) |

For non-promoted artifacts: omit `promotion_target`, or set it equal to `source_artifact`.

## Lifecycle

1. Hash draft (`source_artifact`)
2. Human approves → write approval record bound to that hash
3. Verify source still matches hash
4. Promote bytes to `promotion_target` (identical content)
5. Verify target hash equals approved hash
6. Only then emit narrative state event / fold

### Validation semantics

- **Approved:** `source_artifact` must exist and match `artifact_hash`
- **Approved but waiting:** `promotion_target` set and file missing → OK (promotion not completed)
- **Promotion completed:** `promotion_target` exists → its hash must equal `artifact_hash`
- If source bytes change after approval → approval is **stale**

## Semantics

- Approval binds to the **content hash of the source**. If source bytes change, the approval is **stale**.
- Required when the matching `book.yaml` → `human_approval.*` key is true.
- Nothing canonical may persist before a required approval: no promote to `manuscript/scenes/`, no state event, no fold of new narrative outcomes.
- Drafts may stage under `manuscript/drafts/` and reviews may be written while awaiting approval.

## Verification

Skill: `.ai/skills/orchestration/verify-approval/SKILL.md`

Book-relative paths in approvals must stay inside the book workspace (`scripts/lib/book-paths.ts`). Scene event provenance cross-checks approvals when `human_approval.scenes` is true (`scripts/lib/provenance-validation.ts`).
