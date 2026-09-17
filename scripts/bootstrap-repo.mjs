#!/usr/bin/env node
/**
 * Bootstrap script — generates the ai-author-orchestration repository structure.
 * Run once: node scripts/bootstrap-repo.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function write(rel, content) {
  const full = join(ROOT, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content.endsWith("\n") ? content : content + "\n", "utf8");
}

function skill(category, name, body) {
  write(`.ai/skills/${category}/${name}/SKILL.md`, body);
}

function agent(category, name, body) {
  write(`.ai/agents/${category}/${name}.md`, body);
}

function rule(category, name, body) {
  write(`.ai/rules/${category}/${name}.md`, body);
}

function protocol(category, name, body) {
  write(`.ai/protocols/${category}/${name}.md`, body);
}

function genrePack(genre, files) {
  for (const [name, content] of Object.entries(files)) {
    write(`.ai/genres/${genre}/${name}.md`, content);
  }
}

// --- Skills helper ---
function makeSkill(name, purpose, whenToUse, inputs, workflow, output, forbidden, related) {
  return `# ${name}

## Purpose

${purpose}

## When to Use

${whenToUse.map((w) => `- ${w}`).join("\n")}

## Required Inputs

${inputs.map((i) => `- ${i}`).join("\n")}

## Workflow

${workflow.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Output

${output}

## Forbidden

${forbidden.map((f) => `- ${f}`).join("\n")}

## Related

${related.map((r) => `- ${r}`).join("\n")}
`;
}

const SKILLS = {
  orchestration: [
    ["initialize-book", "Create a new book workspace from a concept.", ["User requests a new book or novel project", "Starting from scratch with a story concept"], ["Story concept or brief", "Optional genre/audience preferences"], ["Resolve book slug and check books/ for conflicts", "Copy book template structure", "Create book.yaml from template", "Initialize canon/planning/state directories", "Record initial configuration"], "New book directory under books/<slug>/ with book.yaml and folder structure", ["Skipping human approval gates configured in book.yaml", "Creating canon facts without canon workflow"], ["Rules: project/active-book-resolution.md", "Protocols: orchestration/initialize-book.md", "Templates: book.template.yaml"]],
    ["resolve-active-book", "Determine which book the current task targets.", ["Task references a book ambiguously", "Multiple books exist in books/", "Harness needs active book context"], ["User request", "Optional explicit book slug or path"], ["List books/ directories", "Check user request for explicit book reference", "Check environment variable BOOK_SLUG if present", "Default to sole book if only one exists", "Ask user if ambiguous"], "Resolved book slug and path to books/<slug>/", ["Guessing among multiple books without confirmation", "Mixing artifacts from different books"], ["Rules: project/active-book-resolution.md", "Skills: orchestration/load-book-context/SKILL.md"]],
    ["load-book-context", "Selectively load book context for a specific task.", ["Before scene writing, review, or continuity check", "Context window is limited"], ["Resolved book slug", "Task type (scene-write, review, etc.)", "Relevant entity IDs (characters, locations, threads)"], ["Read book.yaml for configuration", "Apply context-selection rules for task type", "Load scene card if scene task", "Load POV character canon and knowledge state", "Load participating characters, location, world rules", "Load active threads and previous scene summary only", "Do not load full manuscript by default"], "Focused context bundle: paths and summaries of loaded artifacts", ["Loading entire manuscript for routine scene work", "Loading all canon files unconditionally"], ["Rules: project/context-loading.md", "Protocols: authoring/write-scene.md"]],
    ["select-authoring-workflow", "Choose the appropriate protocol for an authoring task.", ["User asks to write, outline, plan, or review", "Task spans multiple authoring phases"], ["User request", "Book status from book.yaml"], ["Classify request: concept, bible, outline, scene, chapter, review", "Map to protocol in protocols dispatcher", "Check book.yaml approval gates", "Return recommended protocol and prerequisites"], "Selected protocol path and prerequisite checklist", ["Jumping to prose without approved scene cards", "Skipping required review protocols"], ["Protocols: protocols.md", "Skills: orchestration/resolve-active-book/SKILL.md"]],
    ["prepare-agent-brief", "Package focused inputs for a specialist agent role.", ["Delegating to continuity-editor, prose-writer, etc.", "Multi-agent review panel"], ["Target agent definition", "Task scope", "Context bundle from load-book-context"], ["Load agent Allowed/Not Allowed boundaries", "Attach only inputs the agent expects", "Include output format requirements", "State explicit constraints from rules"], "Agent brief document or structured handoff", ["Including unrelated context", "Omitting authority boundaries"], ["Templates: agent-delegation.template.md", "Agents: orchestration/orchestrator.md"]],
    ["synthesize-agent-findings", "Merge and deduplicate outputs from multiple reviewers.", ["Multi-agent review completed", "Parallel continuity and developmental reviews"], ["Review artifacts from each agent", "Review template schema"], ["Collect findings by severity and category", "Deduplicate overlapping issues", "Identify conflicts between reviewers", "Produce unified summary and recommended action"], "Synthesized review report per review.template.yaml", ["Letting one reviewer override another without noting conflict", "Rewriting prose during synthesis"], ["Protocols: review/manuscript-review.md", "Skills: editorial/manuscript-review/SKILL.md"]],
  ],
  story: [
    ["create-premise", "Articulate the core story premise.", ["New book initialization", "Premise is missing or rejected"], ["Story concept", "Genre configuration", "Target audience"], ["Extract central conflict", "Define protagonist situation", "State stakes", "Write premise.md using template", "Flag for human approval if configured"], "books/<book>/canon/premise.md (status PROPOSED until approved)", ["Locking premise as CANON without approval", "Over-specifying plot beats in premise"], ["Templates: premise.template.md", "Protocols: authoring/concept-to-bible.md"]],
    ["define-themes", "Identify and document thematic through-lines.", ["Story bible creation", "Developmental review flags weak theme"], ["Premise", "Character arcs", "Genre pack guidance"], ["List primary and secondary themes", "Link themes to character arcs and plot", "Write themes.md"], "books/<book>/canon/themes.md", ["Declaring themes that contradict approved premise"], ["Templates: premise.template.md", "Skills: story/create-story-bible/SKILL.md"]],
    ["create-story-bible", "Compile foundational story reference.", ["After premise approval", "Before macro outlining"], ["Approved premise", "Initial characters and world notes"], ["Gather premise, themes, narrative-style", "Index character and world canon paths", "Document POV and tense from book.yaml", "Create bible index in canon/"], "Story bible index linking canon artifacts", ["Writing full manuscript in bible phase", "Establishing plot outcomes not yet in planning"], ["Protocols: authoring/concept-to-bible.md", "Agents: story-architect.md"]],
    ["outline-novel", "Create macro story architecture.", ["Bible approved", "Moving from concept to structure"], ["Story bible", "Genre packs", "book.yaml structure model"], ["Define acts and major turning points", "Map main plot and subplots", "Document in planning/architecture.md", "Create thread stubs"], "planning/architecture.md and thread files", ["Writing scene prose", "Resolving every thread in outline phase"], ["Templates: story-architecture.template.md", "Agents: story-architect.md"]],
    ["outline-act", "Detail structure within one act.", ["Act-level planning", "After macro outline approved"], ["architecture.md", "Act number", "Active threads"], ["Define act goal and climax", "List chapters with purpose", "Note setup/payoff items"], "planning/acts/act-<n>.md", ["Changing approved macro structure silently"], ["Skills: story/outline-chapter/SKILL.md"]],
    ["outline-chapter", "Plan chapter beats without prose.", ["Chapter-level planning"], ["Act outline", "Chapter number", "Thread states"], ["List scenes or beat sequence", "Assign POV if known", "Note chapter purpose and end hook"], "planning/chapters/chapter-<n>.md", ["Writing final prose in outline step"], ["Skills: prose/plan-scene/SKILL.md"]],
    ["track-setup-payoff", "Register and monitor setup/payoff pairs.", ["Planting foreshadowing", "Before act review"], ["Scene or outline with setup elements", "Existing setup-payoff registry"], ["Record setup ID, location, intended payoff", "Link to threads", "Update setup-payoff registry"], "planning/setup-payoff/<id>.md", ["Paying off without recorded setup", "Orphan setups with no plan"], ["Templates: setup-payoff.template.md"]],
    ["track-story-threads", "Create or update a plot thread.", ["New subplot or mystery introduced", "Thread state changes"], ["Thread description", "Related characters", "Initial state"], ["Assign thread ID", "Set state: introduced/active/etc.", "Link scenes that touch thread"], "planning/threads/<thread-id>.md", ["Resolving threads without explicit event", "Duplicate thread IDs"], ["Templates: story-thread.template.md", "Rules: canon/timeline-consistency.md"]],
  ],
  character: [
    ["create-character", "Define a new character in canon.", ["New character needed for plot", "Bible phase"], ["Role in story", "Relationships", "Arc needs"], ["Write character file from template", "Set status PROPOSED", "Link to relationships"], "canon/characters/<slug>.md", ["Establishing CANON status without workflow", "Contradicting existing character canon"], ["Templates: character.template.md", "Agents: character-architect.md"]],
    ["design-character-arc", "Plan character transformation arc.", ["Architecture or bible phase"], ["Character canon", "Theme links", "Plot role"], ["Define want, need, flaw, ghost", "Map arc beats across acts", "Write arc document"], "planning or canon/characters/<slug>-arc.md", ["Arc that requires unapproved plot changes"], ["Agents: character-architect.md"]],
    ["update-relationship-state", "Record relationship changes.", ["After scene with relationship shift", "Canon update workflow"], ["Characters involved", "Nature of change", "Scene reference"], ["Update relationship notes in character files or state event", "Propose canon if permanent"], "Updated relationship documentation or event delta", ["Silent relationship retcons"], ["Rules: canon/no-silent-retcon.md"]],
    ["validate-character-behavior", "Check actions against character profile and knowledge.", ["Continuity review", "Before approving scene"], ["Character canon", "Knowledge state", "Proposed actions/dialogue"], ["Compare behavior to motivations and flaws", "Check knowledge boundaries", "Flag inconsistencies"], "Validation notes or review findings", ["Rewriting scene during validation"], ["Rules: canon/character-knowledge.md", "Agents: continuity-editor.md"]],
  ],
  world: [
    ["build-world", "Establish foundational world context.", ["Bible phase", "New book in speculative genre"], ["Genre packs", "Premise needs", "Story scale"], ["Document geography, institutions, constraints", "Create index in canon/world/", "Link locations and factions"], "canon/world/ index and initial world files", ["Over-building irrelevant detail", "Violating genre without book config"], ["Agents: world-architect.md", "Genres: applicable packs"]],
    ["create-location", "Define a named location.", ["Scene needs new or detailed location"], ["Location role", "Sensory and practical details"], ["Write location template", "Link factions/characters present", "Status PROPOSED until promoted"], "canon/locations/<slug>.md", ["Geography that contradicts established map"], ["Templates: location.template.md"]],
    ["create-faction", "Define a group, institution, or faction.", ["Political/social plot needs"], ["Faction goals", "Key members", "Relationships"], ["Write faction template", "Link to locations and characters"], "canon/factions/<slug>.md", ["Faction capabilities that break world rules"], ["Templates: faction.template.md"]],
    ["define-world-rule", "Document a magic/tech/social rule.", ["Speculative fiction worldbuilding"], ["Rule scope", "Limitations", "Costs"], ["Write world rule template", "Note exceptions", "Status PROPOSED"], "canon/world/<rule-slug>.md", ["Rules without limitations", "Silent changes to established rules"], ["Rules: canon/world-rule-consistency.md", "Templates: world-rule.template.md"]],
    ["validate-world-consistency", "Check scenes against world rules.", ["Continuity review", "Speculative fiction books"], ["World rules canon", "Scene events"], ["Match events to rules", "Flag violations", "Suggest fixes or canon change"], "Review findings", ["Inventing new rules to excuse violations"], ["Agents: continuity-editor.md"]],
  ],
  prose: [
    ["plan-scene", "Create executable scene card from outline.", ["Before prose writing", "Outline-to-scene-graph phase"], ["Chapter outline beat", "Thread states", "POV assignment"], ["Fill scene card template", "Define goal, conflict, turn, outcome", "List information revealed/withheld", "Set prohibited reveals"], "planning/scenes/<scene-id>.yaml", ["Leaving outcome ambiguous", "Approving reveals that violate thread plan"], ["Templates: scene-card.template.yaml", "Agents: scene-planner.md"]],
    ["write-scene", "Draft manuscript prose from approved scene card.", ["Scene card approved", "write-scene protocol active"], ["Scene card", "Context bundle", "Style guide"], ["Follow scene card outcomes strictly", "Respect POV and knowledge", "Add texture without plot changes", "Submit CHANGE_REQUEST if blocked"], "manuscript/scenes/<scene-id>.md draft", ["Changing required outcome silently", "Violating prohibited reveals"], ["Protocols: authoring/write-scene.md", "Agents: prose-writer.md"]],
    ["revise-scene", "Revise prose based on review findings.", ["Review returned revise action", "CHANGE_REQUEST approved"], ["Scene draft", "Review findings", "Scene card"], ["Address findings by severity", "Preserve approved outcomes", "Re-run continuity checks"], "Revised manuscript scene", ["Using revision to change plot without approval"], ["Protocols: review/scene-review.md"]],
    ["write-dialogue", "Craft or refine dialogue for a scene.", ["Dialogue-heavy scenes", "Dialogue review findings"], ["Character voices", "Knowledge boundaries", "Scene goals"], ["Match character speech patterns", "Subtext and conflict in lines", "Flag knowledge leakage"], "Dialogue passages or revised lines", ["Exposition dumps violating character knowledge"], ["Rules: narrative/dialogue-attribution.md"]],
    ["prose-review", "Evaluate prose quality without rewriting.", ["Scene or chapter review"], ["Manuscript section", "narrative-style.md", "book.yaml prose settings"], ["Check clarity, rhythm, voice consistency", "Note line-level issues", "Do not rewrite unless protocol allows"], "Prose review findings", ["Developmental restructuring during prose review"], ["Agents: continuity-editor.md (delegate style to skill)"]],
  ],
  continuity: [
    ["extract-scene-events", "Derive story-state event from approved scene.", ["Scene approved after review", "End of write-scene protocol"], ["Approved scene prose", "Scene card"], ["Identify state changes: location, knowledge, threads", "Build event JSON per schema", "Validate against schema", "Write to state/events/"], "Immutable state/events/<scene-id>.json", ["Mutating existing events", "Inferring canon not supported by scene"], ["Templates: state-event.template.json", "Schemas: story-event.schema.json"]],
    ["check-continuity", "Run full continuity pass on a scene.", ["write-scene review gate", "continuity-repair protocol"], ["Scene draft", "Derived state", "Canon"], ["Run timeline, knowledge, world, thread checks", "Aggregate findings"], "Review report", ["Fixing issues by silent retcon"], ["Protocols: continuity/continuity-repair.md"]],
    ["check-character-knowledge", "Verify POV and dialogue knowledge boundaries.", ["Continuity review", "Mystery/thriller books"], ["Knowledge state", "Scene draft"], ["Map each line to character knowledge", "Flag leakage"], "Knowledge findings", ["Assuming omniscient POV characters"], ["Rules: canon/character-knowledge.md"]],
    ["check-timeline", "Verify temporal consistency.", ["Continuity review", "Time-travel or tight timelines"], ["Timeline derived state", "Scene card story_time"], ["Order events", "Check durations", "Flag paradoxes"], "Timeline findings", ["Ignoring established dates"], ["Rules: canon/timeline-consistency.md"]],
    ["check-thread-consistency", "Verify thread advancement matches plan.", ["Scene review", "Act review"], ["Thread registry", "Scene card threads_advanced"], ["Match advances to thread files", "Flag accidental resolution"], "Thread findings", ["Closing threads without author intent"], ["Skills: story/track-story-threads/SKILL.md"]],
    ["build-story-state", "Regenerate derived state from events.", ["After new event committed", "Before context load"], ["Event files in order"], ["Run scripts/story-state/fold.ts", "Verify derived JSON", "Use --check in CI"], "state/derived/*.json", ["Hand-editing derived state", "Reordering events"], ["Scripts: scripts/story-state/fold.ts"]],
    ["propose-canon-change", "Formal proposal to change established canon.", ["Conflict detected", "Approved retcon needed"], ["Contradiction evidence", "Proposed resolution"], ["Document conflict", "Propose options", "Route to canon-curator", "Require human approval for major changes"], "canon proposal per template", ["Silent retcon", "Writer self-approving canon"], ["Rules: canon/no-silent-retcon.md", "Protocols: continuity/canon-update.md"]],
  ],
  editorial: [
    ["developmental-review", "Evaluate structure, pacing, and arc progression.", ["Scene/chapter/act review"], ["Manuscript section", "Architecture", "Threads"], ["Assess scene necessity and stakes", "Check arc movement", "Note structural issues"], "Developmental review findings", ["Line editing", "Rewriting scenes"], ["Agents: developmental-editor.md"]],
    ["pacing-review", "Evaluate rhythm and momentum.", ["Chapter or act review"], ["Manuscript section"], ["Identify drag and rush sections", "Check scene length balance"], "Pacing findings", ["Plot changes"], ["Skills: editorial/developmental-review/SKILL.md"]],
    ["character-arc-review", "Evaluate arc progression in section.", ["Act review"], ["Character arcs", "Manuscript"], ["Compare beats to arc plan", "Flag stalled arcs"], "Arc review findings", ["Changing arc without architect"], ["Agents: character-architect.md"]],
    ["dialogue-review", "Review dialogue effectiveness.", ["Scene review"], ["Scene dialogue", "Character profiles"], ["Check voice distinction", "Subtext", "Knowledge"], "Dialogue findings", ["Full scene rewrite"], ["Skills: prose/write-dialogue/SKILL.md"]],
    ["style-review", "Check prose style against narrative-style.md.", ["Prose review gate"], ["narrative-style.md", "Manuscript"], ["Voice, tense, POV discipline", "Filter words if configured"], "Style findings", ["Imposing genre style over book config"], ["Rules: narrative/narrative-voice.md"]],
    ["chapter-review", "Coordinate multi-domain chapter review.", ["Chapter complete"], ["All chapter scenes", "Chapter outline"], ["Run scene-level checks", "Synthesize chapter findings"], "Chapter review report", ["Skipping continuity"], ["Protocols: review/chapter-review.md"]],
    ["manuscript-review", "Full manuscript multi-agent review.", ["Draft complete", "Major revision milestone"], ["Manuscript index", "Architecture"], ["Parallel specialist reviews", "Synthesize findings"], "Manuscript review report", ["Implementing fixes during review"], ["Protocols: review/manuscript-review.md"]],
  ],
  research: [
    ["research-topic", "Gather factual research for the book.", ["Historical/scientific accuracy needed"], ["Research question", "book.yaml research rules"], ["Search reliable sources", "Distinguish fact from fiction", "Summarize findings"], "research/ notes", ["Treating research as canon", "Uncited claims as fact"], ["Rules: research/factual-research.md"]],
    ["record-research", "Document research with sources.", ["After research-topic"], ["Findings", "Sources"], ["Write research note template", "Tag uncertainty"], "research/<topic>.md", ["Mixing into canon without label"], ["Templates: research-note.template.md"]],
    ["validate-factual-claim", "Check a claim against research notes.", ["Continuity or research review"], ["Claim in manuscript", "Research notes"], ["Match or flag", "Recommend fix or footnote"], "Validation result", ["Inventing facts"], ["Rules: research/research-vs-canon.md"]],
  ],
};

for (const [cat, items] of Object.entries(SKILLS)) {
  for (const [slug, purpose, when, inputs, workflow, output, forbidden, related] of items) {
    const title = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    skill(cat, slug, makeSkill(title, purpose, when, inputs, workflow, output, forbidden, related));
  }
}

console.log("Skills created:", Object.values(SKILLS).flat().length);
