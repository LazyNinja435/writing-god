# Canon Update Protocol

## Flow

1. Receive canon proposal (`propose-canon-change` skill) — typically sourced from an approved scene
2. **Agent:** canon-curator evaluates
3. Detect contradictions with existing CANON
4. Document decision in canon-change record
5. Human approval for major retcons / when `human_approval.canon_retcon`
6. Update canon file status (`PROPOSED` → `CANON`, or explicit `RETCONNED`/`DEPRECATED`)
7. Optionally emit a `canon-change` narrative event if story history must reflect the change — never mutate old events; use a correction with `supersedes: [one_id]` when replacing prior narrative deltas (chains OK; no branching)

## Separation

- State events = narrative history
- Canon files = permanent established truth
- Scene approval alone does not establish CANON

## Rules

- `.ai/rules/canon/no-silent-retcon.md`
- `.ai/rules/canon/canon-authority.md`
- `.ai/rules/canon/canon-lifecycle.md`
- `.ai/rules/artifacts/approvals.md`
