import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const pipeline = await prisma.pipelineRun.findFirst({
    where: {
      id,
      project: {
        organization: { memberships: { some: { userId: session.user.id } } },
      },
    },
    include: {
      stages: { orderBy: { sequence: "asc" } },
    },
  });
  if (!pipeline) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: pipeline.id,
    status: pipeline.status,
    targetUrl: pipeline.targetUrl,
    autoHeal: pipeline.autoHeal,
    autoBug: pipeline.autoBug,
    notify: pipeline.notify,
    maxHealAttempts: pipeline.maxHealAttempts,
    finalRunId: pipeline.finalRunId,
    bugReportId: pipeline.bugReportId,
    summary: pipeline.summary,
    errorMessage: pipeline.errorMessage,
    startedAt: pipeline.startedAt ? pipeline.startedAt.toISOString() : null,
    completedAt: pipeline.completedAt
      ? pipeline.completedAt.toISOString()
      : null,
    createdAt: pipeline.createdAt.toISOString(),
    stages: pipeline.stages.map((s) => ({
      id: s.id,
      name: s.name,
      sequence: s.sequence,
      status: s.status,
      detail: s.detail,
      startedAt: s.startedAt ? s.startedAt.toISOString() : null,
      completedAt: s.completedAt ? s.completedAt.toISOString() : null,
    })),
  });
}
