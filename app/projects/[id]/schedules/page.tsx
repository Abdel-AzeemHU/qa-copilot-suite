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
import { SchedulesManager, type ScheduleView } from "./schedules-manager";

export default async function SchedulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const schedules = await prisma.schedule.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });

  const scheduleViews: ScheduleView[] = schedules.map((s) => ({
    id: s.id,
    name: s.name,
    enabled: s.enabled,
    cronExpr: s.cronExpr,
    targetUrl: s.targetUrl,
    autoHeal: s.autoHeal,
    autoBug: s.autoBug,
    notify: s.notify,
    lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
    nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : null,
    lastStatus: s.lastStatus,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Schedules</CardTitle>
            <CardDescription>
              Automate pipeline runs for {project.name} on a cron schedule or
              trigger them via an inbound webhook.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SchedulesManager
              projectId={project.id}
              initialSchedules={scheduleViews}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
