import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { requireOrgRole } from "@/lib/data";
import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organization: { memberships: { some: { userId } } } },
    select: { id: true, orgId: true },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tokenId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, tokenId } = await params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!(await requireOrgRole(session.user.id, project.orgId, "admin"))) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const token = await prisma.projectApiToken.findFirst({
    where: { id: tokenId, projectId: id },
    select: { id: true, revokedAt: true },
  });
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  if (!token.revokedAt) {
    await prisma.projectApiToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
  }

  logAudit({
    orgId: project.orgId,
    userId: session.user.id,
    action: "citoken.revoke",
    entityType: "ProjectApiToken",
    entityId: tokenId,
    meta: { projectId: id },
  });

  return NextResponse.json({ ok: true });
}
