import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  foldEvents,
  asEffectiveHistory,
  sortEvents,
  checkDuplicateIds,
  checkSequenceUniqueness,
  validateEvent,
  loadEvents,
  resolveEffectiveHistory,
  resolveSupersession,
  enforceKnowledgeInvariants,
  runFold,
  writeDerived,
  defaultPaths,
  defaultSchemaRegistry,
  type StoryEvent,
  type InitialState,
} from "./fold.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const registry = defaultSchemaRegistry(REPO_ROOT);

const baseProvenance = {
  manuscript: "manuscript/scenes/scene-0001.md",
  manuscript_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  approval_id: "apr-000001",
  scene_card: "planning/scenes/scene-0001.yaml",
};

const baseEvent = (overrides: Partial<StoryEvent> = {}): StoryEvent => ({
  schema_version: "1.0",
  event_id: "evt-000001",
  event_type: "scene",
  scene_id: "scene-0001",
  sequence: 1,
  provenance: { ...baseProvenance },
  changes: {},
  ...overrides,
});

describe("validateEvent", () => {
  it("rejects missing sequence", () => {
    const errors: string[] = [];
    const event = baseEvent();
    delete (event as Partial<StoryEvent>).sequence;
    validateEvent(event as StoryEvent, errors);
    assert.ok(errors.some((e) => e.includes("sequence")));
  });

  it("rejects invalid event_id format", () => {
    const errors: string[] = [];
    validateEvent(baseEvent({ event_id: "scene-0001" }), errors);
    assert.ok(errors.some((e) => e.includes("evt-")));
  });

  it("rejects character knowledge_added", () => {
    const errors: string[] = [];
    validateEvent(
      baseEvent({
        changes: {
          characters: {
            sera: { location: "medbay", knowledge_added: ["x"] } as never,
          },
        },
      }),
      errors,
    );
    assert.ok(errors.some((e) => e.includes("knowledge_")));
  });

  it("rejects canon_facts on changes", () => {
    const errors: string[] = [];
    validateEvent(
      baseEvent({
        changes: { canon_facts: [{ id: "x" }] } as never,
      }),
      errors,
    );
    assert.ok(errors.some((e) => e.includes("canon_facts")));
  });

  it("requires supersedes and reason for corrections", () => {
    const errors: string[] = [];
    validateEvent(
      baseEvent({
        event_id: "evt-000002",
        event_type: "correction",
        sequence: 2,
        provenance: undefined,
      }),
      errors,
    );
    assert.ok(errors.some((e) => e.includes("supersedes")));
    assert.ok(errors.some((e) => e.includes("reason")));
  });

  it("rejects supersedes on non-correction events", () => {
    const errors: string[] = [];
    validateEvent(
      baseEvent({
        event_type: "scene",
        supersedes: ["evt-000000"],
      }),
      errors,
    );
    assert.ok(errors.some((e) => e.includes("only correction events may have supersedes")));
  });

  it("requires provenance on scene events", () => {
    const errors: string[] = [];
    validateEvent(
      baseEvent({
        provenance: undefined,
      }),
      errors,
    );
    assert.ok(errors.some((e) => e.includes("provenance")));
  });

  it("rejects multi-target supersedes on correction", () => {
    const errors: string[] = [];
    validateEvent(
      baseEvent({
        event_id: "evt-000003",
        event_type: "correction",
        sequence: 3,
        supersedes: ["evt-000001", "evt-000002"],
        reason: "multi",
      }),
      errors,
    );
    assert.ok(errors.some((e) => e.includes("exactly one") || e.includes("exactly one event")));
  });

  it("rejects self-supersession", () => {
    const errors: string[] = [];
    validateEvent(
      baseEvent({
        event_id: "evt-000002",
        event_type: "correction",
        sequence: 2,
        supersedes: ["evt-000002"],
        reason: "oops",
      }),
      errors,
    );
    assert.ok(errors.some((e) => e.includes("cannot supersede itself")));
  });

  it("rejects undefined/null root fields without crashing", () => {
    const errors: string[] = [];
    validateEvent(undefined as unknown as StoryEvent, errors, "bad.json");
    assert.ok(errors.length > 0);
  });
});

