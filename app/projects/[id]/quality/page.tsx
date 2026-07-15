import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getProjectForUser } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Status colors (reserved for state, always paired with a text label).
const STATUS = {
  good: "bg-green-500",
  goodText: "text-green-600",
  warn: "bg-amber-400",
  warnText: "text-amber-600",
  bad: "bg-red-500",
  badText: "text-red-600",
  neutral: "bg-neutral-300",
  neutralText: "text-neutral-500",
} as const;

const FAILURE_CLASS_META: Record<string, { label: string; dot: string }> = {
  real_bug: { label: "Real bugs", dot: STATUS.bad },
  flaky: { label: "Flaky", dot: STATUS.warn },
  environment: { label: "Environment", dot: "bg-blue-400" },
  automation: { label: "Automation", dot: STATUS.neutral },
};

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function StatTile({
  value,
  label,
  sub,
  tone,
}: {
  value: string;
  label: string;
  sub?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? STATUS.goodText
      : tone === "warn"
        ? STATUS.warnText
        : tone === "bad"
          ? STATUS.badText
          : "text-neutral-900";
  return (
    <Card>
      <CardContent className="pt-4">
        <p className={`text-3xl font-bold tabular-nums ${toneClass}`}>{value}</p>
        <p className="mt-0.5 text-sm font-medium text-neutral-700">{label}</p>
        {sub ? <p className="text-xs text-neutral-500">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

/** A single labeled segment bar (status encoding, labels always visible). */
function SegmentBar({
  segments,
  total,
}: {
  segments: Array<{ label: string; count: number; color: string }>;
  total: number;
}) {
  const shown = segments.filter((s) => s.count > 0);
  if (total === 0 || shown.length === 0) {
    return <p className="text-sm text-neutral-500">No data yet.</p>;
  }
  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {shown.map((s) => (
          <div
            key={s.label}
            className={`${s.color} h-full rounded-sm`}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.color}`} />
            {s.label}: <span className="font-medium tabular-nums">{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function QualityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  // --- Aggregate everything in parallel -----------------------------------
  const [
    testCaseGroups,
    runGroups,
    failureClassGroups,
    healedCount,
    layer1Saves,
    flakinessReports,
    pipelineGroups,
    visualGroups,
    apiRunGroups,
    recentRuns,
    coveredTestCases,
  ] = await Promise.all([
    prisma.testCase.groupBy({ by: ["type"], where: { projectId: id }, _count: true }),
    prisma.executionRun.groupBy({
      by: ["result"],
      where: { projectId: id, result: { not: null } },
      _count: true,
    }),
    prisma.executionRun.groupBy({
      by: ["failureClass"],
      where: { projectId: id, failureClass: { not: null } },
      _count: true,
    }),
    prisma.healingAttempt.count({
      where: { executionRun: { projectId: id }, status: "healed" },
    }),
    prisma.selectorCache.aggregate({
      where: { projectId: id },
      _sum: { hitCount: true },
      _count: true,
    }),
    prisma.flakinessReport.groupBy({
      by: ["status", "quarantined"],
      where: { projectId: id },
      _count: true,
    }),
    prisma.pipelineRun.groupBy({ by: ["status"], where: { projectId: id }, _count: true }),
    prisma.visualRun.groupBy({ by: ["status"], where: { projectId: id }, _count: true }),
    prisma.apiTestRun.groupBy({ by: ["status"], where: { projectId: id }, _count: true }),
    prisma.executionRun.findMany({
      where: { projectId: id, result: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, result: true, failureClass: true, createdAt: true },
    }),
    prisma.testCase.count({ where: { projectId: id, executionRunId: { not: null } } }),
  ]);

  // --- Shape the numbers ----------------------------------------------------
  const countOf = <T extends { _count: number }>(rows: T[], pick: (r: T) => boolean) =>
    rows.filter(pick).reduce((acc, r) => acc + r._count, 0);

  const totalTestCases = testCaseGroups.reduce((a, g) => a + g._count, 0);
  const apiTestCases = countOf(testCaseGroups, (g) => g.type === "api");

  const totalRuns = runGroups.reduce((a, g) => a + g._count, 0);
  const passedRuns = countOf(runGroups, (g) => g.result === "passed");
  const failedRuns = countOf(runGroups, (g) => g.result === "failed");
  const errorRuns = countOf(runGroups, (g) => g.result === "error");

  const classCounts = Object.fromEntries(
    failureClassGroups.map((g) => [g.failureClass ?? "unknown", g._count]),
  ) as Record<string, number>;
  const totalClassified = failureClassGroups.reduce((a, g) => a + g._count, 0);

  const totalHealingSaves = healedCount + (layer1Saves._sum.hitCount ?? 0);

  const flakyCount = countOf(flakinessReports, (r) => r.status === "flaky");
  const brokenCount = countOf(flakinessReports, (r) => r.status === "broken");
  const stableCount = countOf(flakinessReports, (r) => r.status === "stable");
  const quarantinedCount = countOf(flakinessReports, (r) => r.quarantined);

  const totalPipelines = pipelineGroups.reduce((a, g) => a + g._count, 0);
  const pipelineSucceeded = countOf(pipelineGroups, (g) => g.status === "succeeded");

  const totalVisual = visualGroups.reduce((a, g) => a + g._count, 0);
  const visualPassed = countOf(visualGroups, (g) => g.status === "passed");
  const visualDiffs = countOf(visualGroups, (g) => g.status === "diff" || g.status === "failed");

  const totalApiRuns = apiRunGroups.reduce((a, g) => a + g._count, 0);
  const apiPassed = countOf(apiRunGroups, (g) => g.status === "passed");

  const oldestFirst = [...recentRuns].reverse();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Quality Dashboard</h1>
            <p className="mt-1 text-neutral-500">
              {project.name} — one view of test health, reliability, and the
              value the platform is delivering.
            </p>
          </div>
          <Link
            href={`/projects/${project.id}`}
            className="text-sm text-neutral-500 underline hover:text-neutral-700"
          >
            Back to project
          </Link>
        </div>

        {/* Headline tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            value={pct(passedRuns, totalRuns)}
            label="UI run pass rate"
            sub={`${passedRuns}/${totalRuns} runs passed`}
            tone={totalRuns === 0 ? undefined : passedRuns / totalRuns >= 0.9 ? "good" : passedRuns / totalRuns >= 0.7 ? "warn" : "bad"}
          />
          <StatTile
            value={String(totalHealingSaves)}
            label="Healing saves"
            sub={`${layer1Saves._sum.hitCount ?? 0} selector fixes · ${healedCount} script repairs`}
            tone={totalHealingSaves > 0 ? "good" : undefined}
          />
          <StatTile
            value={String(quarantinedCount)}
            label="Flaky tests quarantined"
            sub={`${flakyCount} flaky · ${brokenCount} broken · ${stableCount} stable`}
            tone={quarantinedCount > 0 ? "warn" : undefined}
          />
          <StatTile
            value={String(classCounts["real_bug"] ?? 0)}
            label="Real bugs caught"
            sub={`${totalClassified} failures triaged by AI`}
            tone={(classCounts["real_bug"] ?? 0) > 0 ? "bad" : undefined}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Execution results */}
          <Card>
            <CardHeader>
              <CardTitle>UI test executions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SegmentBar
                total={totalRuns}
                segments={[
                  { label: "Passed", count: passedRuns, color: STATUS.good },
                  { label: "Failed", count: failedRuns, color: STATUS.bad },
                  { label: "Error", count: errorRuns, color: STATUS.warn },
                ]}
              />
              {oldestFirst.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-neutral-500">
                    Last {oldestFirst.length} runs (oldest → newest)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {oldestFirst.map((r) => (
                      <span
                        key={r.id}
                        title={`${r.result}${r.failureClass ? ` — ${r.failureClass}` : ""} · ${r.createdAt.toLocaleString()}`}
                        className={`inline-block h-4 w-4 rounded-sm ${
                          r.result === "passed"
                            ? STATUS.good
                            : r.result === "failed"
                              ? STATUS.bad
                              : STATUS.warn
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Failure classification */}
          <Card>
            <CardHeader>
              <CardTitle>Why tests fail (AI triage)</CardTitle>
            </CardHeader>
            <CardContent>
              <SegmentBar
                total={totalClassified}
                segments={Object.entries(FAILURE_CLASS_META).map(([key, meta]) => ({
                  label: meta.label,
                  count: classCounts[key] ?? 0,
                  color: meta.dot,
                }))}
              />
              <p className="mt-3 text-xs text-neutral-500">
                Only real bugs should block your team — flaky, environment, and
                automation failures are maintenance signals, not product defects.
              </p>
            </CardContent>
          </Card>

          {/* API testing */}
          <Card>
            <CardHeader>
              <CardTitle>API tests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SegmentBar
                total={totalApiRuns}
                segments={[
                  { label: "Passed", count: apiPassed, color: STATUS.good },
                  {
                    label: "Failed",
                    count: countOf(apiRunGroups, (g) => g.status === "failed"),
                    color: STATUS.bad,
                  },
                  {
                    label: "Error",
                    count: countOf(apiRunGroups, (g) => g.status === "error"),
                    color: STATUS.warn,
                  },
                ]}
              />
              <p className="text-xs text-neutral-500">
                {apiTestCases} API test case{apiTestCases !== 1 ? "s" : ""} defined ·{" "}
                {totalApiRuns} execution{totalApiRuns !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          {/* Pipelines & visual */}
          <Card>
            <CardHeader>
              <CardTitle>Pipelines & visual regression</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-neutral-500">
                  Pipeline runs — {pct(pipelineSucceeded, totalPipelines)} succeeded
                </p>
                <SegmentBar
                  total={totalPipelines}
                  segments={[
                    { label: "Succeeded", count: pipelineSucceeded, color: STATUS.good },
                    {
                      label: "Failed",
                      count: countOf(pipelineGroups, (g) => g.status === "failed" || g.status === "error"),
                      color: STATUS.bad,
                    },
                    {
                      label: "In progress",
                      count: countOf(pipelineGroups, (g) => g.status === "queued" || g.status === "running"),
                      color: STATUS.neutral,
                    },
                  ]}
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-neutral-500">
                  Visual checks — {visualDiffs} with differences
                </p>
                <SegmentBar
                  total={totalVisual}
                  segments={[
                    { label: "Passed", count: visualPassed, color: STATUS.good },
                    { label: "Diffs", count: visualDiffs, color: STATUS.warn },
                    {
                      label: "Other",
                      count: totalVisual - visualPassed - visualDiffs,
                      color: STATUS.neutral,
                    },
                  ]}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coverage strip */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Test inventory & coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-2xl font-bold tabular-nums">{totalTestCases}</p>
                <p className="text-neutral-500">Test cases</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{apiTestCases}</p>
                <p className="text-neutral-500">API test cases</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {pct(coveredTestCases, totalTestCases)}
                </p>
                <p className="text-neutral-500">Linked to an execution</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{layer1Saves._count}</p>
                <p className="text-neutral-500">Healed selectors cached</p>
              </div>
            </div>
            {testCaseGroups.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                {testCaseGroups.map((g) => (
                  <span key={g.type}>
                    {g.type}: <span className="font-medium tabular-nums">{g._count}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
