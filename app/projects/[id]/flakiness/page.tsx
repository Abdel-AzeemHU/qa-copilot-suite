import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProjectForUser } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { FlakinessDashboard } from "./flakiness-dashboard";

export default async function FlakinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Flakiness Detection</h1>
          <p className="mt-1 text-neutral-500">
            Run tests multiple times to detect non-deterministic failures. AI
            analyzes patterns and suggests root causes.
          </p>
        </div>
        <FlakinessDashboard projectId={id} />
      </main>
    </>
  );
}
