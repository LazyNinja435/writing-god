/**
 * validate.ts — repository integrity checks (read-only; no side effects on book state).
 *
 * Usage: npx tsx scripts/validate.ts
 *
 * Testable via runValidate(rootPath) against isolated fixtures.
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  createSchemaRegistry,
  schemasDirFromRoot,
  type SchemaRegistry,
} from "./lib/schema-validation.ts";
import { resolveBookRelativePath, BookPathError } from "./lib/book-paths.ts";
import { validateBookEventProvenance } from "./lib/provenance-validation.ts";
import {
  loadEvents,
  loadInitialState,
  resolveEffectiveHistory,
  checkDuplicateIds,
  checkSequenceUniqueness,
  type StoryEvent,
} from "./story-state/fold.ts";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Manifest {
  mandatory_startup_files?: string[];
  rule_categories?: Record<string, { path: string; files: string[] }>;
  skill_categories?: Record<string, { path: string; skills: string[] }>;
  agent_categories?: Record<string, { path: string; agents: string[] }>;
  protocol_categories?: Record<string, { path: string; protocols: string[] }>;
  genre_packs?: Record<string, string>;
  available_templates?: Array<{ file: string }>;
  available_schemas?: Array<{ file: string }>;
  harness_adapters?: Record<string, string>;
  directory_map?: Record<string, string>;
  story_state_model?: Record<string, unknown>;
  approval_model?: Record<string, unknown>;
  example_books?: string[];
}

export interface ApprovalRecord {
  schema_version?: string;
  approval_id?: string;
  artifact_type?: string;
  source_artifact?: string;
  promotion_target?: string;
  artifact_hash?: string;
  decision?: string;
  approved_at?: string;
  approved_by?: string;
  revision?: number;
  notes?: string;
}

function err(errors: string[], msg: string): void {
  errors.push(msg);
}

function existsIn(root: string, rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

function readJson(abs: string): unknown {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function readYaml(abs: string): unknown {
  return parseYaml(fs.readFileSync(abs, "utf8"));
}

function sha256Artifact(abs: string): string {
  const bytes = fs.readFileSync(abs);
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}

function validateAgainstSchema(
  registry: SchemaRegistry,
  errors: string[],
  label: string,
  schemaFile: string,
  data: unknown,
): void {
  const result = registry.validate(schemaFile, data, label);
  if (!result.ok) {
    for (const e of result.errors) err(errors, e);
  }
}

function extractBacktickedPaths(content: string): string[] {
  const matches = content.matchAll(/`((?:\.ai|books|scripts|docs|AGENTS\.md)[^`]*)`/g);
  const out: string[] = [];
  for (const m of matches) {
    const p = m[1];
    if (p.includes("<") || p.includes("*") || p.includes("...")) continue;
    if (p.endsWith("/")) continue;
    out.push(p);
  }
  return out;
}

function validateManifest(root: string, errors: string[]): Manifest {
  const manifestPath = path.join(root, ".ai/manifest.json");
  if (!fs.existsSync(manifestPath)) {
    err(errors, "Missing .ai/manifest.json");
    return {};
  }
  let manifest: Manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  } catch (e) {
    err(errors, `Invalid manifest JSON: ${(e as Error).message}`);
    return {};
  }

  for (const file of manifest.mandatory_startup_files ?? []) {
    if (!existsIn(root, file)) err(errors, `Mandatory startup file missing: ${file}`);
  }

  for (const [cat, info] of Object.entries(manifest.rule_categories ?? {})) {
    for (const file of info.files) {
      const rel = `${info.path}${file}`;
      if (!existsIn(root, rel)) err(errors, `Rule file missing [${cat}]: ${rel}`);
    }
  }

  for (const [cat, info] of Object.entries(manifest.skill_categories ?? {})) {
    for (const skill of info.skills ?? []) {
      const rel = `${info.path}${skill}/SKILL.md`;
      if (!existsIn(root, rel)) err(errors, `Skill missing [${cat}]: ${rel}`);
    }
  }

  for (const [cat, info] of Object.entries(manifest.agent_categories ?? {})) {
    for (const agent of info.agents ?? []) {
      const rel = `${info.path}${agent}.md`;
      if (!existsIn(root, rel)) err(errors, `Agent missing [${cat}]: ${rel}`);
    }
  }

  for (const [cat, info] of Object.entries(manifest.protocol_categories ?? {})) {
    for (const proto of info.protocols ?? []) {
      const rel = `${info.path}${proto}.md`;
      if (!existsIn(root, rel)) err(errors, `Protocol missing [${cat}]: ${rel}`);
    }
  }

  for (const [genre, packPath] of Object.entries(manifest.genre_packs ?? {})) {
    if (!existsIn(root, packPath)) err(errors, `Genre pack missing [${genre}]: ${packPath}`);
  }

  if (!existsIn(root, ".ai/genres/genres.md")) err(errors, "Genre dispatcher missing");

  for (const t of manifest.available_templates ?? []) {
    if (!existsIn(root, `.ai/templates/${t.file}`)) err(errors, `Template missing: ${t.file}`);
  }

  for (const s of manifest.available_schemas ?? []) {
    const rel = `.ai/schemas/${s.file}`;
    if (!existsIn(root, rel)) err(errors, `Schema missing: ${s.file}`);
    else {
      try {
        JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
      } catch (e) {
        err(errors, `Schema invalid JSON [${s.file}]: ${(e as Error).message}`);
      }
    }
  }

  for (const [name, rel] of Object.entries(manifest.harness_adapters ?? {})) {
    if (!existsIn(root, rel)) err(errors, `Harness adapter missing [${name}]: ${rel}`);
  }

  for (const [key, rel] of Object.entries(manifest.directory_map ?? {})) {
    if (typeof rel !== "string") continue;
    if (rel.includes("<")) continue;
    if (!existsIn(root, rel) && !rel.endsWith("/")) {
      err(errors, `directory_map missing [${key}]: ${rel}`);
    } else if (rel.endsWith("/") && !existsIn(root, rel)) {
      err(errors, `directory_map missing dir [${key}]: ${rel}`);
    }
  }

  const dispatchers = [
    ".ai/rules/rules.md",
    ".ai/protocols/protocols.md",
    ".ai/genres/genres.md",
    "AGENTS.md",
  ];
  for (const d of dispatchers) {
    if (!existsIn(root, d)) err(errors, `Dispatcher missing: ${d}`);
  }

  return manifest;
}

function validateDispatcherRefs(root: string, errors: string[]): void {
  const files = [
    ".ai/rules/rules.md",
    ".ai/protocols/protocols.md",
    ".ai/genres/genres.md",
    "AGENTS.md",
  ];
  for (const rel of files) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, "utf8");
    for (const ref of extractBacktickedPaths(content)) {
      if (!existsIn(root, ref)) err(errors, `Broken path ref in ${rel}: ${ref}`);
    }
  }
}

function walkMdFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMdFiles(full, acc);
    else if (entry.name.endsWith(".md")) acc.push(full);
  }
  return acc;
}

function validateSkillAgentProtocolRefs(root: string, errors: string[]): void {
  const roots = [
    path.join(root, ".ai/skills"),
    path.join(root, ".ai/agents"),
    path.join(root, ".ai/protocols"),
  ];
  for (const skillRoot of roots) {
    for (const abs of walkMdFiles(skillRoot)) {
      const rel = path.relative(root, abs).replace(/\\/g, "/");
      const content = fs.readFileSync(abs, "utf8");
      for (const ref of extractBacktickedPaths(content)) {
        if (!existsIn(root, ref)) err(errors, `Broken path ref in ${rel}: ${ref}`);
      }
    }
  }
}

function listBookDirs(root: string, baseRel: string): string[] {
  const abs = path.join(root, baseRel);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => path.join(baseRel, d.name).replace(/\\/g, "/"));
}

function walkFiles(dir: string, exts: string[], acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, exts, acc);
    else if (exts.some((e) => entry.name.endsWith(e))) acc.push(full);
  }
  return acc;
}

/**
 * Validate an approved record's source / promotion lifecycle.
 *
 * - source_artifact must exist and match artifact_hash
 * - If promotion_target is set and differs from source:
 *   - missing target → approved but awaiting promotion (OK)
 *   - present target → hash must equal artifact_hash (promotion completed)
 * Paths must stay inside the book workspace.
 */
