import { prisma } from "@/lib/db/prisma";
import { runPipeline } from "./orchestrator";
import { CronExpressionParser } from "cron-parser";

/**
 * Computes the next run date for a cron expression.
 * Throws if the expression is invalid.
 */
export function computeNextRun(cronExpr: string, from?: Date): Date {
  const interval = CronExpressionParser.parse(cronExpr, {
    currentDate: from ?? new Date(),
  });
  return interval.next().toDate();
}

/**
 * Queries for enabled schedules whose nextRunAt is in the past,
 * fires a pipeline run for each, and updates last/next run times.
 */
export async function runDueSchedules(): Promise<void> {
  const now = new Date();

  let schedules: {
    id: string;
    projectId: string;
    cronExpr: string;
    targetUrl: string;
    autoHeal: boolean;
    autoBug: boolean;
    notify: boolean;
  }[];

  try {
    schedules = await prisma.schedule.findMany({
      where: { enabled: true, nextRunAt: { lte: now } },
    });
  } catch {
    return;
  }

  await Promise.allSettled(
    schedules.map(async (schedule) => {
      try {
        const pipelineRun = await prisma.pipelineRun.create({
          data: {
            projectId: schedule.projectId,
            targetUrl: schedule.targetUrl,
            autoHeal: schedule.autoHeal,
            autoBug: schedule.autoBug,
            notify: schedule.notify,
            status: "queued",
          },
        });

        // Create pipeline stages
        const stageNames = ["execute", "heal", "bug", "notify", "report"];
        await prisma.pipelineStage.createMany({
          data: stageNames.map((name, idx) => ({
            pipelineRunId: pipelineRun.id,
            name,
            sequence: idx + 1,
          })),
        });

        void runPipeline(pipelineRun.id);

        const nextRunAt = computeNextRun(schedule.cronExpr, now);
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            nextRunAt,
            lastStatus: "succeeded",
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.schedule
          .update({
            where: { id: schedule.id },
            data: { lastStatus: "error" },
          })
          .catch(() => {});
        console.error(`[scheduler] schedule ${schedule.id} error: ${message}`);
      }
    }),
  );
}
