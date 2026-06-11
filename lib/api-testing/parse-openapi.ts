import yaml from "js-yaml";

export interface ParsedEndpoint {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: unknown[];
  requestBody: unknown | null;
  responses: Record<string, unknown>;
  tags: string[];
}

export interface ParsedSpec {
  baseUrl: string | null;
  endpoints: ParsedEndpoint[];
}

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

interface OpenApiDoc {
  servers?: Array<{ url?: string }>;
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Parses an OpenAPI 2.x (Swagger) or 3.x document, supplied as JSON or YAML text.
 */
export function parseOpenApiSpec(content: string): ParsedSpec {
  const doc = parseJsonOrYaml(content) as OpenApiDoc;

  let baseUrl: string | null = null;
  if (doc.servers?.[0]?.url) {
    baseUrl = doc.servers[0].url;
  } else if (doc.host) {
    const scheme = doc.schemes?.[0] ?? "https";
    baseUrl = `${scheme}://${doc.host}${doc.basePath ?? ""}`;
  }

  const endpoints: ParsedEndpoint[] = [];
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = methods[method];
      if (!op) continue;
      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        parameters: op.parameters ?? [],
        requestBody: op.requestBody ?? null,
        responses: (op.responses as Record<string, unknown>) ?? {},
        tags: op.tags ?? [],
      });
    }
  }

  return { baseUrl, endpoints };
}

function parseJsonOrYaml(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  return yaml.load(trimmed);
}

/**
 * Heuristic check for whether a piece of text looks like an OpenAPI/Swagger document.
 */
export function looksLikeOpenApi(content: string): boolean {
  try {
    const doc = parseJsonOrYaml(content) as Record<string, unknown>;
    return (
      typeof doc === "object" &&
      doc !== null &&
      ("openapi" in doc || "swagger" in doc)
    );
  } catch {
    return false;
  }
}
