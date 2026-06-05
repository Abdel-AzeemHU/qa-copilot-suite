import { describe, it, expect, vi } from "vitest";
import { runHelper } from "@/lib/ai/run-helper";
import type { LLMProvider } from "@/lib/ai/provider";
import {
  bugReporterHelper,
  bugReporterOutputSchema,
} from "@/lib/helpers/bug-reporter";

function makeMockProvider(payload: unknown): LLMProvider {
  return {
    name: "mock",
    generateStructured: vi.fn().mockResolvedValue(payload),
  };
}

const validPayload = {
  title: "Checkout fails on empty cart",
  summary: "Submitting an empty cart throws a 500.",
  stepsToReproduce: ["Open cart", "Remove all items", "Click checkout"],
  expectedBehavior: "A friendly empty-cart message",
  actualBehavior: "500 server error",
  severity: "high",
  priority: "p2",
  environment: "Chrome 120, macOS",
  suggestedLabels: ["checkout", "bug"],
};

const input = {
  description: "Checkout breaks with empty cart.",
  stepsToReproduce: "Empty cart then checkout",
  environment: "Chrome 120 on macOS",
  severity: "high" as const,
};

describe("bug-reporter helper", () => {
  it("validates input, calls provider, returns schema-valid output", async () => {
    const provider = makeMockProvider(validPayload);
    const result = await runHelper(bugReporterHelper, input, provider);
    expect(() => bugReporterOutputSchema.parse(result)).not.toThrow();
    expect(result.stepsToReproduce.length).toBeGreaterThan(0);
    const call = (provider.generateStructured as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.tool.name).toBe("record_bug_report");
  });

  it("rejects empty description via the Zod input schema", async () => {
    const provider = makeMockProvider(validPayload);
    await expect(
      runHelper(bugReporterHelper, { ...input, description: "" }, provider),
    ).rejects.toThrow();
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("throws when provider output violates the schema", async () => {
    const bad = makeMockProvider({ ...validPayload, severity: "urgent" });
    await expect(runHelper(bugReporterHelper, input, bad)).rejects.toThrow();
  });
});