describe("sortEvents", () => {
  it("orders by recorded sequence then event_id", () => {
    const events = [
      baseEvent({ event_id: "evt-000002", sequence: 2, scene_id: "scene-0002" }),
      baseEvent({ event_id: "evt-000001", sequence: 1 }),
    ];
    const sorted = sortEvents(events);
    assert.equal(sorted[0].event_id, "evt-000001");
    assert.equal(sorted[1].event_id, "evt-000002");
  });
});

describe("checkDuplicateIds / checkSequenceUniqueness", () => {
  it("detects duplicate event IDs", () => {
    const errors: string[] = [];
    checkDuplicateIds(
      [baseEvent({ event_id: "evt-000001" }), baseEvent({ event_id: "evt-000001" })],
      errors,
    );
    assert.ok(errors.some((e) => e.includes("Duplicate event_id")));
  });

  it("detects duplicate sequences", () => {
    const errors: string[] = [];
    checkSequenceUniqueness(
      [
        baseEvent({ event_id: "evt-000001", sequence: 1 }),
        baseEvent({ event_id: "evt-000002", sequence: 1, scene_id: "scene-0002" }),
      ],
      errors,
    );
    assert.ok(errors.some((e) => e.includes("Duplicate sequence")));
  });
});

describe("resolveEffectiveHistory", () => {
  it("marks superseded events inactive and places correction at root effective sequence", () => {
    const errors: string[] = [];
    const events = [
      baseEvent({
        event_id: "evt-000001",
        sequence: 1,
        changes: { characters: { sera: { location: "medbay" } } },
      }),
      baseEvent({
        event_id: "evt-000002",
        event_type: "correction",
        sequence: 2,
        supersedes: ["evt-000001"],
        reason: "fix location",
        changes: { characters: { sera: { location: "bridge" } } },
      }),
    ];
    const { effectiveEvents, activeIds, supersededIds } = resolveEffectiveHistory(events, errors);
    assert.equal(errors.length, 0);
    assert.ok(supersededIds.has("evt-000001"));
    assert.ok(activeIds.has("evt-000002"));
    assert.ok(!activeIds.has("evt-000001"));
    assert.equal(effectiveEvents.length, 1);
    assert.equal(effectiveEvents[0].event.event_id, "evt-000002");
    assert.equal(effectiveEvents[0].effectiveSequence, 1);
    assert.equal(effectiveEvents[0].replacementRootId, "evt-000001");
  });

  it("rejects missing supersession target", () => {
    const errors: string[] = [];
    resolveEffectiveHistory(
      [
        baseEvent({
          event_id: "evt-000002",
          event_type: "correction",
          sequence: 2,
          supersedes: ["evt-999999"],
          reason: "fix",
        }),
      ],
      errors,
    );
    assert.ok(errors.some((e) => e.includes("unknown event")));
  });

  it("rejects supersession cycles", () => {
    const errors: string[] = [];
    resolveEffectiveHistory(
      [
        baseEvent({
          event_id: "evt-000001",
          event_type: "correction",
          sequence: 1,
          supersedes: ["evt-000002"],
          reason: "a",
          scene_id: "scene-0001",
        }),
        baseEvent({
          event_id: "evt-000002",
          event_type: "correction",
          sequence: 2,
          supersedes: ["evt-000001"],
          reason: "b",
          scene_id: "scene-0001",
        }),
      ],
      errors,
    );
    assert.ok(errors.some((e) => e.includes("cycle")));
  });

  it("rejects correction branching (two active tips for same root)", () => {
    const errors: string[] = [];
    resolveEffectiveHistory(
      [
        baseEvent({ event_id: "evt-000001", sequence: 1 }),
        baseEvent({
          event_id: "evt-000002",
          event_type: "correction",
          sequence: 2,
          supersedes: ["evt-000001"],
          reason: "branch a",
          changes: { characters: { sera: { location: "a" } } },
        }),
        baseEvent({
          event_id: "evt-000003",
          event_type: "correction",
          sequence: 3,
          supersedes: ["evt-000001"],
          reason: "branch b",
          changes: { characters: { sera: { location: "b" } } },
        }),
      ],
      errors,
    );
    assert.ok(errors.some((e) => e.includes("branch conflict")));
  });

  it("allows correction chains A←B←C", () => {
    const errors: string[] = [];
    const { effectiveEvents, activeIds } = resolveEffectiveHistory(
      [
        baseEvent({ event_id: "evt-000001", sequence: 1 }),
        baseEvent({
          event_id: "evt-000002",
          event_type: "correction",
          sequence: 2,
          supersedes: ["evt-000001"],
          reason: "first fix",
          changes: {},
        }),
        baseEvent({
          event_id: "evt-000003",
          event_type: "correction",
          sequence: 3,
          supersedes: ["evt-000002"],
          reason: "second fix",
          changes: {},
        }),
      ],
      errors,
    );
    assert.equal(errors.length, 0);
    assert.ok(activeIds.has("evt-000003"));
    assert.ok(!activeIds.has("evt-000001"));
    assert.ok(!activeIds.has("evt-000002"));
    assert.equal(effectiveEvents[0].effectiveSequence, 1);
    assert.equal(effectiveEvents[0].replacementRootId, "evt-000001");
  });

  it("rejects correction whose recorded sequence is not greater than superseded", () => {
    const errors: string[] = [];
    resolveEffectiveHistory(
      [
        baseEvent({ event_id: "evt-000001", sequence: 2 }),
        baseEvent({
          event_id: "evt-000002",
          event_type: "correction",
          sequence: 1,
          supersedes: ["evt-000001"],
          reason: "bad order",
        }),
      ],
      errors,
    );
    assert.ok(errors.some((e) => e.includes("must be greater than superseded")));
  });

  it("resolveSupersession wrapper still returns active/superseded sets", () => {
    const errors: string[] = [];
    const { activeIds, supersededIds } = resolveSupersession(
      [
        baseEvent({ event_id: "evt-000001", sequence: 1 }),
        baseEvent({
          event_id: "evt-000002",
          event_type: "correction",
          sequence: 2,
          supersedes: ["evt-000001"],
          reason: "fix",
        }),
      ],
      errors,
    );
    assert.equal(errors.length, 0);
    assert.ok(supersededIds.has("evt-000001"));
    assert.ok(activeIds.has("evt-000002"));
  });
});

