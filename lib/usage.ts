import { prisma } from "@/lib/db/prisma";

export interface OrgUsage {
  projects: number;
  pipelineRunsThisMonth: number;
  executionRunsThisMonth: number;
  members: number;
}

export async function getOrgUsage(orgId: string): Promise<OrgUsage> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [projects, pipelineRunsThisMonth, executionRunsThisMonth, members] =
    await Promise.all([
      prisma.project.count({ where: { orgId } }),
      prisma.pipelineRun.count({
        where: {
          project: { orgId },
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.executionRun.count({
        where: {
          project: { orgId },
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.membership.count({ where: { orgId } }),
    ]);

  return { projects, pipelineRunsThisMonth, executionRunsThisMonth, members };
}
