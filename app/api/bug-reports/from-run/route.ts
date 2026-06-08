import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dispatchIntegrationEvent } from "@/lib/integrations/dispatch";

const schema = z.object({
  runId: z.string().min(1),
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

  const run = await prisma.executionRun.findFirst({
    where: {
      id: parsed.data.runId,
      project: { organization: { memberships: { some: { userId: session.user.id } } } },
    },
    include: { testCases: true },
  });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const linkedTestCase = run.testCases[0];
  const requirement =
    linkedTestCase?.requirement?.trim() ||
    `Automation against ${run.targetUrl}`;

  const input = {
    description:
      `Automated test execution against ${run.targetUrl} failed in a way that ` +
      `appears to indicate a real product defect rather than an automation issue.\n\n` +
      `Requirement:\n${requirement}`,
    stepsToReproduce:
      linkedTestCase?.steps && linkedTestCase.steps !== "[]"
        ? (JSON.parse(linkedTestCase.steps) as string[]).join("\n")
        : `Run the automation for "${linkedTestCase?.title ?? "this test case"}" against ${run.targetUrl}.`,
    environment: `Target URL: ${run.targetUrl} (framework: ${run.framework})`,
    severity: "medium" as const,
  };

  const output = {
    title: `Execution run ${run.id.slice(0, 8)} failed: ${linkedTestCase?.title ?? "automated check"}`,
    summary: `The execution run against ${run.targetUrl} ended with status "${run.status}".`,
    expectedBehavior:
      linkedTestCase?.expectedResult ??
      "The application should behave as described in the requirement.",
    actualBehavior:
      run.errorMessage ?? "The run did not produce the expected result; see logs.",
    logs: run.logs ?? "",
    errorMessage: run.errorMessage ?? null,
    runStatus: run.status,
    runResult: run.result,
  };

  const bugReport = await prisma.bugReport.create({
    data: {
      projectId: run.projectId,
      executionRunId: run.id,
      input: JSON.stringify(input),
      output: JSON.stringify(output),
    },
  });

  dispatchIntegrationEvent(bugReport.projectId, {
    type: "bug.created",
    bugReport: {
      id: bugReport.id,
      projectId: bugReport.projectId,
      output: bugReport.output,
    },
  }).catch(() => {});

  return NextResponse.json({ id: bugReport.id });
}
