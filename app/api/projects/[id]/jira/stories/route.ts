import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";
import { fetchJiraStories } from "@/lib/integrations/jira";
import type { JiraConfig } from "@/lib/integrations/jira";
import { NextRequest, NextResponse } from "next/server";

async function getOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organization: { memberships: { some: { userId } } } },
    select: { id: true },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const integration = await prisma.integration.findFirst({
    where: { projectId: id, type: "jira", enabled: true },
  });

  if (!integration) {
    return NextResponse.json({ error: "No Jira integration configured" }, { status: 404 });
  }

  if (!integration.encryptedSecret) {
    return NextResponse.json({ error: "Jira integration missing API token" }, { status: 400 });
  }

  let token: string;
  try {
    token = decrypt(integration.encryptedSecret);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt Jira token" }, { status: 500 });
  }

  let config: JiraConfig;
  try {
    config = JSON.parse(integration.config) as JiraConfig;
  } catch {
    return NextResponse.json({ error: "Invalid Jira config" }, { status: 400 });
  }

  try {
    const stories = await fetchJiraStories(config, token);
    return NextResponse.json(stories);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch stories";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
