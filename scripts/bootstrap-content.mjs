#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function w(rel, content) {
  const full = join(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, (content.endsWith("\n") ? content : content + "\n"), "utf8");
}

// --- RULES DISPATCHER ---
w(".ai/rules/rules.md", `# Rules Dispatcher

> Do not load all rule files by default. Use this dispatcher to select only rules relevant to the current task.

## How to Use

1. Identify task domain (project, canon, narrative, research, artifacts, git, safety).
2. Load only listed files for that domain.
3. Rules are **laws**, not suggestions.
4. Canon and safety rules override convenience.

---

## Project Rules (\`.ai/rules/project/\`)
**When:** Always for any work in this repository.

| File | Load When |
|------|-----------|
| \`project/project-scope.md\` | Always |
| \`project/source-of-truth.md\` | Always |
| \`project/active-book-resolution.md\` | Any book-specific task |
| \`project/semantic-agents.md\` | Delegating to specialist roles |
| \`project/context-loading.md\` | Loading book context |

## Canon Rules (\`.ai/rules/canon/\`)
**When:** Any task touching story truth, continuity, or state.

| File | Load When |
|------|-----------|
| \`canon/no-silent-retcon.md\` | Always (mandatory) |
| \`canon/canon-authority.md\` | Always (mandatory) |
| \`canon/canon-lifecycle.md\` | Creating or changing canon |
| \`canon/character-knowledge.md\` | Writing/reviewing scenes, dialogue |
| \`canon/timeline-consistency.md\` | Events, chronology, flashbacks |
| \`canon/world-rule-consistency.md\` | Speculative fiction, world systems |

## Narrative Rules (\`.ai/rules/narrative/\`)
**When:** Writing or reviewing prose.

| File | Load When |
|------|-----------|
| \`narrative/pov-discipline.md\` | Scene writing/review |
| \`narrative/tense-consistency.md\` | Prose work |
| \`narrative/narrative-voice.md\` | Prose/style review |
| \`narrative/dialogue-attribution.md\` | Dialogue |
| \`narrative/exposition-constraints.md\` | Exposition-heavy scenes |
| \`narrative/scene-purpose.md\` | Scene planning/review |

## Research Rules (\`.ai/rules/research/\`)
**When:** Factual research or accuracy checks.

| File | Load When |
|------|-----------|
| \`research/factual-research.md\` | Gathering facts |
| \`research/source-notes.md\` | Recording research |
| \`research/research-vs-canon.md\` | Distinguishing fact from fiction |
| \`research/uncertainty.md\` | Unverified claims |

## Artifact Rules (\`.ai/rules/artifacts/\`)
**When:** Creating structured outputs.

| File | Load When |
|------|-----------|
| \`artifacts/artifact-basics.md\` | Any generated artifact |
| \`artifacts/naming-conventions.md\` | New files |
| \`artifacts/scene-cards.md\` | Scene cards |
| \`artifacts/state-events.md\` | Story-state events |
| \`artifacts/reviews.md\` | Review reports |

## Git Rules (\`.ai/rules/git/\`)
**When:** Version control operations.

| File | Load When |
|------|-----------|
| \`git/git-basics.md\` | Any git operation |
| \`git/commits.md\` | Committing |
| \`git/destructive-actions.md\` | Force push, reset, delete |

## Safety Rules (\`.ai/rules/safety/\`)
**When:** Always when safety concerns exist.

| File | Load When |
|------|-----------|
| \`safety/safety-basics.md\` | Always (mandatory) |
| \`safety/content-boundaries.md\` | Sensitive content per book config |

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
`);

