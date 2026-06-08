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
import { serializeIntegration } from "@/lib/integrations/serialize";
import { IntegrationsManager } from "./integrations-manager";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const integrations = await prisma.integration.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              Connect {project.name} to Slack, GitHub, or any webhook endpoint
              so QA Copilot Suite can push run results and bug reports outward.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IntegrationsManager
              projectId={project.id}
              initialIntegrations={integrations.map(serializeIntegration)}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
