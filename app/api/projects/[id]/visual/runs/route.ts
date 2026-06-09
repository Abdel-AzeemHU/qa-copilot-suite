import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { runVisualComparison } from "@/worker/visual-runner";

type RouteContext = { params: Promise<{ id: string }> };

async function getMemberProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      organization: { memberships: { some: { userId } } },
    },
    select: { id: true },
  });
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await getMemberProject(id, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const runs = await prisma.visualRun.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      url: true,
      viewport: true,
      status: true,
      diffScore: true,
      aiSeverity: true,
      aiSummary: true,
      baselineId: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ runs });
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await getMemberProject(id, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    baselineId: string;
    diffThreshold?: number;
  };

  if (!body.baselineId) {
    return NextResponse.json({ error: "baselineId required" }, { status: 400 });
  }

  const baseline = await prisma.visualBaseline.findFirst({
    where: { id: body.baselineId, projectId: id },
  });
  if (!baseline) {
    return NextResponse.json({ error: "Baseline not found" }, { status: 404 });
  }

  const run = await prisma.visualRun.create({
    data: {
      projectId: id,
      baselineId: body.baselineId,
      url: baseline.url,
      viewport: baseline.viewport,
      diffThreshold: body.diffThreshold ?? 0.01,
      status: "queued",
    },
  });

  void runVisualComparison(run.id).catch(() => {});

  return NextResponse.json({ runId: run.id }, { status: 201 });
}