const rules = {
  project: {
    "project-scope.md": `# Project Scope

## In Scope

- Long-form fiction: novels, novellas, series books
- Planning, writing, reviewing, revising, maintaining manuscripts
- Canon, planning, event-sourced state, and prose artifacts per book
- Harness-agnostic orchestration via \`.ai/\`

## Out of Scope (V1)

- Web UI, LLM API integrations, vector databases
- Automated publishing/export pipelines
- Real-time collaborative editing
- Replacing human creative judgment on major plot decisions

## Book Workspace

Each book lives under \`books/<slug>/\` with separated canon, planning, state, manuscript, reviews, and research.`,
    "source-of-truth.md": `# Source of Truth

## Hierarchy

1. **\`.ai/\`** — AI operating instructions (rules, skills, protocols, agents)
2. **\`AGENTS.md\`** — Root dispatcher
3. **\`books/<book>/book.yaml\`** — Book configuration
4. **\`books/<book>/canon/\`** — Established truth (CANON status)
5. **\`books/<book>/planning/\`** — Intent (not yet happened)
6. **\`books/<book>/state/events/\`** — Immutable narrative history
7. **\`books/<book>/manuscript/\`** — Prose (may include non-canon texture)

Harness adapters are **not** source of truth. They point into \`.ai/\`.

*Adapted from AstrAI source-of-truth pattern.*`,
    "active-book-resolution.md": `# Active Book Resolution

1. List \`books/*\` directories.
2. Prefer explicit slug in user request.
3. Check \`BOOK_SLUG\` environment variable.
4. If one book exists, use it.
5. If multiple, ask the user.
6. Never mix books in one task.`,
    "semantic-agents.md": `# Semantic Agents

Agents are **role contracts**, not separate processes.

Harnesses implement agents via subagents, context switching, or sequential role adoption.

Always load agent definition before acting in that role. Respect Allowed / Not Allowed.

*Adapted from AstrAI semantic agent model.*`,
    "context-loading.md": `# Context Loading Discipline

## Default: Selective Loading

Do not load full manuscript, all canon, or all skills by default.

## Scene Writing Minimum Context

- Scene card
- POV character canon + derived knowledge
- Participant canon (abbreviated)
- Location + applicable world rules
- Active threads for this scene
- Previous scene summary
- narrative-style.md

## Scene Writing Forbidden Default

- Entire manuscript
- All thread files
- All character files
- Unrelated genre packs`,
  },
  canon: {
    "no-silent-retcon.md": `# No Silent Retcon

Established canon **cannot** change silently.

## On Conflict

1. **Stop** — do not guess or smooth over
2. **Identify** the contradiction (cite canon vs. proposed output)
3. **Propose options** (revise draft, amend plan, formal canon change)
4. **Route** through \`continuity/canon-update.md\` if canon must change

## Forbidden

- "Fixing" contradictions by rewriting canon files without workflow
- Assuming the newer draft overrides older approved canon
- Letting prose writers resolve canon conflicts unilaterally`,
    "canon-authority.md": `# Canon Authority

## Who May Establish Canon

| Role | May Propose | May Establish |
|------|-------------|---------------|
| prose-writer | Yes | No |
| story-architect | Yes | Planning only |
| canon-curator | Yes | Yes (via workflow) |
| orchestrator | Route only | No |

## Promotion Path

\`PROPOSED\` → review → \`CANON\` via canon-update protocol and configured human approval.

Writers may add **non-canon texture** (gestures, weather, incidental detail) that does not contradict canon.`,
    "character-knowledge.md": `# Character Knowledge

Characters act only on information they:

- Directly experienced
- Were told (on-page or established off-page)
- Reasonably inferred from known facts
- Otherwise hold in derived \`current-knowledge.json\`

## Review Requirements

Continuity review must check dialogue, narration, decisions, and reactions against POV/participant knowledge.

Flag **knowledge leakage** when characters demonstrate facts they have not acquired.`,
    "timeline-consistency.md": `# Timeline Consistency

Events must respect:

- Established chronological order in \`current-timeline.json\`
- Durations and travel times once established
- Flashback framing (must not contaminate present knowledge inappropriately)

Contradictions require explicit resolution — not silent adjustment.`,
    "world-rule-consistency.md": `# World Rule Consistency

Magic, technology, politics, biology, geography, and social rules in \`canon/world/\` are binding.

Violations require:

- In-story explanation (established before payoff), or
- Approved canon change, or
- Revision of the draft`,
    "canon-lifecycle.md": `# Canon Lifecycle

## Statuses

| Status | Meaning |
|--------|---------|
| PROPOSED | Suggested, not yet authoritative |
| CANON | Established truth |
| DEPRECATED | Superseded but recorded |
| RETCONNED | Explicitly replaced; history preserved |
| UNKNOWN | Deliberately unspecified |

## Canon-Worthy Facts

- Character identity, relationships, significant traits
- World rules, named locations, faction relationships
- Injuries, possessions with plot consequence
- Revealed secrets, major historical facts

## Non-Canon by Default

- Incidental sensory detail unless promoted
- Throwaway background names
- Draft-stage speculation in planning/`,
  },
  narrative: {
    "pov-discipline.md": `# POV Discipline

Follow \`book.yaml\` POV configuration.

In limited POV: no access to other characters' thoughts unless POV allows. No head-hopping within a scene without structural justification.`,
    "tense-consistency.md": `# Tense Consistency

Use tense specified in \`book.yaml\`. Maintain consistent tense within scenes except deliberate flashback framing.`,
    "narrative-voice.md": `# Narrative Voice

Follow \`canon/narrative-style.md\` and \`book.yaml\` prose settings. Genre packs provide guidance, not override.`,
    "dialogue-attribution.md": `# Dialogue Attribution

Clear speaker attribution. Match character voice profiles. Avoid exposition dumps in dialogue that violate knowledge rules.`,
    "exposition-constraints.md": `# Exposition Constraints

Prefer dramatization over explanation. POV characters may only reflect knowledge they possess. Info-dumps require architectural justification.`,
    "scene-purpose.md": `# Scene Purpose

Every scene must have a defined goal, conflict, turn, and outcome on its scene card. Scenes without purpose should be cut at planning stage.`,
  },
  research: {
    "factual-research.md": `# Factual Research

Use reliable sources. Record in \`books/<book>/research/\`. Distinguish verified fact from creative invention.`,
    "source-notes.md": `# Source Notes

Research notes must cite sources where applicable. Tag confidence level.`,
    "research-vs-canon.md": `# Research vs Canon

Research informs plausibility; it does not automatically become story canon. Fictional settings may diverge from real-world fact deliberately.`,
    "uncertainty.md": `# Uncertainty

Mark unverified claims. Do not present uncertain research as canon or as character knowledge without justification.`,
  },
  artifacts: {
    "artifact-basics.md": `# Artifact Basics

Use templates from \`.ai/templates/\`. Validate against schemas when available. Store in correct book subdirectory.`,
    "naming-conventions.md": `# Naming Conventions

- Slugs: lowercase, hyphen-separated
- Scenes: \`scene-NNNN\` (zero-padded)
- Threads: descriptive hyphenated IDs
- Characters/locations: slug matching filename`,
    "scene-cards.md": `# Scene Cards

Scene cards live in \`planning/scenes/\`. Required before prose writing in write-scene protocol. Outcomes are binding unless CHANGE_REQUEST approved.`,
    "state-events.md": `# State Events

One immutable JSON event per approved scene in \`state/events/\`. Never edit committed events. Retcons add explicit superseding events.`,
    "reviews.md": `# Reviews

Reviews use \`review.template.yaml\`. Default role is diagnose, not rewrite. Revision is a separate step.`,
  },
  git: {
    "git-basics.md": `# Git Basics

Commit only when user requests. Never force-push main. Never commit secrets.`,
    "commits.md": `# Commits

Meaningful messages. Do not commit derived state if gitignored (regenerate instead).`,
    "destructive-actions.md": `# Destructive Actions

No force push, hard reset, or history rewrite without explicit user approval.`,
  },
  safety: {
    "safety-basics.md": `# Safety Basics

Follow user content boundaries in book.yaml. Do not produce harmful content. Escalate sensitive material per user direction.`,
    "content-boundaries.md": `# Content Boundaries

Respect \`book.yaml\` content settings (violence, romance, etc.). When uncertain, ask the user.`,
  },
};

