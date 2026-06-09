import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runPipeline } from "@/worker/orchestrator";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound, badRequest } from "@/lib/errors";
import { getOrgUsage } from "@/lib/usage";
import { checkLimit, ORG_LIMITS } from "@/lib/limits";

const STAGE_NAMES = ["execute", "heal", "bug", "notify", "report"] as const;

const schema = z.object({
  targetUrl: z.string().url("A valid target URL is required"),
  autoHeal: z.boolean().optional(),
  autoBug: z.boolean().optional(),
  notify: z.boolean().optional(),
  maxHealAttempts: z.number().int().min(1).max(3).optional(),
  generatedCode: z.string().optional(),
});

export const POST = withHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const session = await auth();
  if (!session?.user?.id) throw unauthorized();

  const rl = rateLimit(`${session.user.id}:POST /api/projects/[id]/pipelines`, 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: { memberships: { some: { userId: session.user.id } } },
    },
    select: { id: true, orgId: true },
  });
  if (!project) throw notFound("Project not found");

  // Usage limit check
  const usage = await getOrgUsage(project.orgId);
  checkLimit(usage.pipelineRunsThisMonth, ORG_LIMITS.maxPipelineRunsPerMonth, "pipeline runs this month");

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { targetUrl, autoHeal, autoBug, notify, maxHealAttempts } = parsed.data;

  const pipeline = await prisma.pipelineRun.create({
    data: {
      projectId,
      targetUrl,
      autoHeal: autoHeal ?? true,
      autoBug: autoBug ?? true,
      notify: notify ?? true,
      maxHealAttempts: maxHealAttempts ?? 2,
      stages: {
        create: STAGE_NAMES.map((name, i) => ({
          name,
          sequence: i + 1,
          status: "pending",
        })),
      },
    },
  });

  logAudit({
    orgId: project.orgId,
    userId: session.user.id,
    action: "pipeline.start",
    entityType: "PipelineRun",
    entityId: pipeline.id,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  // Fire-and-forget: do NOT await the orchestration.
  void runPipeline(pipeline.id);

  return NextResponse.json({ id: pipeline.id });
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organization: { memberships: { some: { userId: session.user.id } } },
    },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const pipelines = await prisma.pipelineRun.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      targetUrl: true,
      summary: true,
      finalRunId: true,
      bugReportId: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json(
    pipelines.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
    })),
  );
}
