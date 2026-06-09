import { prisma } from "@/lib/db/prisma";
import { runPipeline } from "@/worker/orchestrator";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const triggerSchema = z.object({
  secret: z.string().min(1),
  targetUrl: z.string().url().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Validate secret against any enabled schedule for this project
  const schedule = await prisma.schedule.findFirst({
    where: { projectId: id, enabled: true },
  });

  if (!schedule) {
    return NextResponse.json({ error: "No schedules found for project" }, { status: 404 });
  }

  // Secret must match the schedule id (used as a simple webhook secret)
  // In a real system you'd store a hashed secret per schedule; here we use the schedule.id
  if (parsed.data.secret !== schedule.id) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const targetUrl = parsed.data.targetUrl ?? schedule.targetUrl;

  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      projectId: id,
      targetUrl,
      autoHeal: schedule.autoHeal,
      autoBug: schedule.autoBug,
      notify: schedule.notify,
      status: "queued",
    },
  });

  const stageNames = ["execute", "heal", "bug", "notify", "report"];
  await prisma.pipelineStage.createMany({
    data: stageNames.map((name, idx) => ({
      pipelineRunId: pipelineRun.id,
      name,
      sequence: idx + 1,
    })),
  });

  void runPipeline(pipelineRun.id);

  return NextResponse.json({ pipelineRunId: pipelineRun.id }, { status: 201 });
}
