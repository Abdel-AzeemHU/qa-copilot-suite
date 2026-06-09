import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { requireOrgRole } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, forbidden, badRequest } from "@/lib/errors";
import { getOrgUsage } from "@/lib/usage";
import { checkLimit, ORG_LIMITS } from "@/lib/limits";

const INVITE_TTL_DAYS = 7;

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});

function inviteUrl(req: NextRequest, token: string): string {
  const origin = req.nextUrl.origin;
  return `${origin}/invitations/${token}`;
}

/**
 * POST /api/orgs/[orgId]/invitations — invite a user by email. Admin/owner only.
 */
export const POST = withHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) => {
  const session = await auth();
  if (!session?.user?.id) throw unauthorized();

  const { orgId } = await params;

  const rl = rateLimit(`${session.user.id}:POST /api/orgs/invitations`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  if (!(await requireOrgRole(session.user.id, orgId, "admin"))) {
    throw forbidden("Inviting members requires an admin or owner role.");
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // Usage limit check
  const usage = await getOrgUsage(orgId);
  checkLimit(usage.members, ORG_LIMITS.maxMembersPerOrg, "members");

  const email = parsed.data.email.toLowerCase().trim();
  const { role } = parsed.data;

  // Reject if the email already maps to a current member.
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: existingUser.id, orgId } },
    });
    if (alreadyMember) {
      throw badRequest("That user is already a member of this organization.");
    }
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Reuse / refresh an existing pending invite for this email + org.
  const existingInvite = await prisma.invitation.findFirst({
    where: { orgId, email, status: "pending" },
  });

  let invitation;
  if (existingInvite) {
    invitation = await prisma.invitation.update({
      where: { id: existingInvite.id },
      data: {
        role,
        token: randomBytes(24).toString("hex"),
        invitedById: session.user.id,
        expiresAt,
        createdAt: new Date(),
      },
    });
  } else {
    invitation = await prisma.invitation.create({
      data: {
        orgId,
        email,
        role,
        token: randomBytes(24).toString("hex"),
        invitedById: session.user.id,
        expiresAt,
      },
    });
  }

  logAudit({
    orgId,
    userId: session.user.id,
    action: "member.invite",
    entityType: "Invitation",
    entityId: invitation.id,
    meta: { email, role },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json(
    {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      expiresAt: invitation.expiresAt.toISOString(),
      inviteUrl: inviteUrl(req, invitation.token),
    },
    { status: 201 },
  );
});
