import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound, badRequest } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { runFlakinessDetection } from "@/worker/flakiness-detector";

const createSchema = z.object({
  generatedCode: z.string().min(1, "Generated code is required"),
  targetUrl: z.string().url("A valid target URL is required"),
  testCaseId: z.string().optional(),
  runCount: z.number().int().min(2).max(20).optional().default(5),
});

// GET /api/projects/[id]/flakiness — list reports for this project
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

    const reports = await prisma.flakinessReport.findMany({
      where: { projectId },
      orderBy: { triggeredAt: "desc" },
      take: 50,
      select: {
        id: true,
        testCaseId: true,
        targetUrl: true,
        totalRuns: true,
        passCount: true,
        failCount: true,
        errorCount: true,
        status: true,
        flakinessScore: true,
        quarantined: true,
        rootCause: true,
        suggestions: true,
        triggeredAt: true,
        completedAt: true,
        testCase: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ reports });
  },
);

// POST /api/projects/[id]/flakiness — trigger flakiness detection
export const POST = withHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId } = await params;

    const rl = rateLimit(
      `${session.user.id}:POST /api/projects/${projectId}/flakiness`,
      5,
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { generatedCode, targetUrl, testCaseId, runCount } = parsed.data;

    // Validate testCaseId belongs to this project if provided
    if (testCaseId) {
      const tc = await prisma.testCase.findFirst({
        where: { id: testCaseId, projectId },
        select: { id: true },
      });
      if (!tc) throw notFound("Test case not found");
    }

    const report = await prisma.flakinessReport.create({
      data: {
        projectId,
        testCaseId,
        generatedCode,
        targetUrl,
        status: "running",
      },
    });

    logAudit({
      orgId: project.orgId,
      userId: session.user.id,
      action: "flakiness.detect",
      entityType: "FlakinessReport",
      entityId: report.id,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    // Fire-and-forget
    void runFlakinessDetection(report.id, runCount).catch(async (err) => {
      await prisma.flakinessReport.update({
        where: { id: report.id },
        data: {
          status: "error",
          rootCause: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ id: report.id }, { status: 201 });
  },
);
