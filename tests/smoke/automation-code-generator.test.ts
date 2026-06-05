import { describe, it, expect, vi } from "vitest";
import { runHelper } from "@/lib/ai/run-helper";
import type { LLMProvider } from "@/lib/ai/provider";
import {
  automationCodeGeneratorHelper,
  automationCodeGeneratorOutputSchema,
} from "@/lib/helpers/automation-code-generator";

function makeMockProvider(payload: unknown): LLMProvider {
  return {
    name: "mock",
    generateStructured: vi.fn().mockResolvedValue(payload),
  };
}

const validPayload = {
  files: [
    {
      filename: "pages/LoginPage.ts",
      language: "typescript",
      content: "export class LoginPage {}",
    },
    {
      filename: "tests/login.spec.ts",
      language: "typescript",
      content: "test('login', async () => {});",
    },
  ],
};

const input = {
  framework: "playwright" as const,
  language: "typescript" as const,
  testCases: [
    {
      title: "User can log in",
      preconditions: "Registered user",
      steps: ["Go to /login", "Submit credentials"],
      expectedResult: "Dashboard shown",
    },
  ],
};

describe("automation-code-generator helper", () => {
  it("validates input, calls provider, returns schema-valid output", async () => {
    const provider = makeMockProvider(validPayload);
    const result = await runHelper(
      automationCodeGeneratorHelper,
      input,
      provider,
    );
    expect(() =>
      automationCodeGeneratorOutputSchema.parse(result),
    ).not.toThrow();
    expect(result.files).toHaveLength(2);
    const call = (provider.generateStructured as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.tool.name).toBe("record_automation_code");
    expect(call.userMessage).toContain("playwright");
  });

  it("rejects empty test cases via the Zod input schema", async () => {
    const provider = makeMockProvider(validPayload);
    await expect(
      runHelper(
        automationCodeGeneratorHelper,
        { ...input, testCases: [] },
        provider,
      ),
    ).rejects.toThrow();
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("throws when provider output violates the schema", async () => {
    const bad = makeMockProvider({ files: [{ filename: "x" }] });
    await expect(
      runHelper(automationCodeGeneratorHelper, input, bad),
    ).rejects.toThrow();
  });
});
