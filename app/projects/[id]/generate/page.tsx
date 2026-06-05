import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getProjectForUser,
  getClaudeApiKeyRecord,
} from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GenerateForm } from "./generate-form";

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const keyRecord = await getClaudeApiKeyRecord(session.user.id);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Generate test cases</CardTitle>
            <CardDescription>{project.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateForm
              projectId={project.id}
              hasStoredKey={Boolean(keyRecord)}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
