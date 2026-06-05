import { describe, it, expect, vi } from "vitest";
import { runHelper } from "@/lib/ai/run-helper";
import type { LLMProvider } from "@/lib/ai/provider";
import {
  testPlannerHelper,
  testPlannerOutputSchema,
} from "@/lib/helpers/test-planner";

function makeMockProvider(payload: unknown): LLMProvider {
  return {
    name: "mock",
    generateStructured: vi.fn().mockResolvedValue(payload),
  };
}

const validPayload = {
  strategy: "Risk-based testing across all levels.",
  scope: "In: web app. Out: native mobile.",
  testLevels: ["unit", "integration", "system"],
  resources: { people: "2 QA engineers", tools: ["Playwright", "Jira"] },
  timeline: [
    {
      phase: "Planning",
      duration: "2 days",
      activities: ["Define scope", "Identify risks"],
    },
  ],
  risks: [{ risk: "Tight deadline", mitigation: "Prioritize critical paths" }],
};

const input = {
  description: "An e-commerce checkout flow.",
  scope: "Checkout and payment.",
  teamSize: 3,
  sprintLengthDays: 14,
};

describe("test-planner helper", () => {
  it("validates input, calls provider, returns schema-valid output", async () => {
    const provider = makeMockProvider(validPayload);
    const result = await runHelper(testPlannerHelper, input, provider);
    expect(() => testPlannerOutputSchema.parse(result)).not.toThrow();
    expect(result.testLevels.length).toBeGreaterThan(0);
    expect(result.timeline[0].phase).toBe("Planning");
    const call = (provider.generateStructured as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.tool.name).toBe("record_test_plan");
  });

  it("rejects invalid team size via the Zod input schema", async () => {
    const provider = makeMockProvider(validPayload);
    await expect(
      runHelper(testPlannerHelper, { ...input, teamSize: 0 }, provider),
    ).rejects.toThrow();
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("throws when provider output violates the schema", async () => {
    const bad = makeMockProvider({ strategy: "x" });
    await expect(runHelper(testPlannerHelper, input, bad)).rejects.toThrow();
  });
});
