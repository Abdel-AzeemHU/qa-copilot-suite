import { describe, it, expect } from "vitest";
import {
  validateAgainstSchema,
  findResponseSpec,
  jsonSchemaOf,
  checkContract,
} from "@/lib/api-testing/contract";

describe("validateAgainstSchema", () => {
  it("passes matching objects", () => {
    const issues = validateAgainstSchema(
      { id: 1, name: "Alice" },
      {
        type: "object",
        required: ["id", "name"],
        properties: { id: { type: "integer" }, name: { type: "string" } },
      },
    );
    expect(issues).toHaveLength(0);
  });

  it("flags missing required properties", () => {
    const issues = validateAgainstSchema(
      { id: 1 },
      { type: "object", required: ["id", "name"], properties: {} },
    );
    expect(issues.some((i) => i.message.includes("name") && i.message.includes("required"))).toBe(true);
  });

  it("flags wrong types", () => {
    const issues = validateAgainstSchema(
      { id: "not-a-number" },
      { type: "object", properties: { id: { type: "integer" } } },
    );
    expect(issues.some((i) => i.message.includes("expected integer"))).toBe(true);
  });

  it("integer accepts JS numbers", () => {
    expect(validateAgainstSchema(42, { type: "integer" })).toHaveLength(0);
  });

  it("validates array items (sampled)", () => {
    const issues = validateAgainstSchema(
      [{ id: 1 }, { id: "bad" }],
      { type: "array", items: { type: "object", properties: { id: { type: "integer" } } } },
    );
    expect(issues.some((i) => i.message.includes("[1].id"))).toBe(true);
  });

  it("respects nullable", () => {
    expect(validateAgainstSchema(null, { type: "string", nullable: true })).toHaveLength(0);
    expect(validateAgainstSchema(null, { type: "string" }).length).toBeGreaterThan(0);
  });

  it("checks enums", () => {
    expect(validateAgainstSchema("red", { type: "string", enum: ["red", "blue"] })).toHaveLength(0);
    expect(validateAgainstSchema("green", { type: "string", enum: ["red", "blue"] }).length).toBeGreaterThan(0);
  });

  it("skips $ref and composition rather than guessing", () => {
    expect(validateAgainstSchema({ any: "thing" }, { $ref: "#/components/schemas/X" })).toHaveLength(0);
    expect(validateAgainstSchema({ any: "thing" }, { allOf: [{}] })).toHaveLength(0);
  });
});

describe("findResponseSpec", () => {
  it("matches exact, range, and default keys in order", () => {
    expect(findResponseSpec({ "200": { description: "ok" } }, 200)?.key).toBe("200");
    expect(findResponseSpec({ "2XX": { description: "ok" } }, 201)?.key).toBe("2XX");
    expect(findResponseSpec({ default: { description: "any" } }, 503)?.key).toBe("default");
    expect(findResponseSpec({ "200": { description: "ok" } }, 404)).toBeNull();
  });
});

describe("jsonSchemaOf", () => {
  it("reads OAS3 content and OAS2 schema shapes", () => {
    expect(
      jsonSchemaOf({ content: { "application/json": { schema: { type: "object" } } } }),
    ).toEqual({ type: "object" });
    expect(jsonSchemaOf({ schema: { type: "array" } })).toEqual({ type: "array" });
    expect(jsonSchemaOf({ description: "no body" })).toBeUndefined();
  });
});

describe("checkContract", () => {
  const documented = {
    "200": {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["id"],
            properties: { id: { type: "integer" } },
          },
        },
      },
    },
    "404": { description: "not found" },
  };

  it("passes a conforming response", () => {
    const issues = checkContract(documented, {
      status: 200,
      bodyText: '{"id": 7}',
      contentType: "application/json",
    });
    expect(issues.filter((i) => i.severity === "violation")).toHaveLength(0);
  });

  it("flags undocumented status codes", () => {
    const issues = checkContract(documented, {
      status: 500,
      bodyText: "{}",
      contentType: "application/json",
    });
    expect(issues.some((i) => i.message.includes("Undocumented status code 500"))).toBe(true);
  });

  it("flags non-JSON bodies when JSON is documented", () => {
    const issues = checkContract(documented, {
      status: 200,
      bodyText: "<html></html>",
      contentType: "text/html",
    });
    expect(issues.some((i) => i.message.includes("Content-Type"))).toBe(true);
  });

  it("flags invalid JSON", () => {
    const issues = checkContract(documented, {
      status: 200,
      bodyText: "{oops",
      contentType: "application/json",
    });
    expect(issues.some((i) => i.message.includes("not valid JSON"))).toBe(true);
  });

  it("flags schema violations in the body", () => {
    const issues = checkContract(documented, {
      status: 200,
      bodyText: '{"id": "seven"}',
      contentType: "application/json",
    });
    expect(issues.some((i) => i.message.includes("expected integer"))).toBe(true);
  });

  it("warns (not fails) when nothing is documented", () => {
    const issues = checkContract({}, {
      status: 200,
      bodyText: "{}",
      contentType: "application/json",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("passes documented statuses without schemas", () => {
    const issues = checkContract(documented, {
      status: 404,
      bodyText: "",
      contentType: "",
    });
    expect(issues.filter((i) => i.severity === "violation")).toHaveLength(0);
  });
});
