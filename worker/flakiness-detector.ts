import { prisma } from "@/lib/db/prisma";
import { executeRun } from "./executor";
import { runHelper } from "@/lib/ai/run-helper";
import { flakinessAnalyzerHelper } from "@/lib/helpers/flakiness-analyzer";
import { getProviderForOwner } from "@/lib/ai/get-provider";

const DEFAULT_RUNS = 5;

/**
 * Runs the automation code for a FlakinessReport N times, computes a flakiness
 * score, then calls the AI to analyze the pattern and suggest root causes.
 *
 * Score definition:
 *   0.0 = perfectly stable (all passes)
 *   1.0 = completely broken (all fail/error)
 *   0.0–1.0 = flaky (non-deterministic)
 *
 * Status:
 *   stable  — score = 0
 *   flaky   — 0 < score < 1
 *   broken  — score = 1
 */
export async function runFlakinessDetection(
  reportId: string,
  runCount = DEFAULT_RUNS,
): Promise<void> {
  const report = await prisma.flakinessReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      projectId: true,
      testCaseId: true,
      targetUrl: true,
      generatedCode: true,
      project: { select: { orgId: true } },
    },
  });

  if (!report) {
    throw new Error(`FlakinessReport ${reportId} not found`);
  }

  const runIds: string[] = [];
  const runSummaries: Array<{
    attempt: number;
    result: "passed" | "failed" | "error";
    errorMessage?: string;
    logs?: string;
  }> = [];

  let passCount = 0;
  let failCount = 0;
  let errorCount = 0;

  // Run sequentially to avoid overwhelming the machine
  for (let attempt = 1; attempt <= runCount; attempt++) {
    const run = await prisma.executionRun.create({
      data: {
        projectId: report.projectId,
        targetUrl: report.targetUrl,
        generatedCode: report.generatedCode,
        status: "queued",
      },
    });
    runIds.push(run.id);

    // Update report with current progress
    await prisma.flakinessReport.update({
      where: { id: reportId },
      data: { totalRuns: attempt - 1, runIds: JSON.stringify(runIds) },
    });

    await executeRun(run.id);

    const completed = await prisma.executionRun.findUnique({
      where: { id: run.id },
      select: { result: true, errorMessage: true, logs: true },
    });

    const result = (completed?.result ?? "error") as "passed" | "failed" | "error";

    if (result === "passed") passCount++;
    else if (result === "failed") failCount++;
    else errorCount++;

    runSummaries.push({
      attempt,
      result,
      errorMessage: completed?.errorMessage ?? undefined,
      logs: completed?.logs?.slice(-500) ?? undefined,
    });

    // Update progress
    await prisma.flakinessReport.update({
      where: { id: reportId },
      data: {
        totalRuns: attempt,
        passCount,
        failCount,
        errorCount,
        runIds: JSON.stringify(runIds),
      },
    });
  }

  // Compute flakiness score
  const flakinessScore = (failCount + errorCount) / runCount;
  const status =
    flakinessScore === 0 ? "stable" : flakinessScore === 1 ? "broken" : "flaky";

  let rootCause: string | null = null;
  let suggestions: string | null = null;

  // Only run AI analysis if there are actual failures to analyze
  if (flakinessScore > 0) {
    try {
      const provider = await getProviderForOwner(report.project.orgId);
      const analysis = await runHelper(
        flakinessAnalyzerHelper,
        {
          testCaseTitle: undefined,
          targetUrl: report.targetUrl,
          generatedCode: report.generatedCode,
          totalRuns: runCount,
          passCount,
          failCount,
          errorCount,
          runSummaries,
        },
        provider,
      );
      rootCause = analysis.rootCause;
      suggestions = JSON.stringify(analysis.suggestions);
    } catch {
      // Non-fatal: complete report without AI analysis
    }
  }

  await prisma.flakinessReport.update({
    where: { id: reportId },
    data: {
      totalRuns: runCount,
      passCount,
      failCount,
      errorCount,
      flakinessScore,
      status,
      runIds: JSON.stringify(runIds),
      rootCause,
      suggestions,
      completedAt: new Date(),
    },
  });

}
