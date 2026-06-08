import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock state (hoisted so the vi.mock factory can safely reference it) -----

const S = vi.hoisted(() => {
  return {
    pipeline: null as Record<string, unknown> | null,
    pipelineUpdates: [] as Array<Record<string, unknown>>,
    stageUpdates: [] as Array<{ name: string; data: Record<string, unknown> }>,
    executionRuns: {} as Record<string, { status: string; result: string }>,
    createdRunCounter: 0,
    bugReportsCreated: [] as Array<Record<string, unknown>>,
    healOutcomes: [] as Array<{
      status: string;
      classification: string;
      newRunId?: string | null;
    }>,
    healAttemptsCreated: [] as Array<Record<string, unknown>>,
    healAttemptCounter: 0,
    healAttemptResults: {} as Record<
      string,
      { status: string; classification: string; newRunId?: string | null }
    >,
  };
});

const prismaMock = vi.hoisted(() => ({}) as Record<string, Record<string, ReturnType<typeof vi.fn>>>);

Object.assign(prismaMock, {
  pipelineRun: {
    findUnique: vi.fn(async () => S.pipeline),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      S.pipelineUpdates.push(data);
      if (S.pipeline) Object.assign(S.pipeline, data);
      return {};
    }),
  },
  pipelineStage: {
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { name: string };
        data: Record<string, unknown>;
      }) => {
        S.stageUpdates.push({ name: where.name, data });
        return {};
      },
    ),
  },
  automationRun: {
    findFirst: vi.fn(async () => ({
      files: JSON.stringify([{ content: "console.log('code')" }]),
    })),
  },
  executionRun: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      S.createdRunCounter += 1;
      const id = `run${S.createdRunCounter}`;
      // default to whatever the test seeded for this index, else passed.
      return { id, ...data };
    }),
    findUnique: vi.fn(
      async ({ where, include }: { where: { id: string }; include?: unknown }) => {
        const r = S.executionRuns[where.id] ?? { status: "passed", result: "passed" };
        if (include) {
          return {
            id: where.id,
            projectId: "proj1",
            targetUrl: "https://example.com",
            framework: "playwright",
            logs: "boom",
            errorMessage: "Element not found",
            status: r.status,
            result: r.result,
            testCases: [],
          };
        }
        return r;
      },
    ),
  },
  healingAttempt: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      S.healAttemptCounter += 1;
      const id = `attempt${S.healAttemptCounter}`;
      S.healAttemptsCreated.push(data);
      const outcome = S.healOutcomes.shift() ?? {
        status: "failed_again",
        classification: "inconclusive",
      };
      S.healAttemptResults[id] = outcome;
      return { id, ...data };
    }),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      const o = S.healAttemptResults[where.id];
      return {
        status: o.status,
        classification: o.classification,
        newRunId: o.newRunId ?? null,
      };
    }),
  },
  bugReport: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      S.bugReportsCreated.push(data);
      return { id: "bug1", projectId: "proj1", output: "{}" };
    }),
  },
});

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

const dispatchIntegrationEvent = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/integrations/dispatch", () => ({
  dispatchIntegrationEvent,
}));

// executeRun is mocked: it does nothing; the run's terminal status comes from
// the seeded executionRuns map keyed by the created id.
const executeRun = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/worker/executor", () => ({ executeRun }));

const runHealingAttempt = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/worker/healer", () => ({ runHealingAttempt }));

import { runPipeline } from "@/worker/orchestrator";

function basePipeline(over: Record<string, unknown> = {}) {
  return {
    id: "pipe1",
    projectId: "proj1",
    targetUrl: "https://example.com",
    autoHeal: true,
    autoBug: true,
    notify: true,
    maxHealAttempts: 2,
    status: "queued",
    ...over,
  };
}

function lastStage(name: string) {
  const matches = S.stageUpdates.filter((s) => s.name === name);
  return matches[matches.length - 1]?.data;
}

function lastPipelineUpdate() {
  return S.pipelineUpdates[S.pipelineUpdates.length - 1];
}

