/**
 * validate.ts — repository integrity checks (read-only; no side effects on book state).
 *
 * Usage: npx tsx scripts/validate.ts
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { parse as parseYaml } from "yaml";
import { loadEvents, loadInitialState, resolveSupersession, checkDuplicateIds, checkSequenceUniqueness } from "./story-state/fold.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = new Map<string, ValidateFunction>();

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function err(errors: string[], msg: string): void {
  errors.push(msg);
}

function loadSchema(name: string): ValidateFunction | null {
  if (validators.has(name)) return validators.get(name)!;
  const schemaPath = path.join(ROOT, ".ai/schemas", name);
  if (!fs.existsSync(schemaPath)) return null;
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const validate = ajv.compile(schema);
  validators.set(name, validate);
  return validate;
}

function formatAjvErrors(validate: ValidateFunction): string {
  return (validate.errors ?? [])
    .map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`)
    .join("; ");
}

function readJson(abs: string): unknown {
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function readYaml(abs: string): unknown {
  return parseYaml(fs.readFileSync(abs, "utf8"));
}

function validateAgainstSchema(
  errors: string[],
  label: string,
  schemaFile: string,
  data: unknown,
): void {
  const validate = loadSchema(schemaFile);
  if (!validate) {
    err(errors, `Schema missing for validation: ${schemaFile}`);
    return;
  }
  if (!validate(data)) {
    err(errors, `Schema validation failed [${label}]: ${formatAjvErrors(validate)}`);
  }
}

function extractBacktickedPaths(content: string): string[] {
  const matches = content.matchAll(/`((?:\.ai|books|scripts|docs|AGENTS\.md)[^`]*)`/g);
  const out: string[] = [];
  for (const m of matches) {
    let p = m[1];
    // Skip placeholders
    if (p.includes("<") || p.includes("*") || p.includes("...")) continue;
    // Normalize directory refs ending with /
    if (p.endsWith("/")) continue;
    out.push(p);
  }
  return out;
}

function validateManifest(errors: string[]): Manifest {
  const manifestPath = path.join(ROOT, ".ai/manifest.json");
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
    if (!exists(file)) err(errors, `Mandatory startup file missing: ${file}`);
  }

  for (const [cat, info] of Object.entries(manifest.rule_categories ?? {})) {
    for (const file of info.files) {
      const rel = `${info.path}${file}`;
      if (!exists(rel)) err(errors, `Rule file missing [${cat}]: ${rel}`);
    }
  }

  for (const [cat, info] of Object.entries(manifest.skill_categories ?? {})) {
    for (const skill of info.skills ?? []) {
      const rel = `${info.path}${skill}/SKILL.md`;
      if (!exists(rel)) err(errors, `Skill missing [${cat}]: ${rel}`);
    }
  }

  for (const [cat, info] of Object.entries(manifest.agent_categories ?? {})) {
    for (const agent of info.agents ?? []) {
      const rel = `${info.path}${agent}.md`;
      if (!exists(rel)) err(errors, `Agent missing [${cat}]: ${rel}`);
    }
  }

  for (const [cat, info] of Object.entries(manifest.protocol_categories ?? {})) {
    for (const proto of info.protocols ?? []) {
      const rel = `${info.path}${proto}.md`;
      if (!exists(rel)) err(errors, `Protocol missing [${cat}]: ${rel}`);
    }
  }

  for (const [genre, packPath] of Object.entries(manifest.genre_packs ?? {})) {
    if (!exists(packPath)) err(errors, `Genre pack missing [${genre}]: ${packPath}`);
  }

  if (!exists(".ai/genres/genres.md")) err(errors, "Genre dispatcher missing");

  for (const t of manifest.available_templates ?? []) {
    if (!exists(`.ai/templates/${t.file}`)) err(errors, `Template missing: ${t.file}`);
  }

  for (const s of manifest.available_schemas ?? []) {
    const rel = `.ai/schemas/${s.file}`;
    if (!exists(rel)) err(errors, `Schema missing: ${s.file}`);
    else {
      try {
        JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
      } catch (e) {
        err(errors, `Schema invalid JSON [${s.file}]: ${(e as Error).message}`);
      }
    }
  }

  for (const [name, rel] of Object.entries(manifest.harness_adapters ?? {})) {
    if (!exists(rel)) err(errors, `Harness adapter missing [${name}]: ${rel}`);
  }

  for (const [key, rel] of Object.entries(manifest.directory_map ?? {})) {
    if (typeof rel !== "string") continue;
    // Skip patterns with placeholders
    if (rel.includes("<")) continue;
    if (!exists(rel) && !rel.endsWith("/")) {
      err(errors, `directory_map missing [${key}]: ${rel}`);
    } else if (rel.endsWith("/") && !exists(rel)) {
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
    if (!exists(d)) err(errors, `Dispatcher missing: ${d}`);
  }

  return manifest;
}

function validateDispatcherRefs(errors: string[]): void {
  const files = [
    ".ai/rules/rules.md",
    ".ai/protocols/protocols.md",
    ".ai/genres/genres.md",
    "AGENTS.md",
  ];
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, "utf8");
    for (const ref of extractBacktickedPaths(content)) {
      if (!exists(ref)) err(errors, `Broken path ref in ${rel}: ${ref}`);
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

function validateSkillAgentProtocolRefs(errors: string[]): void {
  const roots = [
    path.join(ROOT, ".ai/skills"),
    path.join(ROOT, ".ai/agents"),
    path.join(ROOT, ".ai/protocols"),
  ];
  for (const root of roots) {
    for (const abs of walkMdFiles(root)) {
      const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
      const content = fs.readFileSync(abs, "utf8");
      for (const ref of extractBacktickedPaths(content)) {
        if (!exists(ref)) err(errors, `Broken path ref in ${rel}: ${ref}`);
      }
    }
  }
}

function listBookDirs(baseRel: string): string[] {
  const abs = path.join(ROOT, baseRel);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => path.join(baseRel, d.name).replace(/\\/g, "/"));
}

function validateBookWorkspace(errors: string[], bookRel: string): void {
  const bookAbs = path.join(ROOT, bookRel);
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
  validateAgainstSchema(errors, `${bookRel}/book.yaml`, "book.schema.json", bookData);

  // Scene cards
  const scenesDir = path.join(bookAbs, "planning", "scenes");
  if (fs.existsSync(scenesDir)) {
    for (const file of fs.readdirSync(scenesDir).filter((f) => f.endsWith(".yaml"))) {
      const abs = path.join(scenesDir, file);
      try {
        const data = readYaml(abs);
        validateAgainstSchema(errors, `${bookRel}/planning/scenes/${file}`, "scene-card.schema.json", data);
      } catch (e) {
        err(errors, `Invalid scene card [${bookRel}/planning/scenes/${file}]: ${(e as Error).message}`);
      }
    }
  }

  // Initial state
  const initialPath = path.join(bookAbs, "state", "initial.json");
  if (fs.existsSync(initialPath)) {
    try {
      const data = readJson(initialPath);
      validateAgainstSchema(errors, `${bookRel}/state/initial.json`, "initial-state.schema.json", data);
    } catch (e) {
      err(errors, `Invalid initial state [${bookRel}]: ${(e as Error).message}`);
    }
  }

  // Events — schema + fold structural validation (read-only, no write)
  const eventsDir = path.join(bookAbs, "state", "events");
  if (fs.existsSync(eventsDir)) {
    for (const file of fs.readdirSync(eventsDir).filter((f) => f.endsWith(".json"))) {
      const abs = path.join(eventsDir, file);
      try {
        const data = readJson(abs);
        validateAgainstSchema(errors, `${bookRel}/state/events/${file}`, "story-event.schema.json", data);
      } catch (e) {
        err(errors, `Invalid event JSON [${bookRel}/state/events/${file}]: ${(e as Error).message}`);
      }
    }

    const loaded = loadEvents(eventsDir);
    for (const e of loaded.errors) err(errors, `Event load [${bookRel}]: ${e}`);
    checkDuplicateIds(loaded.validEvents, errors);
    checkSequenceUniqueness(loaded.validEvents, errors);
    resolveSupersession(loaded.validEvents, errors);
  }

  // Approvals
  const approvalsDir = path.join(bookAbs, "approvals");
  if (fs.existsSync(approvalsDir)) {
    for (const file of fs.readdirSync(approvalsDir).filter((f) => f.endsWith(".json"))) {
      const abs = path.join(approvalsDir, file);
      try {
        const data = readJson(abs) as {
          artifact?: string;
          artifact_hash?: string;
          decision?: string;
        };
        validateAgainstSchema(errors, `${bookRel}/approvals/${file}`, "approval.schema.json", data);

        // Hash binding check when approved
        if (data.decision === "approved" && data.artifact && data.artifact_hash) {
          const artifactAbs = path.join(bookAbs, data.artifact);
          if (!fs.existsSync(artifactAbs)) {
            err(errors, `Approval ${file} artifact missing: ${data.artifact}`);
          } else {
            const bytes = fs.readFileSync(artifactAbs);
            const hash =
              "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
            if (hash !== data.artifact_hash) {
              err(
                errors,
                `Approval ${file} stale: artifact hash mismatch for ${data.artifact}`,
              );
            }
          }
        }
      } catch (e) {
        err(errors, `Invalid approval [${bookRel}/approvals/${file}]: ${(e as Error).message}`);
      }
    }
  }

  // Reviews (optional schema)
  const reviewsRoot = path.join(bookAbs, "reviews");
  if (fs.existsSync(reviewsRoot)) {
    for (const abs of walkFiles(reviewsRoot, [".yaml", ".yml"])) {
      const relFromBook = path.relative(bookAbs, abs).replace(/\\/g, "/");
      try {
        const data = readYaml(abs);
        validateAgainstSchema(errors, `${bookRel}/${relFromBook}`, "review-result.schema.json", data);
      } catch (e) {
        err(errors, `Invalid review [${bookRel}/${relFromBook}]: ${(e as Error).message}`);
      }
    }
  }

  // Threads
  const threadsDir = path.join(bookAbs, "planning", "threads");
  if (fs.existsSync(threadsDir)) {
    for (const file of fs.readdirSync(threadsDir).filter((f) => f.endsWith(".md") || f.endsWith(".yaml") || f.endsWith(".json"))) {
      if (file.endsWith(".yaml") || file.endsWith(".json")) {
        const abs = path.join(threadsDir, file);
        try {
          const data = file.endsWith(".json") ? readJson(abs) : readYaml(abs);
          validateAgainstSchema(errors, `${bookRel}/planning/threads/${file}`, "story-thread.schema.json", data);
        } catch (e) {
          err(errors, `Invalid thread [${bookRel}/planning/threads/${file}]: ${(e as Error).message}`);
        }
      }
    }
  }

  // Canon proposals if present as structured files
  const proposalsDir = path.join(bookAbs, "canon", "proposals");
  if (fs.existsSync(proposalsDir)) {
    for (const file of fs.readdirSync(proposalsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".json"))) {
      const abs = path.join(proposalsDir, file);
      try {
        const data = file.endsWith(".json") ? readJson(abs) : readYaml(abs);
        validateAgainstSchema(errors, `${bookRel}/canon/proposals/${file}`, "canon-proposal.schema.json", data);
      } catch (e) {
        err(errors, `Invalid canon proposal [${bookRel}/canon/proposals/${file}]: ${(e as Error).message}`);
      }
    }
  }

  // Ensure initial.json load does not throw
  const foldErrors: string[] = [];
  loadInitialState(initialPath, foldErrors);
  for (const e of foldErrors) err(errors, e);
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

function validateExampleAndUserBooks(errors: string[], manifest: Manifest): void {
  const exampleBooks = manifest.example_books ?? [".ai/examples/books/memory-echo"];
  for (const book of exampleBooks) {
    if (!exists(book)) {
      err(errors, `Example book missing: ${book}`);
      continue;
    }
    validateBookWorkspace(errors, book);
  }

  // User books under books/ (none required)
  for (const book of listBookDirs("books")) {
    validateBookWorkspace(errors, book);
  }

  // Guard: example must not also live under books/ as active book
  if (exists("books/memory-echo")) {
    err(
      errors,
      "Example book must not live under books/memory-echo; use .ai/examples/books/memory-echo/",
    );
  }
}

export function runValidate(): string[] {
  const errors: string[] = [];
  const manifest = validateManifest(errors);
  validateDispatcherRefs(errors);
  validateSkillAgentProtocolRefs(errors);
  validateExampleAndUserBooks(errors, manifest);
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
