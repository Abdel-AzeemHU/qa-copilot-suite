import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { dispatchTestEvent } from "@/lib/integrations/dispatch";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; integrationId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, integrationId } = await params;
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      projectId: id,
      project: { organization: { memberships: { some: { userId: session.user.id } } } },
    },
  });
  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const result = await dispatchTestEvent(integration);

  return NextResponse.json(result);
}
