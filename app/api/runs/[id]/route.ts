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
  const run = await prisma.executionRun.findFirst({
    where: {
      id,
      project: { organization: { memberships: { some: { userId: session.user.id } } } },
    },
    select: {
      id: true,
      status: true,
      targetUrl: true,
      framework: true,
      logs: true,
      result: true,
      errorMessage: true,
      screenshotPath: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}
