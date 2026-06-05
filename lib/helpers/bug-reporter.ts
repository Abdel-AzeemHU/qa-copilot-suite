import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export const PRIORITIES = ["p1", "p2", "p3", "p4"] as const;

// --- Input schema ---
export const bugReporterInputSchema = z.object({
  description: z.string().min(1, "A bug description is required"),
  stepsToReproduce: z.string().min(1, "Steps to reproduce are required"),
  environment: z.string().min(1, "Environment information is required"),
  severity: z.enum(SEVERITIES),
});

export type BugReporterInput = z.infer<typeof bugReporterInputSchema>;

// --- Output schema ---
export const bugReporterOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  stepsToReproduce: z.array(z.string()),
  expectedBehavior: z.string(),
  actualBehavior: z.string(),
  severity: z.enum(SEVERITIES),
  priority: z.enum(PRIORITIES),
  environment: z.string(),
  suggestedLabels: z.array(z.string()),
});

export type BugReporterOutput = z.infer<typeof bugReporterOutputSchema>;

// --- Tool JSON Schema ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string", description: "Concise, descriptive bug title." },
    summary: { type: "string", description: "Short summary of the issue." },
    stepsToReproduce: {
      type: "array",
      items: { type: "string" },
      description: "Ordered, explicit reproduction steps.",
    },
    expectedBehavior: {
      type: "string",
      description: "What should happen.",
    },
    actualBehavior: {
      type: "string",
      description: "What actually happens.",
    },
    severity: {
      type: "string",
      enum: [...SEVERITIES],
      description: "Technical impact severity.",
    },
    priority: {
      type: "string",
      enum: [...PRIORITIES],
      description: "Business priority to fix.",
    },
    environment: {
      type: "string",
      description: "Environment details (OS, browser, version, etc.).",
    },
    suggestedLabels: {
      type: "array",
      items: { type: "string" },
      description: "Suggested issue tracker labels.",
    },
  },
  required: [
    "title",
    "summary",
    "stepsToReproduce",
    "expectedBehavior",
    "actualBehavior",
    "severity",
    "priority",
    "environment",
    "suggestedLabels",
  ],
};

const SYSTEM_PROMPT = `You are an experienced QA engineer writing high-quality, \
reproducible bug reports. Given a raw bug description, reproduction steps, \
environment, and a severity, produce a clear, structured report: a concise title, \
a summary, explicit numbered reproduction steps, expected vs actual behavior, an \
appropriate severity and priority, normalized environment details, and useful \
issue-tracker labels. Always respond by calling the record_bug_report tool with \
structured data — never free-form text.`;

export const bugReporterHelper: AiHelper<
  BugReporterInput,
  BugReporterOutput
> = {
  name: "bug-reporter",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: bugReporterInputSchema,
  outputSchema: bugReporterOutputSchema,
  tool: {
    name: "record_bug_report",
    description: "Record the structured bug report as data.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 8000,
  buildUserMessage: (input) => {
    return [
      `Bug description:\n${input.description}`,
      `\nSteps to reproduce (raw):\n${input.stepsToReproduce}`,
      `\nEnvironment:\n${input.environment}`,
      `\nReported severity: ${input.severity}`,
    ].join("\n");
  },
};
