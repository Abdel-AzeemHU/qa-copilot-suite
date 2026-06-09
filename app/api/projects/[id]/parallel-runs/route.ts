import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { runParallelBatch } from "@/worker/parallel-executor";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const targetSchema = z.object({
  targetUrl: z.string().url("Invalid URL"),
  generatedCode: z.string().optional(),
});

const createSchema = z.object({
  targets: z.array(targetSchema).min(1).max(5),
});

async function getOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organization: { memberships: { some: { userId } } } },
    select: { id: true },
  });
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

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Resolve generated code fallback
  let fallbackCode = "";
  const latest = await prisma.automationRun.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  if (latest) {
    const files = JSON.parse(latest.files) as Array<{ content: string }>;
    fallbackCode = files.map((f) => f.content).join("\n\n");
  }

  const batch = await prisma.parallelBatch.create({
    data: { projectId: id },
  });

  const runIds: string[] = [];
  for (const target of parsed.data.targets) {
    const code = target.generatedCode?.trim() || fallbackCode;
    if (!code) continue;
    const run = await prisma.executionRun.create({
      data: {
        projectId: id,
        targetUrl: target.targetUrl,
        generatedCode: code,
        status: "queued",
        batchId: batch.id,
      },
    });
    runIds.push(run.id);
  }

  // Fire-and-forget
  void runParallelBatch(batch.id);

  return NextResponse.json({ batchId: batch.id, runIds }, { status: 201 });
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

  const batches = await prisma.parallelBatch.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      runs: {
        select: {
          id: true,
          status: true,
          result: true,
          targetUrl: true,
          createdAt: true,
          completedAt: true,
        },
      },
    },
  });

  return NextResponse.json(batches);
}
