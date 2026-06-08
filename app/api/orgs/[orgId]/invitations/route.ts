import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { requireOrgRole } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  if (!(await requireOrgRole(session.user.id, orgId, "admin"))) {
    return NextResponse.json(
      { error: "Inviting members requires an admin or owner role." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const { role } = parsed.data;

  // Reject if the email already maps to a current member.
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: existingUser.id, orgId } },
    });
    if (alreadyMember) {
      return NextResponse.json(
        { error: "That user is already a member of this organization." },
        { status: 409 },
      );
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
}
