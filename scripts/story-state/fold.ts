/**
 * fold.ts — deterministic fold of event-sourced story state.
 *
 * Sources (committed):
 *   books/<book>/state/events/<scene-id>.json  — immutable narrative events
 *
 * Derived (gitignored, regenerate):
 *   books/<book>/state/derived/current-*.json
 *
 * Usage:
 *   npx tsx scripts/story-state/fold.ts books/<book>
 *   npx tsx scripts/story-state/fold.ts books/<book> --check
 *
 * Pattern adapted from AstrAI scripts/memory/fold.ts (MIT License).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoryEvent {
  schema_version: string;
  event_id: string;
  scene_id: string;
  sequence?: number;
  status: "canon" | "retconned";
  story_time?: Record<string, unknown>;
  changes: EventChanges;
}

export interface EventChanges {
  characters?: Record<string, CharacterDelta>;
  threads?: Record<string, ThreadDelta>;
  knowledge?: Record<string, KnowledgeDelta>;
  world?: Record<string, unknown>;
  inventory?: Record<string, InventoryDelta>;
  timeline?: TimelineEntry[];
  canon_facts?: CanonFact[];
}

export interface CharacterDelta {
  location?: string;
  condition?: string;
  injuries_added?: string[];
  injuries_removed?: string[];
  relationships?: Record<string, string>;
  status?: string;
  knowledge_added?: string[];
}

export interface ThreadDelta {
  state?: string;
  note?: string;
}

export interface KnowledgeDelta {
  knows_added?: string[];
  knows_removed?: string[];
  believes_added?: string[];
  suspects_added?: string[];
  does_not_know_added?: string[];
}

export interface InventoryDelta {
  gained?: string[];
  lost?: string[];
}

export interface TimelineEntry {
  event_id?: string;
  scene_id?: string;
  label?: string;
  story_time?: Record<string, unknown>;
}

export interface CanonFact {
  id?: string;
  fact?: string;
  status?: string;
}

export interface CharacterState {
  location?: string;
  condition?: string;
  injuries: string[];
  relationships: Record<string, string>;
  status?: string;
}

export interface KnowledgeState {
  knows: string[];
  believes: string[];
  suspects: string[];
  does_not_know: string[];
}

export interface ThreadState {
  state: string;
  note?: string;
  last_scene?: string;
}

export interface DerivedState {
  generated_at: string;
  event_count: number;
  last_event_id: string | null;
  characters: Record<string, CharacterState>;
  knowledge: Record<string, KnowledgeState>;
  threads: Record<string, ThreadState>;
  world: Record<string, unknown>;
  inventory: Record<string, string[]>;
  timeline: TimelineEntry[];
  canon_facts: CanonFact[];
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function loadEvents(eventsDir: string, errors: string[]): StoryEvent[] {
  if (!fs.existsSync(eventsDir)) return [];
  const events: StoryEvent[] = [];
  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith(".json")).sort();

  for (const file of files) {
    const filePath = path.join(eventsDir, file);
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as StoryEvent;
      validateEvent(raw, errors);
      events.push(raw);
    } catch (err) {
      errors.push(`Malformed event ${filePath}: ${(err as Error).message}`);
    }
  }
  return events;
}

export function validateEvent(event: StoryEvent, errors: string[]): void {
  if (!event.schema_version) errors.push(`Event ${event.event_id}: missing schema_version`);
  if (!event.event_id) errors.push("Event missing event_id");
  if (!event.scene_id) errors.push(`Event ${event.event_id}: missing scene_id`);
  if (!event.changes) errors.push(`Event ${event.event_id}: missing changes`);
  if (event.status !== "canon" && event.status !== "retconned") {
    errors.push(`Event ${event.event_id}: invalid status`);
  }
}

export function sortEvents(events: StoryEvent[]): StoryEvent[] {
  return [...events].sort((a, b) => {
    const seqA = a.sequence ?? Number.MAX_SAFE_INTEGER;
    const seqB = b.sequence ?? Number.MAX_SAFE_INTEGER;
    if (seqA !== seqB) return seqA - seqB;
    return a.event_id.localeCompare(b.event_id);
  });
}

export function checkDuplicateIds(events: StoryEvent[], errors: string[]): void {
  const seen = new Set<string>();
  for (const e of events) {
    if (seen.has(e.event_id)) {
      errors.push(`Duplicate event_id: ${e.event_id}`);
    }
    seen.add(e.event_id);
  }
}

// ---------------------------------------------------------------------------
// Fold
// ---------------------------------------------------------------------------

function emptyKnowledge(): KnowledgeState {
  return { knows: [], believes: [], suspects: [], does_not_know: [] };
}

function emptyCharacter(): CharacterState {
  return { injuries: [], relationships: {} };
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr)];
}

function addItems(target: string[], added?: string[], removed?: string[]): string[] {
  let result = [...target];
  if (added) result = uniq([...result, ...added]);
  if (removed) result = result.filter((x) => !removed.includes(x));
  return result;
}

/** Pure fold: ordered events → derived state. */
export function foldEvents(events: StoryEvent[], generatedAt: string): DerivedState {
  const state: DerivedState = {
    generated_at: generatedAt,
    event_count: 0,
    last_event_id: null,
    characters: {},
    knowledge: {},
    threads: {},
    world: {},
    inventory: {},
    timeline: [],
    canon_facts: [],
  };

  const sorted = sortEvents(events.filter((e) => e.status === "canon"));

  for (const event of sorted) {
    state.event_count += 1;
    state.last_event_id = event.event_id;
    const { changes } = event;

    // Characters
    for (const [id, delta] of Object.entries(changes.characters ?? {})) {
      const cur = state.characters[id] ?? emptyCharacter();
      if (delta.location) cur.location = delta.location;
      if (delta.condition) cur.condition = delta.condition;
      if (delta.status) cur.status = delta.status;
      if (delta.injuries_added) cur.injuries = addItems(cur.injuries, delta.injuries_added);
      if (delta.injuries_removed) cur.injuries = addItems(cur.injuries, undefined, delta.injuries_removed);
      if (delta.relationships) cur.relationships = { ...cur.relationships, ...delta.relationships };
      if (delta.knowledge_added) {
        const k = state.knowledge[id] ?? emptyKnowledge();
        k.knows = addItems(k.knows, delta.knowledge_added);
        state.knowledge[id] = k;
      }
      state.characters[id] = cur;
    }

    // Knowledge
    for (const [id, delta] of Object.entries(changes.knowledge ?? {})) {
      const k = state.knowledge[id] ?? emptyKnowledge();
      k.knows = addItems(k.knows, delta.knows_added, delta.knows_removed);
      k.believes = addItems(k.believes, delta.believes_added);
      k.suspects = addItems(k.suspects, delta.suspects_added);
      k.does_not_know = addItems(k.does_not_know, delta.does_not_know_added);
      state.knowledge[id] = k;
    }

    // Threads
    for (const [id, delta] of Object.entries(changes.threads ?? {})) {
      const cur = state.threads[id] ?? { state: "introduced" };
      if (delta.state) cur.state = delta.state;
      if (delta.note) cur.note = delta.note;
      cur.last_scene = event.scene_id;
      state.threads[id] = cur;
    }

    // World
    if (changes.world) {
      state.world = { ...state.world, ...changes.world };
    }

    // Inventory
    for (const [id, delta] of Object.entries(changes.inventory ?? {})) {
      const cur = state.inventory[id] ?? [];
      let items = [...cur];
      if (delta.gained) items = uniq([...items, ...delta.gained]);
      if (delta.lost) items = items.filter((x) => !delta.lost!.includes(x));
      state.inventory[id] = items;
    }

    // Timeline
    if (changes.timeline?.length) {
      state.timeline.push(...changes.timeline);
    } else {
      state.timeline.push({
        event_id: event.event_id,
        scene_id: event.scene_id,
        story_time: event.story_time,
      });
    }

    // Canon facts
    if (changes.canon_facts?.length) {
      state.canon_facts.push(...changes.canon_facts);
    }
  }

  return state;
}

