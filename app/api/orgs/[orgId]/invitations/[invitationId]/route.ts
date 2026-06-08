import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { requireOrgRole } from "@/lib/data";
import { NextResponse } from "next/server";

/**
 * DELETE /api/orgs/[orgId]/invitations/[invitationId] — revoke a pending
 * invitation. Admin/owner only.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; invitationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, invitationId } = await params;
  if (!(await requireOrgRole(session.user.id, orgId, "admin"))) {
    return NextResponse.json(
      { error: "Revoking invitations requires an admin or owner role." },
      { status: 403 },
    );
  }

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, orgId },
  });
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { status: "revoked" },
  });

  return NextResponse.json({ ok: true });
}
