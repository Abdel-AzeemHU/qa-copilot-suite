import { describe, it, expect, vi } from "vitest";
import { runHelper } from "@/lib/ai/run-helper";
import type { LLMProvider } from "@/lib/ai/provider";
import {
  testCaseGeneratorHelper,
  testCaseGeneratorOutputSchema,
} from "@/lib/helpers/test-case-generator";

// A mock provider that returns a fixed, schema-valid structured payload.
function makeMockProvider(payload: unknown): LLMProvider {
  return {
    name: "mock",
    generateStructured: vi.fn().mockResolvedValue(payload),
  };
}

const validPayload = {
  cases: [
    {
      title: "User can log in with valid credentials",
      preconditions: "A registered user exists",
      steps: ["Navigate to /login", "Enter valid email and password", "Submit"],
      expectedResult: "User is redirected to the dashboard",
      priority: "high",
      type: "functional",
    },
    {
      title: "Login rejects an empty password",
      preconditions: "On the login page",
      steps: ["Enter email", "Leave password blank", "Submit"],
      expectedResult: "A validation error is shown",
      priority: "medium",
      type: "negative",
    },
  ],
};

describe("test-case-generator helper", () => {
  it("validates input, calls the provider, and returns schema-valid output", async () => {
    const provider = makeMockProvider(validPayload);

    const result = await runHelper(
      testCaseGeneratorHelper,
      { requirement: "Users must be able to log in." },
      provider,
    );

    // Output conforms to the declared Zod output schema.
    expect(() => testCaseGeneratorOutputSchema.parse(result)).not.toThrow();
    expect(result.cases).toHaveLength(2);
    expect(result.cases[0].priority).toBe("high");
    expect(result.cases[0].type).toBe("functional");
    expect(Array.isArray(result.cases[0].steps)).toBe(true);

    // Provider received the system prompt and a forced tool spec.
    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
    const call = (provider.generateStructured as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    expect(call.tool.name).toBe("record_test_cases");
    expect(call.system).toContain("QA engineer");
    expect(call.userMessage).toContain("Users must be able to log in.");
  });

  it("rejects empty requirement input via the Zod input schema", async () => {
    const provider = makeMockProvider(validPayload);
    await expect(
      runHelper(testCaseGeneratorHelper, { requirement: "" }, provider),
    ).rejects.toThrow();
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("throws when the provider returns output violating the schema", async () => {
    // priority is not one of the allowed enum values.
    const badProvider = makeMockProvider({
      cases: [
        {
          title: "x",
          preconditions: "y",
          steps: ["z"],
          expectedResult: "w",
          priority: "urgent",
          type: "functional",
        },
      ],
    });
    await expect(
      runHelper(
        testCaseGeneratorHelper,
        { requirement: "something" },
        badProvider,
      ),
    ).rejects.toThrow();
  });
});

describe("ClaudeProvider tool-use path (mocked Anthropic client)", () => {
  it("extracts structured input from a tool_use block", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "record_test_cases",
          id: "toolu_1",
          input: validPayload,
        },
      ],
    });

    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create };
      },
    }));

    const { ClaudeProvider } = await import("@/lib/ai/claude");
    const provider = new ClaudeProvider("sk-ant-test");

    const result = await runHelper(
      testCaseGeneratorHelper,
      { requirement: "Login flow" },
      provider,
    );

    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0][0];
    expect(args.tool_choice).toEqual({
      type: "tool",
      name: "record_test_cases",
    });
    expect(result.cases).toHaveLength(2);

    vi.doUnmock("@anthropic-ai/sdk");
  });
});
