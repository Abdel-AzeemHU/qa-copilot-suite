import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/ci/tokens";
import { evaluateGate } from "@/lib/ci/gate";
import { NextRequest, NextResponse } from "next/server";

// Token-authed run-status endpoint. The CI job polls this to wait for
// completion and decide pass/fail.

function bearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function conclusionFor(status: string): "success" | "failure" | "neutral" {
  if (status === "succeeded") return "success";
  if (status === "failed" || status === "error") return "failure";
  return "neutral";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const raw = bearer(req);
  if (!raw) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }
  const token = await verifyToken(raw);
  if (!token) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const { id } = await params;
  const run = await prisma.pipelineRun.findUnique({
    where: { id },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });

  // Don't leak other projects' runs — scope to the token's project.
  if (!run || run.projectId !== token.projectId) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Flakiness-aware merge gate: unlike the raw conclusion, the gate does not
  // block on quarantined known-flaky tests and explains every block.
  const gate = await evaluateGate(run.id);

  return NextResponse.json({
    id: run.id,
    status: run.status,
    conclusion: conclusionFor(run.status),
    gate: {
      verdict: gate.verdict,
      reasons: gate.reasons,
      failureClass: gate.failureClass,
      quarantineApplied: gate.quarantineApplied,
    },
    summary: run.summary,
    stages: run.stages.map((s) => ({ name: s.name, status: s.status })),
    finalRunId: run.finalRunId,
    bugReportId: run.bugReportId,
    url: `${appUrl}/projects/${run.projectId}/pipeline`,
  });
}
