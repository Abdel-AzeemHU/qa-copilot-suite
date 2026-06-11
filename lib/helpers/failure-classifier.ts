import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

export const FAILURE_CLASSES = [
  "real_bug",
  "flaky",
  "environment",
  "automation",
] as const;

export const CONFIDENCES = ["low", "medium", "high"] as const;

// --- Input ---
export const failureClassifierInputSchema = z.object({
  targetUrl: z.string(),
  generatedCode: z.string(),
  logs: z.string(),
  errorMessage: z.string().optional(),
  // Optional context that sharpens the classification:
  testCaseTitle: z.string().optional(),
  requirement: z.string().optional(),
  recentHistory: z
    .array(
      z.object({
        result: z.string(),
        errorMessage: z.string().optional(),
        completedAt: z.string().optional(),
      }),
    )
    .optional(),
});

export type FailureClassifierInput = z.infer<typeof failureClassifierInputSchema>;

// --- Output ---
export const failureClassifierOutputSchema = z.object({
  failureClass: z.enum(FAILURE_CLASSES),
  confidence: z.enum(CONFIDENCES),
  summary: z.string(),
});

export type FailureClassifierOutput = z.infer<typeof failureClassifierOutputSchema>;

// --- Tool JSON Schema ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    failureClass: {
      type: "string",
      enum: [...FAILURE_CLASSES],
      description:
        "'real_bug': the application did not behave as expected — assertion mismatches on actual app " +
        "state/content/values, error pages, wrong navigation, broken functionality. " +
        "'flaky': non-deterministic failure — timing/race conditions, animations, async operations " +
        "without proper waits, intermittent symptoms, or history shows the same test alternating pass/fail. " +
        "'environment': infrastructure problems — network timeouts/DNS failures, target site unreachable, " +
        "missing dependencies/browsers, out of memory, CI resource limits. " +
        "'automation': the test code itself is wrong — stale/invalid selectors, syntax errors in the " +
        "script, wrong locator strategy, test logic bugs (the app is fine, the script is not).",
    },
    confidence: {
      type: "string",
      enum: [...CONFIDENCES],
      description:
        "'high' when the logs clearly indicate one class. 'medium' when likely but ambiguous. " +
        "'low' when there is little signal.",
    },
    summary: {
      type: "string",
      description:
        "One short paragraph: what failed, why this classification, and what a human should check first.",
    },
  },
  required: ["failureClass", "confidence", "summary"],
};

const SYSTEM_PROMPT = `You are a senior QA engineer triaging a failed automated test run. \
Your job is to classify WHY it failed into exactly one of four classes:

- "real_bug": the application under test misbehaved. The test did its job — it caught a product defect. \
Signals: assertions failing on actual application content/state/values, unexpected error pages, wrong \
redirects, features not working.
- "flaky": the failure is non-deterministic. Signals: timeout waiting for elements that normally appear, \
race conditions, animation/timing sensitivity, network jitter on otherwise-working endpoints, or run \
history showing the same test alternating between pass and fail.
- "environment": the infrastructure failed, not the app or the test. Signals: DNS errors, connection \
refused, target completely unreachable, missing browser binaries, out-of-memory, disk/CI resource errors.
- "automation": the test script itself is defective. Signals: selectors that never existed or are stale, \
script syntax/reference errors, wrong locator strategy, incorrect test logic while the app behaves fine.

Decision discipline:
- A selector that FORMERLY worked and the page changed → "automation" (the script is now wrong).
- An assertion comparing expected vs. actual app behavior that fails consistently → "real_bug".
- If run history shows pass/fail alternation with no code change → strongly favor "flaky".
- Total inability to reach the target → "environment".
Misclassifying a real bug as flaky/automation hides defects from the team — when genuinely torn between \
"real_bug" and another class, prefer "real_bug" with lower confidence so a human reviews it.

Always respond by calling the classify_failure tool with structured data — never free-form text.`;

export const failureClassifierHelper: AiHelper<
  FailureClassifierInput,
  FailureClassifierOutput
> = {
  name: "failure-classifier",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: failureClassifierInputSchema,
  outputSchema: failureClassifierOutputSchema,
  tool: {
    name: "classify_failure",
    description:
      "Record the structured classification of why a test run failed.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 2048,
  buildUserMessage: (input) => {
    const lines: string[] = [];
    if (input.testCaseTitle) lines.push(`Test case: ${input.testCaseTitle}`);
    if (input.requirement) lines.push(`Requirement: ${input.requirement}`);
    lines.push(`Target URL: ${input.targetUrl}`);
    lines.push(`\nTest code:\n${input.generatedCode.slice(0, 4000)}`);
    lines.push(`\nFailure logs (tail):\n${input.logs.slice(-3000) || "(no logs captured)"}`);
    if (input.errorMessage) lines.push(`\nError message:\n${input.errorMessage}`);
    if (input.recentHistory?.length) {
      lines.push(
        `\nRecent run history for this project (newest first):\n` +
          input.recentHistory
            .map(
              (h) =>
                `  - ${h.result}${h.errorMessage ? ` (${h.errorMessage.slice(0, 120)})` : ""}`,
            )
            .join("\n"),
      );
    }
    lines.push(
      `\nClassify this failure as real_bug, flaky, environment, or automation.`,
    );
    return lines.join("\n");
  },
};
