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
  const project = await prisma.project.findFirst({
    where: {
      id,
      organization: { memberships: { some: { userId: session.user.id } } },
    },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entries = await prisma.selectorCache.findMany({
    where: { projectId: id },
    orderBy: { hitCount: "desc" },
    select: {
      id: true,
      originalSelector: true,
      healedSelector: true,
      strategy: true,
      confidence: true,
      hitCount: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ entries });
}
