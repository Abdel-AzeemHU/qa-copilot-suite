import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  selfHealerOutputSchema,
  selfHealerInputSchema,
} from "@/lib/helpers/self-healer";

// --- Mocks for the orchestration ---

const healingAttemptUpdates: Array<Record<string, unknown>> = [];
const findUniqueAttempt = vi.fn();
const updateAttempt = vi.fn(
  async ({ data }: { data: Record<string, unknown> }) => {
    healingAttemptUpdates.push(data);
    return {};
  },
);

const executionRunCreate = vi.fn();
const executionRunFindUnique = vi.fn();

const apiKeyRecord = {
  encryptedKey: "encrypted",
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    healingAttempt: {
      findUnique: (...args: unknown[]) => findUniqueAttempt(...args),
      update: (...args: unknown[]) => updateAttempt(...args),
    },
    executionRun: {
      create: (...args: unknown[]) => executionRunCreate(...args),
      findUnique: (...args: unknown[]) => executionRunFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(() => "fake-api-key"),
}));

vi.mock("@/lib/data", () => ({
  getClaudeApiKeyRecord: vi.fn(async () => apiKeyRecord),
}));

vi.mock("@/lib/ai/claude", () => ({
  ClaudeProvider: class {
    name = "claude";
  },
}));

vi.mock("@/lib/ai/get-provider", () => ({
  getProviderForOwner: vi.fn(async () => ({ name: "claude" })),
}));

const generateStructured = vi.fn();
vi.mock("@/lib/ai/run-helper", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/run-helper")>(
    "@/lib/ai/run-helper",
  );
  return {
    ...actual,
    runHelper: vi.fn(async (helper, input, _provider) => {
      const raw = await generateStructured(input);
      return helper.outputSchema.parse(raw);
    }),
  };
});

const executeRun = vi.fn(async () => {});
vi.mock("@/worker/executor", () => ({
  executeRun: (...args: unknown[]) => executeRun(...args),
}));

import { runHealingAttempt } from "@/worker/healer";

const baseRun = {
  id: "run1",
  projectId: "proj1",
  targetUrl: "https://example.com",
  framework: "playwright",
  generatedCode: "console.log('hi')",
  logs: "boom",
  errorMessage: "Element not found: #submit",
  status: "failed",
  result: "failed",
  project: {
    organization: { ownerId: "user1" },
  },
  testCases: [
    {
      id: "tc1",
      title: "Submits the form",
      requirement: "Users can submit the contact form",
      steps: "[]",
      expectedResult: "Form is submitted",
    },
  ],
};

const baseAttempt = {
  id: "attempt1",
  attemptNumber: 1,
  executionRun: baseRun,
};

