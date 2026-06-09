import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; cacheId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, cacheId } = await params;

  // Require admin+ membership
  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      organization: { projects: { some: { id } } },
      role: { in: ["owner", "admin"] },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await prisma.selectorCache.findFirst({
    where: { id: cacheId, projectId: id },
  });
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.selectorCache.delete({ where: { id: cacheId } });

  return NextResponse.json({ ok: true });
}
