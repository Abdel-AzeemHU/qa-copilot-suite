import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

// --- Input schema ---
export const testPlannerInputSchema = z.object({
  description: z.string().min(1, "A project description is required"),
  scope: z.string().min(1, "A scope is required"),
  teamSize: z.number().int().min(1).max(1000),
  sprintLengthDays: z.number().int().min(1).max(365),
});

export type TestPlannerInput = z.infer<typeof testPlannerInputSchema>;

// --- Output schema ---
export const testPlannerOutputSchema = z.object({
  strategy: z.string(),
  scope: z.string(),
  testLevels: z.array(z.string()),
  resources: z.object({
    people: z.string(),
    tools: z.array(z.string()),
  }),
  timeline: z.array(
    z.object({
      phase: z.string(),
      duration: z.string(),
      activities: z.array(z.string()),
    }),
  ),
  risks: z.array(
    z.object({
      risk: z.string(),
      mitigation: z.string(),
    }),
  ),
});

export type TestPlannerOutput = z.infer<typeof testPlannerOutputSchema>;

// --- Tool JSON Schema ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    strategy: {
      type: "string",
      description: "The overall test strategy narrative.",
    },
    scope: {
      type: "string",
      description: "What is in and out of scope for testing.",
    },
    testLevels: {
      type: "array",
      items: { type: "string" },
      description:
        "Test levels to apply, e.g. unit, integration, system, acceptance.",
    },
    resources: {
      type: "object",
      properties: {
        people: {
          type: "string",
          description: "Description of the people/roles needed.",
        },
        tools: {
          type: "array",
          items: { type: "string" },
          description: "Tools and frameworks to use.",
        },
      },
      required: ["people", "tools"],
    },
    timeline: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phase: { type: "string" },
          duration: { type: "string" },
          activities: { type: "array", items: { type: "string" } },
        },
        required: ["phase", "duration", "activities"],
      },
      description: "Phased timeline of the test effort.",
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          risk: { type: "string" },
          mitigation: { type: "string" },
        },
        required: ["risk", "mitigation"],
      },
      description: "Identified risks and their mitigations.",
    },
  },
  required: [
    "strategy",
    "scope",
    "testLevels",
    "resources",
    "timeline",
    "risks",
  ],
};

const SYSTEM_PROMPT = `You are a QA lead and test strategist. Given a project \
description, scope, team size, and sprint length, produce a comprehensive, \
practical test strategy aligned with ISTQB best practices. Cover the strategy, \
in/out-of-scope items, appropriate test levels, required people and tools, a \
realistic phased timeline that fits the sprint length, and the key risks with \
concrete mitigations. Always respond by calling the record_test_plan tool with \
structured data — never free-form text.`;

export const testPlannerHelper: AiHelper<
  TestPlannerInput,
  TestPlannerOutput
> = {
  name: "test-planner",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: testPlannerInputSchema,
  outputSchema: testPlannerOutputSchema,
  tool: {
    name: "record_test_plan",
    description: "Record the generated test plan as structured data.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 16000,
  buildUserMessage: (input) => {
    return [
      `Project description:\n${input.description}`,
      `\nScope:\n${input.scope}`,
      `\nTeam size: ${input.teamSize} people`,
      `Sprint length: ${input.sprintLengthDays} days`,
    ].join("\n");
  },
};
