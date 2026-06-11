import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound } from "@/lib/errors";
import { logAudit } from "@/lib/audit";

// GET /api/projects/[id]/api-specs/[specId] — spec detail with endpoints
export const GET = withHandler(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; specId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId, specId } = await params;

    const spec = await prisma.apiSpec.findFirst({
      where: {
        id: specId,
        projectId,
        project: {
          organization: { memberships: { some: { userId: session.user.id } } },
        },
      },
      select: {
        id: true,
        name: true,
        sourceType: true,
        baseUrl: true,
        createdAt: true,
        endpoints: {
          select: {
            id: true,
            method: true,
            path: true,
            operationId: true,
            summary: true,
            description: true,
            tags: true,
            _count: { select: { testCases: true } },
          },
          orderBy: [{ path: "asc" }, { method: "asc" }],
        },
      },
    });
    if (!spec) throw notFound("Spec not found");

    return NextResponse.json({ spec });
  },
);

// DELETE /api/projects/[id]/api-specs/[specId]
export const DELETE = withHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string; specId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId, specId } = await params;

    const spec = await prisma.apiSpec.findFirst({
      where: {
        id: specId,
        projectId,
        project: {
          organization: { memberships: { some: { userId: session.user.id } } },
        },
      },
      select: { id: true, project: { select: { orgId: true } } },
    });
    if (!spec) throw notFound("Spec not found");

    await prisma.apiSpec.delete({ where: { id: specId } });

    logAudit({
      orgId: spec.project.orgId,
      userId: session.user.id,
      action: "api-spec.delete",
      entityType: "ApiSpec",
      entityId: specId,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ ok: true });
  },
);
