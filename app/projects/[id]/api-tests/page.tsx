import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProjectForUser } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { ApiTestsDashboard } from "./api-tests-dashboard";

export default async function ApiTestsPage({
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
          <h1 className="text-2xl font-semibold">API Testing</h1>
          <p className="mt-1 text-neutral-500">
            Import an OpenAPI/Swagger spec or a Postman collection, pick the
            endpoints you care about, and let AI generate API test cases.
            Generate Playwright (TypeScript) or REST Assured (Java) automation
            from the Automation page once test cases are created.
          </p>
        </div>
        <ApiTestsDashboard projectId={id} />
      </main>
    </>
  );
}
