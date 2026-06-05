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
import { Badge } from "@/components/ui/badge";
import type { TestPlannerOutput } from "@/lib/helpers/test-planner";
import { TestPlanForm } from "./test-plan-form";

export default async function TestPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const latest = await prisma.testPlan.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  const plan: TestPlannerOutput | null = latest
    ? (JSON.parse(latest.output) as TestPlannerOutput)
    : null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Planner</CardTitle>
            <CardDescription>{project.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <TestPlanForm projectId={project.id} />
          </CardContent>
        </Card>

        {plan ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Strategy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="whitespace-pre-wrap">{plan.strategy}</p>
                <div>
                  <h4 className="font-medium">Scope</h4>
                  <p className="whitespace-pre-wrap text-neutral-700">
                    {plan.scope}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {plan.testLevels.map((lvl) => (
                    <Badge key={lvl} variant="secondary">
                      {lvl}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="whitespace-pre-wrap">{plan.resources.people}</p>
                <div className="flex flex-wrap gap-2">
                  {plan.resources.tools.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {plan.timeline.map((p, i) => (
                  <div key={i} className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{p.phase}</h4>
                      <span className="text-xs text-neutral-500">
                        {p.duration}
                      </span>
                    </div>
                    <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700">
                      {p.activities.map((a, j) => (
                        <li key={j}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.risks.map((r, i) => (
                  <div key={i} className="rounded-md border border-neutral-200 p-3 text-sm">
                    <p className="font-medium">{r.risk}</p>
                    <p className="text-neutral-700">Mitigation: {r.mitigation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </>
  );
}
