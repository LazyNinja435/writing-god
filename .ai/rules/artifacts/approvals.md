# Approvals

Durable human approval records live in `books/<book>/approvals/`.

## Required fields

See `.ai/schemas/approval.schema.json`:

- `approval_id` (`apr-NNNNNN`)
- `artifact` (book-relative path)
- `artifact_hash` (`sha256:` + hex)
- `artifact_type`, `decision`, `approved_at`, `approved_by` (`human`)
- optional `revision`, `notes`

## Semantics

- Approval binds to the **content hash**. If the artifact bytes change, the approval is **stale**.
- Required when the matching `book.yaml` → `human_approval.*` key is true.
- Nothing canonical may persist before a required approval: no promote to `manuscript/scenes/`, no state event, no fold of new narrative outcomes.
- Drafts may stage under `manuscript/drafts/` and reviews may be written while awaiting approval.

## Verification

Skill: `.ai/skills/orchestration/verify-approval/SKILL.md`
