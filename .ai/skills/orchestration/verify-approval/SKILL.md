# Verify Approval

## Purpose

Confirm a durable, non-stale human approval exists before canonical persistence.

## When to Use

- Before promoting drafts to approved manuscript paths
- Before writing state events
- Before fold of newly approved narrative outcomes
- When `book.yaml` human_approval requires a gate

## Required Inputs

- Book path
- `source_artifact` path (book-relative; usually a draft)
- Optional `promotion_target`
- Expected `artifact_type`
- Current source artifact bytes

## Workflow

1. Compute `sha256:` hex of **source** artifact bytes
2. Find matching `approvals/*.json` with `decision: approved` and same `source_artifact`
3. Compare stored `artifact_hash` to current source hash
4. If missing or mismatched → stop; present artifact for human approval; write new approval record when confirmed (`source_artifact`, optional `promotion_target`)
5. If match and promotion applies:
   - Copy identical bytes to `promotion_target`
   - Verify target hash equals `artifact_hash`
6. Only then allow event emit / fold

## Output

Pass/fail with approval_id or stale/missing/promotion-mismatch reason

## Forbidden

- Treating reviews as approvals
- Persisting canonical artifacts when approval is required but stale/missing
- Emitting narrative events before promotion target hash verification (when promotion applies)

## Related

- Rules: `.ai/rules/artifacts/approvals.md`
- Schemas: `.ai/schemas/approval.schema.json`
- Templates: `.ai/templates/approval.template.json`
