import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/invitations/[token] — non-sensitive preview of an invitation for the
 * accept page. Readable without org membership (the token is the credential).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const expired = invitation.expiresAt.getTime() < Date.now();
  const valid = invitation.status === "pending" && !expired;

  return NextResponse.json({
    orgName: invitation.organization.name,
    role: invitation.role,
    email: invitation.email,
    invitedBy: invitation.invitedBy.name ?? invitation.invitedBy.email,
    status: invitation.status,
    expired,
    valid,
  });
}
