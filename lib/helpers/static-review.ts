import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

export const ARTIFACT_TYPES = [
  "requirement",
  "user-story",
  "test-case",
  "test-plan",
  "other",
] as const;
export const FINDING_TYPES = [
  "gap",
  "defect",
  "ambiguity",
  "improvement",
] as const;
export const FINDING_SEVERITIES = ["critical", "major", "minor"] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

// --- Input schema ---
export const staticReviewInputSchema = z.object({
  artifactType: z.enum(ARTIFACT_TYPES),
  text: z.string().min(1, "Artifact text is required"),
});

export type StaticReviewInput = z.infer<typeof staticReviewInputSchema>;

// --- Output schema ---
export const staticReviewFindingSchema = z.object({
  type: z.enum(FINDING_TYPES),
  description: z.string(),
  severity: z.enum(FINDING_SEVERITIES),
  suggestion: z.string(),
});

export type StaticReviewFinding = z.infer<typeof staticReviewFindingSchema>;

export const staticReviewOutputSchema = z.object({
  overallScore: z.number().min(0).max(100),
  findings: z.array(staticReviewFindingSchema),
  summary: z.string(),
});

export type StaticReviewOutput = z.infer<typeof staticReviewOutputSchema>;

// --- Tool JSON Schema ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    overallScore: {
      type: "number",
      description: "Overall quality score from 0 (poor) to 100 (excellent).",
    },
    findings: {
      type: "array",
      description: "Individual review findings.",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [...FINDING_TYPES],
            description: "Category of the finding.",
          },
          description: {
            type: "string",
            description: "Clear description of the issue.",
          },
          severity: {
            type: "string",
            enum: [...FINDING_SEVERITIES],
            description: "Severity of the finding.",
          },
          suggestion: {
            type: "string",
            description: "Concrete suggestion to address the finding.",
          },
        },
        required: ["type", "description", "severity", "suggestion"],
      },
    },
    summary: {
      type: "string",
      description: "Overall summary of the review.",
    },
  },
  required: ["overallScore", "findings", "summary"],
};

const SYSTEM_PROMPT = `You are an ISTQB-certified reviewer performing a static / peer \
review of a software testing artifact (requirement, user story, test case, or test \
plan). Apply ISTQB review principles: check for gaps, defects, ambiguities, and \
improvement opportunities. For each finding, give its type, a clear description, a \
severity, and a concrete suggestion. Provide an overall quality score from 0 to 100 \
and a concise summary. Always respond by calling the record_static_review tool with \
structured data — never free-form text.`;

export const staticReviewHelper: AiHelper<
  StaticReviewInput,
  StaticReviewOutput
> = {
  name: "static-review",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: staticReviewInputSchema,
  outputSchema: staticReviewOutputSchema,
  tool: {
    name: "record_static_review",
    description: "Record the static review results as structured data.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 12000,
  buildUserMessage: (input) => {
    return [
      `Artifact type: ${input.artifactType}`,
      `\nArtifact text to review:\n${input.text}`,
    ].join("\n");
  },
};
