import { describe, it, expect } from "vitest";
import { evaluateAssertion, evaluateAll, type ResponseFacts } from "@/lib/api-testing/assert";
import {
  apiTestCompilerHelper,
  apiTestCompilerOutputSchema,
  ASSERTION_KINDS,
} from "@/lib/helpers/api-test-compiler";

function facts(overrides: Partial<ResponseFacts> = {}): ResponseFacts {
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    bodyText: '{"data":{"id":42,"name":"Alice"},"ok":true}',
    json: { data: { id: 42, name: "Alice" }, ok: true },
    timeMs: 120,
    ...overrides,
  };
}

describe("evaluateAssertion", () => {
  it("status_equals passes on match, fails on mismatch", () => {
    expect(evaluateAssertion({ kind: "status_equals", description: "200", value: "200" }, facts()).passed).toBe(true);
    expect(evaluateAssertion({ kind: "status_equals", description: "201", value: "201" }, facts()).passed).toBe(false);
  });

  it("status_in_range respects bounds", () => {
    expect(evaluateAssertion({ kind: "status_in_range", description: "2xx", rangeMin: 200, rangeMax: 299 }, facts()).passed).toBe(true);
    expect(evaluateAssertion({ kind: "status_in_range", description: "4xx", rangeMin: 400, rangeMax: 499 }, facts()).passed).toBe(false);
  });

  it("header_exists and header_contains are case-insensitive on name", () => {
    expect(evaluateAssertion({ kind: "header_exists", description: "ct", target: "Content-Type" }, facts()).passed).toBe(true);
    expect(evaluateAssertion({ kind: "header_contains", description: "json", target: "Content-Type", value: "json" }, facts()).passed).toBe(true);
    expect(evaluateAssertion({ kind: "header_exists", description: "x", target: "X-Missing" }, facts()).passed).toBe(false);
  });

  it("body_contains matches substring", () => {
    expect(evaluateAssertion({ kind: "body_contains", description: "alice", value: "Alice" }, facts()).passed).toBe(true);
    expect(evaluateAssertion({ kind: "body_contains", description: "bob", value: "Bob" }, facts()).passed).toBe(false);
  });

  it("json_path_exists and json_path_equals read dotted paths", () => {
    expect(evaluateAssertion({ kind: "json_path_exists", description: "id", target: "data.id" }, facts()).passed).toBe(true);
    expect(evaluateAssertion({ kind: "json_path_exists", description: "missing", target: "data.email" }, facts()).passed).toBe(false);
    expect(evaluateAssertion({ kind: "json_path_equals", description: "id=42", target: "data.id", value: "42" }, facts()).passed).toBe(true);
    expect(evaluateAssertion({ kind: "json_path_equals", description: "id=7", target: "data.id", value: "7" }, facts()).passed).toBe(false);
  });

  it("json_path handles array indices", () => {
    const r = facts({ json: { items: [{ id: "a" }, { id: "b" }] } });
    expect(evaluateAssertion({ kind: "json_path_equals", description: "second", target: "items.1.id", value: "b" }, r).passed).toBe(true);
  });

  it("response_time_lt compares timing", () => {
    expect(evaluateAssertion({ kind: "response_time_lt", description: "fast", value: "500" }, facts()).passed).toBe(true);
    expect(evaluateAssertion({ kind: "response_time_lt", description: "slow", value: "100" }, facts()).passed).toBe(false);
  });

  it("json assertions fail gracefully on non-JSON responses", () => {
    const r = facts({ json: undefined, bodyText: "plain text" });
    expect(evaluateAssertion({ kind: "json_path_exists", description: "x", target: "a.b" }, r).passed).toBe(false);
  });

  it("evaluateAll returns one result per assertion", () => {
    const results = evaluateAll(
      [
        { kind: "status_equals", description: "200", value: "200" },
        { kind: "json_path_exists", description: "id", target: "data.id" },
      ],
      facts(),
    );
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});

describe("apiTestCompilerHelper", () => {
  it("exposes the known assertion kinds", () => {
    expect(ASSERTION_KINDS).toContain("status_equals");
    expect(ASSERTION_KINDS).toContain("json_path_equals");
  });

  it("validates a compiled request", () => {
    const out = apiTestCompilerOutputSchema.parse({
      method: "POST",
      path: "/users",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"Alice"}',
      assertions: [{ kind: "status_in_range", description: "2xx", rangeMin: 200, rangeMax: 299 }],
    });
    expect(out.method).toBe("POST");
    expect(out.assertions).toHaveLength(1);
  });

  it("requires at least one assertion", () => {
    expect(() =>
      apiTestCompilerOutputSchema.parse({ method: "GET", path: "/x", assertions: [] }),
    ).toThrow();
  });

  it("builds a user message with endpoint + test context", () => {
    const msg = apiTestCompilerHelper.buildUserMessage({
      baseUrl: "https://api.example.com",
      method: "GET",
      path: "/users/{id}",
      testTitle: "Fetch a user",
      testSteps: ["GET /users/42"],
      expectedResult: "200 with the user",
      testType: "functional",
    });
    expect(msg).toContain("https://api.example.com");
    expect(msg).toContain("Fetch a user");
    expect(msg).toContain("functional");
  });
});
