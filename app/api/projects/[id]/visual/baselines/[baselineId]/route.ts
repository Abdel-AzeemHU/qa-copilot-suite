import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type RouteContext = { params: Promise<{ id: string; baselineId: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, baselineId } = await params;

  // Check membership and admin/owner role
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

  const baseline = await prisma.visualBaseline.findFirst({
    where: { id: baselineId, projectId: id },
  });
  if (!baseline) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clean up image file
  try {
    const absPath = path.join(process.cwd(), "public", baseline.imagePath);
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch {
    // Non-critical
  }

  await prisma.visualBaseline.delete({ where: { id: baselineId } });

  return NextResponse.json({ ok: true });
}
