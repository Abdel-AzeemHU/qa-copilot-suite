import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getProjectForUser } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";

function priorityVariant(priority: string): BadgeProps["variant"] {
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

function runStatusVariant(status: string): BadgeProps["variant"] {
  if (status === "passed") return "low";
  if (status === "failed" || status === "error") return "high";
  if (status === "running" || status === "queued") return "medium";
  return "secondary";
}

export default async function TraceabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const testCases = await prisma.testCase.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    include: {
      executionRun: {
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

  // Project-level aggregate stats (automation/run/bug-report granularity is
  // project-wide — there's no direct per-requirement link for these).
  const [automationRunCount, executionRunCount, bugReportCount] =
    await Promise.all([
      prisma.automationRun.count({ where: { projectId: id } }),
      prisma.executionRun.count({ where: { projectId: id } }),
      prisma.bugReport.count({ where: { projectId: id } }),
    ]);

  const executionRunIds = Array.from(
    new Set(
      testCases
        .map((tc) => tc.executionRun?.id)
        .filter((v): v is string => Boolean(v)),
    ),
  );

  const bugReports = executionRunIds.length
    ? await prisma.bugReport.findMany({
        where: { executionRunId: { in: executionRunIds } },
        select: {
          id: true,
          executionRunId: true,
          createdAt: true,
          output: true,
        },
      })
    : [];

  const bugReportsByRunId = new Map<string, typeof bugReports>();
  for (const br of bugReports) {
    if (!br.executionRunId) continue;
    const list = bugReportsByRunId.get(br.executionRunId) ?? [];
    list.push(br);
    bugReportsByRunId.set(br.executionRunId, list);
  }

  // Group test cases by their free-text `requirement` string.
  const groups = new Map<string, typeof testCases>();
  for (const tc of testCases) {
    const key = tc.requirement?.trim() || "(no requirement specified)";
    const list = groups.get(key) ?? [];
    list.push(tc);
    groups.set(key, list);
  }

  const requirementCards = Array.from(groups.entries()).map(
    ([requirement, cases]) => {
      // "Latest" linked execution run = most recently created among the group's cases.
      const linkedRuns = cases
        .map((c) => c.executionRun)
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const latestRun = linkedRuns[0] ?? null;

      const linkedBugReports = linkedRuns.flatMap(
        (r) => bugReportsByRunId.get(r.id) ?? [],
      );

      return { requirement, cases, latestRun, linkedRuns, linkedBugReports };
    },
  );

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Traceability Spine</CardTitle>
            <CardDescription>
              {project.name} — coverage chain from requirements through test
              cases, automation, execution runs, and bug reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-md border border-neutral-200 p-3 text-center">
                <p className="text-2xl font-semibold">{testCases.length}</p>
                <p className="text-xs text-neutral-500">Test cases</p>
              </div>
              <div className="rounded-md border border-neutral-200 p-3 text-center">
                <p className="text-2xl font-semibold">{automationRunCount}</p>
                <p className="text-xs text-neutral-500">
                  Automation generations (project-wide)
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 p-3 text-center">
                <p className="text-2xl font-semibold">{executionRunCount}</p>
                <p className="text-xs text-neutral-500">
                  Execution runs (project-wide)
                </p>
              </div>
              <div className="rounded-md border border-neutral-200 p-3 text-center">
                <p className="text-2xl font-semibold">{bugReportCount}</p>
                <p className="text-xs text-neutral-500">
                  Bug reports (project-wide)
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Note: automation code, execution runs, and bug reports are tracked
              at the project level — there is no direct per-requirement link for
              automation generations. The chain below is precise from
              requirement → test case → execution run (via the test case&apos;s
              linked run) → bug report (via that run&apos;s id), and shown
              alongside the project-wide aggregates above for context.
            </p>
          </CardContent>
        </Card>

        {requirementCards.length === 0 ? (
          <Card>
            <CardContent>
              <p className="py-6 text-center text-sm text-neutral-500">
                No test cases yet — generate some from the project page to
                populate the traceability spine.
              </p>
            </CardContent>
          </Card>
        ) : (
          requirementCards.map(
            ({ requirement, cases, latestRun, linkedBugReports }, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="text-base">{requirement}</CardTitle>
                  <CardDescription>
                    {cases.length} linked test case{cases.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Test cases
                    </h4>
                    <ul className="space-y-1.5">
                      {cases.map((tc) => (
                        <li
                          key={tc.id}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <span>{tc.title}</span>
                          <Badge variant={priorityVariant(tc.priority)}>
                            {tc.priority}
                          </Badge>
                          <Badge variant="secondary">{tc.type}</Badge>
                          {tc.executionRun ? (
                            <span className="text-xs text-neutral-500">
                              → run {tc.executionRun.id.slice(0, 8)}{" "}
                              <Badge variant={runStatusVariant(tc.executionRun.status)}>
                                {tc.executionRun.status}
                              </Badge>
                            </span>
                          ) : (
                            <span className="text-xs text-neutral-400">
                              (not linked to an execution run)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Latest linked execution run
                    </h4>
                    {latestRun ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-mono text-xs">
                          {latestRun.id.slice(0, 8)}
                        </span>
                        <Badge variant={runStatusVariant(latestRun.status)}>
                          {latestRun.status}
                        </Badge>
                        {latestRun.result ? (
                          <span className="text-xs text-neutral-500">
                            result: {latestRun.result}
                          </span>
                        ) : null}
                        <span className="text-xs text-neutral-500">
                          {latestRun.targetUrl}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-400">
                        No execution run linked to this requirement&apos;s test
                        cases yet.
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Linked bug reports
                    </h4>
                    {linkedBugReports.length === 0 ? (
                      <p className="text-sm text-neutral-400">
                        No bug reports linked to these execution runs.
                      </p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {linkedBugReports.map((br) => {
                          let title = br.id.slice(0, 8);
                          try {
                            const parsed = JSON.parse(br.output) as {
                              title?: string;
                            };
                            if (parsed.title) title = parsed.title;
                          } catch {
                            // ignore
                          }
                          return (
                            <li key={br.id} className="text-neutral-700">
                              {title}{" "}
                              <span className="text-xs text-neutral-400">
                                ({new Date(br.createdAt).toLocaleString()})
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            ),
          )
        )}
      </main>
    </>
  );
}
