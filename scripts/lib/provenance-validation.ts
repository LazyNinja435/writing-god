/**
 * Cross-artifact provenance checks for scene / correction story events.
 * Enforces manuscript hash + optional approval binding against book workspace files.
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import { BookPathError, resolveBookRelativePath } from "./book-paths.ts";
import type { StoryEvent } from "../story-state/fold.ts";
import { findReplacementRoot } from "../story-state/fold.ts";

export interface EventProvenance {
  manuscript?: string;
  manuscript_hash?: string;
  approval_id?: string;
  scene_card?: string;
}

export interface ApprovalRecordLike {
  approval_id?: string;
  artifact_type?: string;
  source_artifact?: string;
  promotion_target?: string;
  artifact_hash?: string;
  decision?: string;
}

export interface BookHumanApproval {
  scenes?: boolean;
  [key: string]: unknown;
}

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const APR_PATTERN = /^apr-[0-9]{6,}$/;

export function sha256FileBytes(absPath: string): string {
  const bytes = fs.readFileSync(absPath);
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}

function err(errors: string[], msg: string): void {
  errors.push(msg);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readBookHumanApproval(bookAbs: string): BookHumanApproval {
  const bookYaml = path.join(bookAbs, "book.yaml");
  if (!fs.existsSync(bookYaml)) return {};
  try {
    const data = parseYaml(fs.readFileSync(bookYaml, "utf8"));
    if (!isPlainObject(data)) return {};
    const ha = data.human_approval;
    if (!isPlainObject(ha)) return {};
    return ha as BookHumanApproval;
  } catch {
    return {};
  }
}

export function loadApprovalsById(
  bookAbs: string,
): Map<string, { record: ApprovalRecordLike; file: string }> {
  const map = new Map<string, { record: ApprovalRecordLike; file: string }>();
  const dir = path.join(bookAbs, "approvals");
  if (!fs.existsSync(dir)) return map;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    try {
      const record = JSON.parse(
        fs.readFileSync(path.join(dir, file), "utf8"),
      ) as ApprovalRecordLike;
      if (record.approval_id) {
        map.set(record.approval_id, { record, file });
      }
    } catch {
      // Schema validation elsewhere reports parse errors
    }
  }
  return map;
}

function resolveSafe(
  bookAbs: string,
  relativePath: string,
  label: string,
  errors: string[],
): string | null {
  try {
    return resolveBookRelativePath(bookAbs, relativePath);
  } catch (e) {
    const msg = e instanceof BookPathError ? e.message : (e as Error).message;
    err(errors, `${label}: unsafe book path (${relativePath}): ${msg}`);
    return null;
  }
}

function manuscriptBelongsToScene(manuscriptRel: string, sceneId: string): boolean {
  const base = path.posix.basename(manuscriptRel.replace(/\\/g, "/"));
  return base.includes(sceneId);
}

/**
 * Validate provenance block shape used by scene events and scene-root corrections.
 * Does not check disk (use validateManuscriptProvenanceAgainstWorkspace).
 */
export function validateProvenanceShape(
  provenance: EventProvenance | undefined,
  label: string,
  errors: string[],
  options: { requireApprovalId: boolean },
): void {
  if (!provenance || !isPlainObject(provenance)) {
    err(errors, `${label}: missing provenance object`);
    return;
  }
  if (!provenance.manuscript || typeof provenance.manuscript !== "string") {
    err(errors, `${label}: provenance.manuscript is required`);
  }
  if (!provenance.manuscript_hash || typeof provenance.manuscript_hash !== "string") {
    err(errors, `${label}: provenance.manuscript_hash is required`);
  } else if (!SHA256_PATTERN.test(provenance.manuscript_hash)) {
    err(
      errors,
      `${label}: provenance.manuscript_hash must match sha256:<64 lowercase hex>`,
    );
  }
  if (!provenance.scene_card || typeof provenance.scene_card !== "string") {
    err(errors, `${label}: provenance.scene_card is required`);
  }
  if (options.requireApprovalId) {
    if (!provenance.approval_id || typeof provenance.approval_id !== "string") {
      err(
        errors,
        `${label}: provenance.approval_id is required when human_approval.scenes is true`,
      );
    } else if (!APR_PATTERN.test(provenance.approval_id)) {
      err(errors, `${label}: provenance.approval_id must match apr-NNNNNN`);
    }
  } else if (
    provenance.approval_id !== undefined &&
    provenance.approval_id !== null &&
    (typeof provenance.approval_id !== "string" || !APR_PATTERN.test(provenance.approval_id))
  ) {
    err(errors, `${label}: provenance.approval_id must match apr-NNNNNN when present`);
  }
}

/**
 * Hard-fail cross-checks for manuscript + scene card (+ approval when required).
 */
