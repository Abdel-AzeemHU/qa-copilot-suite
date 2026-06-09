import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { runVisualComparison } from "@/worker/visual-runner";
import { STANDARD_VIEWPORTS } from "@/lib/visual/capture";

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

  const baselines = await prisma.visualBaseline.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, diffScore: true, aiSeverity: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({ baselines });
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await getMemberProject(id, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    name: string;
    url: string;
    viewport?: { width: number; height: number };
  };

  if (!body.name || !body.url) {
    return NextResponse.json({ error: "name and url required" }, { status: 400 });
  }

  const viewport = body.viewport ?? STANDARD_VIEWPORTS[0]!.viewport;
  const viewportJson = JSON.stringify(viewport);

  // Create a VisualRun without a baselineId → worker treats it as baseline capture
  const run = await prisma.visualRun.create({
    data: {
      projectId: id,
      url: body.url,
      viewport: viewportJson,
      status: "queued",
      // We store name temporarily in the run — the worker creates the actual baseline
    },
  });

  // Store the baseline name so the worker can use it
  // (we use a fire-and-forget worker call; pass name via a tiny patch below)
  // Since the VisualRun model doesn't have a name field, we handle naming in worker
  // by injecting a custom name. For now we store it as a separate DB step.

  // Fire-and-forget
  void runVisualComparison(run.id, { baselineName: body.name }).catch(() => {});

  return NextResponse.json({ runId: run.id }, { status: 201 });
}
