import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { requireOrgRole } from "@/lib/data";
import { computeNextRun } from "@/worker/scheduler";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  cronExpr: z.string().optional(),
  targetUrl: z.string().url().optional(),
  name: z.string().min(1).max(120).optional(),
  autoHeal: z.boolean().optional(),
  autoBug: z.boolean().optional(),
  notify: z.boolean().optional(),
});

async function getOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organization: { memberships: { some: { userId } } } },
    select: { id: true, orgId: true },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, scheduleId } = await params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!(await requireOrgRole(session.user.id, project.orgId, "admin"))) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.cronExpr) {
    try {
      updates.nextRunAt = computeNextRun(parsed.data.cronExpr);
    } catch {
      return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 });
    }
  }

  const schedule = await prisma.schedule.updateMany({
    where: { id: scheduleId, projectId: id },
    data: updates,
  });

  if (schedule.count === 0) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const updated = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, scheduleId } = await params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!(await requireOrgRole(session.user.id, project.orgId, "admin"))) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  await prisma.schedule.deleteMany({ where: { id: scheduleId, projectId: id } });
  return new NextResponse(null, { status: 204 });
}
