import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getMembership } from "@/lib/data";
import { NextResponse } from "next/server";

/**
 * GET /api/orgs/[orgId]/members — list members and pending invitations.
 * Any member of the org may read this.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const me = await getMembership(session.user.id, orgId);
  if (!me) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const [memberships, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { orgId, status: "pending" },
      include: { invitedBy: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    myRole: me.role,
    members: memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.createdAt.toISOString(),
      isSelf: m.userId === session.user!.id,
    })),
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      token: inv.token,
      invitedBy: inv.invitedBy.name ?? inv.invitedBy.email,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
      expired: inv.expiresAt.getTime() < Date.now(),
    })),
  });
}
