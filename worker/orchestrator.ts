import { prisma } from "@/lib/db/prisma";
import { dispatchIntegrationEvent } from "@/lib/integrations/dispatch";
import { executeRun } from "./executor";
import { runHealingAttempt } from "./healer";

/**
 * Orchestrator pipeline: chains the existing QA capabilities into one
 * automated, observable run. It is a state machine over the EXISTING worker
 * functions — it never reimplements execution / healing / AI logic.
 *
 * Stages: execute -> (heal) -> (bug) -> notify -> report.
 *
 * Fire-and-forget, like executeRun. Persists PipelineRun.status and each
 * PipelineStage as it progresses so the UI can poll.
 */

// Hard ceiling shared with the manual heal route.
const MAX_HEAL_ATTEMPTS = 3;

const TERMINAL_OUTCOMES = {
  passed: "passed",
  failed: "failed",
  error: "error",
} as const;

type StageName = "execute" | "heal" | "bug" | "notify" | "report";

async function startStage(pipelineRunId: string, name: StageName) {
  await prisma.pipelineStage.updateMany({
    where: { pipelineRunId, name },
    data: { status: "running", startedAt: new Date() },
  });
}

async function finishStage(
  pipelineRunId: string,
  name: StageName,
  status: "succeeded" | "skipped" | "failed",
  detail?: string,
) {
  await prisma.pipelineStage.updateMany({
    where: { pipelineRunId, name },
    data: { status, detail, completedAt: new Date() },
  });
}

async function resolveGeneratedCode(
  projectId: string,
  carried: string | null | undefined,
): Promise<string> {
  const code = carried?.trim() ?? "";
  if (code) return code;
  const latest = await prisma.automationRun.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) {
    throw new Error(
      "No automation code found. Generate automation code first.",
    );
  }
  const files = JSON.parse(latest.files) as Array<{ content: string }>;
  const joined = files.map((f) => f.content).join("\n\n");
  if (!joined.trim()) throw new Error("No automation code to execute.");
  return joined;
}

