import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound } from "@/lib/errors";

// GET /api/projects/[id]/api-tests/runs?ids=a,b,c — poll API test run results.
// Without ids, returns the most recent 50 runs for the project.
export const GET = withHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
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

    const idsParam = req.nextUrl.searchParams.get("ids");
    const ids = idsParam ? idsParam.split(",").filter(Boolean) : null;

    const runs = await prisma.apiTestRun.findMany({
      where: { projectId, ...(ids ? { id: { in: ids } } : {}) },
      orderBy: { createdAt: "desc" },
      take: ids ? ids.length : 50,
      select: {
        id: true,
        testCaseId: true,
        status: true,
        method: true,
        url: true,
        responseCode: true,
        responseTimeMs: true,
        responseBody: true,
        assertions: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
        testCase: { select: { id: true, title: true, type: true } },
      },
    });

    return NextResponse.json({ runs });
  },
);
