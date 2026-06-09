import { describe, it, expect, vi, beforeEach } from "vitest";

// -----------------------------------------------------------------------
// Rate limiter
// -----------------------------------------------------------------------
describe("rateLimit", () => {
  // Dynamic import so each test group gets a fresh module import if needed.
  // For simplicity we use the singleton store but isolate via unique keys.

  it("allows requests below the limit", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = `test:below-limit:${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).allowed).toBe(true);
    }
  });

  it("blocks the request at the limit", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = `test:at-limit:${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60_000);
    }
    const result = rateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("isolates different keys", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const keyA = `test:key-a:${Date.now()}`;
    const keyB = `test:key-b:${Date.now()}`;
    rateLimit(keyA, 1, 60_000);
    rateLimit(keyA, 1, 60_000); // blocked
    // keyB should still be allowed
    expect(rateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });

  it("allows again after the window expires", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const key = `test:window-reset:${Date.now()}`;
    // Fill with a 1ms window so it expires immediately
    rateLimit(key, 1, 1);
    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 5));
    expect(rateLimit(key, 1, 1).allowed).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Audit logger
// -----------------------------------------------------------------------
describe("logAudit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("calls prisma.auditLog.create with the correct fields", async () => {
    const mockCreate = vi.fn().mockResolvedValue({});
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: { auditLog: { create: mockCreate } },
    }));

    const { logAudit } = await import("@/lib/audit");
    logAudit({
      orgId: "org1",
      userId: "user1",
      action: "project.create",
      entityType: "Project",
      entityId: "proj1",
      meta: { name: "Test" },
      ip: "127.0.0.1",
    });

    // Fire-and-forget — give the microtask queue a tick.
    await new Promise((r) => setTimeout(r, 10));

    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.orgId).toBe("org1");
    expect(call.data.userId).toBe("user1");
    expect(call.data.action).toBe("project.create");
    expect(call.data.entityType).toBe("Project");
    expect(call.data.entityId).toBe("proj1");
    expect(call.data.meta).toContain("Test");
    expect(call.data.ip).toBe("127.0.0.1");
  });
});

// -----------------------------------------------------------------------
// Usage / limits
// -----------------------------------------------------------------------
describe("checkLimit", () => {
  it("does not throw when current is below max", async () => {
    const { checkLimit } = await import("@/lib/limits");
    expect(() => checkLimit(5, 10, "projects")).not.toThrow();
  });

  it("throws an AppError when current equals max", async () => {
    const { checkLimit } = await import("@/lib/limits");
    expect(() => checkLimit(10, 10, "projects")).toThrow();
  });

  it("throws an AppError when current exceeds max", async () => {
    const { checkLimit } = await import("@/lib/limits");
    expect(() => checkLimit(11, 10, "projects")).toThrow();
  });

  it("thrown error has status 400", async () => {
    const { checkLimit } = await import("@/lib/limits");
    const { AppError } = await import("@/lib/errors");
    let caught: unknown;
    try {
      checkLimit(10, 10, "projects");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as InstanceType<typeof AppError>).status).toBe(400);
  });
});

// -----------------------------------------------------------------------
// withHandler wrapper
// -----------------------------------------------------------------------
describe("withHandler", () => {
  function makeRequest() {
    const { NextRequest } = require("next/server");
    return new NextRequest("http://localhost/test");
  }

  it("returns the handler response on success", async () => {
    const { withHandler } = await import("@/lib/api-handler");
    const { NextResponse } = await import("next/server");
    const handler = withHandler(async () => NextResponse.json({ ok: true }));
    const res = await handler(makeRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("converts AppError to the correct status and code", async () => {
    const { withHandler } = await import("@/lib/api-handler");
    const { forbidden } = await import("@/lib/errors");
    const handler = withHandler(async () => {
      throw forbidden("Not allowed");
    });
    const res = await handler(makeRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN");
    expect(body.error).toBe("Not allowed");
  });

  it("returns 500 for unknown errors without leaking the stack trace", async () => {
    const { withHandler } = await import("@/lib/api-handler");
    const handler = withHandler(async () => {
      throw new Error("secret internal error");
    });
    const res = await handler(makeRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("secret internal error");
  });

  it("does not expose stack traces in the 500 response", async () => {
    const { withHandler } = await import("@/lib/api-handler");
    const handler = withHandler(async () => {
      const err = new Error("stack trace here");
      err.stack = "Error: stack trace here\n  at someFile.ts:42:10";
      throw err;
    });
    const res = await handler(makeRequest(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});
