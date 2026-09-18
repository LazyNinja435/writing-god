# Rules Dispatcher

> Do not load all rule files by default. Use this dispatcher to select only rules relevant to the current task.

## How to Use

1. Identify task domain (project, canon, narrative, research, artifacts, git, safety).
2. Load only listed files for that domain.
3. Rules are **laws**, not suggestions.
4. Canon and safety rules override convenience.

---

## Project Rules (`.ai/rules/project/`)
**When:** Always for any work in this repository.

| File | Load When |
|------|-----------|
| `project/project-scope.md` | Always |
| `project/source-of-truth.md` | Always |
| `project/active-book-resolution.md` | Any book-specific task |
| `project/semantic-agents.md` | Delegating to specialist roles |
| `project/context-loading.md` | Loading book context |

## Canon Rules (`.ai/rules/canon/`)
**When:** Any task touching story truth, continuity, or state.

| File | Load When |
|------|-----------|
| `canon/no-silent-retcon.md` | Always (mandatory) |
| `canon/canon-authority.md` | Always (mandatory) |
| `canon/canon-lifecycle.md` | Creating or changing canon |
| `canon/character-knowledge.md` | Writing/reviewing scenes, dialogue |
| `canon/timeline-consistency.md` | Events, chronology, flashbacks |
| `canon/world-rule-consistency.md` | Speculative fiction, world systems |

## Narrative Rules (`.ai/rules/narrative/`)
**When:** Writing or reviewing prose.

| File | Load When |
|------|-----------|
| `narrative/pov-discipline.md` | Scene writing/review |
| `narrative/tense-consistency.md` | Prose work |
| `narrative/narrative-voice.md` | Prose/style review |
| `narrative/dialogue-attribution.md` | Dialogue |
| `narrative/exposition-constraints.md` | Exposition-heavy scenes |
| `narrative/scene-purpose.md` | Scene planning/review |

## Research Rules (`.ai/rules/research/`)
**When:** Factual research or accuracy checks.

| File | Load When |
|------|-----------|
| `research/factual-research.md` | Gathering facts |
| `research/source-notes.md` | Recording research |
| `research/research-vs-canon.md` | Distinguishing fact from fiction |
| `research/uncertainty.md` | Unverified claims |

## Artifact Rules (`.ai/rules/artifacts/`)
**When:** Creating structured outputs.

| File | Load When |
|------|-----------|
| `artifacts/artifact-basics.md` | Any generated artifact |
| `artifacts/naming-conventions.md` | New files |
| `artifacts/scene-cards.md` | Scene cards |
| `artifacts/state-events.md` | Story-state events |
| `artifacts/approvals.md` | Human approval records |
| `artifacts/human-approval-config.md` | book.yaml human_approval keys |
| `artifacts/reviews.md` | Review reports |

## Git Rules (`.ai/rules/git/`)
**When:** Version control operations.

| File | Load When |
|------|-----------|
| `git/git-basics.md` | Any git operation |
| `git/commits.md` | Committing |
| `git/destructive-actions.md` | Force push, reset, delete |

## Safety Rules (`.ai/rules/safety/`)
**When:** Always when safety concerns exist.

| File | Load When |
|------|-----------|
| `safety/safety-basics.md` | Always (mandatory) |
| `safety/content-boundaries.md` | Sensitive content per book config |

---

## Precedence

1. Safety rules
2. Canon rules (no silent retcons)
3. Project rules
4. Narrative, research, artifact rules
5. Git rules

## Forbidden

- Loading all rules "just in case"
- Ignoring canon rules for convenience
- Creating rules without updating this dispatcher
