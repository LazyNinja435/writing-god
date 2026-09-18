/**
 * fold.ts — deterministic fold of event-sourced story state.
 *
 * Sources (committed):
 *   books/<book>/state/initial.json            — optional bootstrap state
 *   books/<book>/state/events/*.json           — immutable narrative events
 *
 * Derived (regenerate; do not hand-edit):
 *   books/<book>/state/derived/current-*.json
 *
 * Usage:
 *   npx tsx scripts/story-state/fold.ts <book-path>
 *   npx tsx scripts/story-state/fold.ts <book-path> --check   # read-only
 *
 * Pattern adapted from AstrAI scripts/memory/fold.ts (MIT License).
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventType = "scene" | "correction" | "canon-change" | "bootstrap";

export interface StoryEvent {
  schema_version: string;
  event_id: string;
  event_type: EventType;
  scene_id?: string;
  sequence: number;
  supersedes?: string[];
  reason?: string;
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
}

export interface CharacterDelta {
  location?: string;
  condition?: string;
  injuries_added?: string[];
  injuries_removed?: string[];
  relationships?: Record<string, string>;
  status?: string;
}

export interface ThreadDelta {
  state?: string;
  note?: string;
}

export interface KnowledgeDelta {
  knows_added?: string[];
  knows_removed?: string[];
  believes_added?: string[];
  believes_removed?: string[];
  suspects_added?: string[];
  suspects_removed?: string[];
  does_not_know_added?: string[];
  does_not_know_removed?: string[];
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
  last_event?: string;
}

export interface InitialState {
  schema_version: string;
  characters?: Record<string, Partial<CharacterState>>;
  knowledge?: Record<string, Partial<KnowledgeState>>;
  threads?: Record<string, Partial<ThreadState>>;
  world?: Record<string, unknown>;
  inventory?: Record<string, string[]>;
  timeline?: TimelineEntry[];
}

export interface DerivedState {
  source_hash: string;
  event_count: number;
  active_event_count: number;
  last_event_id: string | null;
  active_event_ids: string[];
  superseded_event_ids: string[];
  characters: Record<string, CharacterState>;
  knowledge: Record<string, KnowledgeState>;
  threads: Record<string, ThreadState>;
  world: Record<string, unknown>;
  inventory: Record<string, string[]>;
  timeline: TimelineEntry[];
}

export interface LoadEventsResult {
  validEvents: StoryEvent[];
  errors: string[];
  fileHashes: Record<string, string>;
}

export interface FoldPaths {
  bookDir: string;
  eventsDir: string;
  derivedDir: string;
  initialPath: string;
}

export interface FoldResult {
  ok: boolean;
  derived: DerivedState | null;
  errors: string[];
  eventsLoaded: number;
  eventsValid: number;
  wrote: boolean;
}

const EVENT_TYPES: EventType[] = ["scene", "correction", "canon-change", "bootstrap"];

// ---------------------------------------------------------------------------
// Loading & validation
// ---------------------------------------------------------------------------

export function defaultPaths(bookPath: string): FoldPaths {
  const bookDir = path.resolve(bookPath);
  return {
    bookDir,
    eventsDir: path.join(bookDir, "state", "events"),
    derivedDir: path.join(bookDir, "state", "derived"),
    initialPath: path.join(bookDir, "state", "initial.json"),
  };
}

export function sha256Hex(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

export function loadEvents(eventsDir: string): LoadEventsResult {
  const errors: string[] = [];
  const validEvents: StoryEvent[] = [];
  const fileHashes: Record<string, string> = {};

  if (!fs.existsSync(eventsDir)) {
    return { validEvents, errors, fileHashes };
  }

  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith(".json")).sort();

  for (const file of files) {
    const filePath = path.join(eventsDir, file);
    let rawText: string;
    try {
      rawText = fs.readFileSync(filePath, "utf8");
    } catch (err) {
      errors.push(`Unreadable event ${filePath}: ${(err as Error).message}`);
      continue;
    }

    fileHashes[file] = sha256Hex(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      errors.push(`Malformed event ${filePath}: ${(err as Error).message}`);
      continue;
    }

    const eventErrors: string[] = [];
    if (!isPlainObject(parsed)) {
      errors.push(`Malformed event ${filePath}: root must be an object`);
      continue;
    }

    validateEvent(parsed as StoryEvent, eventErrors, file);
    if (eventErrors.length > 0) {
      for (const e of eventErrors) errors.push(e);
      continue;
    }

    validEvents.push(parsed as StoryEvent);
  }

  return { validEvents, errors, fileHashes };
}

export function validateEvent(
  event: StoryEvent,
  errors: string[],
  sourceLabel = "event",
): void {
  if (!isPlainObject(event)) {
    errors.push(`${sourceLabel}: root must be an object`);
    return;
  }

  const id = typeof event.event_id === "string" && event.event_id ? event.event_id : sourceLabel;

  if (!event.schema_version || typeof event.schema_version !== "string") {
    errors.push(`Event ${id}: missing schema_version`);
  }
  if (!event.event_id || typeof event.event_id !== "string") {
    errors.push(`${sourceLabel}: missing event_id`);
  } else if (!/^evt-\d{6,}$/.test(event.event_id)) {
    errors.push(`Event ${id}: event_id must match evt-NNNNNN`);
  }
  if (!event.event_type || !EVENT_TYPES.includes(event.event_type)) {
    errors.push(`Event ${id}: event_type must be one of ${EVENT_TYPES.join(", ")}`);
  }
  if (typeof event.sequence !== "number" || !Number.isInteger(event.sequence) || event.sequence < 1) {
    errors.push(`Event ${id}: sequence must be a positive integer`);
  }
  if (!isPlainObject(event.changes)) {
    errors.push(`Event ${id}: missing changes object`);
  } else if ("canon_facts" in (event.changes as Record<string, unknown>)) {
    errors.push(
      `Event ${id}: canon_facts are not allowed on state events; use canon proposals instead`,
    );
  }

  if (event.event_type === "scene" && (!event.scene_id || typeof event.scene_id !== "string")) {
    errors.push(`Event ${id}: scene events require scene_id`);
  }

  if (event.event_type === "correction") {
    if (!Array.isArray(event.supersedes) || event.supersedes.length === 0) {
      errors.push(`Event ${id}: correction events require non-empty supersedes[]`);
    }
    if (!event.reason || typeof event.reason !== "string") {
      errors.push(`Event ${id}: correction events require reason`);
    }
  }

  if (event.supersedes !== undefined) {
    if (!Array.isArray(event.supersedes)) {
      errors.push(`Event ${id}: supersedes must be an array`);
    } else {
      for (const target of event.supersedes) {
        if (typeof target !== "string" || !target) {
          errors.push(`Event ${id}: supersedes entries must be non-empty strings`);
        }
        if (target === event.event_id) {
          errors.push(`Event ${id}: cannot supersede itself`);
        }
      }
    }
  }

  // Reject character-embedded knowledge (must live under changes.knowledge)
  const characters = event.changes?.characters;
  if (characters && isPlainObject(characters)) {
    for (const [cid, delta] of Object.entries(characters)) {
      if (!isPlainObject(delta)) continue;
      if ("knowledge_added" in delta || "knowledge_removed" in delta) {
        errors.push(
          `Event ${id}: character ${cid} must not carry knowledge_* fields; use changes.knowledge`,
        );
      }
    }
  }
}

export function loadInitialState(
  initialPath: string,
  errors: string[],
): { state: InitialState | null; hash: string | null } {
  if (!fs.existsSync(initialPath)) {
    return { state: null, hash: null };
  }

  let raw: string;
  try {
    raw = fs.readFileSync(initialPath, "utf8");
  } catch (err) {
    errors.push(`Unreadable initial state ${initialPath}: ${(err as Error).message}`);
    return { state: null, hash: null };
  }

  const hash = sha256Hex(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    errors.push(`Malformed initial state ${initialPath}: ${(err as Error).message}`);
    return { state: null, hash: null };
  }

  if (!isPlainObject(parsed)) {
    errors.push(`Initial state ${initialPath}: root must be an object`);
    return { state: null, hash: null };
  }

  const initial = parsed as InitialState;
  if (!initial.schema_version || typeof initial.schema_version !== "string") {
    errors.push(`Initial state ${initialPath}: missing schema_version`);
    return { state: null, hash: null };
  }

  return { state: initial, hash };
}

export function sortEvents(events: StoryEvent[]): StoryEvent[] {
  return [...events].sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    // Diagnostic tiebreaker only — duplicate sequences are rejected separately
    return a.event_id.localeCompare(b.event_id);
  });
}

export function checkSequenceUniqueness(events: StoryEvent[], errors: string[]): void {
  const seen = new Map<number, string>();
  for (const e of events) {
    if (seen.has(e.sequence)) {
      errors.push(
        `Duplicate sequence ${e.sequence}: ${seen.get(e.sequence)} and ${e.event_id}`,
      );
    } else {
      seen.set(e.sequence, e.event_id);
    }
  }
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

/**
 * Build supersession relationships. Returns active event IDs and errors for
 * missing targets / cycles. Self-supersession is caught in validateEvent.
 */