describe("historical correction ordering", () => {
  it("basic: correction of seq1 applies before later seq2 event (final from B not C)", () => {
    const errors: string[] = [];
    const events = [
      baseEvent({
        event_id: "evt-000001",
        sequence: 1,
        changes: { characters: { sera: { location: "A" } } },
      }),
      baseEvent({
        event_id: "evt-000002",
        scene_id: "scene-0002",
        sequence: 2,
        changes: { characters: { sera: { location: "B" } } },
      }),
      baseEvent({
        event_id: "evt-000003",
        event_type: "correction",
        sequence: 3,
        supersedes: ["evt-000001"],
        reason: "fix A→C",
        changes: { characters: { sera: { location: "C" } } },
      }),
    ];
    const resolution = resolveEffectiveHistory(events, errors);
    assert.equal(errors.length, 0);
    assert.deepEqual(
      resolution.effectiveEvents.map((e) => e.event.event_id),
      ["evt-000003", "evt-000002"],
    );
    assert.equal(resolution.effectiveEvents[0].effectiveSequence, 1);
    assert.equal(resolution.effectiveEvents[1].effectiveSequence, 2);

    const state = foldEvents(resolution.effectiveEvents, {
      sourceHash: "x",
      totalEventCount: 3,
      supersededEventIds: [...resolution.supersededIds],
      allEvents: events,
    });
    assert.equal(state.characters.sera.location, "B");
    assert.equal(state.total_event_count, 3);
    assert.equal(state.active_event_count, 2);
    assert.equal(state.superseded_event_count, 1);
    assert.equal(state.latest_recorded_event_id, "evt-000003");
    assert.equal(state.latest_recorded_sequence, 3);
    assert.equal(state.last_effective_event_id, "evt-000002");
    assert.deepEqual(state.active_event_ids, ["evt-000003", "evt-000002"]);
  });

  it("chain: A←C←D at pos1, B at pos2 → final B", () => {
    const errors: string[] = [];
    const events = [
      baseEvent({
        event_id: "evt-000001",
        sequence: 1,
        changes: { characters: { sera: { location: "A" } } },
      }),
      baseEvent({
        event_id: "evt-000002",
        scene_id: "scene-0002",
        sequence: 2,
        changes: { characters: { sera: { location: "B" } } },
      }),
      baseEvent({
        event_id: "evt-000003",
        event_type: "correction",
        sequence: 3,
        supersedes: ["evt-000001"],
        reason: "A→C",
        changes: { characters: { sera: { location: "C" } } },
      }),
      baseEvent({
        event_id: "evt-000004",
        event_type: "correction",
        sequence: 4,
        supersedes: ["evt-000003"],
        reason: "C→D",
        changes: { characters: { sera: { location: "D" } } },
      }),
    ];
    const resolution = resolveEffectiveHistory(events, errors);
    assert.equal(errors.length, 0);
    assert.deepEqual(
      resolution.effectiveEvents.map((e) => ({
        id: e.event.event_id,
        eff: e.effectiveSequence,
        root: e.replacementRootId,
      })),
      [
        { id: "evt-000004", eff: 1, root: "evt-000001" },
        { id: "evt-000002", eff: 2, root: "evt-000002" },
      ],
    );
    const state = foldEvents(resolution.effectiveEvents, {
      sourceHash: "x",
      totalEventCount: 4,
      supersededEventIds: [...resolution.supersededIds],
    });
    assert.equal(state.characters.sera.location, "B");
  });

  it("independent later state is not overridden by historical correction", () => {
    const errors: string[] = [];
    const events = [
      baseEvent({
        event_id: "evt-000001",
        sequence: 1,
        changes: {
          characters: { sera: { location: "medbay" } },
          inventory: { sera: { gained: ["pad-v1"] } },
        },
      }),
      baseEvent({
        event_id: "evt-000002",
        scene_id: "scene-0002",
        sequence: 2,
        changes: {
          characters: { sera: { location: "bridge", condition: "alert" } },
          inventory: { sera: { gained: ["badge"], lost: ["pad-v1"] } },
        },
      }),
      baseEvent({
        event_id: "evt-000003",
        event_type: "correction",
        sequence: 3,
        supersedes: ["evt-000001"],
        reason: "rename pad only in historical slot",
        changes: {
          characters: { sera: { location: "medbay" } },
          inventory: { sera: { gained: ["pad-v2"] } },
        },
      }),
    ];
    const resolution = resolveEffectiveHistory(events, errors);
    assert.equal(errors.length, 0);
    const state = foldEvents(resolution.effectiveEvents, {
      sourceHash: "x",
      totalEventCount: 3,
      supersededEventIds: [...resolution.supersededIds],
    });
    // Later scene still wins location/condition; correction does not clobber them.
    assert.equal(state.characters.sera.location, "bridge");
    assert.equal(state.characters.sera.condition, "alert");
    // Replay: correction (pad-v2) then scene-2 (lose pad-v1, gain badge) —
    // scene-2 never removes pad-v2, so both remain (demonstrates historical insert, not override).
    assert.deepEqual(state.inventory.sera, ["badge", "pad-v2"]);
  });

  it("branch conflict fails before fold", () => {
    const errors: string[] = [];
    resolveEffectiveHistory(
      [
        baseEvent({ event_id: "evt-000001", sequence: 1 }),
        baseEvent({
          event_id: "evt-000002",
          event_type: "correction",
          sequence: 2,
          supersedes: ["evt-000001"],
          reason: "a",
        }),
        baseEvent({
          event_id: "evt-000003",
          event_type: "correction",
          sequence: 3,
          supersedes: ["evt-000001"],
          reason: "b",
        }),
      ],
      errors,
    );
    assert.ok(errors.some((e) => e.includes("branch conflict")));
  });

  it("multi-target correction rejected by resolveEffectiveHistory", () => {
    const errors: string[] = [];
    resolveEffectiveHistory(
      [
        baseEvent({ event_id: "evt-000001", sequence: 1 }),
        baseEvent({ event_id: "evt-000002", sequence: 2, scene_id: "scene-0002" }),
        baseEvent({
          event_id: "evt-000003",
          event_type: "correction",
          sequence: 3,
          supersedes: ["evt-000001", "evt-000002"],
          reason: "multi",
        }),
      ],
      errors,
    );
    assert.ok(errors.some((e) => e.includes("exactly one")));
  });
});

