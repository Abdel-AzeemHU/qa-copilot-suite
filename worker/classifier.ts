import { prisma } from "@/lib/db/prisma";
import { runHelper } from "@/lib/ai/run-helper";
import { failureClassifierHelper } from "@/lib/helpers/failure-classifier";
import { getProviderForOwner } from "@/lib/ai/get-provider";

/**
 * Classifies WHY a failed/error ExecutionRun failed:
 *   real_bug | flaky | environment | automation
 *
 * Designed to be fired-and-forgotten after a run completes with a non-passed
 * result. Never throws — classification is best-effort enrichment; a failure
 * here must not affect the run itself.
 *
 * Recent history of runs with the same generatedCode is included as signal:
 * a pass/fail alternation with identical code strongly suggests flakiness.
 */
export async function classifyRunFailure(runId: string): Promise<void> {
  try {
    const run = await prisma.executionRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        projectId: true,
        result: true,
        targetUrl: true,
        generatedCode: true,
        logs: true,
        errorMessage: true,
        failureClass: true,
        testCases: { select: { title: true, requirement: true }, take: 1 },
        project: { select: { orgId: true } },
      },
    });

    if (!run) return;
    if (run.result === "passed") return; // nothing to classify
    if (run.failureClass) return; // already classified

    // History: recent completed runs of the same code in this project.
    const history = await prisma.executionRun.findMany({
      where: {
        projectId: run.projectId,
        id: { not: run.id },
        generatedCode: run.generatedCode,
        result: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { result: true, errorMessage: true, completedAt: true },
    });

    const provider = await getProviderForOwner(run.project.orgId);

    const output = await runHelper(
      failureClassifierHelper,
      {
        targetUrl: run.targetUrl,
        generatedCode: run.generatedCode,
        logs: run.logs ?? "",
        errorMessage: run.errorMessage ?? undefined,
        testCaseTitle: run.testCases[0]?.title,
        requirement: run.testCases[0]?.requirement ?? undefined,
        recentHistory: history.map((h) => ({
          result: h.result ?? "unknown",
          errorMessage: h.errorMessage ?? undefined,
          completedAt: h.completedAt?.toISOString(),
        })),
      },
      provider,
    );

    await prisma.executionRun.update({
      where: { id: runId },
      data: {
        failureClass: output.failureClass,
        failureClassConfidence: output.confidence,
        failureClassSummary: output.summary,
      },
    });
  } catch (err) {
    // Best-effort: log and move on. No API key, provider error, etc. must
    // never break the execution flow.
    console.error(
      `[classifier] failed to classify run ${runId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
