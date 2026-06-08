import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getMembership, requireOrgRole } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  role: z.enum(["owner", "admin", "member"]),
});

async function ownerCount(orgId: string): Promise<number> {
  return prisma.membership.count({ where: { orgId, role: "owner" } });
}

/**
 * PATCH /api/orgs/[orgId]/members/[membershipId] — change a member's role.
 * Owner only. Cannot demote the last owner.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, membershipId } = await params;
  if (!(await requireOrgRole(session.user.id, orgId, "owner"))) {
    return NextResponse.json(
      { error: "Only an owner can change member roles." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const target = await prisma.membership.findFirst({
    where: { id: membershipId, orgId },
  });
  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Prevent demoting the last owner.
  if (
    target.role === "owner" &&
    parsed.data.role !== "owner" &&
    (await ownerCount(orgId)) <= 1
  ) {
    return NextResponse.json(
      { error: "Cannot demote the last owner of the organization." },
      { status: 400 },
    );
  }

  const updated = await prisma.membership.update({
    where: { id: membershipId },
    data: { role: parsed.data.role },
  });

  return NextResponse.json({ membershipId: updated.id, role: updated.role });
}

/**
 * DELETE /api/orgs/[orgId]/members/[membershipId] — remove a member.
 * Admin/owner may remove others; a member may remove themselves (leave).
 * Cannot remove the last owner.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, membershipId } = await params;

  const me = await getMembership(session.user.id, orgId);
  if (!me) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const target = await prisma.membership.findFirst({
    where: { id: membershipId, orgId },
  });
  if (!target) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const isSelf = target.userId === session.user.id;
  const isAdmin = await requireOrgRole(session.user.id, orgId, "admin");

  // Members can only remove themselves; admins/owners can remove anyone.
  if (!isSelf && !isAdmin) {
    return NextResponse.json(
      { error: "You don't have permission to remove this member." },
      { status: 403 },
    );
  }

  if (target.role === "owner" && (await prisma.membership.count({ where: { orgId, role: "owner" } })) <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last owner of the organization." },
      { status: 400 },
    );
  }

  await prisma.membership.delete({ where: { id: membershipId } });

  return NextResponse.json({ ok: true });
}