describe("enforceKnowledgeInvariants", () => {
  it("removes does_not_know when knows contradicts", () => {
    const k = enforceKnowledgeInvariants({
      knows: ["secret"],
      believes: ["secret"],
      suspects: ["secret"],
      does_not_know: ["secret"],
    });
    assert.deepEqual(k.knows, ["secret"]);
    assert.deepEqual(k.does_not_know, []);
    assert.deepEqual(k.believes, []);
    assert.deepEqual(k.suspects, []);
  });
});

describe("foldEvents", () => {
  it("applies character location and knowledge via knowledge namespace", () => {
    const events = [
      baseEvent({
        changes: {
          characters: { sera: { location: "medbay" } },
          knowledge: {
            sera: { knows_added: ["Patient records show gaps"] },
          },
        },
      }),
    ];
    const state = foldEvents(asEffectiveHistory(events), {
      sourceHash: "abc",
      totalEventCount: 1,
      supersededEventIds: [],
    });
    assert.equal(state.characters.sera.location, "medbay");
    assert.deepEqual(state.knowledge.sera.knows, ["Patient records show gaps"]);
    assert.equal(state.source_hash, "abc");
  });

  it("folds events in effective sequence order", () => {
    const events = [
      baseEvent({
        event_id: "evt-000002",
        scene_id: "scene-0002",
        sequence: 2,
        changes: { characters: { sera: { location: "bridge" } } },
      }),
      baseEvent({
        event_id: "evt-000001",
        sequence: 1,
        changes: { characters: { sera: { location: "medbay" } } },
      }),
    ];
    const state = foldEvents(asEffectiveHistory(events), {
      sourceHash: "x",
      totalEventCount: 2,
      supersededEventIds: [],
    });
    assert.equal(state.characters.sera.location, "bridge");
    assert.equal(state.active_event_count, 2);
  });

  it("applies correction deltas at effective position", () => {
    const errors: string[] = [];
    const events = [
      baseEvent({
        event_id: "evt-000001",
        sequence: 1,
        changes: { characters: { sera: { location: "medbay" } } },
      }),
      baseEvent({
        event_id: "evt-000002",
        event_type: "correction",
        sequence: 2,
        supersedes: ["evt-000001"],
        reason: "wrong location",
        changes: { characters: { sera: { location: "bridge" } } },
      }),
    ];
    const resolution = resolveEffectiveHistory(events, errors);
    assert.equal(errors.length, 0);
    const state = foldEvents(resolution.effectiveEvents, {
      sourceHash: "x",
      totalEventCount: 2,
      supersededEventIds: [...resolution.supersededIds],
    });
    assert.equal(state.characters.sera.location, "bridge");
    assert.equal(state.active_event_count, 1);
    assert.deepEqual(state.active_event_ids, ["evt-000002"]);
  });

  it("merges world entity-level and tracks inventory", () => {
    const events = [
      baseEvent({
        changes: {
          world: { ship: { status: "nominal" }, alert: "none" },
          inventory: { sera: { gained: ["data-pad"], lost: [] } },
        },
      }),
      baseEvent({
        event_id: "evt-000002",
        scene_id: "scene-0002",
        sequence: 2,
        changes: {
          world: { ship: { status: "alert" } },
          inventory: { sera: { lost: ["data-pad"], gained: ["badge"] } },
        },
      }),
    ];
    const state = foldEvents(asEffectiveHistory(events), {
      sourceHash: "x",
      totalEventCount: 2,
      supersededEventIds: [],
    });
    assert.equal((state.world.ship as { status: string }).status, "alert");
    assert.equal(state.world.alert, "none");
    assert.deepEqual(state.inventory.sera, ["badge"]);
  });

  it("applies initial state before events", () => {
    const initial: InitialState = {
      schema_version: "1.0",
      characters: { sera: { location: "quarters" } },
      knowledge: { sera: { knows: ["ship name"] } },
    };
    const events = [
      baseEvent({
        changes: { characters: { sera: { location: "medbay" } } },
      }),
    ];
    const state = foldEvents(asEffectiveHistory(events), {
      initial,
      sourceHash: "x",
      totalEventCount: 1,
      supersededEventIds: [],
    });
    assert.equal(state.characters.sera.location, "medbay");
    assert.deepEqual(state.knowledge.sera.knows, ["ship name"]);
  });

  it("advances thread state", () => {
    const events = [
      baseEvent({
        changes: {
          threads: {
            "memory-gaps": { state: "advanced", note: "Sera finds mismatch" },
          },
        },
      }),
    ];
    const state = foldEvents(asEffectiveHistory(events), {
      sourceHash: "x",
      totalEventCount: 1,
      supersededEventIds: [],
    });
    assert.equal(state.threads["memory-gaps"].state, "advanced");
    assert.equal(state.threads["memory-gaps"].last_scene, "scene-0001");
    assert.equal(state.threads["memory-gaps"].last_event, "evt-000001");
  });

  it("merges relationships deterministically", () => {
    const events = [
      baseEvent({
        changes: {
          characters: {
            sera: { relationships: { marcus: "suspicious", zed: "unknown" } },
          },
        },
      }),
      baseEvent({
        event_id: "evt-000002",
        scene_id: "scene-0002",
        sequence: 2,
        changes: {
          characters: {
            sera: { relationships: { marcus: "ally" } },
          },
        },
      }),
    ];
    const state = foldEvents(asEffectiveHistory(events), {
      sourceHash: "x",
      totalEventCount: 2,
      supersededEventIds: [],
    });
    assert.equal(state.characters.sera.relationships.marcus, "ally");
    assert.equal(state.characters.sera.relationships.zed, "unknown");
    assert.deepEqual(Object.keys(state.characters.sera.relationships), ["marcus", "zed"]);
  });
});

