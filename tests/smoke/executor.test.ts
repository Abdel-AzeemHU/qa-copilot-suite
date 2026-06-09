import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// --- Mocks ---

const updates: Array<Record<string, unknown>> = [];
const findUnique = vi.fn();
const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
  updates.push(data);
  return {};
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    executionRun: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

const spawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawn(...args),
}));

vi.mock("node:fs/promises", () => ({
  mkdtemp: vi.fn().mockResolvedValue("/tmp/qa-exec-test"),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Build a fake child process whose close fires the given exit code.
function makeChild(exitCode: number, stdout = "hello\n") {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => {
    child.stdout.emit("data", Buffer.from(stdout));
    child.emit("close", exitCode);
  });
  return child;
}

import { executeRun } from "@/worker/executor";

describe("executeRun", () => {
  beforeEach(() => {
    updates.length = 0;
    findUnique.mockReset();
    update.mockClear();
    spawn.mockReset();
  });

  it("marks the run passed and writes logs on exit code 0", async () => {
    findUnique.mockResolvedValue({
      id: "run1",
      generatedCode: "console.log('hi')",
      targetUrl: "https://example.com",
    });
    spawn.mockReturnValue(makeChild(0, "test output\n"));

    await executeRun("run1");

    // First update sets running, last update sets terminal status.
    const first = updates[0];
    expect(first.status).toBe("running");
    expect(first.startedAt).toBeInstanceOf(Date);

    const last = updates[updates.length - 1];
    expect(last.status).toBe("passed");
    expect(last.result).toBe("passed");
    expect(last.completedAt).toBeInstanceOf(Date);
    expect(String(last.logs)).toContain("test output");
  });

  it("marks the run failed on non-zero exit code", async () => {
    findUnique.mockResolvedValue({
      id: "run2",
      generatedCode: "process.exit(1)",
      targetUrl: "https://example.com",
    });
    spawn.mockReturnValue(makeChild(1));

    await executeRun("run2");

    const last = updates[updates.length - 1];
    expect(last.status).toBe("failed");
    expect(last.result).toBe("failed");
  });

  it("does nothing when the run record is missing", async () => {
    findUnique.mockResolvedValue(null);
    await executeRun("missing");
    expect(update).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });
});
