import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound, badRequest } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { runContractCheck } from "@/worker/contract-runner";

const triggerSchema = z.object({
  includeUnsafe: z.boolean().optional().default(false),
});

async function assertAccess(projectId: string, specId: string, userId: string) {
  const spec = await prisma.apiSpec.findFirst({
    where: {
      id: specId,
      projectId,
      project: {
        organization: { memberships: { some: { userId } } },
      },
    },
    select: { id: true, baseUrl: true, project: { select: { orgId: true } } },
  });
  return spec;
}

// POST /api/projects/[id]/api-specs/[specId]/contract — start a contract check
export const POST = withHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string; specId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId, specId } = await params;

    const rl = rateLimit(
      `${session.user.id}:POST contract ${specId}`,
      10,
      10 * 60 * 1000,
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
        { status: 429 },
      );
    }

    const spec = await assertAccess(projectId, specId, session.user.id);
    if (!spec) throw notFound("Spec not found");
    if (!spec.baseUrl) {
      throw badRequest(
        "This spec has no base URL — re-import it with servers/baseUrl set.",
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = triggerSchema.safeParse(body ?? {});
    const includeUnsafe = parsed.success ? parsed.data.includeUnsafe : false;

    const run = await prisma.contractRun.create({
      data: { projectId, apiSpecId: specId, includeUnsafe },
      select: { id: true },
    });

    logAudit({
      orgId: spec.project.orgId,
      userId: session.user.id,
      action: "contract.check",
      entityType: "ContractRun",
      entityId: run.id,
      meta: { includeUnsafe },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    void runContractCheck(run.id);

    return NextResponse.json({ id: run.id }, { status: 201 });
  },
);

// GET /api/projects/[id]/api-specs/[specId]/contract — list runs (latest first),
// most recent run includes per-endpoint results.
export const GET = withHandler(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; specId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId, specId } = await params;

    const spec = await assertAccess(projectId, specId, session.user.id);
    if (!spec) throw notFound("Spec not found");

    const runs = await prisma.contractRun.findMany({
      where: { apiSpecId: specId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        totalEndpoints: true,
        passedCount: true,
        failedCount: true,
        skippedCount: true,
        includeUnsafe: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const latest = runs[0];
    const results = latest
      ? await prisma.contractResult.findMany({
          where: { contractRunId: latest.id },
          orderBy: [{ status: "asc" }, { path: "asc" }],
          select: {
            id: true,
            method: true,
            path: true,
            status: true,
            responseCode: true,
            durationMs: true,
            issues: true,
            detail: true,
          },
        })
      : [];

    return NextResponse.json({ runs, latestResults: results });
  },
);
