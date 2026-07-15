import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound, badRequest } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { runApiTestBatch } from "@/worker/api-test-runner";

const schema = z.object({
  testCaseIds: z.array(z.string()).min(1, "Select at least one test case"),
});

// POST /api/projects/[id]/api-tests/run — execute API test cases
export const POST = withHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId } = await params;

    const rl = rateLimit(
      `${session.user.id}:POST /api/projects/${projectId}/api-tests/run`,
      15,
      10 * 60 * 1000,
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
        { status: 429 },
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organization: { memberships: { some: { userId: session.user.id } } },
      },
      select: { id: true, orgId: true },
    });
    if (!project) throw notFound("Project not found");

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    // Only run test cases that belong to this project and are API-linked.
    const testCases = await prisma.testCase.findMany({
      where: {
        id: { in: parsed.data.testCaseIds },
        projectId,
        apiEndpointId: { not: null },
      },
      select: { id: true },
    });
    if (testCases.length === 0) {
      throw badRequest("No API-linked test cases found for the given ids.");
    }

    const runIds = await runApiTestBatch(
      projectId,
      testCases.map((t) => t.id),
    );

    logAudit({
      orgId: project.orgId,
      userId: session.user.id,
      action: "api-test.run",
      entityType: "Project",
      entityId: projectId,
      meta: { count: runIds.length },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ runIds }, { status: 201 });
  },
);
