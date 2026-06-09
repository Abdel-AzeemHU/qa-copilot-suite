import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { requireOrgRole } from "@/lib/data";
import { logAudit } from "@/lib/audit";
import { generateToken } from "@/lib/ci/tokens";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  expiresInDays: z.number().int().positive().max(3650).optional(),
});

async function getOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organization: { memberships: { some: { userId } } } },
    select: { id: true, orgId: true },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const tokens = await prisma.projectApiToken.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    // NEVER select tokenHash.
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json(tokens);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!(await requireOrgRole(session.user.id, project.orgId, "admin"))) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { raw, prefix, hash } = generateToken();
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000)
    : null;

  const token = await prisma.projectApiToken.create({
    data: {
      projectId: id,
      name: parsed.data.name,
      tokenPrefix: prefix,
      tokenHash: hash,
      createdById: session.user.id,
      expiresAt,
    },
    select: { id: true, name: true },
  });

  logAudit({
    orgId: project.orgId,
    userId: session.user.id,
    action: "citoken.create",
    entityType: "ProjectApiToken",
    entityId: token.id,
    meta: { projectId: id, name: token.name, prefix },
  });

  // The raw token is returned ONCE — the UI must warn it won't be shown again.
  return NextResponse.json(
    { id: token.id, name: token.name, token: raw },
    { status: 201 },
  );
}
