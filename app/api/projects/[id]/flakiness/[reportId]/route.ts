import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound } from "@/lib/errors";

// GET /api/projects/[id]/flakiness/[reportId] — poll a single report
export const GET = withHandler(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; reportId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId, reportId } = await params;

    const report = await prisma.flakinessReport.findFirst({
      where: {
        id: reportId,
        projectId,
        project: {
          organization: { memberships: { some: { userId: session.user.id } } },
        },
      },
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
        runIds: true,
        rootCause: true,
        suggestions: true,
        triggeredAt: true,
        completedAt: true,
        testCase: { select: { id: true, title: true } },
      },
    });
    if (!report) throw notFound("Report not found");

    return NextResponse.json({ report });
  },
);

// PATCH /api/projects/[id]/flakiness/[reportId] — toggle quarantine
export const PATCH = withHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string; reportId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId, reportId } = await params;

    const existing = await prisma.flakinessReport.findFirst({
      where: {
        id: reportId,
        projectId,
        project: {
          organization: { memberships: { some: { userId: session.user.id } } },
        },
      },
      select: { id: true, quarantined: true },
    });
    if (!existing) throw notFound("Report not found");

    const body = await req.json().catch(() => ({})) as { quarantined?: boolean };
    const quarantined =
      typeof body.quarantined === "boolean"
        ? body.quarantined
        : !existing.quarantined;

    const updated = await prisma.flakinessReport.update({
      where: { id: reportId },
      data: { quarantined },
      select: { id: true, quarantined: true },
    });

    return NextResponse.json({ report: updated });
  },
);