describe("selfHealerOutputSchema", () => {
  it("accepts a repairable classification with patchedCode", () => {
    const result = selfHealerOutputSchema.safeParse({
      classification: "repairable",
      diagnosis: "Selector changed from #submit to #submit-btn",
      patchedCode: "console.log('patched')",
      confidence: "high",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a repairable classification missing patchedCode", () => {
    const result = selfHealerOutputSchema.safeParse({
      classification: "repairable",
      diagnosis: "Selector changed",
      confidence: "high",
    });
    expect(result.success).toBe(false);
  });

  it("accepts likely_bug / inconclusive without patchedCode", () => {
    expect(
      selfHealerOutputSchema.safeParse({
        classification: "likely_bug",
        diagnosis: "Assertion mismatch on page title",
        confidence: "medium",
      }).success,
    ).toBe(true);

    expect(
      selfHealerOutputSchema.safeParse({
        classification: "inconclusive",
        diagnosis: "Network timeout, unclear cause",
        confidence: "low",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid classification value", () => {
    const result = selfHealerOutputSchema.safeParse({
      classification: "definitely_a_bug",
      diagnosis: "x",
      confidence: "low",
    });
    expect(result.success).toBe(false);
  });
});

describe("selfHealerInputSchema", () => {
  it("requires requirement, targetUrl, generatedCode", () => {
    expect(
      selfHealerInputSchema.safeParse({
        requirement: "",
        targetUrl: "https://example.com",
        generatedCode: "code",
        logs: "",
      }).success,
    ).toBe(false);

    expect(
      selfHealerInputSchema.safeParse({
        requirement: "Users can log in",
        targetUrl: "https://example.com",
        generatedCode: "code",
        logs: "",
      }).success,
    ).toBe(true);
  });
});

describe("runHealingAttempt", () => {
  beforeEach(() => {
    healingAttemptUpdates.length = 0;
    findUniqueAttempt.mockReset();
    updateAttempt.mockClear();
    executionRunCreate.mockReset();
    executionRunFindUnique.mockReset();
    generateStructured.mockReset();
    executeRun.mockClear();
  });

  it("routes a 'repairable' diagnosis through patch + verify, marking 'healed' on pass", async () => {
    findUniqueAttempt.mockResolvedValue(baseAttempt);
    generateStructured.mockResolvedValue({
      classification: "repairable",
      diagnosis: "Stale selector; switched to role-based locator",
      patchedCode: "console.log('patched and passing')",
      confidence: "high",
    });
    executionRunCreate.mockResolvedValue({ id: "run2" });
    executionRunFindUnique.mockResolvedValue({
      result: "passed",
      status: "passed",
    });

    await runHealingAttempt("attempt1");

    const statuses = healingAttemptUpdates.map((u) => u.status).filter(Boolean);
    expect(statuses).toEqual(["patched", "verifying", "healed"]);
    expect(executionRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          generatedCode: "console.log('patched and passing')",
          status: "queued",
        }),
      }),
    );
    expect(executeRun).toHaveBeenCalledWith("run2");

    const last = healingAttemptUpdates[healingAttemptUpdates.length - 1];
    expect(last.status).toBe("healed");
    expect(last.completedAt).toBeInstanceOf(Date);
  });

  it("marks 'failed_again' when the verification run does not pass", async () => {
    findUniqueAttempt.mockResolvedValue(baseAttempt);
    generateStructured.mockResolvedValue({
      classification: "repairable",
      diagnosis: "Timing issue; added explicit wait",
      patchedCode: "console.log('patched but still failing')",
      confidence: "medium",
    });
    executionRunCreate.mockResolvedValue({ id: "run3" });
    executionRunFindUnique.mockResolvedValue({
      result: "failed",
      status: "failed",
    });

    await runHealingAttempt("attempt1");

    const last = healingAttemptUpdates[healingAttemptUpdates.length - 1];
    expect(last.status).toBe("failed_again");
  });

  it("routes 'likely_bug' straight to 'needs_review' without patching", async () => {
    findUniqueAttempt.mockResolvedValue(baseAttempt);
    generateStructured.mockResolvedValue({
      classification: "likely_bug",
      diagnosis: "Page shows a 500 error instead of the expected confirmation",
      confidence: "high",
    });

    await runHealingAttempt("attempt1");

    expect(executionRunCreate).not.toHaveBeenCalled();
    expect(executeRun).not.toHaveBeenCalled();
    const last = healingAttemptUpdates[healingAttemptUpdates.length - 1];
    expect(last.status).toBe("needs_review");
  });

  it("routes 'inconclusive' to 'needs_review' as well", async () => {
    findUniqueAttempt.mockResolvedValue(baseAttempt);
    generateStructured.mockResolvedValue({
      classification: "inconclusive",
      diagnosis: "Network error; cannot tell if app or automation issue",
      confidence: "low",
    });

    await runHealingAttempt("attempt1");

    const last = healingAttemptUpdates[healingAttemptUpdates.length - 1];
    expect(last.status).toBe("needs_review");
  });

  it("marks 'error' and records the message when something throws", async () => {
    findUniqueAttempt.mockResolvedValue(baseAttempt);
    generateStructured.mockRejectedValue(new Error("LLM request failed"));

    await runHealingAttempt("attempt1");

    const last = healingAttemptUpdates[healingAttemptUpdates.length - 1];
    expect(last.status).toBe("error");
    expect(last.errorMessage).toBe("LLM request failed");
    expect(last.completedAt).toBeInstanceOf(Date);
  });

  it("does nothing when the attempt record is missing", async () => {
    findUniqueAttempt.mockResolvedValue(null);
    await runHealingAttempt("missing");
    expect(updateAttempt).not.toHaveBeenCalled();
  });
});
