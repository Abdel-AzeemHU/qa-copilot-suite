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
import { ExecuteRunner, type PastRun } from "./execute-runner";
import { ParallelRunner } from "./parallel-runner";
import { SelectorCachePanel } from "./selector-cache-panel";

interface GeneratedFile {
  filename: string;
  language: string;
  content: string;
}

export default async function ExecutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const latest = await prisma.automationRun.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  const files: GeneratedFile[] = latest
    ? (JSON.parse(latest.files) as GeneratedFile[])
    : [];
  const generatedCode = files.map((f) => f.content).join("\n\n");

  // Pre-fill target URL from any stored test case targetUrl, if present.
  const defaultTargetUrl =
    project.testCases.find((tc) => tc.targetUrl)?.targetUrl ?? "";

  const runs = await prisma.executionRun.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      targetUrl: true,
      result: true,
      createdAt: true,
      completedAt: true,
    },
  });

  const pastRuns: PastRun[] = runs.map((r) => ({
    id: r.id,
    status: r.status,
    targetUrl: r.targetUrl,
    result: r.result,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
  }));

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Run Tests</CardTitle>
            <CardDescription>
              {project.name} — execute the latest generated automation code
              against a live URL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExecuteRunner
              projectId={project.id}
              defaultTargetUrl={defaultTargetUrl}
              generatedCode={generatedCode}
              pastRuns={pastRuns}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Selector Healing</CardTitle>
            <CardDescription>
              Layer 1 fine-grained healing — selectors repaired automatically
              mid-run are cached here. Remove an entry to force a fresh LLM
              lookup on the next run.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SelectorCachePanel projectId={project.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parallel Run</CardTitle>
            <CardDescription>
              Run against multiple target URLs simultaneously (up to 5). Each URL
              gets its own execution run tracked independently.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ParallelRunner projectId={project.id} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
