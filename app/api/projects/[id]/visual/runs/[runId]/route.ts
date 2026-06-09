import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string; runId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, runId } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id,
      organization: { memberships: { some: { userId: session.user.id } } },
    },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const run = await prisma.visualRun.findFirst({
    where: { id: runId, projectId: id },
    include: { baseline: { select: { id: true, name: true, imagePath: true } } },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ run });
}
