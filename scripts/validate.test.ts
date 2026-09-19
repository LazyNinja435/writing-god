import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runValidate, validateApprovalLifecycle, type ApprovalRecord } from "./validate.ts";
import { runFold, defaultPaths } from "./story-state/fold.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLE = path.join(ROOT, ".ai/examples/books/memory-echo");

function sha256File(abs: string): string {
  const bytes = fs.readFileSync(abs);
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

/** Minimal fixture root that can run validateBookWorkspace paths via copied schemas. */
function makeFixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "validate-fix-"));
  fs.mkdirSync(path.join(root, ".ai", "schemas"), { recursive: true });
  fs.mkdirSync(path.join(root, ".ai", "templates"), { recursive: true });
  fs.mkdirSync(path.join(root, ".ai", "genres"), { recursive: true });
  fs.mkdirSync(path.join(root, ".ai", "rules"), { recursive: true });
  fs.mkdirSync(path.join(root, ".ai", "protocols"), { recursive: true });
  fs.mkdirSync(path.join(root, ".ai", "skills"), { recursive: true });
  fs.mkdirSync(path.join(root, ".ai", "agents"), { recursive: true });
  fs.mkdirSync(path.join(root, ".ai", "examples", "books"), { recursive: true });
  fs.mkdirSync(path.join(root, ".ai", "harnesses", "cursor"), { recursive: true });
  fs.mkdirSync(path.join(root, "books"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });

  // Copy all schemas from real repo so AJV validation works
  copyDir(path.join(ROOT, ".ai", "schemas"), path.join(root, ".ai", "schemas"));

  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Fixture\n", "utf8");
  fs.writeFileSync(path.join(root, ".ai/rules/rules.md"), "# Rules\n", "utf8");
  fs.writeFileSync(path.join(root, ".ai/protocols/protocols.md"), "# Protocols\n", "utf8");
  fs.writeFileSync(path.join(root, ".ai/genres/genres.md"), "# Genres\n", "utf8");
  fs.writeFileSync(path.join(root, ".ai/harnesses/cursor/README.md"), "# cursor\n", "utf8");
  fs.writeFileSync(path.join(root, "docs/architecture.md"), "# arch\n", "utf8");

  return root;
}

function writeMinimalManifest(root: string, overrides: Record<string, unknown> = {}): void {
  const manifest = {
    schema_version: "1.1.0",
    project: { name: "fixture" },
    mandatory_startup_files: ["AGENTS.md"],
    rule_categories: {},
    skill_categories: {},
    agent_categories: {},
    protocol_categories: {},
    genre_packs: {},
    available_templates: [],
    available_schemas: [
      { file: "book.schema.json" },
      { file: "scene-card.schema.json" },
      { file: "story-event.schema.json" },
      { file: "initial-state.schema.json" },
      { file: "approval.schema.json" },
      { file: "review-result.schema.json" },
      { file: "canon-proposal.schema.json" },
      { file: "story-thread.schema.json" },
    ],
    harness_adapters: {
      cursor: ".ai/harnesses/cursor/README.md",
    },
    directory_map: {
      entrypoint: "AGENTS.md",
      instructions: ".ai/",
    },
    example_books: [],
    ...overrides,
  };
  fs.writeFileSync(
    path.join(root, ".ai/manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
}

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
    const errors = runValidate(ROOT);
    assert.deepEqual(errors, [], errors.join("\n"));
  });

  it("does not write derived state", () => {
    const derived = path.join(EXAMPLE, "state", "derived");
    const before = fs.existsSync(derived);
    runValidate(ROOT);
    if (!before) {
      assert.ok(!fs.existsSync(derived));
    }
  });
});

describe("example book fold + approval hashes", () => {
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

    assert.deepEqual(first.derived!.active_event_ids, ["evt-000002"]);
    assert.ok(first.derived!.superseded_event_ids.includes("evt-000001"));
    assert.equal(first.derived!.total_event_count, 2);
    assert.equal(first.derived!.active_event_count, 1);
    assert.equal(first.derived!.superseded_event_count, 1);
    assert.equal(first.derived!.latest_recorded_event_id, "evt-000002");
    assert.equal(first.derived!.latest_recorded_sequence, 2);
    assert.equal(first.derived!.last_effective_event_id, "evt-000002");
  });

  it("draft hash == approval hash == approved scene hash", () => {
    const draft = path.join(EXAMPLE, "manuscript/drafts/scene-0001.md");
    const scene = path.join(EXAMPLE, "manuscript/scenes/scene-0001.md");
    const approval = JSON.parse(
      fs.readFileSync(path.join(EXAMPLE, "approvals/apr-000001-scene-0001.json"), "utf8"),
    ) as ApprovalRecord;

    const draftHash = sha256File(draft);
    const sceneHash = sha256File(scene);
    assert.equal(draftHash, sceneHash);
    assert.equal(approval.artifact_hash, draftHash);
    assert.equal(approval.source_artifact, "manuscript/drafts/scene-0001.md");
    assert.equal(approval.promotion_target, "manuscript/scenes/scene-0001.md");
  });
});

