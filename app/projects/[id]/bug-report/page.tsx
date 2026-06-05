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
import type { BugReporterOutput } from "@/lib/helpers/bug-reporter";
import { BugReportForm } from "./bug-report-form";

export default async function BugReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const latest = await prisma.bugReport.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  const report: BugReporterOutput | null = latest
    ? (JSON.parse(latest.output) as BugReporterOutput)
    : null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bug Reporter</CardTitle>
            <CardDescription>{project.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <BugReportForm projectId={project.id} />
          </CardContent>
        </Card>

        {report ? (
          <Card>
            <CardHeader>
              <CardTitle>{report.title}</CardTitle>
              <CardDescription>{report.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="high">Severity: {report.severity}</Badge>
                <Badge variant="secondary">Priority: {report.priority}</Badge>
              </div>
              <div>
                <h4 className="font-medium">Steps to reproduce</h4>
                <ol className="mt-1 list-decimal pl-5 text-neutral-700">
                  {report.stepsToReproduce.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h4 className="font-medium">Expected behavior</h4>
                <p className="text-neutral-700">{report.expectedBehavior}</p>
              </div>
              <div>
                <h4 className="font-medium">Actual behavior</h4>
                <p className="text-neutral-700">{report.actualBehavior}</p>
              </div>
              <div>
                <h4 className="font-medium">Environment</h4>
                <p className="text-neutral-700">{report.environment}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.suggestedLabels.map((l) => (
                  <Badge key={l} variant="secondary">
                    {l}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </>
  );
}