for (const [cat, files] of Object.entries(rules)) {
  for (const [name, body] of Object.entries(files)) {
    w(`.ai/rules/${cat}/${name}`, body);
  }
}

// --- AGENTS ---
function agent(body) { return body; }

const agents = {
  "orchestration/orchestrator.md": agent(`# Orchestrator

## Purpose

Route work through appropriate rules, protocols, skills, and specialist roles.

## Best Used For

- Multi-step authoring workflows
- Resolving which protocol to run
- Coordinating review gates and persistence

## Allowed Actions

- Inspect project and book state
- Select workflows and protocols
- Prepare focused context bundles
- Delegate to specialist agents
- Coordinate review synthesis
- Determine artifact persistence paths

## Not Allowed

- Write manuscript prose unless explicitly operating under prose-writer role
- Silently modify canon
- Bypass required review or approval gates
- Load entire \`.ai/\` or full manuscript by default

## Inputs Expected

- User request
- Resolved book slug
- Book status from book.yaml

## Output Format

Workflow plan, delegation briefs, completion summary with approval flags

## Related Skills

- \`.ai/skills/orchestration/select-authoring-workflow/SKILL.md\`
- \`.ai/skills/orchestration/prepare-agent-brief/SKILL.md\`
- \`.ai/skills/orchestration/synthesize-agent-findings/SKILL.md\`

## Related Protocols

- \`.ai/protocols/orchestration/initialize-book.md\`

## Related Rules

- \`.ai/rules/project/semantic-agents.md\`
- \`.ai/rules/project/context-loading.md\``),

  "orchestration/canon-curator.md": agent(`# Canon Curator

## Purpose

Control promotion, amendment, deprecation, or explicit retconning of canonical facts.

## Best Used For

- Canon proposals and conflicts
- Retcon evaluation
- Canon status transitions

## Allowed Actions

- Evaluate canon proposals
- Detect contradictions
- Accept or reject proposed facts
- Create canon change records
- Update canon through approved workflows

## Not Allowed

- Invent plot changes merely to resolve convenience
- Silently rewrite existing canon
- Override human approval gates

## Inputs Expected

- Canon proposal or conflict report
- Evidence citations
- book.yaml approval settings

## Output Format

Canon decision record per \`canon-change.template.md\`

## Related Skills

- \`.ai/skills/continuity/propose-canon-change/SKILL.md\`

## Related Protocols

- \`.ai/protocols/continuity/canon-update.md\`

## Related Rules

- \`.ai/rules/canon/no-silent-retcon.md\`
- \`.ai/rules/canon/canon-authority.md\`
- \`.ai/rules/canon/canon-lifecycle.md\``),

  "architecture/story-architect.md": agent(`# Story Architect

## Purpose

Own premise, theme, macro structure, acts, plot architecture, subplot architecture, and setup/payoff planning.

## Best Used For

- Story architecture and outlining
- Thread and setup/payoff design
- Evaluating CHANGE_REQUESTs affecting plot

## Allowed Actions

- Create and revise planning/architecture artifacts
- Define acts, chapters, major beats
- Manage thread registry at architectural level
- Approve or reject plot-level change requests

## Not Allowed

- Write final manuscript prose by default
- Establish CANON without canon workflow
- Override approved premise without user approval

## Inputs Expected

- Story bible, premise, themes
- Genre packs, book.yaml structure settings

## Output Format

Architecture docs, act/chapter outlines, thread definitions

## Related Skills

- \`.ai/skills/story/outline-novel/SKILL.md\`
- \`.ai/skills/story/track-story-threads/SKILL.md\`

## Related Protocols

- \`.ai/protocols/authoring/bible-to-outline.md\`

## Related Rules

- \`.ai/rules/canon/canon-authority.md\``),

  "architecture/character-architect.md": agent(`# Character Architect

## Purpose

Own character goals, motivations, flaws, relationships, internal conflicts, arcs, and character-specific continuity.

## Best Used For

- Character creation and arc design
- Relationship dynamics
- Character behavior validation at architectural level

## Allowed Actions

- Create and update character canon (PROPOSED)
- Design character arcs
- Define relationship states
- Review character consistency

## Not Allowed

- Write scene prose by default
- Promote canon to CANON without workflow
- Change plot architecture unilaterally

## Inputs Expected

- Premise, themes, architecture
- Existing character canon

## Output Format

Character files, arc documents, relationship notes

## Related Skills

- \`.ai/skills/character/create-character/SKILL.md\`
- \`.ai/skills/character/design-character-arc/SKILL.md\`

## Related Protocols

- \`.ai/protocols/authoring/concept-to-bible.md\`

## Related Rules

- \`.ai/rules/canon/character-knowledge.md\``),

  "architecture/world-architect.md": agent(`# World Architect

## Purpose

Own locations, institutions, factions, culture, geography, systems, technology/magic rules, and world constraints.

## Best Used For

- Worldbuilding for speculative and grounded fiction
- World rule definition
- Location and faction design

## Allowed Actions

- Create world, location, faction artifacts
- Define world rules (PROPOSED)
- Validate world consistency at planning stage

## Not Allowed

- Write manuscript prose by default
- Violate book.yaml genre without justification
- Establish CANON without workflow

## Inputs Expected

- Premise, genre packs, story scale

## Output Format

World canon files, location/faction/rule documents

## Related Skills

- \`.ai/skills/world/build-world/SKILL.md\`
- \`.ai/skills/world/define-world-rule/SKILL.md\`

## Related Protocols

- \`.ai/protocols/authoring/concept-to-bible.md\`

## Related Rules

- \`.ai/rules/canon/world-rule-consistency.md\``),

  "writing/scene-planner.md": agent(`# Scene Planner

## Purpose

Turn approved plot architecture into executable scene cards.

## Best Used For

- Scene card creation
- Translating chapter outlines to scenes

## Allowed Actions

- Create scene cards from outlines
- Specify goals, conflicts, outcomes, knowledge boundaries
- Link threads and setup/payoff items

## Not Allowed

- Write final prose
- Change macro plot without architect approval
- Omit required outcomes or prohibited reveals

## Inputs Expected

- Chapter outline, thread states, character availability

## Output Format

\`planning/scenes/<scene-id>.yaml\` per template

## Related Skills

- \`.ai/skills/prose/plan-scene/SKILL.md\`

## Related Protocols

- \`.ai/protocols/authoring/outline-to-scene-graph.md\`

## Related Rules

- \`.ai/rules/artifacts/scene-cards.md\`
- \`.ai/rules/narrative/scene-purpose.md\``),

  "writing/prose-writer.md": agent(`# Prose Writer

## Purpose

Write manuscript prose from approved scene cards and loaded context.

## Best Used For

- Drafting scene prose
- Adding texture within scene card constraints

## Allowed Actions

- Write prose matching scene card outcomes
- Add sensory detail, gesture, incidental dialogue
- Submit CHANGE_REQUEST when blocked

## Not Allowed

- Alter required scene outcomes silently
- Violate prohibited reveals
- Change macro plot or canon
- Establish permanent canon from incidental detail

## Inputs Expected

- Approved scene card
- Context bundle from load-book-context
- narrative-style.md

## Output Format

\`manuscript/scenes/<scene-id>.md\`

## Related Skills

- \`.ai/skills/prose/write-scene/SKILL.md\`
- \`.ai/skills/prose/write-dialogue/SKILL.md\`

## Related Protocols

- \`.ai/protocols/authoring/write-scene.md\`

## Related Rules

- \`.ai/rules/canon/character-knowledge.md\`
- \`.ai/rules/narrative/pov-discipline.md\``),

  "editorial/continuity-editor.md": agent(`# Continuity Editor

## Purpose

Check factual contradictions, timeline, knowledge leakage, character state, inventory, geography, world rules, and thread handling.

## Best Used For

- Scene and chapter continuity review
- Pre-approval verification in write-scene protocol

## Allowed Actions

- Diagnose continuity issues
- Cite evidence from canon and derived state
- Recommend revise, canon change, or planning fix

## Not Allowed

- Rewrite scenes unless protocol explicitly requests revision
- Silently fix canon
- Resolve threads without flagging

## Inputs Expected

- Scene draft, scene card, derived state, relevant canon

## Output Format

Review per \`review.template.yaml\` with continuity category findings

## Related Skills

- \`.ai/skills/continuity/check-continuity/SKILL.md\`
- \`.ai/skills/continuity/check-character-knowledge/SKILL.md\`

## Related Protocols

- \`.ai/protocols/review/scene-review.md\`
- \`.ai/protocols/continuity/continuity-repair.md\`

## Related Rules

- \`.ai/rules/canon/no-silent-retcon.md\`
- \`.ai/rules/canon/character-knowledge.md\``),

  "editorial/developmental-editor.md": agent(`# Developmental Editor

## Purpose

Check pacing, stakes, structure, scene necessity, emotional movement, arc progression, setup/payoff, and subplot balance.

## Best Used For

- Scene, chapter, act, and manuscript developmental review

## Allowed Actions

- Diagnose structural and emotional issues
- Evaluate scene necessity
- Recommend cuts, additions, or reordering at planning level

## Not Allowed

- Line-level copy editing as primary role
- Rewrite prose unless protocol allows
- Change approved architecture without escalation

## Inputs Expected

- Manuscript section, architecture, threads, character arcs

## Output Format

Review per \`review.template.yaml\` with developmental findings

## Related Skills

- \`.ai/skills/editorial/developmental-review/SKILL.md\`

## Related Protocols

- \`.ai/protocols/review/scene-review.md\`
- \`.ai/protocols/review/manuscript-review.md\`

## Related Rules

- \`.ai/rules/narrative/scene-purpose.md\``),
};

for (const [path, body] of Object.entries(agents)) {
  w(`.ai/agents/${path}`, body);
}

console.log("Rules and agents created");
