import type { ApiAssertion } from "@/lib/helpers/api-test-compiler";

export interface AssertionResult {
  description: string;
  passed: boolean;
  detail: string;
}

export interface ResponseFacts {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  json: unknown | undefined; // parsed body if it was JSON
  timeMs: number;
}

/** Reads a dotted JSON path (e.g. "data.items.0.id") from a parsed body. */
function readPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(part);
      if (Number.isNaN(idx)) return undefined;
      cur = cur[idx];
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Evaluates a single assertion against the response facts. */
export function evaluateAssertion(
  a: ApiAssertion,
  r: ResponseFacts,
): AssertionResult {
  const pass = (detail: string): AssertionResult => ({
    description: a.description,
    passed: true,
    detail,
  });
  const fail = (detail: string): AssertionResult => ({
    description: a.description,
    passed: false,
    detail,
  });

  switch (a.kind) {
    case "status_equals": {
      const expected = Number(a.value);
      return r.status === expected
        ? pass(`status ${r.status}`)
        : fail(`expected ${expected}, got ${r.status}`);
    }
    case "status_in_range": {
      const min = a.rangeMin ?? 200;
      const max = a.rangeMax ?? 299;
      return r.status >= min && r.status <= max
        ? pass(`status ${r.status} in ${min}-${max}`)
        : fail(`expected ${min}-${max}, got ${r.status}`);
    }
    case "header_exists": {
      const name = (a.target ?? "").toLowerCase();
      return name in r.headers
        ? pass(`header '${a.target}' present`)
        : fail(`header '${a.target}' missing`);
    }
    case "header_contains": {
      const name = (a.target ?? "").toLowerCase();
      const val = r.headers[name];
      if (val == null) return fail(`header '${a.target}' missing`);
      return val.includes(a.value ?? "")
        ? pass(`header '${a.target}' contains '${a.value}'`)
        : fail(`header '${a.target}' = '${val}', missing '${a.value}'`);
    }
    case "body_contains": {
      return r.bodyText.includes(a.value ?? "")
        ? pass(`body contains '${a.value}'`)
        : fail(`body does not contain '${a.value}'`);
    }
    case "json_path_exists": {
      if (r.json === undefined) return fail("response is not JSON");
      const v = readPath(r.json, a.target ?? "");
      return v !== undefined
        ? pass(`'${a.target}' exists`)
        : fail(`'${a.target}' not found`);
    }
    case "json_path_equals": {
      if (r.json === undefined) return fail("response is not JSON");
      const v = readPath(r.json, a.target ?? "");
      const actual = v === undefined ? undefined : String(v);
      return actual === a.value
        ? pass(`'${a.target}' = '${a.value}'`)
        : fail(`'${a.target}' = '${actual ?? "undefined"}', expected '${a.value}'`);
    }
    case "response_time_lt": {
      const limit = Number(a.value);
      return r.timeMs < limit
        ? pass(`${r.timeMs}ms < ${limit}ms`)
        : fail(`${r.timeMs}ms >= ${limit}ms`);
    }
    default:
      return fail(`unknown assertion kind`);
  }
}

export function evaluateAll(
  assertions: ApiAssertion[],
  r: ResponseFacts,
): AssertionResult[] {
  return assertions.map((a) => evaluateAssertion(a, r));
}
