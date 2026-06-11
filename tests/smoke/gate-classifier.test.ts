import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Prisma mock ---------------------------------------------------------

const db = vi.hoisted(() => ({
  pipelineRun: {
    findUnique: vi.fn(),
  },
  executionRun: {
    findUnique: vi.fn(),
    findMany: vi.fn(async () => []),
    update: vi.fn(async () => ({})),
  },
  flakinessReport: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

import { evaluateGate } from "@/lib/ci/gate";
import {
  failureClassifierHelper,
  failureClassifierOutputSchema,
  FAILURE_CLASSES,
} from "@/lib/helpers/failure-classifier";

beforeEach(() => {
  db.pipelineRun.findUnique.mockReset();
  db.executionRun.findUnique.mockReset();
  db.flakinessReport.findFirst.mockReset();
});

// --- Failure classifier helper --------------------------------------------

describe("failureClassifierHelper", () => {
  it("declares all four failure classes", () => {
    expect(FAILURE_CLASSES).toEqual([
      "real_bug",
      "flaky",
      "environment",
      "automation",
    ]);
  });

  it("validates a correct output", () => {
    const out = failureClassifierOutputSchema.parse({
      failureClass: "flaky",
      confidence: "high",
      summary: "Timeout waiting for an element that usually appears.",
    });
    expect(out.failureClass).toBe("flaky");
  });

  it("rejects unknown classes", () => {
    expect(() =>
      failureClassifierOutputSchema.parse({
        failureClass: "mystery",
        confidence: "high",
        summary: "x",
      }),
    ).toThrow();
  });

  it("builds a user message including history", () => {
    const msg = failureClassifierHelper.buildUserMessage({
      targetUrl: "https://example.com",
      generatedCode: "code here",
      logs: "boom",
      recentHistory: [
        { result: "passed" },
        { result: "failed", errorMessage: "timeout" },
      ],
    });
    expect(msg).toContain("https://example.com");
    expect(msg).toContain("Recent run history");
    expect(msg).toContain("timeout");
  });
});

// --- Merge gate -------------------------------------------------------------

describe("evaluateGate", () => {
  it("passes when the pipeline succeeded", async () => {
    db.pipelineRun.findUnique.mockResolvedValue({
      id: "p1",
      projectId: "proj1",
      status: "succeeded",
      finalRunId: null,
    });
    const gate = await evaluateGate("p1");
    expect(gate.verdict).toBe("pass");
  });

  it("is pending while running", async () => {
    db.pipelineRun.findUnique.mockResolvedValue({
      id: "p1",
      projectId: "proj1",
      status: "running",
      finalRunId: null,
    });
    const gate = await evaluateGate("p1");
    expect(gate.verdict).toBe("pending");
  });

  it("fails on a real bug", async () => {
    db.pipelineRun.findUnique.mockResolvedValue({
      id: "p1",
      projectId: "proj1",
      status: "failed",
      finalRunId: "r1",
    });
    db.executionRun.findUnique.mockResolvedValue({
      failureClass: "real_bug",
      failureClassSummary: "Login broken",
      generatedCode: "code",
    });
    const gate = await evaluateGate("p1");
    expect(gate.verdict).toBe("fail");
    expect(gate.failureClass).toBe("real_bug");
    expect(gate.reasons.join(" ")).toContain("REAL BUG");
  });

  it("does NOT block on quarantined flaky tests", async () => {
    db.pipelineRun.findUnique.mockResolvedValue({
      id: "p1",
      projectId: "proj1",
      status: "failed",
      finalRunId: "r1",
    });
    db.executionRun.findUnique.mockResolvedValue({
      failureClass: "flaky",
      failureClassSummary: "Intermittent timeout",
      generatedCode: "the-flaky-code",
    });
    db.flakinessReport.findFirst.mockResolvedValue({ id: "fr1" });
    const gate = await evaluateGate("p1");
    expect(gate.verdict).toBe("pass_with_warnings");
    expect(gate.quarantineApplied).toBe(true);
  });

  it("blocks flaky failures that are NOT quarantined", async () => {
    db.pipelineRun.findUnique.mockResolvedValue({
      id: "p1",
      projectId: "proj1",
      status: "failed",
      finalRunId: "r1",
    });
    db.executionRun.findUnique.mockResolvedValue({
      failureClass: "flaky",
      failureClassSummary: "Intermittent timeout",
      generatedCode: "the-flaky-code",
    });
    db.flakinessReport.findFirst.mockResolvedValue(null);
    const gate = await evaluateGate("p1");
    expect(gate.verdict).toBe("fail");
    expect(gate.quarantineApplied).toBe(false);
    expect(gate.reasons.join(" ")).toContain("quarantine");
  });

  it("fails with no classification available", async () => {
    db.pipelineRun.findUnique.mockResolvedValue({
      id: "p1",
      projectId: "proj1",
      status: "failed",
      finalRunId: null,
    });
    const gate = await evaluateGate("p1");
    expect(gate.verdict).toBe("fail");
    expect(gate.failureClass).toBeNull();
  });
});
