/**
 * Book-local path safety: resolve a book-relative path that must stay inside bookRoot.
 * Rejects absolute paths, Windows drive paths, UNC, and any `..` escape.
 */
import * as path from "node:path";

export class BookPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookPathError";
  }
}

function isWindowsAbsolute(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("\\\\") || p.startsWith("//");
}

/**
 * Resolve `relativePath` against `bookRoot`, ensuring the result stays inside the book.
 * Returns a normalized absolute path using platform separators.
 */
export function resolveBookRelativePath(bookRoot: string, relativePath: string): string {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new BookPathError("Path must be a non-empty book-relative string");
  }
  if (relativePath.includes("\0")) {
    throw new BookPathError("Path must not contain null bytes");
  }
  // Normalize separators for checks; reject absolute forms before join
  const normalizedInput = relativePath.replace(/\\/g, "/");
  if (path.isAbsolute(relativePath) || path.isAbsolute(normalizedInput)) {
    throw new BookPathError(`Absolute paths are not allowed: ${relativePath}`);
  }
  if (isWindowsAbsolute(relativePath) || isWindowsAbsolute(normalizedInput)) {
    throw new BookPathError(`Absolute paths are not allowed: ${relativePath}`);
  }
  if (normalizedInput.startsWith("/") || normalizedInput.startsWith("~")) {
    throw new BookPathError(`Absolute paths are not allowed: ${relativePath}`);
  }

  const segments = normalizedInput.split("/").filter((s) => s.length > 0);
  if (segments.some((s) => s === "..")) {
    throw new BookPathError(`Path escapes book root via '..': ${relativePath}`);
  }

  const bookAbs = path.resolve(bookRoot);
  const resolved = path.resolve(bookAbs, ...segments);
  const rel = path.relative(bookAbs, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new BookPathError(`Path escapes book root: ${relativePath}`);
  }
  return resolved;
}

/** Book-relative POSIX-style path for storage/comparison (forward slashes). */
export function toBookRelativePosix(bookRoot: string, absolutePath: string): string {
  const bookAbs = path.resolve(bookRoot);
  const rel = path.relative(bookAbs, path.resolve(absolutePath));
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new BookPathError(`Path is outside book root: ${absolutePath}`);
  }
  return rel.replace(/\\/g, "/");
}
