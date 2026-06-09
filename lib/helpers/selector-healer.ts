import { z } from "zod";
import type { AiHelper } from "../ai/run-helper";

// --- Input schema ---
export const selectorHealerInputSchema = z.object({
  originalSelector: z.string(),
  errorMessage: z.string(),
  domCandidates: z.array(
    z.object({
      tag: z.string(),
      testId: z.string().optional(),
      role: z.string().optional(),
      ariaLabel: z.string().optional(),
      placeholder: z.string().optional(),
      text: z.string().optional(),
      id: z.string().optional(),
      classes: z.string().optional(),
    }),
  ),
  description: z.string().optional(),
});

export type SelectorHealerInput = z.infer<typeof selectorHealerInputSchema>;

// --- Output schema ---
export const selectorHealerOutputSchema = z.object({
  healedSelector: z.string(),
  strategy: z.enum(["testid", "role", "label", "placeholder", "text", "css"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type SelectorHealerOutput = z.infer<typeof selectorHealerOutputSchema>;

// --- Tool JSON Schema ---
const toolInputSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    healedSelector: {
      type: "string",
      description:
        "The replacement selector that will match exactly one visible element. " +
        "Output ONLY the selector string — no Playwright method wrapping (no page.locator(), no getByTestId(), etc.)",
    },
    strategy: {
      type: "string",
      enum: ["testid", "role", "label", "placeholder", "text", "css"],
      description:
        "The strategy used: 'testid' for data-testid/data-test attributes, " +
        "'role' for ARIA role-based, 'label' for aria-label, 'placeholder' for input placeholder, " +
        "'text' for visible text content, 'css' for CSS selector fallback.",
    },
    confidence: {
      type: "number",
      description: "Confidence score between 0 and 1 that this selector matches the intended element.",
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of why this selector was chosen.",
    },
  },
  required: ["healedSelector", "strategy", "confidence", "reasoning"],
};

const SYSTEM_PROMPT = `You are a senior QA automation engineer specializing in Playwright selector repair.

Given a broken selector, its error message, and a list of DOM candidates extracted from the page, \
your task is to identify the best replacement selector.

Selector priority (use highest available):
1. data-testid / data-test / data-cy attributes (strategy: "testid")
2. ARIA role combined with accessible name (strategy: "role")
3. aria-label attribute (strategy: "label")
4. placeholder attribute for inputs (strategy: "placeholder")
5. Visible text content (strategy: "text")
6. CSS selector as last resort (strategy: "css")

Rules:
- Return a selector that matches EXACTLY ONE visible element
- Avoid overly broad selectors (bare "div", "button" with no qualifiers)
- Prefer stable attributes (data-testid, role, aria-label) over positional or class-based selectors
- Avoid Tailwind utility classes; prefer semantic class names if CSS is used
- The healedSelector must be a raw selector string only — no Playwright wrappers

Always respond by calling the record_healed_selector tool.`;

export const selectorHealerHelper: AiHelper<
  SelectorHealerInput,
  SelectorHealerOutput
> = {
  name: "selector-healer",
  systemPrompt: SYSTEM_PROMPT,
  inputSchema: selectorHealerInputSchema,
  outputSchema: selectorHealerOutputSchema,
  tool: {
    name: "record_healed_selector",
    description:
      "Record the healed selector that replaces the broken one, along with the strategy and confidence.",
    inputSchema: toolInputSchema,
  },
  maxTokens: 2048,
  buildUserMessage: (input) => {
    const lines: string[] = [];
    lines.push(`Broken selector: ${input.originalSelector}`);
    lines.push(`Error message: ${input.errorMessage}`);
    if (input.description) {
      lines.push(`Element description: ${input.description}`);
    }
    lines.push(`\nDOM candidates (${input.domCandidates.length} elements):`);
    for (const c of input.domCandidates) {
      const parts: string[] = [`<${c.tag}`];
      if (c.id) parts.push(` id="${c.id}"`);
      if (c.testId) parts.push(` data-testid="${c.testId}"`);
      if (c.role) parts.push(` role="${c.role}"`);
      if (c.ariaLabel) parts.push(` aria-label="${c.ariaLabel}"`);
      if (c.placeholder) parts.push(` placeholder="${c.placeholder}"`);
      if (c.classes) parts.push(` class="${c.classes}"`);
      parts.push(">");
      if (c.text) parts.push(` [text: "${c.text}"]`);
      lines.push(parts.join(""));
    }
    lines.push(
      "\nIdentify which DOM candidate matches the intended element and provide the best replacement selector.",
    );
    return lines.join("\n");
  },
};
