#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
function w(rel, content) {
  const full = join(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content.endsWith("\n") ? content : content + "\n", "utf8");
}

w(".ai/protocols/protocols.md", `# Protocol Dispatcher

> Do not load all protocols by default. Protocols orchestrate rules, skills, agents, templates, approval gates, and persistence.

## Orchestration (\`.ai/protocols/orchestration/\`)

| File | When |
|------|------|
| \`initialize-book.md\` | New book from concept |

## Authoring (\`.ai/protocols/authoring/\`)

| File | When |
|------|------|
| \`concept-to-bible.md\` | Premise → story bible |
| \`bible-to-outline.md\` | Bible → macro outline |
| \`outline-to-scene-graph.md\` | Outline → scene cards |
| \`write-scene.md\` | Execute one scene end-to-end |
| \`write-chapter.md\` | Coordinate multiple scenes |

## Continuity (\`.ai/protocols/continuity/\`)

| File | When |
|------|------|
| \`canon-update.md\` | Promote or change canon |
| \`continuity-repair.md\` | Resolve detected contradictions |

## Review (\`.ai/protocols/review/\`)

| File | When |
|------|------|
| \`scene-review.md\` | After scene draft |
| \`chapter-review.md\` | Chapter complete |
| \`act-review.md\` | Act milestone |
| \`manuscript-review.md\` | Full draft review |

## Publishing (\`.ai/protocols/publishing/\`) — V1 lightweight

| File | When |
|------|------|
| \`developmental-pass.md\` | Structural revision phase |
| \`structural-revision.md\` | Major restructuring |
| \`line-edit.md\` | Line-level polish |
| \`copy-edit.md\` | Grammar/consistency |
| \`final-manuscript-verification.md\` | Pre-submission check |

## Forbidden

- Duplicating skill workflows in protocols — reference skills by path
- Skipping review gates defined in write-scene
- Loading all protocols for simple tasks
`);