export function validateApprovalLifecycle(
  bookAbs: string,
  data: ApprovalRecord,
  fileLabel: string,
  errors: string[],
): void {
  if (data.decision !== "approved") return;

  const source = data.source_artifact;
  if (!source) {
    err(errors, `Approval ${fileLabel}: approved record missing source_artifact`);
    return;
  }
  if (!data.artifact_hash) {
    err(errors, `Approval ${fileLabel}: approved record missing artifact_hash`);
    return;
  }

  let sourceAbs: string;
  try {
    sourceAbs = resolveBookRelativePath(bookAbs, source);
  } catch (e) {
    const msg = e instanceof BookPathError ? e.message : (e as Error).message;
    err(errors, `Approval ${fileLabel}: unsafe source_artifact ${source}: ${msg}`);
    return;
  }

  if (!fs.existsSync(sourceAbs)) {
    err(errors, `Approval ${fileLabel} source artifact missing: ${source}`);
  } else {
    const hash = sha256Artifact(sourceAbs);
    if (hash !== data.artifact_hash) {
      err(
        errors,
        `Approval ${fileLabel} stale: source artifact hash mismatch for ${source}`,
      );
    }
  }

  const target = data.promotion_target;
  if (target && target !== source) {
    let targetAbs: string;
    try {
      targetAbs = resolveBookRelativePath(bookAbs, target);
    } catch (e) {
      const msg = e instanceof BookPathError ? e.message : (e as Error).message;
      err(errors, `Approval ${fileLabel}: unsafe promotion_target ${target}: ${msg}`);
      return;
    }
    if (fs.existsSync(targetAbs)) {
      const targetHash = sha256Artifact(targetAbs);
      if (targetHash !== data.artifact_hash) {
        err(
          errors,
          `Approval ${fileLabel} promotion target hash mismatch for ${target}`,
        );
      }
    }
    // else: approved-but-waiting — target not required yet
  }
}

