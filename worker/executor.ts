import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { prisma } from "@/lib/db/prisma";
import { dispatchIntegrationEvent } from "@/lib/integrations/dispatch";
import { healSelector } from "@/lib/selector-healing/heal-selector";
import { buildHealingShim } from "@/lib/selector-healing/shim";
import { classifyRunFailure } from "@/worker/classifier";

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
 * Layer 1 selector healing: A tiny HTTP server is started in-process before
 * spawning the child. The shim injected into the test script calls back to this
 * server when a selector fails, and the server calls healSelector() to get a
 * replacement. Healing events are appended to the run logs as [HEALER] lines.
 */

interface HealRequest {
  selector: string;
  errorMessage: string;
  domSnapshot: Array<{
    tag: string;
    id?: string;
    testId?: string;
    role?: string;
    ariaLabel?: string;
    placeholder?: string;
    text?: string;
    classes?: string;
  }>;
}

async function startHealServer(
  projectId: string,
  orgId: string,
  onHealEvent: (msg: string) => void,
): Promise<{ url: string; server: http.Server }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== "POST" || req.url !== "/heal") {
        res.writeHead(404).end();
        return;
      }

      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body) as HealRequest;
          const { selector, errorMessage, domSnapshot } = payload;

          const healedSelector = await healSelector({
            projectId,
            orgId,
            originalSelector: selector,
            errorMessage,
            domCandidates: domSnapshot ?? [],
          });

          if (healedSelector) {
            onHealEvent(
              `[HEALER] Selector "${selector}" healed → "${healedSelector}"\n`,
            );
          } else {
            onHealEvent(
              `[HEALER] Could not heal selector "${selector}" — proceeding with original\n`,
            );
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ healedSelector }));
        } catch (err) {
          res.writeHead(500).end(JSON.stringify({ error: String(err) }));
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to get heal server address"));
        return;
      }
      resolve({ url: `http://127.0.0.1:${addr.port}`, server });
    });

    server.on("error", reject);
  });
}

function getOrgIdForProject(projectId: string): Promise<string | null> {
  return prisma.project
    .findUnique({ where: { id: projectId }, select: { orgId: true } })
    .then((p) => p?.orgId ?? null);
}

export async function executeRun(runId: string): Promise<void> {
  const run = await prisma.executionRun.findUnique({ where: { id: runId } });
  if (!run) return;

  let tempDir: string | null = null;
  let healServer: http.Server | null = null;

  try {
    await prisma.executionRun.update({
      where: { id: runId },
      data: { status: "running", startedAt: new Date(), logs: "" },
    });

    tempDir = await mkdtemp(path.join(tmpdir(), "qa-exec-"));
    const scriptPath = path.join(tempDir, "script.mjs");

    // Resolve orgId for the heal server
    const orgId = await getOrgIdForProject(run.projectId);

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

    // Start heal server if we have the org context
    let healServerUrl = "";
    if (orgId) {
      const { url, server } = await startHealServer(
        run.projectId,
        orgId,
        (msg) => { pending += msg; },
      );
      healServerUrl = url;
      healServer = server;
    }

    // Build the final script with shim prepended
    const shim = healServerUrl ? buildHealingShim(healServerUrl) : "";
    const finalCode = shim + "\n" + run.generatedCode;
    await writeFile(scriptPath, finalCode, "utf8");

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn("node", [scriptPath], {
        shell: true,
        env: {
          ...process.env,
          TARGET_URL: run.targetUrl,
          PLAYWRIGHT_TARGET_URL: run.targetUrl,
          ...(healServerUrl ? { HEAL_SERVER_URL: healServerUrl } : {}),
          ...(orgId ? { PROJECT_ID: run.projectId, ORG_ID: orgId } : {}),
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

    // Fire-and-forget failure classification (real_bug | flaky | environment | automation)
    if (result === "failed") {
      void classifyRunFailure(runId);
    }
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

    void classifyRunFailure(runId);
  } finally {
    if (healServer) {
      healServer.close();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