const protocols = {
  orchestration: {
    "initialize-book.md": `# Initialize Book Protocol

## Trigger
User requests a new novel/novella or provides a fresh concept.

## Flow
1. **Collect** concept, genre preferences, audience
2. **Skill:** \`orchestration/initialize-book\` — create workspace
3. **Skill:** \`orchestration/resolve-active-book\`
4. **Configure** \`book.yaml\` from template
5. **Load** genre packs per book.yaml
6. **Skill:** \`story/create-premise\`
7. **Gate:** human approval if \`human_approval.premise\`
8. **Skill:** \`story/define-themes\`
9. **Skill:** \`story/create-story-bible\`
10. **Gate:** human approval if \`human_approval.story_bible\`

## Agents
- orchestrator (coordinate)
- story-architect, character-architect, world-architect (as needed)

## Outputs
- \`books/<slug>/\` workspace
- premise, themes, initial bible structure`,
  },
  authoring: {
    "concept-to-bible.md": `# Concept to Bible Protocol

## Flow
1. Resolve book → read book.yaml
2. Load genre packs
3. **Skills:** create-premise, define-themes (if not done)
4. **Agent:** character-architect → create-character (as needed)
5. **Agent:** world-architect → build-world, create-location, define-world-rule
6. Write narrative-style.md
7. **Skill:** create-story-bible
8. Human approval gate per book.yaml

## Rules
- canon/canon-authority.md
- research/research-vs-canon.md`,
    "bible-to-outline.md": `# Bible to Outline Protocol

## Flow
1. Verify bible approval status
2. **Agent:** story-architect
3. **Skills:** outline-novel, track-story-threads, track-setup-payoff
4. **Agent:** character-architect → design-character-arc
5. **Skills:** outline-act (per act)
6. Human approval for macro outline if configured

## Outputs
- planning/architecture.md
- planning/threads/
- planning/setup-payoff/`,
    "outline-to-scene-graph.md": `# Outline to Scene Graph Protocol

## Flow
1. Verify macro outline approved
2. **Skills:** outline-chapter (per chapter)
3. **Agent:** scene-planner
4. **Skill:** plan-scene for each scene beat
5. Link threads and setup/payoff on scene cards
6. No prose in this protocol

## Outputs
- planning/chapters/
- planning/scenes/*.yaml`,
    "write-scene.md": `# Write Scene Protocol

## Flow
1. Resolve book
2. Load scene card from planning/scenes/
3. **Skill:** load-book-context (scene-write mode)
4. Load applicable canon, derived state, genre guidance
5. **Agent:** prose-writer → write-scene skill
6. **Skill:** extract-scene-events (draft deltas)
7. **Agent:** continuity-editor → check-continuity, check-character-knowledge, check-timeline, check-thread-consistency
8. **Agent:** developmental-editor → developmental-review
9. **Skill:** prose-review (if configured)
10. Revise if FAIL or major findings → revise-scene skill
11. Final verification against scene card outcomes
12. Save approved scene to manuscript/scenes/
13. **Skill:** extract-scene-events → write immutable event
14. **Skill:** build-story-state → npm run fold
15. Human approval if configured for scenes

## Change Requests
If prose-writer blocked: CHANGE_REQUEST → story-architect/orchestrator

## Rules
- canon/no-silent-retcon.md
- artifacts/state-events.md`,
    "write-chapter.md": `# Write Chapter Protocol

## Flow
1. Load chapter outline
2. List scene cards for chapter in sequence
3. Run write-scene protocol per scene
4. **Skill:** chapter-review between scenes optional
5. After all scenes: **Protocol:** review/chapter-review.md
6. Update chapter summary (derived navigation aid)

## Forbidden
- Single unconstrained prompt for entire chapter prose`,
  },
  continuity: {
    "canon-update.md": `# Canon Update Protocol

## Flow
1. Receive canon proposal (propose-canon-change skill)
2. **Agent:** canon-curator evaluates
3. Detect contradictions with existing CANON
4. Document decision in canon-change record
5. Human approval for major retcons
6. Update canon file status
7. If retcon: mark old fact RETCONNED, add explicit event if narrative

## Rules
- canon/no-silent-retcon.md
- canon/canon-lifecycle.md`,
    "continuity-repair.md": `# Continuity Repair Protocol

## Flow
1. Ingest review findings or detected contradiction
2. Classify: draft error vs planning error vs canon conflict
3. Draft error → revise-scene
4. Planning error → scene-planner/story-architect
5. Canon conflict → canon-update protocol (never silent fix)
6. Re-run continuity checks after repair`,
  },
  review: {
    "scene-review.md": `# Scene Review Protocol

## Panel (sequential or parallel per harness)
1. continuity-editor → continuity skills
2. developmental-editor → developmental-review
3. prose-review skill (style/voice)
4. Genre-specific checks from loaded packs

## Synthesis
**Skill:** synthesize-agent-findings

## Output
reviews/ per review.template.yaml — default action: diagnose, not rewrite`,
    "chapter-review.md": `# Chapter Review Protocol

## Flow
1. Load all chapter scenes
2. Run scene-review per scene (or sampled if harness-limited)
3. **Skills:** pacing-review, character-arc-review
4. Synthesize chapter-level findings`,
    "act-review.md": `# Act Review Protocol

## Flow
1. Load act outline and all chapters in act
2. developmental-editor + story-architect consultation
3. Thread and setup/payoff audit
4. Act summary for navigation`,
    "manuscript-review.md": `# Manuscript Review Protocol

## Panel
- continuity-editor
- character-architect (behavior)
- story-architect (plot intent)
- developmental-editor
- prose-review / style-review
- Genre-specific concern from packs

## Execution
Parallel where harness supports; otherwise sequential role adoption.

## Synthesis
synthesize-agent-findings → manuscript review report`,
  },
  publishing: {
    "developmental-pass.md": `# Developmental Pass (V1 Placeholder)

Structural revision after full draft. Run manuscript-review first. Address architectural findings before line work.`,
    "structural-revision.md": `# Structural Revision (V1 Placeholder)

Reorder, cut, or add scenes at planning level. Update scene graph before prose changes.`,
    "line-edit.md": `# Line Edit (V1 Placeholder)

Sentence-level clarity and rhythm. Does not change plot outcomes.`,
    "copy-edit.md": `# Copy Edit (V1 Placeholder)

Grammar, spelling, consistency of names and terms.`,
    "final-manuscript-verification.md": `# Final Manuscript Verification (V1 Placeholder)

Check all threads resolved or intentionally open, canon consistent, book.yaml targets met.`,
  },
};

for (const [cat, files] of Object.entries(protocols)) {
  for (const [name, body] of Object.entries(files)) {
    w(`.ai/protocols/${cat}/${name}`, body);
  }
}

