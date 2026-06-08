import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ token: z.string().min(1) });

/**
 * POST /api/invitations/accept — the authenticated user accepts an invitation.
 * Idempotent if already a member. Strict: the invite email must match.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token: parsed.data.token },
  });
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invitation.status === "revoked") {
    return NextResponse.json({ error: "This invitation was revoked." }, { status: 410 });
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
  }

  // Strict email match.
  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json(
      {
        error:
          "This invitation was sent to a different email address. Sign in with that address to accept.",
      },
      { status: 403 },
    );
  }

  // Idempotent: already a member.
  const existing = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: invitation.orgId } },
  });

  if (!existing) {
    await prisma.membership.create({
      data: {
        userId: session.user.id,
        orgId: invitation.orgId,
        role: invitation.role,
      },
    });
  }

  if (invitation.status !== "accepted") {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, orgId: invitation.orgId });
}
