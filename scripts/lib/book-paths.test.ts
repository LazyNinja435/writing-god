import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveBookRelativePath, BookPathError, toBookRelativePosix } from "./book-paths.ts";

describe("resolveBookRelativePath", () => {
  it("resolves a normal relative path inside the book", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "book-path-"));
    const abs = resolveBookRelativePath(root, "manuscript/scenes/scene-0001.md");
    assert.equal(abs, path.resolve(root, "manuscript", "scenes", "scene-0001.md"));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("rejects parent traversal", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "book-path-"));
    assert.throws(
      () => resolveBookRelativePath(root, "../outside.md"),
      (e: unknown) => e instanceof BookPathError && /escape|\.\./i.test((e as Error).message),
    );
    assert.throws(
      () => resolveBookRelativePath(root, "manuscript/../../etc/passwd"),
      BookPathError,
    );
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("rejects absolute POSIX-style paths", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "book-path-"));
    assert.throws(() => resolveBookRelativePath(root, "/etc/passwd"), BookPathError);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("rejects Windows absolute paths", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "book-path-"));
    assert.throws(() => resolveBookRelativePath(root, "C:\\Windows\\System32"), BookPathError);
    assert.throws(() => resolveBookRelativePath(root, "D:/secrets/file.md"), BookPathError);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("rejects empty path", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "book-path-"));
    assert.throws(() => resolveBookRelativePath(root, ""), BookPathError);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("toBookRelativePosix round-trips", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "book-path-"));
    const abs = resolveBookRelativePath(root, "approvals/apr-000001.json");
    assert.equal(toBookRelativePosix(root, abs), "approvals/apr-000001.json");
    fs.rmSync(root, { recursive: true, force: true });
  });
});