export function validateManuscriptProvenanceAgainstWorkspace(
  bookAbs: string,
  event: StoryEvent & { provenance?: EventProvenance },
  label: string,
  errors: string[],
  options: {
    requireApprovalId: boolean;
    approvalsById: Map<string, { record: ApprovalRecordLike; file: string }>;
    expectedSceneId: string;
  },
): void {
  const prov = event.provenance;
  validateProvenanceShape(prov, label, errors, {
    requireApprovalId: options.requireApprovalId,
  });
  if (!prov?.manuscript || !prov.manuscript_hash || !prov.scene_card) return;

  if (!manuscriptBelongsToScene(prov.manuscript, options.expectedSceneId)) {
    err(
      errors,
      `${label}: provenance.manuscript basename must include scene_id ${options.expectedSceneId}`,
    );
  }

  const manuscriptAbs = resolveSafe(bookAbs, prov.manuscript, label, errors);
  if (manuscriptAbs) {
    if (!fs.existsSync(manuscriptAbs)) {
      err(errors, `${label}: provenance.manuscript missing: ${prov.manuscript}`);
    } else {
      const actual = sha256FileBytes(manuscriptAbs);
      if (actual !== prov.manuscript_hash) {
        err(
          errors,
          `${label}: provenance.manuscript_hash mismatch for ${prov.manuscript} (file bytes do not match)`,
        );
      }
    }
  }

  const cardAbs = resolveSafe(bookAbs, prov.scene_card, label, errors);
  if (cardAbs) {
    if (!fs.existsSync(cardAbs)) {
      err(errors, `${label}: provenance.scene_card missing: ${prov.scene_card}`);
    } else {
      try {
        const card = parseYaml(fs.readFileSync(cardAbs, "utf8"));
        if (!isPlainObject(card) || card.scene_id !== options.expectedSceneId) {
          err(
            errors,
            `${label}: scene card scene_id must equal event scene_id ${options.expectedSceneId}`,
          );
        }
      } catch (e) {
        err(
          errors,
          `${label}: unreadable scene card ${prov.scene_card}: ${(e as Error).message}`,
        );
      }
    }
  }

  if (!options.requireApprovalId && !prov.approval_id) {
    return;
  }
  if (!prov.approval_id) return;

  const entry = options.approvalsById.get(prov.approval_id);
  if (!entry) {
    err(errors, `${label}: approval record not found for ${prov.approval_id}`);
    return;
  }
  const apr = entry.record;
  if (apr.decision !== "approved") {
    err(
      errors,
      `${label}: approval ${prov.approval_id} decision must be approved (got ${apr.decision ?? "missing"})`,
    );
  }
  if (apr.artifact_type !== "scene") {
    err(
      errors,
      `${label}: approval ${prov.approval_id} artifact_type must be scene`,
    );
  }
  if (apr.promotion_target !== prov.manuscript) {
    err(
      errors,
      `${label}: approval ${prov.approval_id} promotion_target must equal provenance.manuscript`,
    );
  }
  if (apr.artifact_hash !== prov.manuscript_hash) {
    err(
      errors,
      `${label}: approval ${prov.approval_id} artifact_hash must equal provenance.manuscript_hash`,
    );
  }
  // Promoted file actual hash == approval hash (already checked vs provenance hash;
  // re-check file if present for explicit approval binding).
  if (manuscriptAbs && fs.existsSync(manuscriptAbs) && apr.artifact_hash) {
    const fileHash = sha256FileBytes(manuscriptAbs);
    if (fileHash !== apr.artifact_hash) {
      err(
        errors,
        `${label}: promoted manuscript hash does not match approval ${prov.approval_id} artifact_hash`,
      );
    }
  }
}

/**
 * Validate all loaded events' provenance against the book workspace.
 */
export function validateBookEventProvenance(
  bookAbs: string,
  events: StoryEvent[],
  errors: string[],
): void {
  const humanApproval = readBookHumanApproval(bookAbs);
  const scenesApprovalRequired = humanApproval.scenes === true;
  const approvalsById = loadApprovalsById(bookAbs);
  const byId = new Map(events.map((e) => [e.event_id, e]));

  for (const event of events) {
    const label = `Event ${event.event_id}`;
    const withProv = event as StoryEvent & { provenance?: EventProvenance };

    if (event.event_type === "scene") {
      if (!event.scene_id) {
        err(errors, `${label}: scene events require scene_id`);
        continue;
      }
      validateManuscriptProvenanceAgainstWorkspace(bookAbs, withProv, label, errors, {
        requireApprovalId: scenesApprovalRequired,
        approvalsById,
        expectedSceneId: event.scene_id,
      });
      continue;
    }

    if (event.event_type === "correction") {
      const rootId = findReplacementRoot(event, byId);
      const root = byId.get(rootId);
      if (!root) continue;
      if (root.event_type !== "scene") {
        // Non-scene roots may omit manuscript provenance
        continue;
      }
      if (!event.scene_id) {
        err(errors, `${label}: correction of scene root requires scene_id`);
      } else if (root.scene_id && event.scene_id !== root.scene_id) {
        err(
          errors,
          `${label}: correction scene_id ${event.scene_id} must match root scene_id ${root.scene_id}`,
        );
      }
      const expectedSceneId = event.scene_id ?? root.scene_id;
      if (!expectedSceneId) {
        err(errors, `${label}: cannot determine scene_id for scene-root correction`);
        continue;
      }
      validateManuscriptProvenanceAgainstWorkspace(bookAbs, withProv, label, errors, {
        requireApprovalId: scenesApprovalRequired,
        approvalsById,
        expectedSceneId,
      });
    }
  }
}
