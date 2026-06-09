import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { stopRecording } from "@/lib/recorder/launch-recorder";
import { isRecorderUnavailable } from "@/lib/recorder/types";
import { runHelper } from "@/lib/ai/run-helper";
import { getProviderForOwner } from "@/lib/ai/get-provider";
import { recordingSummarizerHelper } from "@/lib/helpers/recording-summarizer";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  startUrl: z.string().optional(),
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
    select: { id: true, orgId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await stopRecording(parsed.data.sessionId);
  if (isRecorderUnavailable(result)) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: 503 },
    );
  }

  const { rawCode, actions } = result;

  // Best-effort AI drafting. If it fails (no API key, etc.) we still return the
  // parsed actions so the user keeps their recording.
  let testCase = null;
  let aiError: string | null = null;
  if (actions.length > 0) {
    try {
      const provider = await getProviderForOwner(project.orgId);
      testCase = await runHelper(
        recordingSummarizerHelper,
        { startUrl: parsed.data.startUrl ?? "", actions },
        provider,
      );
    } catch (err) {
      aiError = err instanceof Error ? err.message : "AI drafting failed";
    }
  }

  return NextResponse.json({ rawCode, actions, testCase, aiError });
}
