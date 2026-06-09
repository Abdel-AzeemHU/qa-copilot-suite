import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { z } from "zod";

const VALID_PROVIDERS = ["claude", "openai"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { activeProvider: true },
  });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: { provider: true, config: true },
  });

  const providers = VALID_PROVIDERS.map((p) => {
    const key = keys.find((k) => k.provider === p);
    const model = key?.config
      ? (JSON.parse(key.config) as { model?: string }).model
      : undefined;
    return { provider: p, hasKey: !!key, model: model ?? null };
  });

  return Response.json({
    activeProvider: user?.activeProvider ?? "claude",
    providers,
  });
}

const postSchema = z.object({
  provider: z.enum(VALID_PROVIDERS),
  apiKey: z.string().min(1, "API key is required"),
  model: z.string().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { provider, apiKey, model } = parsed.data;
  const encryptedKey = encrypt(apiKey);
  const config = model ? JSON.stringify({ model }) : null;

  await prisma.apiKey.upsert({
    where: { userId_provider: { userId: session.user.id, provider } },
    create: { userId: session.user.id, provider, encryptedKey, config },
    update: { encryptedKey, config },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { activeProvider: provider },
  });

  return Response.json({ success: true, activeProvider: provider });
}

const patchSchema = z.object({
  activeProvider: z.enum(VALID_PROVIDERS),
});

export async function PATCH(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { activeProvider } = parsed.data;

  // Verify a key exists for this provider before switching.
  const key = await prisma.apiKey.findUnique({
    where: {
      userId_provider: { userId: session.user.id, provider: activeProvider },
    },
  });
  if (!key) {
    return Response.json(
      { error: `No API key stored for ${activeProvider}. Add a key first.` },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { activeProvider },
  });

  return Response.json({ success: true, activeProvider });
}

const deleteSchema = z.object({
  provider: z.enum(VALID_PROVIDERS),
});

export async function DELETE(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { provider } = parsed.data;
  const userId = session.user.id;

  // Check if it's the only key and it's active.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeProvider: true },
  });

  const allKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: { provider: true },
  });

  if (
    user?.activeProvider === provider &&
    allKeys.length === 1 &&
    allKeys[0]?.provider === provider
  ) {
    return Response.json(
      {
        error:
          "Cannot remove the only API key while it is the active provider. Add another provider first.",
      },
      { status: 400 },
    );
  }

  await prisma.apiKey.delete({
    where: { userId_provider: { userId, provider } },
  });

  // If the deleted key was the active provider, switch to whatever remains.
  if (user?.activeProvider === provider) {
    const remaining = allKeys.find((k) => k.provider !== provider);
    if (remaining) {
      await prisma.user.update({
        where: { id: userId },
        data: { activeProvider: remaining.provider },
      });
    }
  }

  return Response.json({ success: true });
}
