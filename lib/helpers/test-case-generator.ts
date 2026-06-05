import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

export const PRIORITIES = ["high", "medium", "low"] as const;
export const TEST_TYPES = [
  "functional",
  "edge",
  "negative",
  "performance",
  "security",
] as const;

// --- Input schema ---
export const testCaseGeneratorInputSchema = z.object({
  requirement: z
    .string()
    .min(1, "A requirement description is required"),
  targetUrl: z.string().url().optional().or(z.literal("")).optional(),
  count: z.number().int().min(1).max(25).optional(),
});

export type TestCaseGeneratorInput = z.infer<
  typeof testCaseGeneratorInputSchema
>;

// --- Output schema ---
export const generatedTestCaseSchema = z.object({
  title: z.string(),
  preconditions: z.string(),
  steps: z.array(z.string()),
  expectedResult: z.string(),
  priority: z.enum(PRIORITIES),
  type: z.enum(TEST_TYPES),
});

export type GeneratedTestCase = z.infer<typeof generatedTestCaseSchema>;

export const testCaseGeneratorOutputSchema = z.object({
  cases: z.array(generatedTestCaseSchema),
});

export type TestCaseGeneratorOutput = z.infer<
  typeof testCaseGeneratorOutputSchema
>;

// --- Tool JSON Schema (what Claude must call) ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    cases: {
      type: "array",
      description: "The list of generated test cases.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Concise title describing the test case.",
          },
          preconditions: {
            type: "string",
            description:
              "Any setup or state required before executing the steps.",
          },
          steps: {
            type: "array",
            items: { type: "string" },
            description: "Ordered list of steps to perform.",
          },
          expectedResult: {
            type: "string",
            description: "The expected outcome after performing the steps.",
          },
          priority: {
            type: "string",
            enum: [...PRIORITIES],
            description: "Test priority.",
          },
          type: {
            type: "string",
            enum: [...TEST_TYPES],
            description: "The category of the test case.",
          },
        },
        required: [
          "title",
          "preconditions",
          "steps",
          "expectedResult",
          "priority",
          "type",
        ],
      },
    },
  },
  required: ["cases"],
};

const SYSTEM_PROMPT = `You are a senior QA engineer. Given a software requirement \
(and optionally a target URL), produce a thorough, well-structured set of test \
cases. Cover the happy path plus edge, negative, performance, and security \
scenarios where relevant. Each test case must have a clear title, explicit \
preconditions, concrete ordered steps, and a precise expected result. Assign a \
sensible priority and type to each. Always respond by calling the \
record_test_cases tool with structured data — never free-form text.`;

export const testCaseGeneratorHelper: AiHelper<
  TestCaseGeneratorInput,
  TestCaseGeneratorOutput
> = {
  name: "test-case-generator",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: testCaseGeneratorInputSchema,
  outputSchema: testCaseGeneratorOutputSchema,
  tool: {
    name: "record_test_cases",
    description:
      "Record the generated test cases as structured data for the QA system.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 16000,
  buildUserMessage: (input) => {
    const lines: string[] = [];
    lines.push(`Requirement:\n${input.requirement}`);
    if (input.targetUrl) {
      lines.push(`\nTarget URL: ${input.targetUrl}`);
    }
    const count = input.count ?? 6;
    lines.push(
      `\nGenerate approximately ${count} test cases covering the requirement.`,
    );
    return lines.join("\n");
  },
};
