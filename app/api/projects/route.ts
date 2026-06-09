import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateDefaultOrg } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { getOrgUsage } from "@/lib/usage";
import { checkLimit, ORG_LIMITS } from "@/lib/limits";

const schema = z.object({ name: z.string().min(1), description: z.string().optional() });

export async function POST(req: NextRequest) {
  const session = await auth();
  console.log("[API /projects POST] session:", JSON.stringify(session?.user));
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`${session.user.id}:POST /api/projects`, 30, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const orgId = await getOrCreateDefaultOrg(session.user.id);

  // Usage limit check
  const usage = await getOrgUsage(orgId);
  try {
    checkLimit(usage.projects, ORG_LIMITS.maxProjects, "projects");
  } catch (err: unknown) {
    const e = err as { message?: string };
    return NextResponse.json({ error: e.message ?? "Limit exceeded" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { name: parsed.data.name, description: parsed.data.description ?? null, orgId },
  });

  logAudit({
    orgId,
    userId: session.user.id,
    action: "project.create",
    entityType: "Project",
    entityId: project.id,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ id: project.id });
}
