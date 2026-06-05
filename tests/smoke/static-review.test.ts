import { describe, it, expect, vi } from "vitest";
import { runHelper } from "@/lib/ai/run-helper";
import type { LLMProvider } from "@/lib/ai/provider";
import {
  staticReviewHelper,
  staticReviewOutputSchema,
} from "@/lib/helpers/static-review";

function makeMockProvider(payload: unknown): LLMProvider {
  return {
    name: "mock",
    generateStructured: vi.fn().mockResolvedValue(payload),
  };
}

const validPayload = {
  overallScore: 72,
  findings: [
    {
      type: "ambiguity",
      description: "The term 'fast' is not quantified.",
      severity: "major",
      suggestion: "Define a concrete performance target.",
    },
  ],
  summary: "Mostly clear with one ambiguity to resolve.",
};

const input = {
  artifactType: "requirement" as const,
  text: "The system shall respond fast to user actions.",
};

describe("static-review helper", () => {
  it("validates input, calls provider, returns schema-valid output", async () => {
    const provider = makeMockProvider(validPayload);
    const result = await runHelper(staticReviewHelper, input, provider);
    expect(() => staticReviewOutputSchema.parse(result)).not.toThrow();
    expect(result.overallScore).toBe(72);
    expect(result.findings[0].type).toBe("ambiguity");
    const call = (provider.generateStructured as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.tool.name).toBe("record_static_review");
  });

  it("rejects empty text via the Zod input schema", async () => {
    const provider = makeMockProvider(validPayload);
    await expect(
      runHelper(staticReviewHelper, { ...input, text: "" }, provider),
    ).rejects.toThrow();
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("throws when provider output violates the schema", async () => {
    const bad = makeMockProvider({
      ...validPayload,
      findings: [{ type: "wrong", description: "x", severity: "minor", suggestion: "y" }],
    });
    await expect(runHelper(staticReviewHelper, input, bad)).rejects.toThrow();
  });
});
