import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { encrypt } from "@/lib/crypto";
import { serializeIntegration } from "@/lib/integrations/serialize";
import { requireOrgRole } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  secret: z.string().trim().optional(),
});

async function getOwnedIntegration(
  projectId: string,
  integrationId: string,
  userId: string,
) {
  return prisma.integration.findFirst({
    where: {
      id: integrationId,
      projectId,
      project: { organization: { memberships: { some: { userId } } } },
    },
    include: { project: { select: { orgId: true } } },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, integrationId } = await params;
  const existing = await getOwnedIntegration(id, integrationId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }
  if (!(await requireOrgRole(session.user.id, existing.project.orgId, "admin"))) {
    return NextResponse.json(
      { error: "Managing integrations requires an admin or owner role." },
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

  const { name, config, enabled, secret } = parsed.data;

  const integration = await prisma.integration.update({
    where: { id: integrationId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(config !== undefined ? { config: JSON.stringify(config) } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
      ...(secret ? { encryptedSecret: encrypt(secret) } : {}),
    },
  });

  return NextResponse.json(serializeIntegration(integration));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, integrationId } = await params;
  const existing = await getOwnedIntegration(id, integrationId, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }
  if (!(await requireOrgRole(session.user.id, existing.project.orgId, "admin"))) {
    return NextResponse.json(
      { error: "Managing integrations requires an admin or owner role." },
      { status: 403 },
    );
  }

  await prisma.integration.delete({ where: { id: integrationId } });

  logAudit({
    orgId: existing.project.orgId,
    userId: session.user.id,
    action: "integration.delete",
    entityType: "Integration",
    entityId: integrationId,
  });

  return NextResponse.json({ ok: true });
}
