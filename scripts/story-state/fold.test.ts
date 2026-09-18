import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  foldEvents,
  sortEvents,
  checkDuplicateIds,
  checkSequenceUniqueness,
  validateEvent,
  loadEvents,
  resolveSupersession,
  enforceKnowledgeInvariants,
  runFold,
  writeDerived,
  defaultPaths,
  type StoryEvent,
  type InitialState,
} from "./fold.ts";

const baseEvent = (overrides: Partial<StoryEvent> = {}): StoryEvent => ({
  schema_version: "1.0",
  event_id: "evt-000001",
  event_type: "scene",
  scene_id: "scene-0001",
  sequence: 1,
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
      }),
      errors,
    );
    assert.ok(errors.some((e) => e.includes("supersedes")));
    assert.ok(errors.some((e) => e.includes("reason")));
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
  it("orders by sequence then event_id", () => {
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

describe("resolveSupersession", () => {
  it("marks superseded events inactive", () => {
    const errors: string[] = [];
    const events = [
      baseEvent({ event_id: "evt-000001", sequence: 1 }),
      baseEvent({
        event_id: "evt-000002",
        event_type: "correction",
        sequence: 2,
        supersedes: ["evt-000001"],
        reason: "fix location",
        changes: { characters: { sera: { location: "bridge" } } },
      }),
    ];
    const { activeIds, supersededIds } = resolveSupersession(events, errors);
    assert.equal(errors.length, 0);
    assert.ok(supersededIds.has("evt-000001"));
    assert.ok(activeIds.has("evt-000002"));
    assert.ok(!activeIds.has("evt-000001"));
  });

  it("rejects missing supersession target", () => {
    const errors: string[] = [];
    resolveSupersession(
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
    resolveSupersession(
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
    const state = foldEvents(events, { sourceHash: "abc" });
    assert.equal(state.characters.sera.location, "medbay");
    assert.deepEqual(state.knowledge.sera.knows, ["Patient records show gaps"]);
    assert.equal(state.source_hash, "abc");
  });

  it("folds events in sequence order", () => {
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
    const state = foldEvents(events, { sourceHash: "x" });
    assert.equal(state.characters.sera.location, "bridge");
    assert.equal(state.event_count, 2);
  });

  it("skips superseded events and applies correction deltas", () => {
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
    const state = foldEvents(events, {
      sourceHash: "x",
      activeIds: new Set(["evt-000002"]),
    });
    assert.equal(state.characters.sera.location, "bridge");
    assert.equal(state.event_count, 1);
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
    const state = foldEvents(events, { sourceHash: "x" });
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
    const state = foldEvents(events, { initial, sourceHash: "x" });
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
    const state = foldEvents(events, { sourceHash: "x" });
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
    const state = foldEvents(events, { sourceHash: "x" });
    assert.equal(state.characters.sera.relationships.marcus, "ally");
    assert.equal(state.characters.sera.relationships.zed, "unknown");
    assert.deepEqual(Object.keys(state.characters.sera.relationships), ["marcus", "zed"]);
  });
});

describe("loadEvents", () => {
  it("returns validEvents + errors without crashing on bad files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fold-load-"));
    fs.writeFileSync(path.join(dir, "bad.json"), "{not-json", "utf8");
    fs.writeFileSync(
      path.join(dir, "evt-000001-scene-0001-approved.json"),
      JSON.stringify(baseEvent()),
      "utf8",
    );
    const result = loadEvents(dir);
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
    const result = loadEvents(dir);
    assert.equal(result.validEvents.length, 0);
    assert.ok(result.errors.length > 0);
    fs.rmSync(dir, { recursive: true, force: true });
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
    const result = runFold(paths, { checkOnly: true });
    assert.equal(result.ok, true);
    assert.equal(result.wrote, false);
    assert.ok(!fs.existsSync(derivedDir));

    fs.rmSync(bookDir, { recursive: true, force: true });
  });

  it("writes derived only when ok and not checkOnly", () => {
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
    const first = runFold(paths, { checkOnly: false });
    assert.equal(first.ok, true);
    assert.equal(first.wrote, true);
    assert.ok(fs.existsSync(path.join(paths.derivedDir, "_manifest.json")));

    const hash1 = first.derived!.source_hash;
    const second = runFold(paths, { checkOnly: false });
    assert.equal(second.derived!.source_hash, hash1);

    // Byte-stable derived output across runs
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

    const result = runFold(defaultPaths(bookDir), { checkOnly: false });
    assert.equal(result.ok, false);
    assert.equal(result.wrote, false);
    assert.ok(!fs.existsSync(derivedDir));

    fs.rmSync(bookDir, { recursive: true, force: true });
  });
});