export function validateBookWorkspace(
  root: string,
  errors: string[],
  bookRel: string,
  registry: SchemaRegistry,
): void {
  const bookAbs = path.join(root, bookRel);
  const bookYaml = path.join(bookAbs, "book.yaml");
  if (!fs.existsSync(bookYaml)) {
    err(errors, `Book missing book.yaml: ${bookRel}`);
    return;
  }

  let bookData: unknown;
  try {
    bookData = readYaml(bookYaml);
  } catch (e) {
    err(errors, `Invalid book.yaml YAML [${bookRel}]: ${(e as Error).message}`);
    return;
  }
  validateAgainstSchema(registry, errors, `${bookRel}/book.yaml`, "book.schema.json", bookData);

  const scenesDir = path.join(bookAbs, "planning", "scenes");
  if (fs.existsSync(scenesDir)) {
    for (const file of fs.readdirSync(scenesDir).filter((f) => f.endsWith(".yaml"))) {
      const abs = path.join(scenesDir, file);
      try {
        const data = readYaml(abs);
        validateAgainstSchema(
          registry,
          errors,
          `${bookRel}/planning/scenes/${file}`,
          "scene-card.schema.json",
          data,
        );
      } catch (e) {
        err(
          errors,
          `Invalid scene card [${bookRel}/planning/scenes/${file}]: ${(e as Error).message}`,
        );
      }
    }
  }

  const initialPath = path.join(bookAbs, "state", "initial.json");
  if (fs.existsSync(initialPath)) {
    try {
      const data = readJson(initialPath);
      validateAgainstSchema(
        registry,
        errors,
        `${bookRel}/state/initial.json`,
        "initial-state.schema.json",
        data,
      );
    } catch (e) {
      err(errors, `Invalid initial state [${bookRel}]: ${(e as Error).message}`);
    }
  }

  const eventsDir = path.join(bookAbs, "state", "events");
  if (fs.existsSync(eventsDir)) {
    for (const file of fs.readdirSync(eventsDir).filter((f) => f.endsWith(".json"))) {
      const abs = path.join(eventsDir, file);
      try {
        const data = readJson(abs);
        validateAgainstSchema(
          registry,
          errors,
          `${bookRel}/state/events/${file}`,
          "story-event.schema.json",
          data,
        );
      } catch (e) {
        err(
          errors,
          `Invalid event JSON [${bookRel}/state/events/${file}]: ${(e as Error).message}`,
        );
      }
    }

    const loaded = loadEvents(eventsDir, registry);
    for (const e of loaded.errors) err(errors, `Event load [${bookRel}]: ${e}`);
    checkDuplicateIds(loaded.validEvents, errors);
    checkSequenceUniqueness(loaded.validEvents, errors);
    resolveEffectiveHistory(loaded.validEvents, errors);
    validateBookEventProvenance(bookAbs, loaded.validEvents as StoryEvent[], errors);
  }

  const approvalsDir = path.join(bookAbs, "approvals");
  if (fs.existsSync(approvalsDir)) {
    for (const file of fs.readdirSync(approvalsDir).filter((f) => f.endsWith(".json"))) {
      const abs = path.join(approvalsDir, file);
      try {
        const data = readJson(abs) as ApprovalRecord;
        validateAgainstSchema(
          registry,
          errors,
          `${bookRel}/approvals/${file}`,
          "approval.schema.json",
          data,
        );
        validateApprovalLifecycle(bookAbs, data, file, errors);
      } catch (e) {
        err(errors, `Invalid approval [${bookRel}/approvals/${file}]: ${(e as Error).message}`);
      }
    }
  }

  const reviewsRoot = path.join(bookAbs, "reviews");
  if (fs.existsSync(reviewsRoot)) {
    for (const abs of walkFiles(reviewsRoot, [".yaml", ".yml"])) {
      const relFromBook = path.relative(bookAbs, abs).replace(/\\/g, "/");
      try {
        const data = readYaml(abs);
        validateAgainstSchema(
          registry,
          errors,
          `${bookRel}/${relFromBook}`,
          "review-result.schema.json",
          data,
        );
      } catch (e) {
        err(errors, `Invalid review [${bookRel}/${relFromBook}]: ${(e as Error).message}`);
      }
    }
  }

  const threadsDir = path.join(bookAbs, "planning", "threads");
  if (fs.existsSync(threadsDir)) {
    for (const file of fs
      .readdirSync(threadsDir)
      .filter((f) => f.endsWith(".md") || f.endsWith(".yaml") || f.endsWith(".json"))) {
      if (file.endsWith(".yaml") || file.endsWith(".json")) {
        const abs = path.join(threadsDir, file);
        try {
          const data = file.endsWith(".json") ? readJson(abs) : readYaml(abs);
          validateAgainstSchema(
            registry,
            errors,
            `${bookRel}/planning/threads/${file}`,
            "story-thread.schema.json",
            data,
          );
        } catch (e) {
          err(
            errors,
            `Invalid thread [${bookRel}/planning/threads/${file}]: ${(e as Error).message}`,
          );
        }
      }
    }
  }

  const proposalsDir = path.join(bookAbs, "canon", "proposals");
  if (fs.existsSync(proposalsDir)) {
    for (const file of fs
      .readdirSync(proposalsDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".json"))) {
      const abs = path.join(proposalsDir, file);
      try {
        const data = file.endsWith(".json") ? readJson(abs) : readYaml(abs);
        validateAgainstSchema(
          registry,
          errors,
          `${bookRel}/canon/proposals/${file}`,
          "canon-proposal.schema.json",
          data,
        );
      } catch (e) {
        err(
          errors,
          `Invalid canon proposal [${bookRel}/canon/proposals/${file}]: ${(e as Error).message}`,
        );
      }
    }
  }

  const foldErrors: string[] = [];
  loadInitialState(initialPath, foldErrors, registry);
  for (const e of foldErrors) err(errors, e);
}

