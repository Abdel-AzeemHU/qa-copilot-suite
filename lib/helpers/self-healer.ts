import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

export const CLASSIFICATIONS = [
  "repairable",
  "likely_bug",
  "inconclusive",
] as const;

export const CONFIDENCES = ["low", "medium", "high"] as const;

// --- Input schema ---
export const selfHealerInputSchema = z.object({
  requirement: z.string().min(1, "A requirement is required"),
  testCaseTitle: z.string().optional(),
  targetUrl: z.string().min(1, "A target URL is required"),
  generatedCode: z.string().min(1, "Generated code is required"),
  logs: z.string(),
  errorMessage: z.string().optional(),
});

export type SelfHealerInput = z.infer<typeof selfHealerInputSchema>;

// --- Output schema ---
export const selfHealerOutputSchema = z
  .object({
    classification: z.enum(CLASSIFICATIONS),
    diagnosis: z.string(),
    patchedCode: z.string().optional(),
    confidence: z.enum(CONFIDENCES),
  })
  .refine(
    (val) => val.classification !== "repairable" || !!val.patchedCode?.trim(),
    {
      message: "patchedCode is required when classification is 'repairable'",
      path: ["patchedCode"],
    },
  );

export type SelfHealerOutput = z.infer<typeof selfHealerOutputSchema>;

// --- Tool JSON Schema ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    classification: {
      type: "string",
      enum: [...CLASSIFICATIONS],
      description:
        "'repairable' if this looks like an automation-layer issue (stale selector, " +
        "timing/race condition, wrong locator strategy, minor markup drift) where the " +
        "expected app behavior is NOT in question. 'likely_bug' if the application did " +
        "not behave as the requirement/test case expected (assertion mismatches on actual " +
        "app state/content/values, unexpected error pages, wrong navigation). " +
        "'inconclusive' if there isn't enough signal (infrastructure/network errors, " +
        "ambiguous logs). Be conservative: only choose 'repairable' when reasonably " +
        "confident the app itself is fine — bias toward 'likely_bug' or 'inconclusive' when in doubt.",
    },
    diagnosis: {
      type: "string",
      description:
        "Explanation of what went wrong and why this classification was reached.",
    },
    patchedCode: {
      type: "string",
      description:
        "A corrected, full version of the automation script that fixes the diagnosed " +
        "automation-layer issue WITHOUT changing what is being asserted/verified — the " +
        "intent of the test must be preserved, only the mechanics of locating/waiting/" +
        "interacting should change. ONLY provide this when classification is 'repairable'.",
    },
    confidence: {
      type: "string",
      enum: [...CONFIDENCES],
      description: "Confidence in this classification.",
    },
  },
  required: ["classification", "diagnosis", "confidence"],
};

const SYSTEM_PROMPT = `You are a senior QA automation engineer performing self-healing \
triage on a failed test execution. Given the original requirement/test case, the target \
URL, the generated automation code, and the failure logs/error message, you must decide \
whether the failure is:

- "repairable": an automation-layer problem (stale/changed selector, timing/race \
condition, wrong locator strategy, minor markup drift) where the expected behavior of \
the application itself is NOT in question. In this case you MUST also produce \
patchedCode: a corrected full version of the automation script that fixes the mechanics \
of locating/waiting/interacting WITHOUT changing what is being asserted or verified — \
preserve the intent of the test exactly.
- "likely_bug": the application did not behave as the requirement/test case expected \
(assertion mismatches on actual app state/content/values, unexpected error pages, wrong \
navigation, etc). Do NOT produce patched code in this case.
- "inconclusive": not enough signal to confidently decide (infrastructure/network errors, \
ambiguous logs). Do NOT produce patched code.

Be conservative. Silently masking a real product bug behind an auto-repair would be worse \
than asking a human to review — only classify as "repairable" when you are reasonably \
confident the application itself is behaving correctly. When in doubt, prefer "likely_bug" \
or "inconclusive". Always respond by calling the record_healing_diagnosis tool with \
structured data — never free-form text.`;

export const selfHealerHelper: AiHelper<SelfHealerInput, SelfHealerOutput> = {
  name: "self-healer",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: selfHealerInputSchema,
  outputSchema: selfHealerOutputSchema,
  tool: {
    name: "record_healing_diagnosis",
    description:
      "Record the structured diagnosis of a failed automation run, including classification and (if repairable) patched code.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 16000,
  buildUserMessage: (input) => {
    const lines: string[] = [];
    lines.push(`Requirement:\n${input.requirement}`);
    if (input.testCaseTitle) {
      lines.push(`\nTest case title: ${input.testCaseTitle}`);
    }
    lines.push(`\nTarget URL: ${input.targetUrl}`);
    lines.push(`\nGenerated automation code:\n${input.generatedCode}`);
    lines.push(`\nFailure logs:\n${input.logs || "(no logs captured)"}`);
    if (input.errorMessage) {
      lines.push(`\nError message:\n${input.errorMessage}`);
    }
    lines.push(
      `\nDiagnose why this run failed and classify it as repairable, likely_bug, or ` +
        `inconclusive. If repairable, provide a corrected full version of the automation ` +
        `code that preserves the test's intent.`,
    );
    return lines.join("\n");
  },
};
