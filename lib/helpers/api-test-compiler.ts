import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

// Assertion kinds the runner knows how to evaluate.
export const ASSERTION_KINDS = [
  "status_equals",
  "status_in_range",
  "header_exists",
  "header_contains",
  "body_contains",
  "json_path_exists",
  "json_path_equals",
  "response_time_lt",
] as const;

// --- Input ---
export const apiTestCompilerInputSchema = z.object({
  baseUrl: z.string().optional(),
  method: z.string(),
  path: z.string(),
  endpointSummary: z.string().optional(),
  parameters: z.unknown().optional(),
  requestBody: z.unknown().optional(),
  responses: z.unknown().optional(),
  // The natural-language test case to compile:
  testTitle: z.string(),
  testSteps: z.array(z.string()),
  expectedResult: z.string(),
  testType: z.string(), // functional | negative | edge | security
});

export type ApiTestCompilerInput = z.infer<typeof apiTestCompilerInputSchema>;

// --- Output (the executable request spec) ---
export const assertionSchema = z.object({
  kind: z.enum(ASSERTION_KINDS),
  description: z.string(),
  // Depending on kind: expected status, header name, json path, substring, ms, etc.
  target: z.string().optional(), // e.g. header name or JSON path like "data.id"
  value: z.string().optional(), // expected value / substring / status / ms
  rangeMin: z.number().optional(),
  rangeMax: z.number().optional(),
});

export const apiTestCompilerOutputSchema = z.object({
  method: z.string(),
  path: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  query: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(), // JSON string or raw payload; omit for no body
  assertions: z.array(assertionSchema).min(1),
});

export type ApiTestCompilerOutput = z.infer<typeof apiTestCompilerOutputSchema>;
export type ApiAssertion = z.infer<typeof assertionSchema>;

// --- Tool JSON Schema ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    method: { type: "string", description: "HTTP method, e.g. GET, POST." },
    path: {
      type: "string",
      description:
        "Request path with concrete example values substituted for path params, e.g. /users/42. Do NOT include the base URL.",
    },
    headers: {
      type: "object",
      additionalProperties: { type: "string" },
      description:
        "Request headers as string key/value pairs (e.g. Content-Type, Authorization). Use a placeholder like 'Bearer <token>' when auth is required; use an obviously invalid token for security/negative auth tests.",
    },
    query: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Query-string parameters as string key/value pairs.",
    },
    body: {
      type: "string",
      description:
        "Request body as a string (JSON-encoded for application/json). Omit entirely when the request has no body. For negative tests, provide the intentionally-invalid payload here.",
    },
    assertions: {
      type: "array",
      minItems: 1,
      description: "Checks to run against the response.",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [...ASSERTION_KINDS],
            description:
              "status_equals (value=code), status_in_range (rangeMin/rangeMax), header_exists (target=name), header_contains (target=name,value=substring), body_contains (value=substring), json_path_exists (target=dotted path), json_path_equals (target=path,value=expected), response_time_lt (value=ms).",
          },
          description: { type: "string", description: "Human-readable assertion, e.g. 'Status is 200'." },
          target: { type: "string", description: "Header name or JSON path, when applicable." },
          value: { type: "string", description: "Expected value / substring / status code / ms, when applicable." },
          rangeMin: { type: "number", description: "For status_in_range: inclusive lower bound." },
          rangeMax: { type: "number", description: "For status_in_range: inclusive upper bound." },
        },
        required: ["kind", "description"],
      },
    },
  },
  required: ["method", "path", "assertions"],
};

const SYSTEM_PROMPT = `You are an API test compiler. Given a REST endpoint (method, path, parameters, \
request/response schemas) and a single natural-language test case (title, steps, expected result, type), \
produce a concrete, executable HTTP request plus a set of response assertions.

Rules:
- Substitute realistic concrete example values for path and query parameters (e.g. /users/42, ?limit=10).
- For 'functional' tests: valid input, assert a 2xx status and key response fields.
- For 'negative' tests: intentionally-invalid or missing input, assert a 4xx status (usually 400/422).
- For 'edge' tests: boundary values; assert the documented behavior.
- For 'security' tests: missing or invalid auth (e.g. Authorization: 'Bearer invalid'); assert 401/403.
- Keep the path RELATIVE (no base URL). Provide a body only when the method/endpoint needs one.
- Always include at least one status assertion. Add body/header/timing assertions where the expected \
result implies them.
- Prefer status_in_range (e.g. 200–299) when the exact success code is not specified.

Always respond by calling the compile_api_request tool with structured data.`;

export const apiTestCompilerHelper: AiHelper<
  ApiTestCompilerInput,
  ApiTestCompilerOutput
> = {
  name: "api-test-compiler",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: apiTestCompilerInputSchema,
  outputSchema: apiTestCompilerOutputSchema,
  tool: {
    name: "compile_api_request",
    description:
      "Record the concrete executable HTTP request and response assertions compiled from a test case.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 2048,
  buildUserMessage(input) {
    const lines: string[] = [];
    if (input.baseUrl) lines.push(`Base URL: ${input.baseUrl}`);
    lines.push(`Endpoint: ${input.method} ${input.path}`);
    if (input.endpointSummary) lines.push(`Summary: ${input.endpointSummary}`);
    if (input.parameters)
      lines.push(`Parameters: ${JSON.stringify(input.parameters).slice(0, 1500)}`);
    if (input.requestBody)
      lines.push(`Request body schema: ${JSON.stringify(input.requestBody).slice(0, 1500)}`);
    if (input.responses)
      lines.push(`Responses: ${JSON.stringify(input.responses).slice(0, 1000)}`);
    lines.push(`\nTest case (${input.testType}): ${input.testTitle}`);
    lines.push(`Steps:\n${input.testSteps.map((s) => `  - ${s}`).join("\n")}`);
    lines.push(`Expected result: ${input.expectedResult}`);
    lines.push(
      `\nCompile this into an executable request + assertions by calling compile_api_request.`,
    );
    return lines.join("\n");
  },
};
