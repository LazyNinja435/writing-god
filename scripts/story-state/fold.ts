/**
 * fold.ts — deterministic fold of event-sourced story state.
 *
 * Pipeline:
 *   load → schema validate → structural validate → resolve correction chains
 *   → effective event list → sort by effective historical position → fold
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
import {
  createSchemaRegistry,
  schemasDirFromRoot,
  type SchemaRegistry,
} from "../lib/schema-validation.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventType = "scene" | "correction" | "canon-change" | "bootstrap";

export interface StoryEvent {
  schema_version: string;
  event_id: string;
  event_type: EventType;
  scene_id?: string;
  /** Recorded sequence: audit/append order; globally unique per book. */
  sequence: number;
  /** V1: exactly one event ID when present (required for corrections). */
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

/**
 * An active event placed at its effective historical position for replay.
 * effectiveSequence is derived during supersession resolution (not persisted).
 */
export interface EffectiveEvent {
  event: StoryEvent;
  /** Story replay order: for normals = recorded sequence; for corrections = chain-root sequence. */
  effectiveSequence: number;
  /** Ultimate event ID this active event replaces (self if not a correction chain tip). */
  replacementRootId: string;
}

export interface DerivedState {
  source_hash: string;
  total_event_count: number;
  active_event_count: number;
  superseded_event_count: number;
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

export interface SupersessionResolution {
  effectiveEvents: EffectiveEvent[];
  activeIds: Set<string>;
  supersededIds: Set<string>;
}

const EVENT_TYPES: EventType[] = ["scene", "correction", "canon-change", "bootstrap"];

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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

export function defaultSchemaRegistry(repoRoot: string = REPO_ROOT): SchemaRegistry {
  return createSchemaRegistry(schemasDirFromRoot(repoRoot));
}

export function sha256Hex(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadEvents(
  eventsDir: string,
  schemaRegistry: SchemaRegistry = defaultSchemaRegistry(),
): LoadEventsResult {
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

    if (!isPlainObject(parsed)) {
      errors.push(`Malformed event ${filePath}: root must be an object`);
      continue;
    }

    const schemaResult = schemaRegistry.validateStoryEvent(parsed, file);
    if (!schemaResult.ok) {
      for (const e of schemaResult.errors) errors.push(e);
      continue;
    }

    const eventErrors: string[] = [];
    validateEventSemantics(parsed as StoryEvent, eventErrors, file);
    if (eventErrors.length > 0) {
      for (const e of eventErrors) errors.push(e);
      continue;
    }

    validEvents.push(parsed as StoryEvent);
  }

  return { validEvents, errors, fileHashes };
}

/**
 * Semantic checks beyond JSON Schema (self-supersession wording, canon_facts belt).
 * Schema is the primary type/shape authority.
 */
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
    if (!Array.isArray(event.supersedes) || event.supersedes.length !== 1) {
      errors.push(`Event ${id}: correction events require supersedes with exactly one event ID`);
    }
    if (!event.reason || typeof event.reason !== "string") {
      errors.push(`Event ${id}: correction events require reason`);
    }
  }

  if (event.supersedes !== undefined) {
    if (!Array.isArray(event.supersedes)) {
      errors.push(`Event ${id}: supersedes must be an array`);
    } else {
      if (event.supersedes.length > 1) {
        errors.push(
          `Event ${id}: V1 corrections supersede exactly one event (got ${event.supersedes.length})`,
        );
      }
      if (new Set(event.supersedes).size !== event.supersedes.length) {
        errors.push(`Event ${id}: supersedes must not contain duplicates`);
      }
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

function validateEventSemantics(
  event: StoryEvent,
  errors: string[],
  sourceLabel: string,
): void {
  validateEvent(event, errors, sourceLabel);
}

export function loadInitialState(
  initialPath: string,
  errors: string[],
  schemaRegistry: SchemaRegistry = defaultSchemaRegistry(),
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

  const schemaResult = schemaRegistry.validateInitialState(parsed, path.basename(initialPath));
  if (!schemaResult.ok) {
    for (const e of schemaResult.errors) errors.push(e);
    return { state: null, hash: null };
  }

  return { state: parsed as InitialState, hash };
}

/** Sort by recorded sequence (audit order). Diagnostic only for uniqueness checks. */
export function sortEvents(events: StoryEvent[]): StoryEvent[] {
  return [...events].sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.event_id.localeCompare(b.event_id);
  });
}

