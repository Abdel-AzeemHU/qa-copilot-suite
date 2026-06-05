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
import { AutomationForm } from "./automation-form";
import { CodeBlock } from "./code-block";

interface GeneratedFile {
  filename: string;
  language: string;
  content: string;
}

export default async function AutomationPage({
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

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Automation Code Generator</CardTitle>
            <CardDescription>
              {project.name} — {project.testCases.length} test case(s) available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AutomationForm projectId={project.id} />
          </CardContent>
        </Card>

        {latest ? (
          <Card>
            <CardHeader>
              <CardTitle>
                Generated code ({latest.framework} / {latest.language})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {files.map((f) => (
                <CodeBlock key={f.filename} file={f} />
              ))}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </>
  );
}
