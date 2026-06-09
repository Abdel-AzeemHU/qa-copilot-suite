import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/ci/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { runPipeline } from "@/worker/orchestrator";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// PUBLIC, token-authed endpoint that external CI systems call to start a
// pipeline. The project is derived from the bearer token — never from the URL.

const triggerSchema = z.object({
  targetUrl: z.string().url(),
  autoHeal: z.boolean().optional(),
  autoBug: z.boolean().optional(),
  notify: z.boolean().optional(),
  visual: z.boolean().optional(),
  ref: z.string().optional(),
  commit: z.string().optional(),
  prNumber: z.number().int().optional(),
});

// Stages mirror worker/orchestrator.ts (execute → heal → bug → visual → notify → report).
const STAGE_NAMES = ["execute", "heal", "bug", "visual", "notify", "report"];

function bearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function POST(req: NextRequest) {
  const raw = bearer(req);
  if (!raw) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const token = await verifyToken(raw);
  if (!token) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const limited = rateLimit(`ci:${token.id}`, 30, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter ?? 60) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const ciMetadata = JSON.stringify({
    ref: data.ref ?? null,
    commit: data.commit ?? null,
    prNumber: data.prNumber ?? null,
    source: "github-actions",
  });

  const pipelineRun = await prisma.pipelineRun.create({
    data: {
      projectId: token.projectId,
      targetUrl: data.targetUrl,
      autoHeal: data.autoHeal ?? true,
      autoBug: data.autoBug ?? true,
      notify: data.notify ?? true,
      status: "queued",
      ciMetadata,
    },
  });

  await prisma.pipelineStage.createMany({
    data: STAGE_NAMES.map((name, idx) => ({
      pipelineRunId: pipelineRun.id,
      name,
      sequence: idx + 1,
    })),
  });

  void runPipeline(pipelineRun.id);

  logAudit({
    userId: token.createdById,
    action: "ci.trigger",
    entityType: "PipelineRun",
    entityId: pipelineRun.id,
    meta: {
      projectId: token.projectId,
      tokenId: token.id,
      ref: data.ref,
      commit: data.commit,
      prNumber: data.prNumber,
    },
  });

  return NextResponse.json(
    { pipelineRunId: pipelineRun.id, statusUrl: `/api/ci/runs/${pipelineRun.id}` },
    { status: 202 },
  );
}
