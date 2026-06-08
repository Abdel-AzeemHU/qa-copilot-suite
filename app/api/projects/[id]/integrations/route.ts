import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { encrypt } from "@/lib/crypto";
import { serializeIntegration } from "@/lib/integrations/serialize";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const TYPES = ["slack", "github", "webhook"] as const;

const createSchema = z.object({
  type: z.enum(TYPES),
  name: z.string().min(1, "Name is required").max(120),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  secret: z.string().trim().optional(),
});

async function getOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organization: { ownerId: userId } },
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

  const integrations = await prisma.integration.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(integrations.map(serializeIntegration));
}

export async function POST(
  req: NextRequest,
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

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { type, name, config, secret } = parsed.data;

  const integration = await prisma.integration.create({
    data: {
      projectId: id,
      type,
      name,
      config: JSON.stringify(config ?? {}),
      encryptedSecret: secret ? encrypt(secret) : null,
    },
  });

  return NextResponse.json(serializeIntegration(integration), { status: 201 });
}
