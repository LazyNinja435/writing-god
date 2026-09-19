# Continuity Repair Protocol

## Flow

1. Ingest review findings or detected contradiction
2. Classify: draft error vs planning error vs canon conflict vs **extraction error**
3. Draft / prose error → revise-scene (then Case B correction if an event already exists)
4. Planning error → scene-planner/story-architect
5. Canon conflict → canon-update protocol (never silent fix)
6. Extraction error (prose correct; state deltas wrong) → Case A correction
7. Re-run continuity checks after repair

## Correction provenance (must not bypass approval)

Only `event_type: correction` may set `supersedes`. Corrections that ultimately replace a **scene** root must carry manuscript provenance and obey the same approval rules as scene events.

### Case A — Extraction fix (prose unchanged)

Wrong deltas were extracted from an already-approved manuscript.

1. Keep the same promoted manuscript bytes
2. Reuse the same `provenance.manuscript`, `manuscript_hash`, and `approval_id` (when scenes approval is required)
3. Emit a correction with full replacement `changes` and `supersedes: [prior_event_id]`
4. Record in `reason` that this is an extraction correction reusing approved prose

### Case B — Manuscript revision

Prose itself must change.

1. Stage a new draft under `manuscript/drafts/`
2. Review → human approval (when required) → promote identical bytes to `manuscript/scenes/`
3. Hash the **new** promoted file bytes
4. Emit a correction whose provenance points at the new manuscript / hash / approval
5. `scene_id` must match the scene-root being replaced; manuscript basename must belong to that scene

### Validation

- Scene-root corrections without valid provenance fail validate
- Missing / rejected / mismatched approval fails when `human_approval.scenes: true`
- Hash mismatch or manuscript path escape fails hard
