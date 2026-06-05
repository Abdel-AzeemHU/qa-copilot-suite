import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeRun } from "@/worker/executor";

const schema = z.object({
  projectId: z.string().min(1),
  targetUrl: z.string().url("A valid target URL is required"),
  generatedCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { projectId, targetUrl } = parsed.data;

  // Ownership check.
  const project = await prisma.project.findFirst({
    where: { id: projectId, organization: { ownerId: session.user.id } },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Resolve the code: provided directly, else from the latest AutomationRun.
  let generatedCode = parsed.data.generatedCode?.trim() ?? "";
  if (!generatedCode) {
    const latest = await prisma.automationRun.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) {
      return NextResponse.json(
        { error: "No automation code found. Generate automation code first." },
        { status: 400 },
      );
    }
    const files = JSON.parse(latest.files) as Array<{
      filename: string;
      content: string;
    }>;
    generatedCode = files.map((f) => f.content).join("\n\n");
  }

  if (!generatedCode) {
    return NextResponse.json(
      { error: "No automation code to execute." },
      { status: 400 },
    );
  }

  const run = await prisma.executionRun.create({
    data: {
      projectId,
      targetUrl,
      generatedCode,
      status: "queued",
    },
  });

  // Fire-and-forget: do NOT await execution.
  void executeRun(run.id);

  return NextResponse.json({ id: run.id });
}
