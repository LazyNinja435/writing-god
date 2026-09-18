import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runValidate } from "./validate.ts";
import { runFold, defaultPaths } from "./story-state/fold.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLE = path.join(ROOT, ".ai/examples/books/memory-echo");

describe("validate prerequisites", () => {
  it("manifest.json exists and parses", () => {
    const raw = fs.readFileSync(path.join(ROOT, ".ai/manifest.json"), "utf8");
    const manifest = JSON.parse(raw);
    assert.equal(manifest.project.name, "ai-author-orchestration");
    assert.equal(manifest.compatibility.harness_agnostic, true);
    assert.ok(manifest.example_books.includes(".ai/examples/books/memory-echo"));
    assert.ok(manifest.skill_categories.orchestration.skills.includes("verify-approval"));
  });

  it("AGENTS.md exists", () => {
    assert.ok(fs.existsSync(path.join(ROOT, "AGENTS.md")));
  });

  it("example book is not under books/", () => {
    assert.ok(!fs.existsSync(path.join(ROOT, "books/memory-echo")));
    assert.ok(fs.existsSync(EXAMPLE));
  });
});

describe("runValidate", () => {
  it("passes on the repository", () => {
    const errors = runValidate();
    assert.deepEqual(errors, [], errors.join("\n"));
  });

  it("does not write derived state", () => {
    const derived = path.join(EXAMPLE, "state", "derived");
    const before = fs.existsSync(derived);
    runValidate();
    // validate may leave derived absent; must not create it as a side effect of check
    if (!before) {
      assert.ok(!fs.existsSync(derived));
    }
  });
});

describe("example book fold", () => {
  it("fold:check is read-only and ok", () => {
    const derived = path.join(EXAMPLE, "state", "derived");
    if (fs.existsSync(derived)) {
      fs.rmSync(derived, { recursive: true, force: true });
    }
    const result = runFold(defaultPaths(EXAMPLE), { checkOnly: true });
    assert.equal(result.ok, true, result.errors.join("\n"));
    assert.equal(result.wrote, false);
    assert.ok(!fs.existsSync(derived));
  });

  it("fold write is deterministic across two runs", () => {
    const paths = defaultPaths(EXAMPLE);
    const first = runFold(paths, { checkOnly: false });
    assert.equal(first.ok, true, first.errors.join("\n"));
    const m1 = fs.readFileSync(path.join(paths.derivedDir, "_manifest.json"), "utf8");
    const chars1 = fs.readFileSync(path.join(paths.derivedDir, "current-characters.json"), "utf8");

    const second = runFold(paths, { checkOnly: false });
    assert.equal(second.ok, true);
    const m2 = fs.readFileSync(path.join(paths.derivedDir, "_manifest.json"), "utf8");
    const chars2 = fs.readFileSync(path.join(paths.derivedDir, "current-characters.json"), "utf8");
    assert.equal(m1, m2);
    assert.equal(chars1, chars2);
    assert.equal(first.derived!.source_hash, second.derived!.source_hash);

    // Active event should be the correction
    assert.deepEqual(first.derived!.active_event_ids, ["evt-000002"]);
    assert.ok(first.derived!.superseded_event_ids.includes("evt-000001"));
  });
});