describe("runPipeline (orchestrator state machine)", () => {
  beforeEach(() => {
    S.pipeline = basePipeline();
    S.pipelineUpdates.length = 0;
    S.stageUpdates.length = 0;
    S.bugReportsCreated.length = 0;
    S.healAttemptsCreated.length = 0;
    S.executionRuns = {};
    S.healOutcomes = [];
    Object.keys(S.healAttemptResults).forEach(
      (k) => delete S.healAttemptResults[k],
    );
    S.createdRunCounter = 0;
    S.healAttemptCounter = 0;
    vi.clearAllMocks();
  });

  it("execute passes → heal & bug skipped, status succeeded", async () => {
    S.executionRuns["run1"] = { status: "passed", result: "passed" };

    await runPipeline("pipe1");

    expect(lastStage("execute")?.status).toBe("succeeded");
    expect(lastStage("heal")?.status).toBe("skipped");
    expect(lastStage("bug")?.status).toBe("skipped");
    expect(runHealingAttempt).not.toHaveBeenCalled();
    expect(S.bugReportsCreated).toHaveLength(0);
    expect(lastPipelineUpdate()?.status).toBe("succeeded");
  });

  it("execute fails → heal succeeds on an attempt → status succeeded, bug skipped", async () => {
    S.executionRuns["run1"] = { status: "failed", result: "failed" };
    S.healOutcomes = [
      { status: "healed", classification: "repairable", newRunId: "verif1" },
    ];

    await runPipeline("pipe1");

    expect(lastStage("execute")?.status).toBe("succeeded");
    expect(lastStage("heal")?.status).toBe("succeeded");
    expect(lastStage("bug")?.status).toBe("skipped");
    expect(S.bugReportsCreated).toHaveLength(0);
    const upd = lastPipelineUpdate();
    expect(upd?.status).toBe("succeeded");
    expect(upd?.finalRunId).toBe("verif1");
  });

  it("execute fails → heal exhausts → bug filed, status failed, bugReportId set", async () => {
    S.executionRuns["run1"] = { status: "failed", result: "failed" };
    S.healOutcomes = [
      { status: "failed_again", classification: "inconclusive" },
      { status: "failed_again", classification: "inconclusive" },
    ];

    await runPipeline("pipe1");

    expect(runHealingAttempt).toHaveBeenCalledTimes(2);
    expect(lastStage("bug")?.status).toBe("succeeded");
    expect(S.bugReportsCreated).toHaveLength(1);
    const upd = lastPipelineUpdate();
    expect(upd?.status).toBe("failed");
    expect(upd?.bugReportId).toBe("bug1");
  });

  it("heal stops early and files a bug when classification becomes likely_bug", async () => {
    S.executionRuns["run1"] = { status: "failed", result: "failed" };
    S.healOutcomes = [
      { status: "needs_review", classification: "likely_bug" },
    ];

    await runPipeline("pipe1");

    expect(runHealingAttempt).toHaveBeenCalledTimes(1);
    expect(S.bugReportsCreated).toHaveLength(1);
    expect(lastPipelineUpdate()?.status).toBe("failed");
  });

  it("autoHeal=false → goes straight to bug on failure", async () => {
    S.pipeline = basePipeline({ autoHeal: false });
    S.executionRuns["run1"] = { status: "failed", result: "failed" };

    await runPipeline("pipe1");

    expect(runHealingAttempt).not.toHaveBeenCalled();
    expect(lastStage("heal")?.status).toBe("skipped");
    expect(lastStage("bug")?.status).toBe("succeeded");
    expect(S.bugReportsCreated).toHaveLength(1);
    expect(lastPipelineUpdate()?.status).toBe("failed");
  });

  it("a thrown stage error → pipeline ends 'error', never stuck 'running'", async () => {
    S.executionRuns["run1"] = { status: "failed", result: "failed" };
    // Make the bug stage throw by rejecting bugReport.create.
    prismaMock.bugReport.create.mockRejectedValueOnce(new Error("db down"));
    // No heal so we reach bug directly.
    S.pipeline = basePipeline({ autoHeal: false });

    await runPipeline("pipe1");

    expect(lastStage("bug")?.status).toBe("failed");
    // report still runs; pipeline completes (failed, since app ended red).
    const upd = lastPipelineUpdate();
    expect(upd?.status).not.toBe("running");
    expect(upd?.completedAt).toBeInstanceOf(Date);
  });

  it("orchestrator-level throw sets status 'error' with errorMessage", async () => {
    // Force the very first pipeline update (status->running) to throw,
    // simulating an unexpected orchestrator failure.
    prismaMock.pipelineRun.update.mockImplementationOnce(async () => {
      throw new Error("catastrophic");
    });

    await runPipeline("pipe1");

    const upd = lastPipelineUpdate();
    expect(upd?.status).toBe("error");
    expect(upd?.errorMessage).toBe("catastrophic");
  });

  it("does nothing when the pipeline record is missing", async () => {
    S.pipeline = null;
    await runPipeline("missing");
    expect(executeRun).not.toHaveBeenCalled();
  });
});
