import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { runHealingAttempt } from "@/worker/healer";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const MAX_ATTEMPTS = 3;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`${session.user.id}:POST /api/runs/[id]/heal`, 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const { id } = await params;
  const run = await prisma.executionRun.findFirst({
    where: {
      id,
      project: { organization: { memberships: { some: { userId: session.user.id } } } },
    },
    select: { id: true, status: true, projectId: true },
  });
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (run.status !== "failed" && run.status !== "error") {
    return NextResponse.json(
      { error: "Only failed or errored runs can be self-healed." },
      { status: 400 },
    );
  }

  const count = await prisma.healingAttempt.count({
    where: { executionRunId: id },
  });
  if (count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: `This run has reached the maximum of ${MAX_ATTEMPTS} self-healing attempts.` },
      { status: 400 },
    );
  }

  const attempt = await prisma.healingAttempt.create({
    data: {
      executionRunId: id,
      attemptNumber: count + 1,
      classification: "inconclusive",
      diagnosis: "",
      status: "analyzing",
    },
  });

  logAudit({
    userId: session.user.id,
    action: "run.heal",
    entityType: "HealingAttempt",
    entityId: attempt.id,
    meta: { executionRunId: id },
  });

  // Fire-and-forget: do NOT await the orchestration.
  void runHealingAttempt(attempt.id);

  return NextResponse.json({ id: attempt.id });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const run = await prisma.executionRun.findFirst({
    where: {
      id,
      project: { organization: { memberships: { some: { userId: session.user.id } } } },
    },
    select: { id: true },
  });
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const attempts = await prisma.healingAttempt.findMany({
    where: { executionRunId: id },
    orderBy: { attemptNumber: "asc" },
    include: {
      newRun: {
        select: { id: true, status: true, result: true },
      },
    },
  });

  return NextResponse.json(
    attempts.map((a) => ({
      id: a.id,
      attemptNumber: a.attemptNumber,
      classification: a.classification,
      diagnosis: a.diagnosis,
      patchedCode: a.patchedCode,
      status: a.status,
      errorMessage: a.errorMessage,
      createdAt: a.createdAt.toISOString(),
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
      verificationRun: a.newRun
        ? { id: a.newRun.id, status: a.newRun.status, result: a.newRun.result }
        : null,
    })),
  );
}