export function resolveSupersession(
  events: StoryEvent[],
  errors: string[],
): { activeIds: Set<string>; supersededIds: Set<string> } {
  const byId = new Map(events.map((e) => [e.event_id, e]));
  const supersededIds = new Set<string>();

  for (const event of events) {
    for (const target of event.supersedes ?? []) {
      if (!byId.has(target)) {
        errors.push(`Event ${event.event_id}: supersedes unknown event ${target}`);
        continue;
      }
      supersededIds.add(target);
    }
  }

  // Cycle detection on supersedes graph (A supersedes B supersedes A)
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string, stack: string[]): void {
    if (visiting.has(id)) {
      errors.push(`Supersession cycle detected: ${[...stack, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const event = byId.get(id);
    for (const target of event?.supersedes ?? []) {
      if (byId.has(target)) visit(target, [...stack, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const e of events) {
    visit(e.event_id, []);
  }

  const activeIds = new Set(
    events.filter((e) => !supersededIds.has(e.event_id)).map((e) => e.event_id),
  );

  return { activeIds, supersededIds };
}

// ---------------------------------------------------------------------------
// Fold
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emptyKnowledge(): KnowledgeState {
  return { knows: [], believes: [], suspects: [], does_not_know: [] };
}

function emptyCharacter(): CharacterState {
  return { injuries: [], relationships: {} };
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr)].sort();
}

function addItems(target: string[], added?: string[], removed?: string[]): string[] {
  let result = [...target];
  if (added) result = uniq([...result, ...added]);
  if (removed) result = result.filter((x) => !removed.includes(x));
  return result;
}

function deepMergeWorld(
  base: Record<string, unknown>,
  delta: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(delta)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMergeWorld(out[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function sortedObjectKeys<T>(obj: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = obj[key];
  }
  return out;
}

function sortedRelationships(rels: Record<string, string>): Record<string, string> {
  return sortedObjectKeys(rels);
}

/** Enforce knowledge invariants: knows wins over does_not_know; knows clears believes/suspects. */
export function enforceKnowledgeInvariants(k: KnowledgeState): KnowledgeState {
  const knows = uniq(k.knows);
  const knowsSet = new Set(knows);

  // knows removes from does_not_know, believes, suspects
  let does_not_know = uniq(k.does_not_know).filter((f) => !knowsSet.has(f));
  let believes = uniq(k.believes).filter((f) => !knowsSet.has(f));
  let suspects = uniq(k.suspects).filter((f) => !knowsSet.has(f));

  // does_not_know removes from believes/suspects for the same fact
  const dnkSet = new Set(does_not_know);
  believes = believes.filter((f) => !dnkSet.has(f));
  suspects = suspects.filter((f) => !dnkSet.has(f));

  return { knows, believes, suspects, does_not_know };
}

function applyInitial(state: DerivedState, initial: InitialState): void {
  for (const [id, delta] of Object.entries(initial.characters ?? {})) {
    const cur = emptyCharacter();
    if (delta.location) cur.location = delta.location;
    if (delta.condition) cur.condition = delta.condition;
    if (delta.status) cur.status = delta.status;
    if (delta.injuries) cur.injuries = uniq(delta.injuries);
    if (delta.relationships) cur.relationships = sortedRelationships({ ...delta.relationships });
    state.characters[id] = cur;
  }

  for (const [id, delta] of Object.entries(initial.knowledge ?? {})) {
    state.knowledge[id] = enforceKnowledgeInvariants({
      knows: delta.knows ?? [],
      believes: delta.believes ?? [],
      suspects: delta.suspects ?? [],
      does_not_know: delta.does_not_know ?? [],
    });
  }

  for (const [id, delta] of Object.entries(initial.threads ?? {})) {
    state.threads[id] = {
      state: delta.state ?? "introduced",
      note: delta.note,
      last_scene: delta.last_scene,
      last_event: delta.last_event,
    };
  }

  if (initial.world) state.world = deepMergeWorld({}, initial.world);

  for (const [id, items] of Object.entries(initial.inventory ?? {})) {
    state.inventory[id] = uniq(items);
  }

  if (initial.timeline?.length) {
    state.timeline.push(...initial.timeline);
  }
}

function applyEvent(state: DerivedState, event: StoryEvent): void {
  state.event_count += 1;
  state.last_event_id = event.event_id;
  const { changes } = event;

  for (const [id, delta] of Object.entries(changes.characters ?? {})) {
    const cur = state.characters[id] ?? emptyCharacter();
    if (delta.location !== undefined) cur.location = delta.location;
    if (delta.condition !== undefined) cur.condition = delta.condition;
    if (delta.status !== undefined) cur.status = delta.status;
    if (delta.injuries_added) cur.injuries = addItems(cur.injuries, delta.injuries_added);
    if (delta.injuries_removed) cur.injuries = addItems(cur.injuries, undefined, delta.injuries_removed);
    if (delta.relationships) {
      cur.relationships = sortedRelationships({ ...cur.relationships, ...delta.relationships });
    }
    state.characters[id] = cur;
  }

  for (const [id, delta] of Object.entries(changes.knowledge ?? {})) {
    const k = state.knowledge[id] ?? emptyKnowledge();
    k.knows = addItems(k.knows, delta.knows_added, delta.knows_removed);
    k.believes = addItems(k.believes, delta.believes_added, delta.believes_removed);
    k.suspects = addItems(k.suspects, delta.suspects_added, delta.suspects_removed);
    k.does_not_know = addItems(
      k.does_not_know,
      delta.does_not_know_added,
      delta.does_not_know_removed,
    );
    state.knowledge[id] = enforceKnowledgeInvariants(k);
  }

  for (const [id, delta] of Object.entries(changes.threads ?? {})) {
    const cur = state.threads[id] ?? { state: "introduced" };
    if (delta.state) cur.state = delta.state;
    if (delta.note) cur.note = delta.note;
    if (event.scene_id) cur.last_scene = event.scene_id;
    cur.last_event = event.event_id;
    state.threads[id] = cur;
  }

  if (changes.world) {
    state.world = deepMergeWorld(state.world, changes.world as Record<string, unknown>);
  }

  for (const [id, delta] of Object.entries(changes.inventory ?? {})) {
    const cur = state.inventory[id] ?? [];
    let items = [...cur];
    if (delta.gained) items = uniq([...items, ...delta.gained]);
    if (delta.lost) items = items.filter((x) => !delta.lost!.includes(x));
    state.inventory[id] = uniq(items);
  }

  if (changes.timeline?.length) {
    state.timeline.push(...changes.timeline);
  } else if (event.event_type === "scene" || event.event_type === "correction") {
    state.timeline.push({
      event_id: event.event_id,
      scene_id: event.scene_id,
      story_time: event.story_time,
    });
  }
}

/** Pure fold: initial + ordered active events → derived state. */
export function foldEvents(
  events: StoryEvent[],
  options: {
    initial?: InitialState | null;
    activeIds?: Set<string>;
    sourceHash: string;
  },
): DerivedState {
  const state: DerivedState = {
    source_hash: options.sourceHash,
    event_count: 0,
    active_event_count: 0,
    last_event_id: null,
    active_event_ids: [],
    superseded_event_ids: [],
    characters: {},
    knowledge: {},
    threads: {},
    world: {},
    inventory: {},
    timeline: [],
  };

  if (options.initial) {
    applyInitial(state, options.initial);
  }

  const activeIds = options.activeIds ?? new Set(events.map((e) => e.event_id));
  const sorted = sortEvents(events.filter((e) => activeIds.has(e.event_id)));

  state.active_event_ids = sorted.map((e) => e.event_id);
  state.superseded_event_ids = events
    .filter((e) => !activeIds.has(e.event_id))
    .map((e) => e.event_id)
    .sort();
  state.active_event_count = sorted.length;

  for (const event of sorted) {
    applyEvent(state, event);
  }

  // Deterministic key ordering for output stability
  state.characters = sortedObjectKeys(state.characters);
  state.knowledge = sortedObjectKeys(state.knowledge);
  state.threads = sortedObjectKeys(state.threads);
  state.world = sortedObjectKeys(state.world as Record<string, unknown>);
  state.inventory = sortedObjectKeys(state.inventory);

  return state;
}

// ---------------------------------------------------------------------------
// IO
// ---------------------------------------------------------------------------

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
      source_hash: derived.source_hash,
      event_count: derived.event_count,
      active_event_count: derived.active_event_count,
      last_event_id: derived.last_event_id,
      active_event_ids: derived.active_event_ids,
      superseded_event_ids: derived.superseded_event_ids,
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

export function computeSourceHash(
  initialHash: string | null,
  fileHashes: Record<string, string>,
): string {
  const parts = [`initial:${initialHash ?? "none"}`];
  for (const file of Object.keys(fileHashes).sort()) {
    parts.push(`${file}:${fileHashes[file]}`);
  }
  return sha256Hex(parts.join("|"));
}

/**
 * Load → validate → compute → optionally write.
 * Writes only when result.ok && !checkOnly.
 */
export function runFold(
  paths: FoldPaths,
  options: { checkOnly?: boolean } = {},
): FoldResult {
  const errors: string[] = [];
  const checkOnly = options.checkOnly === true;

  const { state: initial, hash: initialHash } = loadInitialState(paths.initialPath, errors);
  const loaded = loadEvents(paths.eventsDir);
  errors.push(...loaded.errors);

  // Structural/relationship validation only on valid events
  checkDuplicateIds(loaded.validEvents, errors);
  checkSequenceUniqueness(loaded.validEvents, errors);
  const { activeIds, supersededIds } = resolveSupersession(loaded.validEvents, errors);

  const hasBlockingErrors = errors.length > 0;
  if (hasBlockingErrors) {
    return {
      ok: false,
      derived: null,
      errors,
      eventsLoaded: loaded.validEvents.length + countInvalidFromErrors(loaded.errors),
      eventsValid: loaded.validEvents.length,
      wrote: false,
    };
  }

  const sourceHash = computeSourceHash(initialHash, loaded.fileHashes);
  const derived = foldEvents(loaded.validEvents, {
    initial,
    activeIds,
    sourceHash,
  });

  // Attach superseded list from resolution (foldEvents already computed from activeIds)
  derived.superseded_event_ids = [...supersededIds].sort();

  let wrote = false;
  if (!checkOnly) {
    writeDerived(derived, paths.derivedDir);
    wrote = true;
  }

  return {
    ok: true,
    derived,
    errors: [],
    eventsLoaded: loaded.validEvents.length,
    eventsValid: loaded.validEvents.length,
    wrote,
  };
}

function countInvalidFromErrors(loadErrors: string[]): number {
  // Approximate: each malformed/invalid file produces at least one error mentioning a path or Event
  const files = new Set<string>();
  for (const e of loadErrors) {
    const m = e.match(/events[\\/]([^\s:]+)/);
    if (m) files.add(m[1]);
  }
  return files.size || (loadErrors.length > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const bookArg = argv.find((a) => !a.startsWith("--"));
  if (!bookArg) {
    console.error("Usage: npx tsx scripts/story-state/fold.ts <book-path> [--check]");
    process.exit(2);
  }

  const checkOnly = argv.includes("--check");
  const paths = defaultPaths(bookArg);
  const result = runFold(paths, { checkOnly });

  if (!result.ok) {
    for (const e of result.errors) console.error(`ERROR ${e}`);
    process.exit(1);
  }

  if (checkOnly) {
    console.log(
      `fold --check: OK — ${result.eventsValid} valid event(s), derived state computed (not written).`,
    );
    return;
  }

  console.log(`fold: ${result.eventsValid} event(s) -> ${paths.derivedDir}`);
  console.log(`characters: ${Object.keys(result.derived!.characters).length}`);
  console.log(`threads: ${Object.keys(result.derived!.threads).length}`);
  console.log(`source_hash: ${result.derived!.source_hash}`);
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  main();
}
