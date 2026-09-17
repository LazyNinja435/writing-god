/**
 * validate.ts — repository integrity checks.
 *
 * Usage: npx tsx scripts/validate.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runFold } from "./story-state/fold.ts";

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
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function err(errors: string[], msg: string): void {
  errors.push(msg);
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
    if (!exists(".ai/genres/genres.md")) err(errors, "Genre dispatcher missing");
  }

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

function validateExampleBookFold(errors: string[]): void {
  const book = "books/memory-echo";
  if (!exists(book)) return;
  const eventsDir = path.join(ROOT, book, "state", "events");
  if (!fs.existsSync(eventsDir)) return;

  const result = runFold(
    {
      bookDir: path.join(ROOT, book),
      eventsDir,
      derivedDir: path.join(ROOT, book, "state", "derived"),
    },
    new Date(),
  );
  for (const e of result.errors) err(errors, `Example book fold: ${e}`);
}

function main(): void {
  const errors: string[] = [];
  validateManifest(errors);
  validateExampleBookFold(errors);

  if (errors.length > 0) {
    console.error(`validate: FAILED (${errors.length} issue(s))`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("validate: OK — manifest, dispatchers, references, and example fold verified.");
}

main();
