import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { requireOrgRole } from "@/lib/data";
import { computeNextRun } from "@/worker/scheduler";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  cronExpr: z.string().min(1),
  targetUrl: z.string().url(),
  autoHeal: z.boolean().optional().default(true),
  autoBug: z.boolean().optional().default(true),
  notify: z.boolean().optional().default(true),
});

async function getOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organization: { memberships: { some: { userId } } } },
    select: { id: true, orgId: true },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const schedules = await prisma.schedule.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(schedules);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!(await requireOrgRole(session.user.id, project.orgId, "admin"))) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  let nextRunAt: Date;
  try {
    nextRunAt = computeNextRun(parsed.data.cronExpr);
  } catch {
    return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
  }

  const schedule = await prisma.schedule.create({
    data: {
      projectId: id,
      name: parsed.data.name,
      cronExpr: parsed.data.cronExpr,
      targetUrl: parsed.data.targetUrl,
      autoHeal: parsed.data.autoHeal,
      autoBug: parsed.data.autoBug,
      notify: parsed.data.notify,
      nextRunAt,
    },
  });

  return NextResponse.json(schedule, { status: 201 });
}
