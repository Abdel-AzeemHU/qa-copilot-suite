import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { dispatchIntegrationEvent } from "@/lib/integrations/dispatch";

/**
 * Executes an ExecutionRun's generated automation code as a Node.js script.
 *
 * Strategy (Phase 3, kept intentionally simple):
 *  1. Load the run record by id.
 *  2. Write `generatedCode` to a temp `.mjs` file (so `import` syntax works).
 *  3. Spawn `node <file>` with `{ shell: true }`, injecting TARGET_URL.
 *  4. Stream stdout/stderr into the DB `logs` field (~1s throttle).
 *  5. On exit: status = "passed" (code 0) | "failed" (code 1+) | "error".
 *
 * This runs in-process (no separate worker). Fire-and-forget from the API.
 */
export async function executeRun(runId: string): Promise<void> {
  const run = await prisma.executionRun.findUnique({ where: { id: runId } });
  if (!run) return;

  let tempDir: string | null = null;

  try {
    await prisma.executionRun.update({
      where: { id: runId },
      data: { status: "running", startedAt: new Date(), logs: "" },
    });

    tempDir = await mkdtemp(path.join(tmpdir(), "qa-exec-"));
    const scriptPath = path.join(tempDir, "script.mjs");
    await writeFile(scriptPath, run.generatedCode, "utf8");

    let logs = "";
    let pending = "";
    let lastFlush = Date.now();

    const flush = async (force = false) => {
      if (!pending) return;
      const now = Date.now();
      if (!force && now - lastFlush < 1000) return;
      logs += pending;
      pending = "";
      lastFlush = now;
      await prisma.executionRun.update({
        where: { id: runId },
        data: { logs },
      });
    };

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn("node", [scriptPath], {
        shell: true,
        env: {
          ...process.env,
          TARGET_URL: run.targetUrl,
          PLAYWRIGHT_TARGET_URL: run.targetUrl,
        },
      });

      const onData = (chunk: Buffer) => {
        pending += chunk.toString();
        void flush();
      };

      child.stdout.on("data", onData);
      child.stderr.on("data", onData);

      child.on("error", (err) => {
        pending += `\n[spawn error: ${err.message}]\n`;
        reject(err);
      });

      child.on("close", (code) => {
        resolve(code ?? 0);
      });
    });

    await flush(true);

    const result = exitCode === 0 ? "passed" : "failed";
    await prisma.executionRun.update({
      where: { id: runId },
      data: {
        status: result,
        result,
        completedAt: new Date(),
        logs,
      },
    });

    dispatchIntegrationEvent(run.projectId, {
      type: "run.completed",
      run: {
        id: run.id,
        projectId: run.projectId,
        status: result,
        result,
        targetUrl: run.targetUrl,
        errorMessage: null,
      },
    }).catch(() => {});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.executionRun.update({
      where: { id: runId },
      data: {
        status: "error",
        result: "error",
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    dispatchIntegrationEvent(run.projectId, {
      type: "run.completed",
      run: {
        id: run.id,
        projectId: run.projectId,
        status: "error",
        result: "error",
        targetUrl: run.targetUrl,
        errorMessage: message,
      },
    }).catch(() => {});
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
