import type { z } from "zod";
import type { LLMProvider, LLMToolSpec } from "./provider";

/**
 * An AiHelper bundles everything needed to run one structured LLM task:
 * a system prompt, Zod input/output schemas, and the tool spec (derived from
 * the output schema) the model must call.
 */
export interface AiHelper<TInput, TOutput> {
  name: string;
  systemPrompt: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  tool: LLMToolSpec;
  /** Build the user message string sent to the model from validated input. */
  buildUserMessage: (input: TInput) => string;
  maxTokens?: number;
}

/**
 * Runs an {@link AiHelper} end-to-end:
 *  1. validate input against the helper's Zod input schema
 *  2. ask the provider for structured output via tool use
 *  3. validate the raw tool output against the Zod output schema
 */
export async function runHelper<TInput, TOutput>(
  helper: AiHelper<TInput, TOutput>,
  input: TInput,
  provider: LLMProvider,
): Promise<TOutput> {
  const validatedInput = helper.inputSchema.parse(input);

  const raw = await provider.generateStructured({
    system: helper.systemPrompt,
    userMessage: helper.buildUserMessage(validatedInput),
    tool: helper.tool,
    maxTokens: helper.maxTokens,
  });

  return helper.outputSchema.parse(raw);
}
