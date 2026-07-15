import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// --- Prisma mock ---------------------------------------------------------

const db = vi.hoisted(() => ({
  projectApiToken: {
    findUnique: vi.fn(),
    update: vi.fn(async () => ({})),
  },
  pipelineRun: {
    create: vi.fn(async () => ({ id: "pr1" })),
    findUnique: vi.fn(),
  },
  pipelineStage: {
    createMany: vi.fn(async () => ({})),
  },
  auditLog: {
    create: vi.fn(async () => ({})),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

// Don't actually run the pipeline.
vi.mock("@/worker/orchestrator", () => ({ runPipeline: vi.fn() }));

import { generateToken, hashToken, verifyToken } from "@/lib/ci/tokens";
import { POST as triggerPost } from "@/app/api/ci/trigger/route";
import { GET as runsGet } from "@/app/api/ci/runs/[id]/route";
import { NextRequest } from "next/server";

function reset() {
  Object.values(db).forEach((m) =>
    Object.values(m).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset?.()),
  );
  db.projectApiToken.update.mockResolvedValue({});
  db.pipelineRun.create.mockResolvedValue({ id: "pr1" });
  db.pipelineStage.createMany.mockResolvedValue({});
}

beforeEach(reset);

function triggerReq(token: string | null, body: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/ci/trigger", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function runsReq(token: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/ci/runs/pr1", { headers });
}

// --- generateToken / hashToken -------------------------------------------

describe("generateToken", () => {
  it("produces a qaera_ raw token, 9-char prefix, and sha256 hash", () => {
    const { raw, prefix, hash } = generateToken();
    expect(raw).toMatch(/^qaera_[0-9a-f]{32}$/);
    expect(prefix).toBe(raw.slice(0, 9));
    expect(prefix).toHaveLength(9);
    expect(hash).toBe(createHash("sha256").update(raw).digest("hex"));
    expect(hash).not.toBe(raw);
  });

  it("still verifies legacy qacs_ tokens", async () => {
    // verifyToken must accept the pre-rebrand prefix so existing CI secrets
    // keep working. (Prefix gate only — DB lookup is mocked elsewhere.)
    const legacy = "qacs_" + "d".repeat(32);
    db.projectApiToken.findUnique.mockResolvedValue(null);
    // Reaching the DB lookup (returning null) proves the prefix was accepted.
    const result = await verifyToken(legacy);
    expect(result).toBeNull();
    expect(db.projectApiToken.findUnique).toHaveBeenCalled();
  });

  it("hashToken matches generateToken's hash", () => {
    const { raw, hash } = generateToken();
    expect(hashToken(raw)).toBe(hash);
  });
});

// --- verifyToken ----------------------------------------------------------

describe("verifyToken", () => {
  const raw = "qaera_" + "a".repeat(32);
  const hash = hashToken(raw);

  it("returns the row and bumps lastUsedAt for a valid token", async () => {
    db.projectApiToken.findUnique.mockResolvedValue({
      id: "t1",
      projectId: "proj1",
      tokenHash: hash,
      revokedAt: null,
      expiresAt: null,
    });
    const row = await verifyToken(raw);
    expect(row?.id).toBe("t1");
    expect(db.projectApiToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" } }),
    );
  });

  it("returns null for a revoked token", async () => {
    db.projectApiToken.findUnique.mockResolvedValue({
      id: "t1",
      projectId: "proj1",
      tokenHash: hash,
      revokedAt: new Date(),
      expiresAt: null,
    });
    expect(await verifyToken(raw)).toBeNull();
  });

  it("returns null for an expired token", async () => {
    db.projectApiToken.findUnique.mockResolvedValue({
      id: "t1",
      projectId: "proj1",
      tokenHash: hash,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await verifyToken(raw)).toBeNull();
  });

  it("returns null for an unknown hash", async () => {
    db.projectApiToken.findUnique.mockResolvedValue(null);
    expect(await verifyToken(raw)).toBeNull();
  });

  it("returns null for a malformed token without lookup", async () => {
    expect(await verifyToken("not-a-token")).toBeNull();
    expect(db.projectApiToken.findUnique).not.toHaveBeenCalled();
  });
});

// --- CI trigger route -----------------------------------------------------

describe("POST /api/ci/trigger", () => {
  const raw = "qaera_" + "b".repeat(32);

  it("returns 401 when bearer token is missing", async () => {
    const res = await triggerPost(triggerReq(null, { targetUrl: "https://x.com" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid token", async () => {
    db.projectApiToken.findUnique.mockResolvedValue(null);
    const res = await triggerPost(triggerReq(raw, { targetUrl: "https://x.com" }));
    expect(res.status).toBe(401);
  });

  it("creates a PipelineRun with ciMetadata for a valid token", async () => {
    db.projectApiToken.findUnique.mockResolvedValue({
      id: "t1",
      projectId: "proj1",
      createdById: "u1",
      tokenHash: hashToken(raw),
      revokedAt: null,
      expiresAt: null,
    });
    const res = await triggerPost(
      triggerReq(raw, {
        targetUrl: "https://staging.example.com",
        ref: "refs/heads/main",
        commit: "abc123",
        prNumber: 42,
      }),
    );
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.pipelineRunId).toBe("pr1");
    expect(json.statusUrl).toBe("/api/ci/runs/pr1");
    const createArg = db.pipelineRun.create.mock.calls[0][0];
    expect(createArg.data.projectId).toBe("proj1");
    const meta = JSON.parse(createArg.data.ciMetadata);
    expect(meta).toMatchObject({
      ref: "refs/heads/main",
      commit: "abc123",
      prNumber: 42,
      source: "github-actions",
    });
  });

  it("returns 429 after exceeding the rate limit", async () => {
    db.projectApiToken.findUnique.mockResolvedValue({
      id: "ratelimited",
      projectId: "proj1",
      createdById: "u1",
      tokenHash: hashToken(raw),
      revokedAt: null,
      expiresAt: null,
    });
    let last = 200;
    // limit is 30/min for the same token id.
    for (let i = 0; i < 35; i++) {
      const res = await triggerPost(
        triggerReq(raw, { targetUrl: "https://x.com" }),
      );
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

// --- CI results route -----------------------------------------------------

describe("GET /api/ci/runs/[id]", () => {
  const raw = "qaera_" + "c".repeat(32);
  const params = Promise.resolve({ id: "pr1" });

  function mockToken(projectId: string) {
    db.projectApiToken.findUnique.mockResolvedValue({
      id: "t1",
      projectId,
      createdById: "u1",
      tokenHash: hashToken(raw),
      revokedAt: null,
      expiresAt: null,
    });
  }

  it("maps succeeded -> success", async () => {
    mockToken("proj1");
    db.pipelineRun.findUnique.mockResolvedValue({
      id: "pr1",
      projectId: "proj1",
      status: "succeeded",
      summary: "ok",
      finalRunId: "fr1",
      bugReportId: null,
      stages: [{ name: "execute", status: "succeeded", sequence: 1 }],
    });
    const res = await runsGet(runsReq(raw), { params });
    const json = await res.json();
    expect(json.conclusion).toBe("success");
    expect(json.stages[0]).toEqual({ name: "execute", status: "succeeded" });
  });

  it("maps failed -> failure", async () => {
    mockToken("proj1");
    db.pipelineRun.findUnique.mockResolvedValue({
      id: "pr1",
      projectId: "proj1",
      status: "failed",
      summary: null,
      finalRunId: null,
      bugReportId: null,
      stages: [],
    });
    const res = await runsGet(runsReq(raw), { params });
    expect((await res.json()).conclusion).toBe("failure");
  });

  it("denies cross-project token access", async () => {
    mockToken("proj-other");
    db.pipelineRun.findUnique.mockResolvedValue({
      id: "pr1",
      projectId: "proj1",
      status: "succeeded",
      stages: [],
    });
    const res = await runsGet(runsReq(raw), { params });
    expect(res.status).toBe(404);
  });
});
