import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { toRunnableScript } from "@/lib/recorder/to-runnable";
import { PRIORITIES, TEST_TYPES } from "@/lib/helpers/test-case-generator";

const actionSchema = z.object({
  type: z.string(),
  target: z.string(),
  value: z.string().optional(),
  selector: z.string(),
  humanText: z.string(),
});

const bodySchema = z.object({
  rawCode: z.string(),
  actions: z.array(actionSchema),
  startUrl: z.string().optional(),
  testCase: z.object({
    title: z.string().min(1),
    description: z.string().optional().default(""),
    preconditions: z.string().optional().default(""),
    expectedResult: z.string().optional().default(""),
    priority: z.enum(PRIORITIES).optional().default("medium"),
    type: z.enum(TEST_TYPES).optional().default("functional"),
    suggestedAssertions: z.array(z.string()).optional().default([]),
  }),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, organization: { memberships: { some: { userId: session.user.id } } } },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { rawCode, actions, testCase } = parsed.data;

  // Transform codegen output into a self-contained runnable ESM script that
  // worker/executor.ts can run directly.
  const runnable = toRunnableScript(rawCode);

  // Build the test case steps from the human-readable recorded actions, plus
  // any AI-suggested assertions.
  const steps = [
    ...actions.map((a) => a.humanText),
    ...testCase.suggestedAssertions.map((s) => `Verify: ${s}`),
  ];

  const automationRun = await prisma.automationRun.create({
    data: {
      projectId: id,
      framework: "playwright",
      language: "javascript",
      files: JSON.stringify([
        {
          filename: "recorded.spec.mjs",
          language: "javascript",
          content: runnable,
        },
      ]),
    },
  });

  const preconditions = [
    testCase.preconditions,
    testCase.description ? `\n\n${testCase.description}` : "",
  ]
    .join("")
    .trim();

  const created = await prisma.testCase.create({
    data: {
      projectId: id,
      title: testCase.title,
      preconditions: preconditions || null,
      steps: JSON.stringify(steps),
      expectedResult: testCase.expectedResult || null,
      priority: testCase.priority,
      type: testCase.type,
      targetUrl: parsed.data.startUrl || null,
    },
  });

  return NextResponse.json({
    automationRunId: automationRun.id,
    testCaseId: created.id,
  });
}
