import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  selectorHealerInputSchema,
  selectorHealerOutputSchema,
} from "@/lib/helpers/selector-healer";
import {
  scoreCandidateRelevance,
  selectTopCandidates,
  type DomCandidate,
} from "@/lib/selector-healing/extract-dom";
import { buildHealingShim } from "@/lib/selector-healing/shim";

// ---------- Mock setup ----------

const selectorCacheFindUnique = vi.fn();
const selectorCacheUpdate = vi.fn(async () => ({}));
const selectorCacheUpsert = vi.fn(async () => ({}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    selectorCache: {
      findUnique: (...args: unknown[]) => selectorCacheFindUnique(...args),
      update: (...args: unknown[]) => selectorCacheUpdate(...args),
      upsert: (...args: unknown[]) => selectorCacheUpsert(...args),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn(() => "fake-api-key"),
}));

const mockRunHelper = vi.fn();
vi.mock("@/lib/ai/run-helper", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/run-helper")>(
    "@/lib/ai/run-helper",
  );
  return {
    ...actual,
    runHelper: (...args: unknown[]) => mockRunHelper(...args),
  };
});

vi.mock("@/lib/ai/get-provider", () => ({
  getProviderForOwner: vi.fn(async () => ({ name: "mock-provider" })),
}));

import { healSelector } from "@/lib/selector-healing/heal-selector";

// ---------- selectorHealerInputSchema ----------

