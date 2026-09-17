import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  foldEvents,
  sortEvents,
  checkDuplicateIds,
  type StoryEvent,
} from "./fold.ts";

const baseEvent = (overrides: Partial<StoryEvent> = {}): StoryEvent => ({
  schema_version: "1.0",
  event_id: "scene-0001",
  scene_id: "scene-0001",
  sequence: 1,
  status: "canon",
  changes: {},
  ...overrides,
});

describe("sortEvents", () => {
  it("orders by sequence then event_id", () => {
    const events = [
      baseEvent({ event_id: "scene-0002", sequence: 2 }),
      baseEvent({ event_id: "scene-0001", sequence: 1 }),
    ];
    const sorted = sortEvents(events);
    assert.equal(sorted[0].event_id, "scene-0001");
    assert.equal(sorted[1].event_id, "scene-0002");
  });
});

describe("checkDuplicateIds", () => {
  it("detects duplicate event IDs", () => {
    const errors: string[] = [];
    checkDuplicateIds([
      baseEvent({ event_id: "scene-0001" }),
      baseEvent({ event_id: "scene-0001" }),
    ], errors);
    assert.ok(errors.some((e) => e.includes("Duplicate")));
  });
});

describe("foldEvents", () => {
  it("applies character location and knowledge", () => {
    const events = [
      baseEvent({
        changes: {
          characters: {
            sera: {
              location: "medbay",
              knowledge_added: ["Patient records show gaps"],
            },
          },
        },
      }),
    ];
    const state = foldEvents(events, "2026-01-01T00:00:00.000Z");
    assert.equal(state.characters.sera.location, "medbay");
    assert.deepEqual(state.knowledge.sera.knows, ["Patient records show gaps"]);
  });

  it("folds events in sequence order", () => {
    const events = [
      baseEvent({
        event_id: "scene-0002",
        scene_id: "scene-0002",
        sequence: 2,
        changes: {
          characters: { sera: { location: "bridge" } },
        },
      }),
      baseEvent({
        event_id: "scene-0001",
        scene_id: "scene-0001",
        sequence: 1,
        changes: {
          characters: { sera: { location: "medbay" } },
        },
      }),
    ];
    const state = foldEvents(events, "2026-01-01T00:00:00.000Z");
    assert.equal(state.characters.sera.location, "bridge");
    assert.equal(state.event_count, 2);
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
    const state = foldEvents(events, "2026-01-01T00:00:00.000Z");
    assert.equal(state.threads["memory-gaps"].state, "advanced");
    assert.equal(state.threads["memory-gaps"].last_scene, "scene-0001");
  });

  it("ignores retconned events", () => {
    const events = [
      baseEvent({
        status: "retconned",
        changes: {
          characters: { sera: { location: "void" } },
        },
      }),
    ];
    const state = foldEvents(events, "2026-01-01T00:00:00.000Z");
    assert.equal(state.event_count, 0);
    assert.equal(state.characters.sera, undefined);
  });

  it("tracks inventory changes", () => {
    const events = [
      baseEvent({
        changes: {
          inventory: {
            sera: { gained: ["data-pad"], lost: [] },
          },
        },
      }),
    ];
    const state = foldEvents(events, "2026-01-01T00:00:00.000Z");
    assert.deepEqual(state.inventory.sera, ["data-pad"]);
  });
});
