import { z } from "zod";
import type { LLMProvider } from "../ai/provider";

export const visualTriageInputSchema = z.object({
  url: z.string(),
  diffScore: z.number(),
  changedPixels: z.number(),
  totalPixels: z.number(),
});

export type VisualTriageInput = z.infer<typeof visualTriageInputSchema>;

export const visualTriageOutputSchema = z.object({
  severity: z.enum(["none", "cosmetic", "layout", "critical"]),
  summary: z.string(),
  intentional: z.boolean(),
  recommendation: z.string(),
});

export type VisualTriageOutput = z.infer<typeof visualTriageOutputSchema>;

const SYSTEM_PROMPT =
  "You are a visual QA expert. You are given a pixel-diff image (red = changed pixels) of a webpage. " +
  "Classify the severity of the visual change, describe what changed, and assess whether this looks like " +
  "an intentional update or a regression.";

const toolSpec = {
  name: "record_visual_triage",
  description: "Record the visual triage result as structured data.",
  inputSchema: {
    type: "object",
    properties: {
      severity: {
        type: "string",
        enum: ["none", "cosmetic", "layout", "critical"],
        description: "Severity of the visual change.",
      },
      summary: {
        type: "string",
        description: "1-2 sentence description of what changed.",
      },
      intentional: {
        type: "boolean",
        description: "Is this likely an intentional update (true) or a regression (false)?",
      },
      recommendation: {
        type: "string",
        description:
          'One of: "Accept as new baseline", "Investigate", or "Reject — likely regression".',
      },
    },
    required: ["severity", "summary", "intentional", "recommendation"],
  } as Record<string, unknown>,
};

export async function runVisualTriage(
  params: VisualTriageInput,
  diffImageBase64: string | null,
  provider: LLMProvider,
): Promise<VisualTriageOutput> {
  const diffPct = (params.diffScore * 100).toFixed(2);
  const userMessage =
    `URL: ${params.url}\n` +
    `Changed pixels: ${params.changedPixels} / ${params.totalPixels} (${diffPct}%)\n\n` +
    `Analyse the diff image (red highlights mark changed pixels) and triage the visual change.`;

  let raw: unknown;

  if (diffImageBase64 && provider.generateWithVision) {
    raw = await provider.generateWithVision({
      system: SYSTEM_PROMPT,
      userMessage,
      imageBase64: diffImageBase64,
      imageMimeType: "image/png",
      tool: toolSpec,
      maxTokens: 1024,
    });
  } else {
    // Graceful degradation: text-only fallback
    const textMessage =
      userMessage +
      `\n\n(No diff image available — classify based on the diff score alone.)`;
    raw = await provider.generateStructured({
      system: SYSTEM_PROMPT,
      userMessage: textMessage,
      tool: toolSpec,
      maxTokens: 1024,
    });
  }

  return visualTriageOutputSchema.parse(raw);
}
