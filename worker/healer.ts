import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";
import { getClaudeApiKeyRecord } from "@/lib/data";
import { ClaudeProvider } from "@/lib/ai/claude";
import { runHelper } from "@/lib/ai/run-helper";
import { selfHealerHelper } from "@/lib/helpers/self-healer";
import { executeRun } from "./executor";

/**
 * Runs a single self-healing attempt to completion:
 *  1. Diagnose the failure via the self-healer LLM helper.
 *  2. If "repairable": create + execute a verification ExecutionRun with the
 *     patched code, and mark the attempt healed/failed_again based on the result.
 *  3. If "likely_bug" / "inconclusive": mark the attempt as needing human review.
 *
 * Runs in-process, fire-and-forget from the API route.
 */
export async function runHealingAttempt(attemptId: string): Promise<void> {
  const attempt = await prisma.healingAttempt.findUnique({
    where: { id: attemptId },
    include: {
      executionRun: {
        include: {
          project: { include: { organization: true } },
          testCases: true,
        },
      },
    },
  });
  if (!attempt) return;

  const run = attempt.executionRun;

  try {
    const ownerId = run.project.organization.ownerId;
    const record = await getClaudeApiKeyRecord(ownerId);
    if (!record) {
      throw new Error(
        "No Claude API key found for the project owner. Add one in settings to enable self-healing.",
      );
    }
    const apiKey = decrypt(record.encryptedKey);
    const provider = new ClaudeProvider(apiKey);

    const linkedTestCase = run.testCases[0];
    const requirement =
      linkedTestCase?.requirement?.trim() ||
      `Verify the automation against ${run.targetUrl}`;

    const output = await runHelper(
      selfHealerHelper,
      {
        requirement,
        testCaseTitle: linkedTestCase?.title,
        targetUrl: run.targetUrl,
        generatedCode: run.generatedCode,
        logs: run.logs ?? "",
        errorMessage: run.errorMessage ?? undefined,
      },
      provider,
    );

    await prisma.healingAttempt.update({
      where: { id: attemptId },
      data: {
        classification: output.classification,
        diagnosis: `[confidence: ${output.confidence}] ${output.diagnosis}`,
      },
    });

    if (output.classification === "repairable" && output.patchedCode?.trim()) {
      await prisma.healingAttempt.update({
        where: { id: attemptId },
        data: { status: "patched", patchedCode: output.patchedCode },
      });

      const newRun = await prisma.executionRun.create({
        data: {
          projectId: run.projectId,
          targetUrl: run.targetUrl,
          framework: run.framework,
          generatedCode: output.patchedCode,
          status: "queued",
        },
      });

      await prisma.healingAttempt.update({
        where: { id: attemptId },
        data: { newRunId: newRun.id, status: "verifying" },
      });

      await executeRun(newRun.id);

      const verified = await prisma.executionRun.findUnique({
        where: { id: newRun.id },
        select: { result: true, status: true },
      });

      if (verified?.result === "passed") {
        await prisma.healingAttempt.update({
          where: { id: attemptId },
          data: { status: "healed", completedAt: new Date() },
        });
      } else {
        await prisma.healingAttempt.update({
          where: { id: attemptId },
          data: { status: "failed_again", completedAt: new Date() },
        });
      }
      return;
    }

    // "likely_bug" or "inconclusive"
    await prisma.healingAttempt.update({
      where: { id: attemptId },
      data: { status: "needs_review", completedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.healingAttempt.update({
      where: { id: attemptId },
      data: { status: "error", errorMessage: message, completedAt: new Date() },
    });
  }
}
