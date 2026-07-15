import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound } from "@/lib/errors";

// GET /api/projects/[id]/api-tests/cases — list API-linked test cases with
// their most recent run result (for the "Run tests" tab).
export const GET = withHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organization: { memberships: { some: { userId: session.user.id } } },
      },
      select: { id: true },
    });
    if (!project) throw notFound("Project not found");

    const cases = await prisma.testCase.findMany({
      where: { projectId, apiEndpointId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        priority: true,
        apiEndpoint: { select: { method: true, path: true } },
        apiTestRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            responseCode: true,
            completedAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      cases: cases.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        priority: c.priority,
        method: c.apiEndpoint?.method ?? null,
        path: c.apiEndpoint?.path ?? null,
        lastRun: c.apiTestRuns[0] ?? null,
      })),
    });
  },
);