// GENRES
w(".ai/genres/genres.md", `# Genre Dispatcher

> Load only genre packs listed in \`books/<book>/book.yaml\`. Genre packs are composable guidance — not separate frameworks.

## How to Use

1. Read \`genre.primary\` — load that pack's files
2. Read each \`genre.secondary\` entry — load those packs' files
3. Do not load unrelated packs

## Available Packs

| Genre | Path | Key Files |
|-------|------|-----------|
| fantasy | \`.ai/genres/fantasy/\` | worldbuilding.md, magic-systems.md, genre-expectations.md |
| science-fiction | \`.ai/genres/science-fiction/\` | worldbuilding.md, technology-systems.md, genre-expectations.md |
| mystery | \`.ai/genres/mystery/\` | clue-management.md, fair-play.md, reveal-structure.md, red-herrings.md |
| thriller | \`.ai/genres/thriller/\` | pacing-tension.md, stakes-escalation.md, genre-expectations.md |
| romance | \`.ai/genres/romance/\` | relationship-arc.md, emotional-beats.md, relationship-continuity.md |
| horror | \`.ai/genres/horror/\` | tension.md, reveal-control.md, fear-escalation.md |
| literary | \`.ai/genres/literary/\` | character-interiority.md, thematic-density.md, genre-expectations.md |

## Precedence

Book configuration (\`book.yaml\`, \`narrative-style.md\`) overrides genre guidance unless a genre file marks a constraint as **hard**.
`);

const genrePacks = {
  fantasy: {
    "worldbuilding.md": "Depth of history, geography, and culture should serve plot. Magic costs and limits must stay consistent (see world-rule-consistency).",
    "magic-systems.md": "Define rules, costs, limits, and what magic cannot do. Avoid spontaneous new abilities without setup.",
    "genre-expectations.md": "Often includes quest structure, wonder, and systemic magic. Adjust per book.yaml tone.",
  },
  "science-fiction": {
    "worldbuilding.md": "Technology and society should follow internal logic. One big lie is acceptable if consistent.",
    "technology-systems.md": "Document capabilities, limits, and failure modes. No technobabble resolutions without setup.",
    "genre-expectations.md": "Sense of wonder, consequence of technology, often extrapolation from present tensions.",
  },
  mystery: {
    "clue-management.md": "Track clues in threads/setup-payoff. Fair-play: reader could deduce solution from presented evidence.",
    "fair-play.md": "No hidden evidence only revealed in denouement. Detective/POV knowledge must align with clue access.",
    "reveal-structure.md": "Plant misdirection early; revelation should reframe prior scenes.",
    "red-herrings.md": "Red herrings must be plausible and fairly presented; resolve or acknowledge them.",
  },
  thriller: {
    "pacing-tension.md": "Escalate stakes and shorten decision cycles. Cut exposition that defuses urgency.",
    "stakes-escalation.md": "Each act raises personal or global cost of failure.",
    "genre-expectations.md": "Clock pressure, antagonist pressure, protagonist agency under constraint.",
  },
  romance: {
    "relationship-arc.md": "Central relationship must evolve through obstacles aligned with character flaws.",
    "emotional-beats.md": "Meet, attraction, conflict, crisis, resolution — adapt to subgenre and heat level in book.yaml.",
    "relationship-continuity.md": "Track relationship state in derived state; dialogue intimacy must match established bond.",
  },
  horror: {
    "tension.md": "Dread through anticipation; control information release.",
    "reveal-control.md": "Delay full monster/truth; partial reveals reframe safety assumptions.",
    "fear-escalation.md": "Progress from unease to violation; avoid fatigue via variation.",
  },
  literary: {
    "character-interiority.md": "Interior life and subtext carry weight; scene purpose may be thematic as well as plot.",
    "thematic-density.md": "Images and motifs echo themes; avoid on-the-nose statement unless intentional.",
    "genre-expectations.md": "Language and structure may be unconventional; still obey canon and POV rules.",
  },
};

for (const [genre, files] of Object.entries(genrePacks)) {
  for (const [name, body] of Object.entries(files)) {
    w(`.ai/genres/${genre}/${name}.md`, `# ${name.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}\n\n${body}\n`);
  }
}

console.log("Protocols and genres created");
