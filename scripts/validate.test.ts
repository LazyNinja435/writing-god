import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("validate prerequisites", () => {
  it("manifest.json exists and parses", () => {
    const raw = fs.readFileSync(path.join(ROOT, ".ai/manifest.json"), "utf8");
    const manifest = JSON.parse(raw);
    assert.equal(manifest.project.name, "ai-author-orchestration");
    assert.equal(manifest.compatibility.harness_agnostic, true);
  });

  it("AGENTS.md exists", () => {
    assert.ok(fs.existsSync(path.join(ROOT, "AGENTS.md")));
  });
});
