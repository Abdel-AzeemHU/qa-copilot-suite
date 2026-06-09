import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMProvider,
  LLMStructuredRequest,
  LLMVisionRequest,
} from "./provider";

const MODEL = "claude-opus-4-8";

/**
 * Claude adapter for the {@link LLMProvider} interface. Uses Claude tool use
 * with a forced tool_choice to obtain structured JSON output.
 */
export class ClaudeProvider implements LLMProvider {
  readonly name = "claude";
  private client: Anthropic;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("ClaudeProvider requires an API key");
    }
    this.client = new Anthropic({ apiKey });
  }

  async generateStructured(req: LLMStructuredRequest): Promise<unknown> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system,
      tools: [
        {
          name: req.tool.name,
          description: req.tool.description,
          input_schema: req.tool
            .inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: req.tool.name },
      messages: [{ role: "user", content: req.userMessage }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === req.tool.name,
    );

    if (!toolUse) {
      throw new Error(
        `Claude did not return a tool_use block for tool "${req.tool.name}"`,
      );
    }

    return toolUse.input;
  }

  async generateWithVision(req: LLMVisionRequest): Promise<unknown> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system,
      tools: [
        {
          name: req.tool.name,
          description: req.tool.description,
          input_schema: req.tool.inputSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: req.tool.name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: req.imageMimeType as "image/png",
                data: req.imageBase64,
              },
            },
            { type: "text", text: req.userMessage },
          ],
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === req.tool.name,
    );

    if (!toolUse) {
      throw new Error(
        `Claude did not return a tool_use block for tool "${req.tool.name}"`,
      );
    }

    return toolUse.input;
  }
}
