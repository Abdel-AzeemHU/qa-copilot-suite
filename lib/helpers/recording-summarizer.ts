import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";
import { PRIORITIES, TEST_TYPES } from "./test-case-generator";

/**
 * Takes a sequence of recorded browser actions and drafts a professional test
 * case, including suggested assertions the recording itself is missing.
 */

const recordedActionSchema = z.object({
  type: z.string(),
  target: z.string(),
  value: z.string().optional(),
  selector: z.string(),
  humanText: z.string(),
});

export const recordingSummarizerInputSchema = z.object({
  startUrl: z.string(),
  actions: z.array(recordedActionSchema).min(1, "At least one action is required"),
});

export type RecordingSummarizerInput = z.infer<
  typeof recordingSummarizerInputSchema
>;

export const recordingSummarizerOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  preconditions: z.string(),
  expectedResult: z.string(),
  priority: z.enum(PRIORITIES),
  type: z.enum(TEST_TYPES),
  suggestedAssertions: z.array(z.string()),
});

export type RecordingSummarizerOutput = z.infer<
  typeof recordingSummarizerOutputSchema
>;

const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string", description: "Concise test case title." },
    description: {
      type: "string",
      description: "A short paragraph explaining what this test verifies.",
    },
    preconditions: {
      type: "string",
      description: "Setup or state required before running the steps.",
    },
    expectedResult: {
      type: "string",
      description: "The overall expected outcome of the flow.",
    },
    priority: { type: "string", enum: [...PRIORITIES] },
    type: { type: "string", enum: [...TEST_TYPES] },
    suggestedAssertions: {
      type: "array",
      items: { type: "string" },
      description:
        "Meaningful assertions/checks the recording is missing but should have.",
    },
  },
  required: [
    "title",
    "description",
    "preconditions",
    "expectedResult",
    "priority",
    "type",
    "suggestedAssertions",
  ],
};

const SYSTEM_PROMPT = `You are a QA analyst. Given a sequence of recorded browser \
actions, infer what the user was testing and produce a clear, professional test \
case. Suggest meaningful assertions the recording is missing (the recording only \
captures clicks/typing/navigation, rarely explicit verifications). Always respond \
by calling the record_test_case tool with structured data — never free-form text.`;

export const recordingSummarizerHelper: AiHelper<
  RecordingSummarizerInput,
  RecordingSummarizerOutput
> = {
  name: "recording-summarizer",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: recordingSummarizerInputSchema,
  outputSchema: recordingSummarizerOutputSchema,
  tool: {
    name: "record_test_case",
    description:
      "Record the drafted test case inferred from the browser recording.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 4000,
  buildUserMessage: (input) => {
    const lines: string[] = [];
    lines.push(`The user recorded a browser session starting at: ${input.startUrl}`);
    lines.push("\nRecorded actions (in order):");
    input.actions.forEach((a, i) => {
      lines.push(`${i + 1}. ${a.humanText}`);
    });
    lines.push(
      "\nInfer the intent and draft a test case. Include assertions the " +
        "recording is missing.",
    );
    return lines.join("\n");
  },
};
