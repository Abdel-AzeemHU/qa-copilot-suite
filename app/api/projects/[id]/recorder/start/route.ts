import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { startRecording } from "@/lib/recorder/launch-recorder";
import { isRecorderUnavailable } from "@/lib/recorder/types";

const bodySchema = z.object({
  startUrl: z.string().url("A valid start URL is required"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, organization: { memberships: { some: { userId: session.user.id } } } },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const result = await startRecording({ startUrl: parsed.data.startUrl });
  if (isRecorderUnavailable(result)) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: 503 },
    );
  }

  return NextResponse.json({ sessionId: result.sessionId });
}