describe("loadEvents schema validation", () => {
  it("returns validEvents + errors without crashing on bad files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-load-"));
    fs.writeFileSync(path.join(dir, "bad.json"), "{not-json", "utf8");
    fs.writeFileSync(
      path.join(dir, "evt-000001-scene-0001-approved.json"),
      JSON.stringify(baseEvent()),
      "utf8",
    );
    const result = loadEvents(dir, registry);
    assert.equal(result.validEvents.length, 1);
    assert.ok(result.errors.some((e) => e.includes("Malformed")));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("excludes invalid events from validEvents", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-inv-"));
    fs.writeFileSync(
      path.join(dir, "broken.json"),
      JSON.stringify({ schema_version: "1.0", event_id: "nope" }),
      "utf8",
    );
    const result = loadEvents(dir, registry);
    assert.equal(result.validEvents.length, 0);
    assert.ok(result.errors.length > 0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects multi-target correction via schema", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-multi-"));
    fs.writeFileSync(
      path.join(dir, "evt-000003.json"),
      JSON.stringify(
        baseEvent({
          event_id: "evt-000003",
          event_type: "correction",
          sequence: 3,
          supersedes: ["evt-000001", "evt-000002"],
          reason: "multi",
        }),
      ),
      "utf8",
    );
    const result = loadEvents(dir, registry);
    assert.equal(result.validEvents.length, 0);
    assert.ok(result.errors.some((e) => e.includes("Schema validation failed")));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects supersedes on scene via schema", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-scene-sup-"));
    fs.writeFileSync(
      path.join(dir, "evt-000001.json"),
      JSON.stringify(
        baseEvent({
          supersedes: ["evt-000000"],
        }),
      ),
      "utf8",
    );
    const result = loadEvents(dir, registry);
    assert.equal(result.validEvents.length, 0);
    assert.ok(result.errors.some((e) => e.includes("Schema validation failed")));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("malformed nested values", () => {
  function writeEventBook(event: unknown): string {
    const bookDir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-malformed-"));
    const eventsDir = path.join(bookDir, "state", "events");
    fs.mkdirSync(eventsDir, { recursive: true });
    fs.writeFileSync(path.join(eventsDir, "evt-000001.json"), JSON.stringify(event), "utf8");
    return bookDir;
  }

  it("rejects knows_added as string; no derived write", () => {
    const bookDir = writeEventBook(
      baseEvent({
        changes: {
          knowledge: { sera: { knows_added: "not-an-array" as unknown as string[] } },
        },
      }),
    );
    const result = runFold(defaultPaths(bookDir), {
      checkOnly: false,
      schemaRegistry: registry,
    });
    assert.equal(result.ok, false);
    assert.equal(result.wrote, false);
    assert.ok(!fs.existsSync(path.join(bookDir, "state", "derived")));
    assert.ok(result.errors.some((e) => e.includes("Schema validation failed")));
    fs.rmSync(bookDir, { recursive: true, force: true });
  });

  it("rejects relationships as non-object", () => {
    const bookDir = writeEventBook(
      baseEvent({
        changes: {
          characters: {
            sera: { relationships: "ally" as unknown as Record<string, string> },
          },
        },
      }),
    );
    const result = runFold(defaultPaths(bookDir), {
      checkOnly: false,
      schemaRegistry: registry,
    });
    assert.equal(result.ok, false);
    assert.equal(result.wrote, false);
    fs.rmSync(bookDir, { recursive: true, force: true });
  });

  it("rejects inventory gained as non-array", () => {
    const bookDir = writeEventBook(
      baseEvent({
        changes: {
          inventory: { sera: { gained: "pad" as unknown as string[] } },
        },
      }),
    );
    const result = runFold(defaultPaths(bookDir), {
      checkOnly: false,
      schemaRegistry: registry,
    });
    assert.equal(result.ok, false);
    assert.equal(result.wrote, false);
    fs.rmSync(bookDir, { recursive: true, force: true });
  });

  it("rejects threads value as non-object", () => {
    const bookDir = writeEventBook(
      baseEvent({
        changes: {
          threads: { "memory-gaps": "advanced" as unknown as { state: string } },
        },
      }),
    );
    const result = runFold(defaultPaths(bookDir), {
      checkOnly: false,
      schemaRegistry: registry,
    });
    assert.equal(result.ok, false);
    assert.equal(result.wrote, false);
    fs.rmSync(bookDir, { recursive: true, force: true });
  });

  it("rejects world as non-object", () => {
    const bookDir = writeEventBook(
      baseEvent({
        changes: {
          world: "broken" as unknown as Record<string, unknown>,
        },
      }),
    );
    const result = runFold(defaultPaths(bookDir), {
      checkOnly: false,
      schemaRegistry: registry,
    });
    assert.equal(result.ok, false);
    assert.equal(result.wrote, false);
    fs.rmSync(bookDir, { recursive: true, force: true });
  });

  it("rejects initial knowledge array fields as non-arrays", () => {
    const bookDir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-init-k-"));
    fs.mkdirSync(path.join(bookDir, "state", "events"), { recursive: true });
    fs.writeFileSync(
      path.join(bookDir, "state", "initial.json"),
      JSON.stringify({
        schema_version: "1.0",
        knowledge: { sera: { knows: "secret" } },
      }),
      "utf8",
    );
    const result = runFold(defaultPaths(bookDir), {
      checkOnly: false,
      schemaRegistry: registry,
    });
    assert.equal(result.ok, false);
    assert.equal(result.wrote, false);
    assert.ok(!fs.existsSync(path.join(bookDir, "state", "derived")));
    fs.rmSync(bookDir, { recursive: true, force: true });
  });

  it("rejects initial inventory non-array", () => {
    const bookDir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-init-inv-"));
    fs.mkdirSync(path.join(bookDir, "state", "events"), { recursive: true });
    fs.writeFileSync(
      path.join(bookDir, "state", "initial.json"),
      JSON.stringify({
        schema_version: "1.0",
        inventory: { sera: "pad" },
      }),
      "utf8",
    );
    const result = runFold(defaultPaths(bookDir), {
      checkOnly: false,
      schemaRegistry: registry,
    });
    assert.equal(result.ok, false);
    assert.equal(result.wrote, false);
    fs.rmSync(bookDir, { recursive: true, force: true });
  });
});

