import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

export const FRAMEWORKS = ["playwright", "selenium", "rest-assured"] as const;
export const LANGUAGES = ["typescript", "java"] as const;

// --- Input schema ---
export const automationTestCaseSchema = z.object({
  title: z.string(),
  preconditions: z.string().optional(),
  steps: z.array(z.string()),
  expectedResult: z.string().optional(),
});

export const automationCodeGeneratorInputSchema = z.object({
  framework: z.enum(FRAMEWORKS),
  language: z.enum(LANGUAGES),
  testCases: z
    .array(automationTestCaseSchema)
    .min(1, "At least one test case is required"),
});

export type AutomationCodeGeneratorInput = z.infer<
  typeof automationCodeGeneratorInputSchema
>;

// --- Output schema ---
export const generatedFileSchema = z.object({
  filename: z.string(),
  language: z.string(),
  content: z.string(),
});

export type GeneratedFile = z.infer<typeof generatedFileSchema>;

export const automationCodeGeneratorOutputSchema = z.object({
  files: z.array(generatedFileSchema),
});

export type AutomationCodeGeneratorOutput = z.infer<
  typeof automationCodeGeneratorOutputSchema
>;

// --- Tool JSON Schema ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    files: {
      type: "array",
      description: "The generated automation code files.",
      items: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description:
              "The file path/name, e.g. pages/LoginPage.ts or tests/login.spec.ts.",
          },
          language: {
            type: "string",
            description: "The programming language of the file.",
          },
          content: {
            type: "string",
            description: "The full source code content of the file.",
          },
        },
        required: ["filename", "language", "content"],
      },
    },
  },
  required: ["files"],
};

const SYSTEM_PROMPT = `You are a senior test automation engineer. Given a list of \
test cases, a target framework, and a programming language, generate clean, \
production-quality automation code that follows the Page Object Model (POM) \
pattern. Separate page objects from test specs into distinct files. Use idiomatic \
conventions for the chosen framework and language, include necessary imports, and \
write maintainable, readable code. Always respond by calling the \
record_automation_code tool with the full set of files — never free-form text.`;

export const automationCodeGeneratorHelper: AiHelper<
  AutomationCodeGeneratorInput,
  AutomationCodeGeneratorOutput
> = {
  name: "automation-code-generator",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: automationCodeGeneratorInputSchema,
  outputSchema: automationCodeGeneratorOutputSchema,
  tool: {
    name: "record_automation_code",
    description:
      "Record the generated automation code files as structured data.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 32000,
  buildUserMessage: (input) => {
    const lines: string[] = [];
    lines.push(`Target framework: ${input.framework}`);
    lines.push(`Language: ${input.language}`);
    lines.push(`\nGenerate Page Object Model automation code for these test cases:`);
    input.testCases.forEach((tc, i) => {
      lines.push(`\n${i + 1}. ${tc.title}`);
      if (tc.preconditions) lines.push(`   Preconditions: ${tc.preconditions}`);
      if (tc.steps.length) {
        lines.push(`   Steps:`);
        tc.steps.forEach((s, j) => lines.push(`     ${j + 1}. ${s}`));
      }
      if (tc.expectedResult)
        lines.push(`   Expected: ${tc.expectedResult}`);
    });
    return lines.join("\n");
  },
};
