import { prisma } from "@/lib/db/prisma";
import { executeRun } from "./executor";

/**
 * Runs all ExecutionRuns in a ParallelBatch concurrently using Promise.allSettled.
 * Updates batch status to "done" or "error" when all runs complete.
 */
export async function runParallelBatch(batchId: string): Promise<void> {
  const batch = await prisma.parallelBatch.findUnique({
    where: { id: batchId },
    include: { runs: { select: { id: true } } },
  });
  if (!batch) return;

  const results = await Promise.allSettled(
    batch.runs.map((run) => executeRun(run.id)),
  );

  const allFailed = results.every((r) => r.status === "rejected");

  await prisma.parallelBatch.update({
    where: { id: batchId },
    data: {
      status: allFailed ? "error" : "done",
      completedAt: new Date(),
    },
  });
}
