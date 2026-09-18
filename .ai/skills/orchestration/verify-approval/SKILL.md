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
- Artifact path (book-relative)
- Expected `artifact_type`
- Current artifact bytes

## Workflow

1. Compute `sha256:` hex of artifact bytes
2. Find matching `approvals/*.json` with `decision: approved` and same `artifact`
3. Compare stored `artifact_hash` to current hash
4. If missing or mismatched → stop; present artifact for human approval; write new approval record when confirmed
5. If match → allow promote / event emit / fold

## Output

Pass/fail with approval_id or stale/missing reason

## Forbidden

- Treating reviews as approvals
- Persisting canonical artifacts when approval is required but stale/missing

## Related

- Rules: `.ai/rules/artifacts/approvals.md`
- Schemas: `.ai/schemas/approval.schema.json`
- Templates: `.ai/templates/approval.template.json`