describe("runValidate negative fixtures", () => {
  it("missing manifest path", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "validate-nomans-"));
    const errors = runValidate(root);
    assert.ok(errors.some((e) => e.includes("Missing .ai/manifest.json")));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("broken dispatcher reference", () => {
    const root = makeFixtureRoot();
    writeMinimalManifest(root);
    fs.writeFileSync(
      path.join(root, "AGENTS.md"),
      "# Fixture\n\nSee `.ai/does-not-exist.md`.\n",
      "utf8",
    );
    const errors = runValidate(root);
    assert.ok(errors.some((e) => e.includes("Broken path ref") && e.includes("does-not-exist")));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("broken skill Related reference", () => {
    const root = makeFixtureRoot();
    writeMinimalManifest(root, {
      skill_categories: {
        orchestration: {
          path: ".ai/skills/orchestration/",
          skills: ["demo"],
        },
      },
    });
    const skillDir = path.join(root, ".ai/skills/orchestration/demo");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "# Demo\n\n## Related\n\n- Rules: `.ai/rules/missing-rule.md`\n",
      "utf8",
    );
    const errors = runValidate(root);
    assert.ok(errors.some((e) => e.includes("Broken path ref") && e.includes("missing-rule")));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("invalid schema JSON", () => {
    const root = makeFixtureRoot();
    writeMinimalManifest(root, {
      available_schemas: [{ file: "broken.schema.json" }],
    });
    fs.writeFileSync(
      path.join(root, ".ai/schemas/broken.schema.json"),
      "{not-json",
      "utf8",
    );
    const errors = runValidate(root);
    assert.ok(errors.some((e) => e.includes("Schema invalid JSON")));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("invalid book.yaml", () => {
    const root = makeFixtureRoot();
    const bookRel = ".ai/examples/books/bad-book";
    writeMinimalManifest(root, { example_books: [bookRel] });
    const bookDir = path.join(root, bookRel);
    fs.mkdirSync(bookDir, { recursive: true });
    fs.writeFileSync(path.join(bookDir, "book.yaml"), "title: [unterminated\n", "utf8");
    const errors = runValidate(root);
    assert.ok(errors.some((e) => e.includes("Invalid book.yaml") || e.includes("book.yaml")));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("invalid scene card", () => {
    const root = makeFixtureRoot();
    const bookRel = ".ai/examples/books/bad-scene";
    writeMinimalManifest(root, { example_books: [bookRel] });
    const bookDir = path.join(root, bookRel);
    fs.mkdirSync(path.join(bookDir, "planning", "scenes"), { recursive: true });
    fs.writeFileSync(
      path.join(bookDir, "book.yaml"),
      [
        "id: bad-scene",
        "title: Bad Scene",
        "status: drafting",
        "genre:",
        "  primary: literary",
        "human_approval:",
        "  scenes: true",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(bookDir, "planning/scenes/scene-0001.yaml"),
      "scene_id: not-valid-shape\n",
      "utf8",
    );
    const errors = runValidate(root);
    assert.ok(errors.some((e) => e.includes("Schema validation failed") && e.includes("scene")));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("invalid story event", () => {
    const root = makeFixtureRoot();
    const bookRel = ".ai/examples/books/bad-event";
    writeMinimalManifest(root, { example_books: [bookRel] });
    const bookDir = path.join(root, bookRel);
    fs.mkdirSync(path.join(bookDir, "state", "events"), { recursive: true });
    fs.writeFileSync(
      path.join(bookDir, "book.yaml"),
      [
        "id: bad-event",
        "title: Bad Event",
        "status: drafting",
        "genre:",
        "  primary: literary",
        "human_approval:",
        "  scenes: false",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(bookDir, "state/events/evt-000001.json"),
      JSON.stringify({ schema_version: "1.0", event_id: "nope" }),
      "utf8",
    );
    const errors = runValidate(root);
    assert.ok(
      errors.some(
        (e) =>
          e.includes("Schema validation failed") &&
          (e.includes("event") || e.includes("evt")),
      ),
    );
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("invalid initial state", () => {
    const root = makeFixtureRoot();
    const bookRel = ".ai/examples/books/bad-initial";
    writeMinimalManifest(root, { example_books: [bookRel] });
    const bookDir = path.join(root, bookRel);
    fs.mkdirSync(path.join(bookDir, "state"), { recursive: true });
    fs.writeFileSync(
      path.join(bookDir, "book.yaml"),
      [
        "id: bad-initial",
        "title: Bad Initial",
        "status: drafting",
        "genre:",
        "  primary: literary",
        "human_approval:",
        "  scenes: false",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(bookDir, "state/initial.json"),
      JSON.stringify({ schema_version: "1.0", knowledge: { sera: { knows: "x" } } }),
      "utf8",
    );
    const errors = runValidate(root);
    assert.ok(errors.some((e) => e.includes("Schema validation failed") && e.includes("initial")));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("stale approval hash", () => {
    const root = makeFixtureRoot();
    const bookRel = ".ai/examples/books/stale-apr";
    writeMinimalManifest(root, { example_books: [bookRel] });
    const bookDir = path.join(root, bookRel);
    fs.mkdirSync(path.join(bookDir, "manuscript/drafts"), { recursive: true });
    fs.mkdirSync(path.join(bookDir, "approvals"), { recursive: true });
    fs.writeFileSync(
      path.join(bookDir, "book.yaml"),
      [
        "id: stale-apr",
        "title: Stale",
        "status: drafting",
        "genre:",
        "  primary: literary",
        "human_approval:",
        "  scenes: true",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(path.join(bookDir, "manuscript/drafts/scene-0001.md"), "hello\n", "utf8");
    fs.writeFileSync(
      path.join(bookDir, "approvals/apr-000001.json"),
      JSON.stringify({
        schema_version: "1.1",
        approval_id: "apr-000001",
        artifact_type: "scene",
        source_artifact: "manuscript/drafts/scene-0001.md",
        artifact_hash:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        decision: "approved",
        approved_at: "2026-01-01T00:00:00.000Z",
        approved_by: "human",
        revision: 1,
      }),
      "utf8",
    );
    const errors = runValidate(root);
    assert.ok(errors.some((e) => e.includes("stale") && e.includes("hash mismatch")));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("missing approval source artifact", () => {
    const root = makeFixtureRoot();
    const bookRel = ".ai/examples/books/missing-src";
    writeMinimalManifest(root, { example_books: [bookRel] });
    const bookDir = path.join(root, bookRel);
    fs.mkdirSync(path.join(bookDir, "approvals"), { recursive: true });
    fs.writeFileSync(
      path.join(bookDir, "book.yaml"),
      [
        "id: missing-src",
        "title: Missing Src",
        "status: drafting",
        "genre:",
        "  primary: literary",
        "human_approval:",
        "  scenes: true",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(bookDir, "approvals/apr-000001.json"),
      JSON.stringify({
        schema_version: "1.1",
        approval_id: "apr-000001",
        artifact_type: "scene",
        source_artifact: "manuscript/drafts/missing.md",
        artifact_hash:
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        decision: "approved",
        approved_at: "2026-01-01T00:00:00.000Z",
        approved_by: "human",
      }),
      "utf8",
    );
    const errors = runValidate(root);
    assert.ok(errors.some((e) => e.includes("source artifact missing")));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("approval promotion target hash mismatch", () => {
    const root = makeFixtureRoot();
    const bookRel = ".ai/examples/books/promo-mismatch";
    writeMinimalManifest(root, { example_books: [bookRel] });
    const bookDir = path.join(root, bookRel);
    fs.mkdirSync(path.join(bookDir, "manuscript/drafts"), { recursive: true });
    fs.mkdirSync(path.join(bookDir, "manuscript/scenes"), { recursive: true });
    fs.mkdirSync(path.join(bookDir, "approvals"), { recursive: true });
    fs.writeFileSync(
      path.join(bookDir, "book.yaml"),
      [
        "id: promo-mismatch",
        "title: Promo Mismatch",
        "status: drafting",
        "genre:",
        "  primary: literary",
        "human_approval:",
        "  scenes: true",
      ].join("\n"),
      "utf8",
    );
    const draftPath = path.join(bookDir, "manuscript/drafts/scene-0001.md");
    fs.writeFileSync(draftPath, "approved draft bytes\n", "utf8");
    fs.writeFileSync(
      path.join(bookDir, "manuscript/scenes/scene-0001.md"),
      "different promoted bytes\n",
      "utf8",
    );
    const hash = sha256File(draftPath);
    fs.writeFileSync(
      path.join(bookDir, "approvals/apr-000001.json"),
      JSON.stringify({
        schema_version: "1.1",
        approval_id: "apr-000001",
        artifact_type: "scene",
        source_artifact: "manuscript/drafts/scene-0001.md",
        promotion_target: "manuscript/scenes/scene-0001.md",
        artifact_hash: hash,
        decision: "approved",
        approved_at: "2026-01-01T00:00:00.000Z",
        approved_by: "human",
      }),
      "utf8",
    );
    const errors = runValidate(root);
    assert.ok(errors.some((e) => e.includes("promotion target hash mismatch")));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("approved-but-waiting allows missing promotion target", () => {
    const errors: string[] = [];
    const bookDir = fs.mkdtempSync(path.join(os.tmpdir(), "apr-waiting-"));
    fs.mkdirSync(path.join(bookDir, "manuscript/drafts"), { recursive: true });
    const draft = path.join(bookDir, "manuscript/drafts/scene-0001.md");
    fs.writeFileSync(draft, "waiting\n", "utf8");
    const hash = sha256File(draft);
    validateApprovalLifecycle(
      bookDir,
      {
        decision: "approved",
        source_artifact: "manuscript/drafts/scene-0001.md",
        promotion_target: "manuscript/scenes/scene-0001.md",
        artifact_hash: hash,
      },
      "apr-test.json",
      errors,
    );
    assert.deepEqual(errors, []);
    fs.rmSync(bookDir, { recursive: true, force: true });
  });
});
