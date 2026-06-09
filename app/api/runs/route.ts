import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeRun } from "@/worker/executor";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound, badRequest } from "@/lib/errors";
import { getOrgUsage } from "@/lib/usage";

const schema = z.object({
  projectId: z.string().min(1),
  targetUrl: z.string().url("A valid target URL is required"),
  generatedCode: z.string().optional(),
});

export const POST = withHandler(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user?.id) throw unauthorized();

  const rl = rateLimit(`${session.user.id}:POST /api/runs`, 20, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { projectId, targetUrl } = parsed.data;

  // Ownership check.
  const project = await prisma.project.findFirst({
    where: { id: projectId, organization: { memberships: { some: { userId: session.user.id } } } },
    select: { id: true, orgId: true },
  });
  if (!project) throw notFound("Project not found");

  // Resolve the code: provided directly, else from the latest AutomationRun.
  let generatedCode = parsed.data.generatedCode?.trim() ?? "";
  if (!generatedCode) {
    const latest = await prisma.automationRun.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) {
      throw badRequest("No automation code found. Generate automation code first.");
    }
    const files = JSON.parse(latest.files) as Array<{
      filename: string;
      content: string;
    }>;
    generatedCode = files.map((f) => f.content).join("\n\n");
  }

  if (!generatedCode) {
    throw badRequest("No automation code to execute.");
  }

  const run = await prisma.executionRun.create({
    data: {
      projectId,
      targetUrl,
      generatedCode,
      status: "queued",
    },
  });

  logAudit({
    orgId: project.orgId,
    userId: session.user.id,
    action: "run.start",
    entityType: "ExecutionRun",
    entityId: run.id,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  // Fire-and-forget: do NOT await execution.
  void executeRun(run.id);

  return NextResponse.json({ id: run.id });
});
