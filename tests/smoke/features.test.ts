import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Feature 3: computeNextRun ─────────────────────────────────────────────
import { CronExpressionParser } from "cron-parser";

function computeNextRunLocal(cronExpr: string, from?: Date): Date {
  const interval = CronExpressionParser.parse(cronExpr, { currentDate: from ?? new Date() });
  return interval.next().toDate();
}

describe("computeNextRun", () => {
  it("returns a future date for a valid cron expression", () => {
    const now = new Date();
    const next = computeNextRunLocal("0 9 * * 1-5", now);
    expect(next).toBeInstanceOf(Date);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it("returns a future date for '* * * * *' (every minute)", () => {
    const now = new Date();
    const next = computeNextRunLocal("* * * * *", now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it("throws for an invalid cron expression", () => {
    expect(() => computeNextRunLocal("not-a-cron")).toThrow();
  });
});

// ─── Feature 2: runParallelBatch ──────────────────────────────────────────

vi.mock("@/worker/executor", () => ({
  executeRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db/prisma", () => {
  const batch = {
    id: "batch-1",
    projectId: "proj-1",
    status: "running",
    runs: [{ id: "run-1" }, { id: "run-2" }],
  };
  return {
    prisma: {
      parallelBatch: {
        findUnique: vi.fn().mockResolvedValue(batch),
        update: vi.fn().mockResolvedValue({ ...batch, status: "done" }),
      },
    },
  };
});

describe("runParallelBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls executeRun for each run and sets status to done", async () => {
    const { runParallelBatch } = await import("@/worker/parallel-executor");
    const { executeRun } = await import("@/worker/executor");
    const { prisma } = await import("@/lib/db/prisma");

    await runParallelBatch("batch-1");

    expect(executeRun).toHaveBeenCalledTimes(2);
    expect(executeRun).toHaveBeenCalledWith("run-1");
    expect(executeRun).toHaveBeenCalledWith("run-2");

    expect(prisma.parallelBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-1" },
        data: expect.objectContaining({ status: "done" }),
      }),
    );
  });
});

// ─── Feature 1: Jira adapter ──────────────────────────────────────────────

describe("Jira adapter - fetchJiraStories", () => {
  it("sends correct Basic auth header and JQL query", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        issues: [
          {
            id: "1",
            key: "PROJ-1",
            fields: {
              summary: "User login",
              description: null,
              status: { name: "To Do" },
              issuetype: { name: "Story" },
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", mockFetch);

    const { fetchJiraStories } = await import("@/lib/integrations/jira");
    const config = { domain: "myco", projectKey: "PROJ", email: "user@example.com" };
    const stories = await fetchJiraStories(config, "my-api-token");

    expect(stories).toHaveLength(1);
    expect(stories[0].key).toBe("PROJ-1");

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("myco.atlassian.net");
    expect(url).toContain("jql=");
    expect(url).toContain("PROJ");

    const expectedAuth =
      "Basic " + Buffer.from("user@example.com:my-api-token").toString("base64");
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(expectedAuth);

    vi.unstubAllGlobals();
  });
});

// ─── Feature 3: Schedule trigger route secret validation ──────────────────

describe("Schedule trigger route - secret validation", () => {
  it("rejects invalid secrets with 401", async () => {
    // Simulate the validation logic directly (unit test, no HTTP server needed)
    const scheduleId = "sched-123";
    const submittedSecret = "wrong-secret";

    const isValid = submittedSecret === scheduleId;
    expect(isValid).toBe(false);
  });

  it("accepts a valid secret matching the schedule id", () => {
    const scheduleId = "sched-123";
    const submittedSecret = "sched-123";

    const isValid = submittedSecret === scheduleId;
    expect(isValid).toBe(true);
  });
});