describe("runFold checkOnly", () => {
  it("never writes derived when checkOnly is true", () => {
    const bookDir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-check-"));
    const eventsDir = path.join(bookDir, "state", "events");
    const derivedDir = path.join(bookDir, "state", "derived");
    fs.mkdirSync(eventsDir, { recursive: true });
    fs.writeFileSync(
      path.join(eventsDir, "evt-000001-scene-0001-approved.json"),
      JSON.stringify(
        baseEvent({
          changes: { characters: { sera: { location: "medbay" } } },
        }),
      ),
      "utf8",
    );

    const paths = defaultPaths(bookDir);
    const result = runFold(paths, { checkOnly: true, schemaRegistry: registry });
    assert.equal(result.ok, true);
    assert.equal(result.wrote, false);
    assert.ok(!fs.existsSync(derivedDir));

    fs.rmSync(bookDir, { recursive: true, force: true });
  });

  it("writes derived only when ok and not checkOnly; byte-stable", () => {
    const bookDir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-write-"));
    const eventsDir = path.join(bookDir, "state", "events");
    fs.mkdirSync(eventsDir, { recursive: true });
    fs.writeFileSync(
      path.join(eventsDir, "evt-000001-scene-0001-approved.json"),
      JSON.stringify(
        baseEvent({
          changes: { characters: { sera: { location: "medbay" } } },
        }),
      ),
      "utf8",
    );

    const paths = defaultPaths(bookDir);
    const first = runFold(paths, { checkOnly: false, schemaRegistry: registry });
    assert.equal(first.ok, true);
    assert.equal(first.wrote, true);
    assert.ok(fs.existsSync(path.join(paths.derivedDir, "_manifest.json")));

    const manifest = JSON.parse(
      fs.readFileSync(path.join(paths.derivedDir, "_manifest.json"), "utf8"),
    );
    assert.equal(manifest.total_event_count, 1);
    assert.equal(manifest.active_event_count, 1);
    assert.equal(manifest.superseded_event_count, 0);
    assert.ok(manifest.source_hash);
    assert.equal(manifest.generated_at, undefined);

    const hash1 = first.derived!.source_hash;
    const second = runFold(paths, { checkOnly: false, schemaRegistry: registry });
    assert.equal(second.derived!.source_hash, hash1);

    const m1 = fs.readFileSync(path.join(paths.derivedDir, "_manifest.json"), "utf8");
    writeDerived(second.derived!, paths.derivedDir);
    const m2 = fs.readFileSync(path.join(paths.derivedDir, "_manifest.json"), "utf8");
    assert.equal(m1, m2);

    fs.rmSync(bookDir, { recursive: true, force: true });
  });

  it("does not write when validation fails", () => {
    const bookDir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-fail-"));
    const eventsDir = path.join(bookDir, "state", "events");
    const derivedDir = path.join(bookDir, "state", "derived");
    fs.mkdirSync(eventsDir, { recursive: true });
    fs.writeFileSync(path.join(eventsDir, "bad.json"), "{", "utf8");

    const result = runFold(defaultPaths(bookDir), {
      checkOnly: false,
      schemaRegistry: registry,
    });
    assert.equal(result.ok, false);
    assert.equal(result.wrote, false);
    assert.ok(!fs.existsSync(derivedDir));

    fs.rmSync(bookDir, { recursive: true, force: true });
  });

  it("does not write when branch conflict present", () => {
    const bookDir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-branch-"));
    const eventsDir = path.join(bookDir, "state", "events");
    fs.mkdirSync(eventsDir, { recursive: true });
    const events = [
      baseEvent({ event_id: "evt-000001", sequence: 1 }),
      baseEvent({
        event_id: "evt-000002",
        event_type: "correction",
        sequence: 2,
        supersedes: ["evt-000001"],
        reason: "a",
      }),
      baseEvent({
        event_id: "evt-000003",
        event_type: "correction",
        sequence: 3,
        supersedes: ["evt-000001"],
        reason: "b",
      }),
    ];
    for (const e of events) {
      fs.writeFileSync(path.join(eventsDir, `${e.event_id}.json`), JSON.stringify(e), "utf8");
    }
    const result = runFold(defaultPaths(bookDir), {
      checkOnly: false,
      schemaRegistry: registry,
    });
    assert.equal(result.ok, false);
    assert.equal(result.wrote, false);
    assert.ok(result.errors.some((e) => e.includes("branch conflict")));
    fs.rmSync(bookDir, { recursive: true, force: true });
  });
});