// ---------------------------------------------------------------------------
// IO
// ---------------------------------------------------------------------------

export interface FoldPaths {
  bookDir: string;
  eventsDir: string;
  derivedDir: string;
}

export function defaultPaths(bookPath: string): FoldPaths {
  const bookDir = path.resolve(bookPath);
  return {
    bookDir,
    eventsDir: path.join(bookDir, "state", "events"),
    derivedDir: path.join(bookDir, "state", "derived"),
  };
}

export function writeDerived(derived: DerivedState, derivedDir: string): void {
  fs.mkdirSync(derivedDir, { recursive: true });
  const writes: Record<string, unknown> = {
    "current-characters.json": derived.characters,
    "current-knowledge.json": derived.knowledge,
    "current-timeline.json": derived.timeline,
    "current-threads.json": derived.threads,
    "current-world.json": derived.world,
    "current-inventory.json": derived.inventory,
    "_manifest.json": {
      generated_at: derived.generated_at,
      event_count: derived.event_count,
      last_event_id: derived.last_event_id,
    },
  };
  for (const [file, data] of Object.entries(writes)) {
    fs.writeFileSync(
      path.join(derivedDir, file),
      JSON.stringify(data, null, 2) + "\n",
      "utf8",
    );
  }
}

export interface FoldResult {
  derived: DerivedState;
  errors: string[];
  eventsLoaded: number;
}

export function runFold(paths: FoldPaths, now: Date): FoldResult {
  const errors: string[] = [];
  const events = loadEvents(paths.eventsDir, errors);
  checkDuplicateIds(events, errors);
  const derived = foldEvents(events, now.toISOString());
  writeDerived(derived, paths.derivedDir);
  return { derived, errors, eventsLoaded: events.length };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const bookArg = argv.find((a) => !a.startsWith("--"));
  if (!bookArg) {
    console.error("Usage: npx tsx scripts/story-state/fold.ts books/<book> [--check]");
    process.exit(2);
  }

  const paths = defaultPaths(bookArg);
  const checkOnly = argv.includes("--check");
  const result = runFold(paths, new Date());

  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`ERROR ${e}`);
    if (checkOnly || result.errors.some((e) => e.startsWith("Duplicate") || e.startsWith("Malformed"))) {
      process.exit(1);
    }
  }

  if (checkOnly) {
    console.log(`fold --check: OK — ${result.eventsLoaded} event(s), derived state valid.`);
    return;
  }

  console.log(
    `fold: ${result.eventsLoaded} event(s) -> ${paths.derivedDir}`,
  );
  console.log(`characters: ${Object.keys(result.derived.characters).length}`);
  console.log(`threads: ${Object.keys(result.derived.threads).length}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  main();
}