function validateExampleAndUserBooks(
  root: string,
  errors: string[],
  manifest: Manifest,
  registry: SchemaRegistry,
): void {
  const exampleBooks = manifest.example_books ?? [".ai/examples/books/memory-echo"];
  for (const book of exampleBooks) {
    if (!existsIn(root, book)) {
      err(errors, `Example book missing: ${book}`);
      continue;
    }
    validateBookWorkspace(root, errors, book, registry);
  }

  for (const book of listBookDirs(root, "books")) {
    validateBookWorkspace(root, errors, book, registry);
  }

  if (existsIn(root, "books/memory-echo")) {
    err(
      errors,
      "Example book must not live under books/memory-echo; use .ai/examples/books/memory-echo/",
    );
  }
}

/**
 * Run repository validation against rootPath (defaults to repo root).
 * Read-only: never writes book state or derived files.
 */
export function runValidate(rootPath: string = DEFAULT_ROOT): string[] {
  const root = path.resolve(rootPath);
  const errors: string[] = [];
  const registry = createSchemaRegistry(schemasDirFromRoot(root));
  const manifest = validateManifest(root, errors);
  validateDispatcherRefs(root, errors);
  validateSkillAgentProtocolRefs(root, errors);
  validateExampleAndUserBooks(root, errors, manifest, registry);
  return errors;
}

function main(): void {
  const errors = runValidate();
  if (errors.length > 0) {
    console.error(`validate: FAILED (${errors.length} issue(s))`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    "validate: OK — manifest, dispatchers, schema validation, and example book verified (no writes).",
  );
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  main();
}
