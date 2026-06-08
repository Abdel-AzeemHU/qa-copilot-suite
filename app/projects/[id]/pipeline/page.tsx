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
import { PipelineRunner, type PastPipeline } from "./pipeline-runner";

export default async function PipelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const defaultTargetUrl =
    project.testCases.find((tc) => tc.targetUrl)?.targetUrl ?? "";

  const recent = await prisma.pipelineRun.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      targetUrl: true,
      summary: true,
      finalRunId: true,
      bugReportId: true,
      createdAt: true,
      completedAt: true,
    },
  });

  const recentPipelines: PastPipeline[] = recent.map((p) => ({
    id: p.id,
    status: p.status,
    targetUrl: p.targetUrl,
    summary: p.summary,
    finalRunId: p.finalRunId,
    bugReportId: p.bugReportId,
    createdAt: p.createdAt.toISOString(),
    completedAt: p.completedAt ? p.completedAt.toISOString() : null,
  }));

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Orchestrator Pipeline</CardTitle>
            <CardDescription>
              {project.name} — automatically execute, self-heal on failure, file
              a bug if it&apos;s a likely defect, and notify your team. Watch each
              stage progress like a CI pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineRunner
              projectId={project.id}
              defaultTargetUrl={defaultTargetUrl}
              recentPipelines={recentPipelines}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
