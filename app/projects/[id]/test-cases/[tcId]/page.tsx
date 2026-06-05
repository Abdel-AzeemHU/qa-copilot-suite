import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTestCaseForUser } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EditForm } from "./edit-form";

function parseSteps(steps: string): string[] {
  try {
    const parsed: unknown = JSON.parse(steps);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // ignore
  }
  return [];
}

export default async function TestCasePage({
  params,
}: {
  params: Promise<{ id: string; tcId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id, tcId } = await params;
  const tc = await getTestCaseForUser(tcId, session.user.id);
  if (!tc || tc.projectId !== id) notFound();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <Link
          href={`/projects/${id}`}
          className="mb-4 inline-block text-sm underline"
        >
          ← Back to {tc.project.name}
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Edit test case</CardTitle>
            {tc.requirement ? (
              <CardDescription>
                Requirement: {tc.requirement}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <EditForm
              id={tc.id}
              title={tc.title}
              preconditions={tc.preconditions ?? ""}
              steps={parseSteps(tc.steps).join("\n")}
              expectedResult={tc.expectedResult ?? ""}
              priority={tc.priority}
              type={tc.type}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
