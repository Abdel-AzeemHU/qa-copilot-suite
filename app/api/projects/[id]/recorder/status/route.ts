import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { getSessionStatus } from "@/lib/recorder/launch-recorder";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, organization: { memberships: { some: { userId: session.user.id } } } },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const status = getSessionStatus(sessionId);
  if (!status) {
    return NextResponse.json({ active: false, found: false });
  }
  return NextResponse.json({ active: status.active, found: true });
}
