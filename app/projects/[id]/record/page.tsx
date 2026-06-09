import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProjectForUser } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecorderStudio } from "./recorder-studio";

export default async function RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const defaultStartUrl =
    project.testCases.find((tc) => tc.targetUrl)?.targetUrl ?? "";

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Record a Test</CardTitle>
            <CardDescription>
              {project.name} — no coding required. Enter a URL, click Record, and
              a real browser window opens. Perform your flow (click, type,
              navigate), then click Stop. We turn it into readable steps, a
              runnable Playwright script, and an AI-drafted test case.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecorderStudio
              projectId={project.id}
              defaultStartUrl={defaultStartUrl}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