export function sortEffectiveEvents(events: EffectiveEvent[]): EffectiveEvent[] {
  return [...events].sort((a, b) => {
    if (a.effectiveSequence !== b.effectiveSequence) {
      return a.effectiveSequence - b.effectiveSequence;
    }
    return a.event.event_id.localeCompare(b.event.event_id);
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
 * Walk supersedes chain to the ultimate replaced event (chain root).
 * A ← B ← C yields root A for tip C.
 */
export function findReplacementRoot(
  event: StoryEvent,
  byId: Map<string, StoryEvent>,
): string {
  let current = event;
  const visiting = new Set<string>();
  while (current.supersedes && current.supersedes.length > 0) {
    if (visiting.has(current.event_id)) {
      return current.event_id;
    }
    visiting.add(current.event_id);
    const targetId = current.supersedes[0];
    const target = byId.get(targetId);
    if (!target) return targetId;
    current = target;
  }
  return current.event_id;
}

/**
 * Resolve correction chains into an explicit effective-event list.
 *
 * Recorded sequence = unique audit/append order (event.sequence).
 * Effective sequence = story replay position:
 *   - normal event: effectiveSequence = event.sequence
 *   - correction: effectiveSequence = recorded sequence of the chain-root event it ultimately replaces
 *
 * V1: each correction supersedes exactly one event. Chains (A←B←C) are valid.
 * Branching (two active tips for the same root) is rejected.
 */
export function resolveEffectiveHistory(
  events: StoryEvent[],
  errors: string[],
): SupersessionResolution {
  const byId = new Map(events.map((e) => [e.event_id, e]));
  const supersededIds = new Set<string>();

  for (const event of events) {
    const supersedes = event.supersedes ?? [];

    if (event.event_type === "correction") {
      if (supersedes.length !== 1) {
        errors.push(
          `Event ${event.event_id}: correction must supersede exactly one event (V1)`,
        );
      }
    } else if (supersedes.length > 1) {
      errors.push(
        `Event ${event.event_id}: V1 allows superseding at most one event (got ${supersedes.length})`,
      );
    }

    if (new Set(supersedes).size !== supersedes.length) {
      errors.push(`Event ${event.event_id}: supersedes contains duplicate IDs`);
    }

    for (const target of supersedes) {
      if (target === event.event_id) {
        errors.push(`Event ${event.event_id}: cannot supersede itself`);
        continue;
      }
      const targetEvent = byId.get(target);
      if (!targetEvent) {
        errors.push(`Event ${event.event_id}: supersedes unknown event ${target}`);
        continue;
      }
      if (!(event.sequence > targetEvent.sequence)) {
        errors.push(
          `Event ${event.event_id}: recorded sequence ${event.sequence} must be greater than superseded ${target} sequence ${targetEvent.sequence}`,
        );
      }
      supersededIds.add(target);
    }
  }

  // Cycle detection on supersedes graph
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

  const activeEvents = events.filter((e) => !supersededIds.has(e.event_id));
  const activeIds = new Set(activeEvents.map((e) => e.event_id));

  const claimantsByRoot = new Map<string, string[]>();
  const effectiveEvents: EffectiveEvent[] = [];

  for (const event of activeEvents) {
    const replacementRootId =
      event.supersedes && event.supersedes.length > 0
        ? findReplacementRoot(event, byId)
        : event.event_id;

    const rootEvent = byId.get(replacementRootId);
    const effectiveSequence = rootEvent ? rootEvent.sequence : event.sequence;

    effectiveEvents.push({
      event,
      effectiveSequence,
      replacementRootId,
    });

    const claimants = claimantsByRoot.get(replacementRootId) ?? [];
    claimants.push(event.event_id);
    claimantsByRoot.set(replacementRootId, claimants);
  }

  for (const [rootId, claimants] of claimantsByRoot) {
    if (claimants.length > 1) {
      errors.push(
        `Correction branch conflict at root ${rootId}: multiple active events [${claimants.sort().join(", ")}] — V1 allows only one effective chain per root`,
      );
    }
  }

  return {
    effectiveEvents: sortEffectiveEvents(effectiveEvents),
    activeIds,
    supersededIds,
  };
}

/** @deprecated Use resolveEffectiveHistory — kept as thin wrapper for callers. */
export function resolveSupersession(
  events: StoryEvent[],
  errors: string[],
): { activeIds: Set<string>; supersededIds: Set<string> } {
  const { activeIds, supersededIds } = resolveEffectiveHistory(events, errors);
  return { activeIds, supersededIds };
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
  return [...new Set(arr)].sort();
}

function addItems(target: string[], added?: string[], removed?: string[]): string[] {
  let result = [...target];
  if (added) {
    if (!Array.isArray(added)) {
      throw new Error("knows/inventory delta array expected");
    }
    result = uniq([...result, ...added]);
  }
  if (removed) {
    if (!Array.isArray(removed)) {
      throw new Error("knows/inventory delta array expected");
    }
    result = result.filter((x) => !removed.includes(x));
  }
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

  let does_not_know = uniq(k.does_not_know).filter((f) => !knowsSet.has(f));
  let believes = uniq(k.believes).filter((f) => !knowsSet.has(f));
  let suspects = uniq(k.suspects).filter((f) => !knowsSet.has(f));

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
    if (delta.injuries) {
      if (!Array.isArray(delta.injuries)) {
        throw new Error(`initial.characters.${id}.injuries must be an array`);
      }
      cur.injuries = uniq(delta.injuries);
    }
    if (delta.relationships) {
      if (!isPlainObject(delta.relationships)) {
        throw new Error(`initial.characters.${id}.relationships must be an object`);
      }
      cur.relationships = sortedRelationships({ ...delta.relationships });
    }
    state.characters[id] = cur;
  }

  for (const [id, delta] of Object.entries(initial.knowledge ?? {})) {
    if (!isPlainObject(delta)) {
      throw new Error(`initial.knowledge.${id} must be an object`);
    }
    for (const key of ["knows", "believes", "suspects", "does_not_know"] as const) {
      const val = delta[key];
      if (val !== undefined && !Array.isArray(val)) {
        throw new Error(`initial.knowledge.${id}.${key} must be an array`);
      }
    }
    state.knowledge[id] = enforceKnowledgeInvariants({
      knows: delta.knows ?? [],
      believes: delta.believes ?? [],
      suspects: delta.suspects ?? [],
      does_not_know: delta.does_not_know ?? [],
    });
  }

  for (const [id, delta] of Object.entries(initial.threads ?? {})) {
    if (!isPlainObject(delta)) {
      throw new Error(`initial.threads.${id} must be an object`);
    }
    state.threads[id] = {
      state: delta.state ?? "introduced",
      note: delta.note,
      last_scene: delta.last_scene,
      last_event: delta.last_event,
    };
  }

  if (initial.world !== undefined) {
    if (!isPlainObject(initial.world)) {
      throw new Error("initial.world must be an object");
    }
    state.world = deepMergeWorld({}, initial.world);
  }

  for (const [id, items] of Object.entries(initial.inventory ?? {})) {
    if (!Array.isArray(items)) {
      throw new Error(`initial.inventory.${id} must be an array`);
    }
    state.inventory[id] = uniq(items);
  }

  if (initial.timeline?.length) {
    state.timeline.push(...initial.timeline);
  }
}

function applyEvent(state: DerivedState, event: StoryEvent): void {
  state.last_event_id = event.event_id;
  const { changes } = event;

  for (const [id, delta] of Object.entries(changes.characters ?? {})) {
    if (!isPlainObject(delta)) {
      throw new Error(`changes.characters.${id} must be an object`);
    }
    const cur = state.characters[id] ?? emptyCharacter();
    if (delta.location !== undefined) cur.location = delta.location;
    if (delta.condition !== undefined) cur.condition = delta.condition;
    if (delta.status !== undefined) cur.status = delta.status;
    if (delta.injuries_added) cur.injuries = addItems(cur.injuries, delta.injuries_added);
    if (delta.injuries_removed) cur.injuries = addItems(cur.injuries, undefined, delta.injuries_removed);
    if (delta.relationships) {
      if (!isPlainObject(delta.relationships)) {
        throw new Error(`changes.characters.${id}.relationships must be an object`);
      }
      cur.relationships = sortedRelationships({ ...cur.relationships, ...delta.relationships });
    }
    state.characters[id] = cur;
  }

  for (const [id, delta] of Object.entries(changes.knowledge ?? {})) {
    if (!isPlainObject(delta)) {
      throw new Error(`changes.knowledge.${id} must be an object`);
    }
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
    if (!isPlainObject(delta)) {
      throw new Error(`changes.threads.${id} must be an object`);
    }
    const cur = state.threads[id] ?? { state: "introduced" };
    if (delta.state) cur.state = delta.state;
    if (delta.note) cur.note = delta.note;
    if (event.scene_id) cur.last_scene = event.scene_id;
    cur.last_event = event.event_id;
    state.threads[id] = cur;
  }

  if (changes.world !== undefined) {
    if (!isPlainObject(changes.world)) {
      throw new Error("changes.world must be an object");
    }
    state.world = deepMergeWorld(state.world, changes.world);
  }

  for (const [id, delta] of Object.entries(changes.inventory ?? {})) {
    if (!isPlainObject(delta)) {
      throw new Error(`changes.inventory.${id} must be an object`);
    }
    const cur = state.inventory[id] ?? [];
    let items = [...cur];
    if (delta.gained) {
      if (!Array.isArray(delta.gained)) {
        throw new Error(`changes.inventory.${id}.gained must be an array`);
      }
      items = uniq([...items, ...delta.gained]);
    }
    if (delta.lost) {
      if (!Array.isArray(delta.lost)) {
        throw new Error(`changes.inventory.${id}.lost must be an array`);
      }
      items = items.filter((x) => !delta.lost!.includes(x));
    }
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

/**
 * Pure fold over resolved effective history (already sorted by effectiveSequence).
 * Does not interpret correction/supersession semantics — callers must resolve first.
 */
export function foldEvents(
  effectiveHistory: EffectiveEvent[],
  options: {
    initial?: InitialState | null;
    sourceHash: string;
    totalEventCount: number;
    supersededEventIds: string[];
  },
): DerivedState {
  const active_event_ids = effectiveHistory.map((e) => e.event.event_id);
  const superseded_event_ids = [...options.supersededEventIds].sort();

  const state: DerivedState = {
    source_hash: options.sourceHash,
    total_event_count: options.totalEventCount,
    active_event_count: effectiveHistory.length,
    superseded_event_count: superseded_event_ids.length,
    last_event_id: null,
    active_event_ids,
    superseded_event_ids,
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

  for (const { event } of effectiveHistory) {
    applyEvent(state, event);
  }

  state.characters = sortedObjectKeys(state.characters);
  state.knowledge = sortedObjectKeys(state.knowledge);
  state.threads = sortedObjectKeys(state.threads);
  state.world = sortedObjectKeys(state.world as Record<string, unknown>);
  state.inventory = sortedObjectKeys(state.inventory);

  return state;
}

/**
 * Convenience: build EffectiveEvent[] for non-correction tests (identity mapping).
 */
export function asEffectiveHistory(events: StoryEvent[]): EffectiveEvent[] {
  return sortEffectiveEvents(
    events.map((event) => ({
      event,
      effectiveSequence: event.sequence,
      replacementRootId: event.event_id,
    })),
  );
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
      total_event_count: derived.total_event_count,
      active_event_count: derived.active_event_count,
      superseded_event_count: derived.superseded_event_count,
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
 * Load → schema validate → structural validate → resolve → fold → optionally write.
 * Writes only when result.ok && !checkOnly.
 */
export function runFold(
  paths: FoldPaths,
  options: { checkOnly?: boolean; schemaRegistry?: SchemaRegistry; repoRoot?: string } = {},
): FoldResult {
  const errors: string[] = [];
  const checkOnly = options.checkOnly === true;
  const schemaRegistry =
    options.schemaRegistry ?? defaultSchemaRegistry(options.repoRoot ?? REPO_ROOT);

  const { state: initial, hash: initialHash } = loadInitialState(
    paths.initialPath,
    errors,
    schemaRegistry,
  );
  const loaded = loadEvents(paths.eventsDir, schemaRegistry);
  errors.push(...loaded.errors);

  checkDuplicateIds(loaded.validEvents, errors);
  checkSequenceUniqueness(loaded.validEvents, errors);
  const resolution = resolveEffectiveHistory(loaded.validEvents, errors);

  if (errors.length > 0) {
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

  let derived: DerivedState;
  try {
    derived = foldEvents(resolution.effectiveEvents, {
      initial,
      sourceHash,
      totalEventCount: loaded.validEvents.length,
      supersededEventIds: [...resolution.supersededIds],
    });
  } catch (err) {
    return {
      ok: false,
      derived: null,
      errors: [`Fold apply failed: ${(err as Error).message}`],
      eventsLoaded: loaded.validEvents.length,
      eventsValid: loaded.validEvents.length,
      wrote: false,
    };
  }

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
