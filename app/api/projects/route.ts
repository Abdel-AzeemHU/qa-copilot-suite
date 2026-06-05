import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateDefaultOrg } from "@/lib/data";

const schema = z.object({ name: z.string().min(1), description: z.string().optional() });

export async function POST(req: NextRequest) {
  const session = await auth();
  console.log("[API /projects POST] session:", JSON.stringify(session?.user));
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const orgId = await getOrCreateDefaultOrg(session.user.id);
  const project = await prisma.project.create({ data: { name: parsed.data.name, description: parsed.data.description ?? null, orgId } });
  return NextResponse.json({ id: project.id });
}
