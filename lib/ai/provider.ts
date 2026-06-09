// LLMProvider abstraction. A provider knows how to take a system prompt, a user
// message, and a single output "tool" schema, and return a structured JSON
// object that Claude (or another LLM) produced via tool use.

export interface LLMToolSpec {
  /** Tool name the model must call. */
  name: string;
  /** Human/model-readable description of what the tool captures. */
  description: string;
  /** JSON Schema (object) describing the tool's input = our desired output. */
  inputSchema: Record<string, unknown>;
}

export interface LLMStructuredRequest {
  system: string;
  userMessage: string;
  tool: LLMToolSpec;
  maxTokens?: number;
}

export interface LLMVisionRequest {
  system: string;
  userMessage: string;
  imageBase64: string;
  imageMimeType: string;
  tool: LLMToolSpec;
  maxTokens?: number;
}

export interface LLMProvider {
  readonly name: string;
  /**
   * Runs a single structured-output request. The returned value is the raw
   * tool input the model produced (unvalidated JSON object). Callers are
   * expected to validate it against their own Zod schema.
   */
  generateStructured(req: LLMStructuredRequest): Promise<unknown>;

  /**
   * Optional vision-capable structured output: sends an image alongside the
   * user message. Falls back to generateStructured if not implemented.
   */
  generateWithVision?(req: LLMVisionRequest): Promise<unknown>;
}
