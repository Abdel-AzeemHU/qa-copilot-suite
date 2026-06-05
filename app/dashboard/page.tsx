import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listProjects } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projects = await listProjects(session.user.id);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <Link href="/projects/new" className={buttonVariants()}>
            New project
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-neutral-500">
              No projects yet. Create your first one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="h-full transition-colors hover:border-neutral-400">
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                    {p.description ? (
                      <CardDescription>{p.description}</CardDescription>
                    ) : null}
                  </CardHeader>
                  <CardContent className="text-sm text-neutral-500">
                    {p._count.testCases} test case
                    {p._count.testCases === 1 ? "" : "s"}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
