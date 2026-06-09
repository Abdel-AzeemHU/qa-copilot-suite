import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

// --- Input ---
export const flakinessAnalyzerInputSchema = z.object({
  testCaseTitle: z.string().optional(),
  targetUrl: z.string(),
  generatedCode: z.string(),
  totalRuns: z.number().int().positive(),
  passCount: z.number().int().min(0),
  failCount: z.number().int().min(0),
  errorCount: z.number().int().min(0),
  runSummaries: z.array(
    z.object({
      attempt: z.number(),
      result: z.enum(["passed", "failed", "error"]),
      errorMessage: z.string().optional(),
      logs: z.string().optional(),
    }),
  ),
});

export type FlakinessAnalyzerInput = z.infer<typeof flakinessAnalyzerInputSchema>;

// --- Output ---
export const flakinessAnalyzerOutputSchema = z.object({
  rootCause: z.string(),
  suggestions: z.array(z.string()).min(1),
  confidence: z.enum(["low", "medium", "high"]),
});

export type FlakinessAnalyzerOutput = z.infer<typeof flakinessAnalyzerOutputSchema>;

// --- Tool JSON Schema ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    rootCause: {
      type: "string",
      description:
        "Concise explanation of the likely root cause of flakiness. Common causes: timing/race conditions, " +
        "environment dependencies, selector instability, async operations without proper waits, " +
        "shared test state/side effects, network timeouts, or non-deterministic data.",
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
      description:
        "Actionable suggestions to fix the flaky test. Each suggestion should be specific and implementable.",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
      description:
        "'high' if error patterns clearly point to a specific cause. 'medium' if there's a likely " +
        "cause but some ambiguity. 'low' if causes are unclear from the available data.",
    },
  },
  required: ["rootCause", "suggestions", "confidence"],
};

const SYSTEM_PROMPT = `You are a senior QA automation engineer specializing in test reliability. \
Given a flaky test's run history (some runs pass, some fail) along with the test code and error patterns, \
your job is to identify the root cause of the flakiness and provide actionable suggestions to fix it.

Common root causes of flaky tests:
- Race conditions / timing issues (missing proper waits, hardcoded delays instead of dynamic waits)
- Selector instability (CSS classes that change, non-unique selectors)
- Shared test state (tests depend on side effects from previous tests)
- Environment dependencies (external APIs, network timeouts, random data)
- Non-deterministic assertions (timestamps, IDs, ordering)
- Resource contention in parallel execution

Always call the analyze_flakiness tool with structured data — never free-form text.`;

export const flakinessAnalyzerHelper: AiHelper<
  FlakinessAnalyzerInput,
  FlakinessAnalyzerOutput
> = {
  name: "flakiness-analyzer",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: flakinessAnalyzerInputSchema,
  outputSchema: flakinessAnalyzerOutputSchema,
  tool: {
    name: "analyze_flakiness",
    description: "Record root cause analysis and fix suggestions for a flaky test",
    inputSchema: toolInputSchema,
  },
  maxTokens: 4096,
  buildUserMessage(input) {
    const flakinessRate = (
      ((input.failCount + input.errorCount) / input.totalRuns) * 100
    ).toFixed(1);

    const summaryLines = input.runSummaries
      .map(
        (r) =>
          `  Run ${r.attempt}: ${r.result}${
            r.errorMessage ? ` — ${r.errorMessage.slice(0, 300)}` : ""
          }`,
      )
      .join("\n");

    const lines: string[] = [];
    if (input.testCaseTitle) lines.push(`Test: ${input.testCaseTitle}`);
    lines.push(`Target URL: ${input.targetUrl}`);
    lines.push(
      `Flakiness rate: ${flakinessRate}% (${input.failCount + input.errorCount} failures out of ${input.totalRuns} runs)`,
    );
    lines.push(`\nRun results:\n${summaryLines}`);
    lines.push(
      `\nTest code (first 3000 chars):\n\`\`\`\n${input.generatedCode.slice(0, 3000)}\n\`\`\``,
    );
    lines.push(
      "\nAnalyze the pattern and call analyze_flakiness with the root cause and fix suggestions.",
    );
    return lines.join("\n");
  },
};
