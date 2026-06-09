import OpenAI from "openai";
import type { LLMProvider, LLMStructuredRequest } from "./provider";

/**
 * OpenAI adapter for the {@link LLMProvider} interface. Uses OpenAI tool use
 * with a forced tool_choice to obtain structured JSON output.
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o") {
    if (!apiKey) {
      throw new Error("OpenAIProvider requires an API key");
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateStructured(req: LLMStructuredRequest): Promise<unknown> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 16000,
      tools: [
        {
          type: "function",
          function: {
            name: req.tool.name,
            description: req.tool.description,
            parameters: req.tool.inputSchema as Record<string, unknown>,
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: req.tool.name },
      },
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.userMessage },
      ],
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error(
        `OpenAI did not return a tool call for tool "${req.tool.name}"`,
      );
    }

    // The OpenAI SDK types tool_calls as a union; narrow to the standard shape.
    const args =
      "function" in toolCall
        ? (toolCall as { function: { arguments: string } }).function.arguments
        : "";
    return JSON.parse(args) as unknown;
  }
}
