import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

export const PRIORITIES = ["high", "medium", "low"] as const;
export const API_TEST_TYPES = [
  "functional",
  "edge",
  "negative",
  "security",
] as const;

// --- Input ---
export const apiEndpointInputSchema = z.object({
  id: z.string(),
  method: z.string(),
  path: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  parameters: z.unknown().optional(),
  requestBody: z.unknown().optional(),
  responses: z.unknown().optional(),
});

export const apiTestGeneratorInputSchema = z.object({
  baseUrl: z.string().optional(),
  endpoints: z.array(apiEndpointInputSchema).min(1),
  countPerEndpoint: z.number().int().min(1).max(6).optional(),
});

export type ApiTestGeneratorInput = z.infer<typeof apiTestGeneratorInputSchema>;

// --- Output ---
export const generatedApiTestCaseSchema = z.object({
  endpointId: z.string(),
  title: z.string(),
  preconditions: z.string(),
  steps: z.array(z.string()),
  expectedResult: z.string(),
  priority: z.enum(PRIORITIES),
  type: z.enum(API_TEST_TYPES),
});

export const apiTestGeneratorOutputSchema = z.object({
  cases: z.array(generatedApiTestCaseSchema),
});

export type ApiTestGeneratorOutput = z.infer<typeof apiTestGeneratorOutputSchema>;

// --- Tool JSON Schema ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    cases: {
      type: "array",
      description: "The generated API test cases.",
      items: {
        type: "object",
        properties: {
          endpointId: {
            type: "string",
            description:
              "The id of the endpoint (from the input list) this test case targets. Must exactly match one of the provided endpoint ids.",
          },
          title: { type: "string", description: "Short descriptive title for the test case." },
          preconditions: {
            type: "string",
            description: "Setup/auth/state required before executing this request.",
          },
          steps: {
            type: "array",
            items: { type: "string" },
            description:
              "Ordered steps describing the request to send (method, path, headers, query params, body) and what to check in the response.",
          },
          expectedResult: {
            type: "string",
            description: "The expected HTTP status code and response body/shape.",
          },
          priority: { type: "string", enum: [...PRIORITIES] },
          type: {
            type: "string",
            enum: [...API_TEST_TYPES],
            description:
              "'functional' for happy-path requests, 'edge' for boundary/unusual-but-valid input, " +
              "'negative' for invalid input / missing required fields / wrong types expecting 4xx, " +
              "'security' for auth/authorization checks (missing/invalid tokens, access control).",
          },
        },
        required: ["endpointId", "title", "preconditions", "steps", "expectedResult", "priority", "type"],
      },
    },
  },
  required: ["cases"],
};

const SYSTEM_PROMPT = `You are a senior API QA engineer. Given a base URL and a list of REST API \
endpoints (parsed from an OpenAPI/Swagger spec or a Postman collection — including method, path, \
parameters, request body schema, and response schemas), generate thorough API test cases for each \
endpoint.

For each endpoint, cover:
- "functional": the happy path with valid input, expecting a successful (2xx) response matching the schema.
- "negative": invalid/missing required fields, wrong data types, malformed JSON — expecting 4xx.
- "edge": boundary values (empty strings, very large numbers, special characters, pagination limits).
- "security": missing/invalid auth tokens, accessing another user's resource — expecting 401/403.

Each test case's "steps" should be concrete and executable: specify the HTTP method, full path \
(with example path/query parameter values), headers (including auth if relevant), and request body \
(if any). The "expectedResult" should state the expected HTTP status code and key response fields/values \
to assert.

Always reference the exact "endpointId" provided in the input for each generated test case. Always \
respond by calling the record_api_test_cases tool with structured data — never free-form text.`;

export const apiTestGeneratorHelper: AiHelper<
  ApiTestGeneratorInput,
  ApiTestGeneratorOutput
> = {
  name: "api-test-generator",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: apiTestGeneratorInputSchema,
  outputSchema: apiTestGeneratorOutputSchema,
  tool: {
    name: "record_api_test_cases",
    description: "Record the generated API test cases as structured data for the QA system.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 16000,
  buildUserMessage(input) {
    const lines: string[] = [];
    if (input.baseUrl) lines.push(`Base URL: ${input.baseUrl}`);
    const count = input.countPerEndpoint ?? 3;
    lines.push(`\nGenerate approximately ${count} test case(s) per endpoint below.\n`);
    lines.push(`Endpoints:`);
    for (const ep of input.endpoints) {
      lines.push(`\n- id: ${ep.id}`);
      lines.push(`  ${ep.method} ${ep.path}`);
      if (ep.summary) lines.push(`  summary: ${ep.summary}`);
      if (ep.description) lines.push(`  description: ${ep.description}`);
      if (ep.parameters) {
        lines.push(`  parameters: ${JSON.stringify(ep.parameters).slice(0, 1500)}`);
      }
      if (ep.requestBody) {
        lines.push(`  requestBody: ${JSON.stringify(ep.requestBody).slice(0, 1500)}`);
      }
      if (ep.responses) {
        lines.push(`  responses: ${JSON.stringify(ep.responses).slice(0, 1000)}`);
      }
    }
    return lines.join("\n");
  },
};