export async function runPipeline(pipelineRunId: string): Promise<void> {
  const pipeline = await prisma.pipelineRun.findUnique({
    where: { id: pipelineRunId },
  });
  if (!pipeline) return;

  const projectId = pipeline.projectId;
  // Final outcome of the app under test: passed | failed | error.
  let outcome: "passed" | "failed" | "error" = TERMINAL_OUTCOMES.error;
  let finalRunId: string | null = null;
  let bugReportId: string | null = null;
  const notes: string[] = [];

  try {
    await prisma.pipelineRun.update({
      where: { id: pipelineRunId },
      data: { status: "running", startedAt: new Date() },
    });

    // --- 1. EXECUTE --------------------------------------------------------
    // The failing run we will heal / file a bug against.
    let failingRunId: string | null = null;
    try {
      await startStage(pipelineRunId, "execute");
      const generatedCode = await resolveGeneratedCode(
        projectId,
        // PipelineRun does not carry code by default; orchestrator resolves it.
        null,
      );
      const run = await prisma.executionRun.create({
        data: {
          projectId,
          targetUrl: pipeline.targetUrl,
          generatedCode,
          status: "queued",
        },
      });
      await executeRun(run.id);
      const executed = await prisma.executionRun.findUnique({
        where: { id: run.id },
        select: { status: true, result: true },
      });
      const status = executed?.status ?? "error";
      finalRunId = run.id;
      if (status === "passed") {
        outcome = "passed";
        notes.push("executed → passed");
        await finishStage(
          pipelineRunId,
          "execute",
          "succeeded",
          JSON.stringify({ executionRunId: run.id, result: "passed" }),
        );
      } else {
        outcome = status === "error" ? "error" : "failed";
        failingRunId = run.id;
        notes.push(`executed → ${status}`);
        await finishStage(
          pipelineRunId,
          "execute",
          "succeeded",
          JSON.stringify({ executionRunId: run.id, result: status }),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      outcome = "error";
      notes.push(`execute stage error: ${message}`);
      await finishStage(
        pipelineRunId,
        "execute",
        "failed",
        JSON.stringify({ error: message }),
      );
    }

    // --- 2. HEAL -----------------------------------------------------------
    const healTargetRunId =
      pipeline.autoHeal && outcome !== "passed" ? failingRunId : null;
    if (healTargetRunId === null) {
      await finishStage(
        pipelineRunId,
        "heal",
        "skipped",
        JSON.stringify({
          reason: !pipeline.autoHeal
            ? "autoHeal disabled"
            : outcome === "passed"
              ? "execution passed"
              : "no failing run",
        }),
      );
    } else {
      try {
        await startStage(pipelineRunId, "heal");
        const cap = Math.min(
          Math.max(pipeline.maxHealAttempts, 1),
          MAX_HEAL_ATTEMPTS,
        );
        const attemptLog: Array<Record<string, unknown>> = [];
        let healed = false;
        let likelyBug = false;
        let attemptNumber = 0;

        while (attemptNumber < cap && !healed && !likelyBug) {
          attemptNumber += 1;
          const attempt = await prisma.healingAttempt.create({
            data: {
              executionRunId: healTargetRunId,
              attemptNumber,
              classification: "inconclusive",
              diagnosis: "",
              status: "analyzing",
            },
          });
          await runHealingAttempt(attempt.id);
          const after = await prisma.healingAttempt.findUnique({
            where: { id: attempt.id },
            select: { status: true, classification: true, newRunId: true },
          });
          attemptLog.push({
            attemptNumber,
            attemptId: attempt.id,
            status: after?.status,
            classification: after?.classification,
            verificationRunId: after?.newRunId ?? null,
          });

          if (after?.status === "healed") {
            healed = true;
            if (after.newRunId) {
              finalRunId = after.newRunId;
              failingRunId = null;
            }
            outcome = "passed";
          } else if (after?.classification === "likely_bug") {
            likelyBug = true;
          }
          // "failed_again" / "needs_review" (inconclusive) → keep looping
          // until cap is exhausted.
        }

        if (healed) {
          notes.push(`healed on attempt ${attemptNumber}`);
        } else if (likelyBug) {
          notes.push(`heal classified likely_bug after ${attemptNumber} attempt(s)`);
        } else {
          notes.push(`heal exhausted ${attemptNumber} attempt(s)`);
        }

        await finishStage(
          pipelineRunId,
          "heal",
          "succeeded",
          JSON.stringify({ healed, likelyBug, attempts: attemptLog }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        notes.push(`heal stage error: ${message}`);
        await finishStage(
          pipelineRunId,
          "heal",
          "failed",
          JSON.stringify({ error: message }),
        );
      }
    }

    // --- 3. BUG ------------------------------------------------------------
    const bugTargetRunId = outcome !== "passed" ? failingRunId : null;
    if (!(pipeline.autoBug && bugTargetRunId !== null)) {
      await finishStage(
        pipelineRunId,
        "bug",
        "skipped",
        JSON.stringify({
          reason: !pipeline.autoBug
            ? "autoBug disabled"
            : outcome === "passed"
              ? "no failure to report"
              : "no failing run",
        }),
      );
    } else {
      try {
        await startStage(pipelineRunId, "bug");
        bugReportId = await fileBugReport(bugTargetRunId);
        notes.push(`bug #${bugReportId.slice(0, 8)} filed`);
        await finishStage(
          pipelineRunId,
          "bug",
          "succeeded",
          JSON.stringify({ bugReportId, executionRunId: bugTargetRunId }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        notes.push(`bug stage error: ${message}`);
        await finishStage(
          pipelineRunId,
          "bug",
          "failed",
          JSON.stringify({ error: message }),
        );
      }
    }

    // --- 4. NOTIFY ---------------------------------------------------------
    // Per-run (run.completed) and per-bug (bug.created) events already fire
    // inside executeRun / fileBugReport. This stage adds a pipeline-level
    // summary dispatch so the team gets one rollup notification.
    if (!pipeline.notify) {
      await finishStage(
        pipelineRunId,
        "notify",
        "skipped",
        JSON.stringify({ reason: "notify disabled" }),
      );
    } else {
      try {
        await startStage(pipelineRunId, "notify");
        const summaryLine = `Pipeline ${pipelineRunId.slice(0, 8)} → ${outcome.toUpperCase()}: ${notes.join(" → ")}`;
        if (finalRunId) {
          await dispatchIntegrationEvent(projectId, {
            type: "run.completed",
            run: {
              id: finalRunId,
              projectId,
              status: outcome,
              result: outcome,
              targetUrl: pipeline.targetUrl,
              errorMessage: outcome === "passed" ? null : summaryLine,
            },
          });
        }
        await finishStage(
          pipelineRunId,
          "notify",
          "succeeded",
          JSON.stringify({
            dispatched: "pipeline summary via run.completed; per-bug bug.created already sent inline",
            summary: summaryLine,
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        notes.push(`notify stage error: ${message}`);
        await finishStage(
          pipelineRunId,
          "notify",
          "failed",
          JSON.stringify({ error: message }),
        );
      }
    }

    // --- 5. REPORT ---------------------------------------------------------
    await startStage(pipelineRunId, "report");
    const summary = buildSummary(outcome, notes);
    // succeeded if app ended green; failed if app ended red but pipeline ran
    // all stages cleanly; (error handled in the outer catch).
    const pipelineStatus = outcome === "passed" ? "succeeded" : "failed";
    await finishStage(
      pipelineRunId,
      "report",
      "succeeded",
      JSON.stringify({ outcome, summary }),
    );

    await prisma.pipelineRun.update({
      where: { id: pipelineRunId },
      data: {
        status: pipelineStatus,
        finalRunId,
        bugReportId,
        summary,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.pipelineRun
      .update({
        where: { id: pipelineRunId },
        data: {
          status: "error",
          errorMessage: message,
          finalRunId,
          bugReportId,
          summary: buildSummary("error", [...notes, `orchestrator error: ${message}`]),
          completedAt: new Date(),
        },
      })
      .catch(() => {});
  }
}

function buildSummary(
  outcome: "passed" | "failed" | "error",
  notes: string[],
): string {
  const head =
    outcome === "passed"
      ? "✅ Pipeline succeeded"
      : outcome === "failed"
        ? "❌ Pipeline failed"
        : "⚠️ Pipeline error";
  return `${head}: ${notes.join(" → ")}`;
}

/**
 * Files a BugReport for a failing ExecutionRun, mirroring
 * app/api/bug-reports/from-run/route.ts (deterministic construction + the
 * same bug.created integration dispatch). Returns the new bug report id.
 */
async function fileBugReport(executionRunId: string): Promise<string> {
  const run = await prisma.executionRun.findUnique({
    where: { id: executionRunId },
    include: { testCases: true },
  });
  if (!run) throw new Error("Failing run not found for bug report");

  const linkedTestCase = run.testCases[0];
  const requirement =
    linkedTestCase?.requirement?.trim() || `Automation against ${run.targetUrl}`;

  const input = {
    description:
      `Automated test execution against ${run.targetUrl} failed in a way that ` +
      `appears to indicate a real product defect rather than an automation issue.\n\n` +
      `Requirement:\n${requirement}`,
    stepsToReproduce:
      linkedTestCase?.steps && linkedTestCase.steps !== "[]"
        ? (JSON.parse(linkedTestCase.steps) as string[]).join("\n")
        : `Run the automation for "${linkedTestCase?.title ?? "this test case"}" against ${run.targetUrl}.`,
    environment: `Target URL: ${run.targetUrl} (framework: ${run.framework})`,
    severity: "medium" as const,
  };

  const output = {
    title: `Execution run ${run.id.slice(0, 8)} failed: ${linkedTestCase?.title ?? "automated check"}`,
    summary: `The execution run against ${run.targetUrl} ended with status "${run.status}".`,
    expectedBehavior:
      linkedTestCase?.expectedResult ??
      "The application should behave as described in the requirement.",
    actualBehavior:
      run.errorMessage ?? "The run did not produce the expected result; see logs.",
    logs: run.logs ?? "",
    errorMessage: run.errorMessage ?? null,
    runStatus: run.status,
    runResult: run.result,
  };

  const bugReport = await prisma.bugReport.create({
    data: {
      projectId: run.projectId,
      executionRunId: run.id,
      input: JSON.stringify(input),
      output: JSON.stringify(output),
    },
  });

  await dispatchIntegrationEvent(bugReport.projectId, {
    type: "bug.created",
    bugReport: {
      id: bugReport.id,
      projectId: bugReport.projectId,
      output: bugReport.output,
    },
  }).catch(() => {});

  return bugReport.id;
}