describe("selectorHealerInputSchema", () => {
  it("accepts valid input", () => {
    const result = selectorHealerInputSchema.safeParse({
      originalSelector: "#submit-btn",
      errorMessage: "Locator not found: #submit-btn",
      domCandidates: [
        {
          tag: "button",
          testId: "submit",
          text: "Submit",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts input without optional fields", () => {
    const result = selectorHealerInputSchema.safeParse({
      originalSelector: ".login-btn",
      errorMessage: "Element not found",
      domCandidates: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects input missing required originalSelector", () => {
    const result = selectorHealerInputSchema.safeParse({
      errorMessage: "Error",
      domCandidates: [],
    });
    expect(result.success).toBe(false);
  });
});

// ---------- selectorHealerOutputSchema ----------

describe("selectorHealerOutputSchema", () => {
  it("accepts valid output with all strategies", () => {
    for (const strategy of ["testid", "role", "label", "placeholder", "text", "css"] as const) {
      const result = selectorHealerOutputSchema.safeParse({
        healedSelector: `[data-testid="submit"]`,
        strategy,
        confidence: 0.9,
        reasoning: "Found matching element",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects confidence out of range", () => {
    expect(
      selectorHealerOutputSchema.safeParse({
        healedSelector: "[data-testid='x']",
        strategy: "testid",
        confidence: 1.5,
        reasoning: "test",
      }).success,
    ).toBe(false);

    expect(
      selectorHealerOutputSchema.safeParse({
        healedSelector: "[data-testid='x']",
        strategy: "testid",
        confidence: -0.1,
        reasoning: "test",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid strategy", () => {
    const result = selectorHealerOutputSchema.safeParse({
      healedSelector: "[data-testid='x']",
      strategy: "xpath",
      confidence: 0.8,
      reasoning: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = selectorHealerOutputSchema.safeParse({
      healedSelector: "[data-testid='x']",
      strategy: "testid",
    });
    expect(result.success).toBe(false);
  });
});

// ---------- DOM candidate scoring ----------

describe("scoreCandidateRelevance", () => {
  it("gives higher score when selector matches testId", () => {
    const candidate: DomCandidate = {
      tag: "button",
      testId: "submit-btn",
      text: "Submit",
    };
    const score = scoreCandidateRelevance(candidate, "#submit-btn");
    expect(score).toBeGreaterThan(0);
  });

  it("gives higher score to elements with stable attributes", () => {
    const withTestId: DomCandidate = { tag: "button", testId: "submit" };
    const withoutTestId: DomCandidate = { tag: "button" };
    const s1 = scoreCandidateRelevance(withTestId, "unrelated-selector");
    const s2 = scoreCandidateRelevance(withoutTestId, "unrelated-selector");
    expect(s1).toBeGreaterThan(s2);
  });

  it("returns 0 or low for completely unrelated elements", () => {
    const candidate: DomCandidate = { tag: "div" };
    const score = scoreCandidateRelevance(candidate, "#submit-button");
    expect(score).toBeLessThanOrEqual(3);
  });
});

describe("selectTopCandidates", () => {
  it("returns at most maxCandidates elements", () => {
    const many: DomCandidate[] = Array.from({ length: 50 }, (_, i) => ({
      tag: "button",
      id: `btn-${i}`,
    }));
    const result = selectTopCandidates(many, "btn-5", 10);
    expect(result.length).toBe(10);
  });

  it("sorts by relevance, putting matching element first", () => {
    const candidates: DomCandidate[] = [
      { tag: "div" },
      { tag: "button", testId: "submit-btn", text: "Submit" },
      { tag: "input", placeholder: "Email" },
    ];
    const result = selectTopCandidates(candidates, "submit-btn", 30);
    expect(result[0].testId).toBe("submit-btn");
  });
});

// ---------- buildHealingShim ----------

describe("buildHealingShim", () => {
  it("returns a non-empty string containing __requestHeal", () => {
    const shim = buildHealingShim("http://127.0.0.1:9999");
    expect(typeof shim).toBe("string");
    expect(shim.length).toBeGreaterThan(0);
    expect(shim).toContain("__requestHeal");
  });

  it("embeds the heal server URL in the shim", () => {
    const url = "http://127.0.0.1:54321";
    const shim = buildHealingShim(url);
    expect(shim).toContain(url);
  });

  it("includes __wrapPage and __isLocatorError", () => {
    const shim = buildHealingShim("http://127.0.0.1:1234");
    expect(shim).toContain("__wrapPage");
    expect(shim).toContain("__isLocatorError");
  });
});

// ---------- healSelector ----------

describe("healSelector", () => {
  beforeEach(() => {
    selectorCacheFindUnique.mockReset();
    selectorCacheUpdate.mockClear();
    selectorCacheUpsert.mockClear();
    mockRunHelper.mockReset();
  });

  const baseParams = {
    projectId: "proj1",
    orgId: "org1",
    originalSelector: "#submit-btn",
    errorMessage: "Locator not found: #submit-btn",
    domCandidates: [{ tag: "button", testId: "submit", text: "Submit" }],
  };

  it("returns cached selector immediately without calling LLM on cache hit", async () => {
    selectorCacheFindUnique.mockResolvedValue({
      id: "cache1",
      healedSelector: '[data-testid="submit"]',
    });

    const result = await healSelector(baseParams);

    expect(result).toBe('[data-testid="submit"]');
    expect(mockRunHelper).not.toHaveBeenCalled();
    expect(selectorCacheUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cache1" },
        data: expect.objectContaining({ hitCount: { increment: 1 } }),
      }),
    );
  });

  it("calls LLM and stores result on cache miss", async () => {
    selectorCacheFindUnique.mockResolvedValue(null);
    mockRunHelper.mockResolvedValue({
      healedSelector: '[data-testid="submit"]',
      strategy: "testid",
      confidence: 0.95,
      reasoning: "Found data-testid attribute",
    });

    const result = await healSelector(baseParams);

    expect(result).toBe('[data-testid="submit"]');
    expect(mockRunHelper).toHaveBeenCalledOnce();
    expect(selectorCacheUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          projectId: "proj1",
          originalSelector: "#submit-btn",
          healedSelector: '[data-testid="submit"]',
          strategy: "testid",
          confidence: 0.95,
        }),
      }),
    );
  });

  it("returns null when LLM call fails", async () => {
    selectorCacheFindUnique.mockResolvedValue(null);
    mockRunHelper.mockRejectedValue(new Error("LLM error"));

    const result = await healSelector(baseParams);

    expect(result).toBeNull();
    expect(selectorCacheUpsert).not.toHaveBeenCalled();
  });

  it("increments hitCount on repeated cache hits", async () => {
    selectorCacheFindUnique.mockResolvedValue({
      id: "cache2",
      healedSelector: ".submit-button",
    });

    await healSelector(baseParams);
    await healSelector(baseParams);

    expect(selectorCacheUpdate).toHaveBeenCalledTimes(2);
    expect(selectorCacheUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hitCount: { increment: 1 } }),
      }),
    );
  });
});
