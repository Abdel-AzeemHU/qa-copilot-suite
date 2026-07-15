/**
 * Lightweight OpenAPI contract validation.
 *
 * Given an endpoint's documented `responses` object (from the imported spec)
 * and an actual HTTP response, reports contract violations:
 *  - undocumented status code
 *  - response declared as JSON but body isn't valid JSON
 *  - structural schema mismatches (missing required properties, wrong types)
 *
 * This is a pragmatic structural checker, not a full JSON Schema validator:
 * it understands `type`, `properties`, `required`, `items`, `nullable`, and
 * `enum`, which covers the large majority of real-world OpenAPI response
 * schemas. `$ref` and composition keywords (allOf/oneOf/anyOf) are skipped
 * rather than guessed at — skipped subtrees produce no false violations.
 */

export interface ContractIssue {
  severity: "violation" | "warning";
  message: string;
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  nullable?: boolean;
  enum?: unknown[];
  $ref?: string;
  allOf?: unknown[];
  oneOf?: unknown[];
  anyOf?: unknown[];
}

interface ResponseSpec {
  description?: string;
  content?: Record<string, { schema?: SchemaObject }>;
  // OpenAPI 2.x style:
  schema?: SchemaObject;
}

function jsTypeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v; // string | number | boolean | object
}

function typeMatches(schemaType: string, actual: string): boolean {
  if (schemaType === "integer") return actual === "number";
  if (schemaType === "number") return actual === "number";
  return schemaType === actual;
}

/** Recursively checks a value against a schema, collecting issues. */
export function validateAgainstSchema(
  value: unknown,
  schema: SchemaObject | undefined,
  path = "$",
  issues: ContractIssue[] = [],
  depth = 0,
): ContractIssue[] {
  if (!schema || depth > 6) return issues;

  // Composition / refs: skip rather than guess.
  if (schema.$ref || schema.allOf || schema.oneOf || schema.anyOf) return issues;

  if (value === null) {
    if (schema.nullable) return issues;
    if (schema.type && schema.type !== "null") {
      issues.push({
        severity: "violation",
        message: `${path}: expected ${schema.type}, got null`,
      });
    }
    return issues;
  }

  const actual = jsTypeOf(value);

  if (schema.type && !typeMatches(schema.type, actual)) {
    issues.push({
      severity: "violation",
      message: `${path}: expected ${schema.type}, got ${actual}`,
    });
    return issues; // structure below won't match either; stop here
  }

  if (schema.enum && !schema.enum.some((e) => e === value)) {
    issues.push({
      severity: "violation",
      message: `${path}: value ${JSON.stringify(value)} not in documented enum`,
    });
  }

  if (actual === "object" && schema.properties) {
    const obj = value as Record<string, unknown>;
    for (const req of schema.required ?? []) {
      if (!(req in obj)) {
        issues.push({
          severity: "violation",
          message: `${path}.${req}: required property missing`,
        });
      }
    }
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in obj) {
        validateAgainstSchema(obj[key], propSchema, `${path}.${key}`, issues, depth + 1);
      }
    }
  }

  if (actual === "array" && schema.items) {
    const arr = value as unknown[];
    // Validate a sample (first 3 items) to keep reports readable.
    arr.slice(0, 3).forEach((item, i) => {
      validateAgainstSchema(item, schema.items, `${path}[${i}]`, issues, depth + 1);
    });
  }

  return issues;
}

/** Finds the documented response spec for a status code ("200", "2XX", "default"). */
export function findResponseSpec(
  responses: Record<string, ResponseSpec>,
  status: number,
): { key: string; spec: ResponseSpec } | null {
  const exact = String(status);
  if (responses[exact]) return { key: exact, spec: responses[exact] };
  const range = `${String(status)[0]}XX`;
  if (responses[range]) return { key: range, spec: responses[range] };
  const rangeLower = `${String(status)[0]}xx`;
  if (responses[rangeLower]) return { key: rangeLower, spec: responses[rangeLower] };
  if (responses["default"]) return { key: "default", spec: responses["default"] };
  return null;
}

/** Extracts the JSON schema for a response spec, handling OAS2 and OAS3 shapes. */
export function jsonSchemaOf(spec: ResponseSpec): SchemaObject | undefined {
  if (spec.schema) return spec.schema; // OpenAPI 2.x
  const content = spec.content ?? {};
  for (const [mime, media] of Object.entries(content)) {
    if (mime.includes("json")) return media.schema;
  }
  return undefined;
}

/**
 * Checks an actual response against the endpoint's documented responses.
 */
export function checkContract(
  documentedResponses: Record<string, ResponseSpec>,
  actual: { status: number; bodyText: string; contentType: string },
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const hasDocs = Object.keys(documentedResponses).length > 0;

  if (!hasDocs) {
    return [
      {
        severity: "warning",
        message: "No documented responses in the spec for this endpoint — nothing to verify",
      },
    ];
  }

  const match = findResponseSpec(documentedResponses, actual.status);
  if (!match) {
    issues.push({
      severity: "violation",
      message: `Undocumented status code ${actual.status} (spec documents: ${Object.keys(documentedResponses).join(", ")})`,
    });
    return issues;
  }

  const schema = jsonSchemaOf(match.spec);
  if (!schema) return issues; // nothing structural documented for this status

  if (!actual.contentType.includes("json")) {
    issues.push({
      severity: "violation",
      message: `Spec documents a JSON body for ${match.key} but response Content-Type is '${actual.contentType || "(none)"}'`,
    });
    return issues;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(actual.bodyText);
  } catch {
    issues.push({
      severity: "violation",
      message: `Response declared JSON but the body is not valid JSON`,
    });
    return issues;
  }

  validateAgainstSchema(parsed, schema, "$", issues);
  return issues;
}
