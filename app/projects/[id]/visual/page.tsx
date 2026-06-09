import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProjectForUser } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { VisualDashboard } from "./visual-dashboard";

export default async function VisualPage({
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Visual Regression</h1>
          <p className="mt-1 text-neutral-500">
            Capture baselines, compare screenshots, and triage visual changes with AI.
          </p>
        </div>
        <VisualDashboard projectId={id} />
      </main>
    </>
  );
}
