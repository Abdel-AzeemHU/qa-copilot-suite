import type { ParsedEndpoint, ParsedSpec } from "./parse-openapi";

interface PostmanUrl {
  raw?: string;
  host?: string[] | string;
  path?: string[] | string;
  query?: Array<{ key?: string; value?: string }>;
}

interface PostmanRequest {
  method?: string;
  url?: PostmanUrl | string;
  header?: Array<{ key?: string; value?: string }>;
  body?: { mode?: string; raw?: string };
  description?: string;
}

interface PostmanItem {
  name?: string;
  request?: PostmanRequest;
  item?: PostmanItem[]; // folders nest items recursively
}

interface PostmanCollection {
  info?: { name?: string };
  item?: PostmanItem[];
  variable?: Array<{ key?: string; value?: string }>;
}

function urlToPath(url: PostmanUrl | string | undefined): string {
  if (!url) return "/";
  if (typeof url === "string") {
    return normalizePath(url);
  }
  if (Array.isArray(url.path)) {
    return "/" + url.path.join("/");
  }
  if (typeof url.path === "string") {
    return normalizePath(url.path);
  }
  if (url.raw) {
    return normalizePath(url.raw);
  }
  return "/";
}

function normalizePath(raw: string): string {
  // Strip protocol/host, leave just the path (+query removed).
  let p = raw.replace(/\{\{[^}]+\}\}/g, ""); // strip {{baseUrl}} variables
  p = p.replace(/^https?:\/\/[^/]+/, "");
  const queryIdx = p.indexOf("?");
  if (queryIdx >= 0) p = p.slice(0, queryIdx);
  return p.startsWith("/") ? p : `/${p}`;
}

function collectItems(items: PostmanItem[] | undefined, out: PostmanItem[]) {
  for (const item of items ?? []) {
    if (item.item) {
      collectItems(item.item, out);
    } else if (item.request) {
      out.push(item);
    }
  }
}

/**
 * Parses a Postman Collection v2.x export into the same ParsedEndpoint shape
 * used for OpenAPI specs.
 */
export function parsePostmanCollection(content: string): ParsedSpec {
  const doc = JSON.parse(content) as PostmanCollection;

  const flat: PostmanItem[] = [];
  collectItems(doc.item, flat);

  let baseUrl: string | null = null;
  const baseUrlVar = doc.variable?.find(
    (v) => v.key === "baseUrl" || v.key === "base_url" || v.key === "host",
  );
  if (baseUrlVar?.value) baseUrl = baseUrlVar.value;

  const endpoints: ParsedEndpoint[] = flat.map((item) => {
    const req = item.request!;
    const method = (req.method ?? "GET").toUpperCase();
    const path = urlToPath(req.url);

    let requestBody: unknown | null = null;
    if (req.body?.mode === "raw" && req.body.raw) {
      try {
        requestBody = { content: { "application/json": { example: JSON.parse(req.body.raw) } } };
      } catch {
        requestBody = { content: { "text/plain": { example: req.body.raw } } };
      }
    }

    const parameters =
      typeof req.url === "object" && req.url?.query
        ? req.url.query
            .filter((q) => q.key)
            .map((q) => ({
              name: q.key,
              in: "query",
              example: q.value,
            }))
        : [];

    return {
      method,
      path,
      operationId: undefined,
      summary: item.name,
      description: req.description,
      parameters,
      requestBody,
      responses: {},
      tags: [],
    };
  });

  return { baseUrl, endpoints };
}

/**
 * Heuristic check for whether a piece of text looks like a Postman collection export.
 */
export function looksLikePostmanCollection(content: string): boolean {
  try {
    const doc = JSON.parse(content) as Record<string, unknown>;
    if (typeof doc !== "object" || doc === null) return false;
    const info = doc.info as Record<string, unknown> | undefined;
    const schema = typeof info?.schema === "string" ? info.schema : "";
    return schema.includes("postman") || ("item" in doc && Array.isArray(doc.item));
  } catch {
    return false;
  }
}
