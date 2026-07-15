import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { parsePlaywrightScript } from "./parse-actions";
import type {
  RecordedResult,
  RecorderUnavailable,
  RecordingSession,
} from "./types";

/**
 * Local-launch recorder backend.
 *
 * ARCHITECTURE NOTE: this module is the ONLY place that launches a real browser.
 * It wraps Playwright's built-in `codegen` engine by spawning it as a child
 * process — the stable, public way to drive codegen programmatically. The
 * codegen browser opens on the SERVER host (the machine running the app), which
 * is perfect for local / self-hosted use. A future cloud build would replace
 * this module with a streaming backend (noVNC / CDP-over-WebSocket) while
 * keeping the same exported surface (startRecording / stopRecording).
 */

interface SessionEntry {
  sessionId: string;
  startUrl: string;
  proc: ChildProcess;
  tempDir: string;
  outputFile: string;
  exited: boolean;
}

/**
 * In-memory registry of active recording sessions. Module singleton — survives
 * across requests within the same Node process (fine for a single-host local
 * deployment).
 */
const sessions = new Map<string, SessionEntry>();

/** Exposed for tests. */
export function _getSessions(): Map<string, SessionEntry> {
  return sessions;
}

/**
 * Heuristic: on Linux with no DISPLAY a headed browser usually cannot launch.
 * We still ATTEMPT (some setups run xvfb / Xvfb-run), but use this to produce a
 * clearer message on failure.
 */
function likelyHeadless(): boolean {
  return process.platform === "linux" && !process.env.DISPLAY;
}

function unavailable(extra?: string): RecorderUnavailable {
  const base =
    "The test recorder needs to open a real browser window on the machine " +
    "running the app. That requires a graphical display, which is available " +
    "when you run Qaera locally (e.g. `npm run dev` on your own " +
    "computer). On a headless server, install/start a virtual display (xvfb) " +
    "or wait for the upcoming cloud streaming backend.";
  return {
    error: "RECORDER_UNAVAILABLE",
    message: extra ? `${base}\n\nDetails: ${extra}` : base,
  };
}

/**
 * Starts a recording session by spawning `playwright codegen`. Resolves once the
 * child process has spawned (or rejects with a structured RecorderUnavailable if
 * spawning fails immediately).
 */
export async function startRecording(opts: {
  startUrl: string;
}): Promise<RecordingSession | RecorderUnavailable> {
  const { startUrl } = opts;

  let tempDir: string;
  try {
    tempDir = await mkdtemp(path.join(tmpdir(), "qa-recorder-"));
  } catch (err) {
    return unavailable(err instanceof Error ? err.message : String(err));
  }

  const sessionId = randomUUID();
  const outputFile = path.join(tempDir, "recorded.js");

  try {
    const proc = spawn(
      "npx",
      [
        "playwright",
        "codegen",
        "--target=javascript",
        `--output=${outputFile}`,
        startUrl,
      ],
      {
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const entry: SessionEntry = {
      sessionId,
      startUrl,
      proc,
      tempDir,
      outputFile,
      exited: false,
    };

    let earlyStderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      // Capture early stderr to detect "no XServer" style failures.
      if (earlyStderr.length < 4000) earlyStderr += chunk.toString();
    });

    proc.on("exit", () => {
      entry.exited = true;
    });

    // Wait briefly to surface immediate spawn/launch failures (e.g. no display).
    const failure = await new Promise<RecorderUnavailable | null>((resolve) => {
      const onError = (err: Error) => {
        resolve(unavailable(err.message));
      };
      proc.once("error", onError);

      const timer = setTimeout(() => {
        proc.removeListener("error", onError);
        // If the process already died very quickly, treat as unavailable.
        if (entry.exited) {
          const detail =
            earlyStderr.match(/XServer|DISPLAY|Executable doesn't exist|launch/i)
              ? earlyStderr.slice(0, 800)
              : earlyStderr.slice(0, 800) || "codegen exited immediately";
          resolve(unavailable(detail));
        } else {
          resolve(null);
        }
      }, 1500);

      proc.once("exit", () => {
        // Fast exit during the probe window = launch failed.
        clearTimeout(timer);
        proc.removeListener("error", onError);
        const detail =
          earlyStderr.slice(0, 800) ||
          (likelyHeadless()
            ? "No display detected (headless server)."
            : "codegen exited before recording could start.");
        resolve(unavailable(detail));
      });
    });

    if (failure) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return failure;
    }

    sessions.set(sessionId, entry);
    return { sessionId, startUrl };
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return unavailable(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Stops a recording session: closes the codegen browser (if still open), reads
 * the generated script, parses it into structured actions, and cleans up.
 */
export async function stopRecording(
  sessionId: string,
): Promise<RecordedResult | RecorderUnavailable> {
  const entry = sessions.get(sessionId);
  if (!entry) {
    return {
      error: "RECORDER_UNAVAILABLE",
      message: "No active recording session found (it may have already stopped).",
    };
  }

  sessions.delete(sessionId);

  try {
    if (!entry.exited && !entry.proc.killed) {
      // Ask codegen to close gracefully so it flushes the output file, then
      // wait for it to exit (with a fallback hard kill).
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        entry.proc.once("exit", done);
        try {
          entry.proc.kill("SIGTERM");
        } catch {
          resolve();
          return;
        }
        setTimeout(() => {
          try {
            entry.proc.kill("SIGKILL");
          } catch {
            /* ignore */
          }
          resolve();
        }, 3000);
      });
    }

    let rawCode = "";
    try {
      rawCode = await readFile(entry.outputFile, "utf8");
    } catch {
      rawCode = "";
    }

    const actions = parsePlaywrightScript(rawCode);
    return { rawCode, actions };
  } finally {
    await rm(entry.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Returns whether a session is currently active (browser still open). */
export function getSessionStatus(
  sessionId: string,
): { active: boolean } | null {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  return { active: !entry.exited };
}
