/**
 * Shared AJV schema validation for story events, initial state, approvals, and related artifacts.
 * Used by both validate.ts and fold.ts so validity is not defined twice.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";

export interface SchemaValidationResult {
  ok: boolean;
  errors: string[];
}

export class SchemaRegistry {
  private readonly ajv = new Ajv2020({ allErrors: true, strict: false });
  private readonly validators = new Map<string, ValidateFunction>();

  constructor(private readonly schemasDir: string) {}

  getSchemasDir(): string {
    return this.schemasDir;
  }

  load(schemaFile: string): ValidateFunction | null {
    if (this.validators.has(schemaFile)) return this.validators.get(schemaFile)!;
    const schemaPath = path.join(this.schemasDir, schemaFile);
    if (!fs.existsSync(schemaPath)) return null;
    let schema: unknown;
    try {
      schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    } catch (e) {
      throw new Error(`Schema invalid JSON [${schemaFile}]: ${(e as Error).message}`);
    }
    const validate = this.ajv.compile(schema as object);
    this.validators.set(schemaFile, validate);
    return validate;
  }

  validate(schemaFile: string, data: unknown, label: string): SchemaValidationResult {
    let validate: ValidateFunction | null;
    try {
      validate = this.load(schemaFile);
    } catch (e) {
      return { ok: false, errors: [(e as Error).message] };
    }
    if (!validate) {
      return { ok: false, errors: [`Schema missing for validation: ${schemaFile}`] };
    }
    if (validate(data)) {
      return { ok: true, errors: [] };
    }
    const detail = (validate.errors ?? [])
      .map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`)
      .join("; ");
    return {
      ok: false,
      errors: [`Schema validation failed [${label}]: ${detail}`],
    };
  }

  validateStoryEvent(data: unknown, label: string): SchemaValidationResult {
    return this.validate("story-event.schema.json", data, label);
  }

  validateInitialState(data: unknown, label: string): SchemaValidationResult {
    return this.validate("initial-state.schema.json", data, label);
  }

  validateApproval(data: unknown, label: string): SchemaValidationResult {
    return this.validate("approval.schema.json", data, label);
  }
}

export function createSchemaRegistry(schemasDir: string): SchemaRegistry {
  return new SchemaRegistry(schemasDir);
}

export function schemasDirFromRoot(rootPath: string): string {
  return path.join(rootPath, ".ai", "schemas");
}
