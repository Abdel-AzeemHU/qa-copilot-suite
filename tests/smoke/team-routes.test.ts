import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Prisma mock ---------------------------------------------------------

const db = vi.hoisted(() => ({
  invitation: {
    findUnique: vi.fn(),
    update: vi.fn(async () => ({})),
  },
  membership: {
    findUnique: vi.fn(),
    create: vi.fn(async () => ({})),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(async (a: { data: unknown }) => ({ id: "m1", ...(a.data as object) })),
    delete: vi.fn(async () => ({})),
  },
  auditLog: {
    create: vi.fn(async () => ({})),
  },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...a: unknown[]) => authMock(...a) }));

// requireOrgRole is used by the member route; mock lib/data minimally.
vi.mock("@/lib/data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data")>("@/lib/data");
  return actual;
});

import { POST as acceptInvite } from "@/app/api/invitations/accept/route";
import { PATCH as patchMember, DELETE as deleteMember } from "@/app/api/orgs/[orgId]/members/[membershipId]/route";

function jsonReq(body: unknown) {
  return new Request("http://localhost/x", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.values(db).forEach((m) =>
    Object.values(m).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset?.()),
  );
  db.invitation.update.mockResolvedValue({});
  db.membership.create.mockResolvedValue({});
  db.membership.update.mockImplementation(async (a: { data: unknown }) => ({
    id: "m1",
    ...(a.data as object),
  }));
  db.membership.delete.mockResolvedValue({});
  authMock.mockReset();
});

describe("POST /api/invitations/accept", () => {
  const futureExpiry = new Date(Date.now() + 86400000);

  it("creates a membership with the invite role and marks accepted", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    db.invitation.findUnique.mockResolvedValue({
      id: "inv1",
      orgId: "org1",
      email: "a@b.com",
      role: "member",
      status: "pending",
      expiresAt: futureExpiry,
    });
    db.membership.findUnique.mockResolvedValue(null);

    const res = await acceptInvite(jsonReq({ token: "tok" }));
    expect(res.status).toBe(200);
    expect(db.membership.create).toHaveBeenCalledWith({
      data: { userId: "u1", orgId: "org1", role: "member" },
    });
    expect(db.invitation.update).toHaveBeenCalled();
  });

  it("rejects an expired invitation", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    db.invitation.findUnique.mockResolvedValue({
      id: "inv1",
      orgId: "org1",
      email: "a@b.com",
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await acceptInvite(jsonReq({ token: "tok" }));
    expect(res.status).toBe(410);
    expect(db.membership.create).not.toHaveBeenCalled();
  });

  it("rejects a revoked invitation", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    db.invitation.findUnique.mockResolvedValue({
      id: "inv1",
      orgId: "org1",
      email: "a@b.com",
      role: "member",
      status: "revoked",
      expiresAt: futureExpiry,
    });
    const res = await acceptInvite(jsonReq({ token: "tok" }));
    expect(res.status).toBe(410);
  });

  it("rejects an email mismatch", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "other@b.com" } });
    db.invitation.findUnique.mockResolvedValue({
      id: "inv1",
      orgId: "org1",
      email: "a@b.com",
      role: "member",
      status: "pending",
      expiresAt: futureExpiry,
    });
    const res = await acceptInvite(jsonReq({ token: "tok" }));
    expect(res.status).toBe(403);
    expect(db.membership.create).not.toHaveBeenCalled();
  });

  it("is idempotent when already a member", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    db.invitation.findUnique.mockResolvedValue({
      id: "inv1",
      orgId: "org1",
      email: "a@b.com",
      role: "member",
      status: "pending",
      expiresAt: futureExpiry,
    });
    db.membership.findUnique.mockResolvedValue({ id: "m9" });
    const res = await acceptInvite(jsonReq({ token: "tok" }));
    expect(res.status).toBe(200);
    expect(db.membership.create).not.toHaveBeenCalled();
  });
});

describe("member role/removal guards", () => {
  const params = (membershipId: string) =>
    Promise.resolve({ orgId: "org1", membershipId });

  it("cannot demote the last owner", async () => {
    authMock.mockResolvedValue({ user: { id: "owner1" } });
    // requireOrgRole(owner) -> membership.findUnique returns owner
    db.membership.findUnique.mockResolvedValue({ id: "mo", role: "owner" });
    db.membership.findFirst.mockResolvedValue({ id: "m-target", role: "owner", userId: "owner1" });
    db.membership.count.mockResolvedValue(1);

    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ role: "member" }),
    });
    const res = await patchMember(req as never, { params: params("m-target") });
    expect(res.status).toBe(400);
    expect(db.membership.update).not.toHaveBeenCalled();
  });

  it("owner can promote a member to admin", async () => {
    authMock.mockResolvedValue({ user: { id: "owner1" } });
    db.membership.findUnique.mockResolvedValue({ id: "mo", role: "owner" });
    db.membership.findFirst.mockResolvedValue({ id: "m-target", role: "member", userId: "u2" });

    const req = new Request("http://localhost/x", {
      method: "PATCH",
      body: JSON.stringify({ role: "admin" }),
    });
    const res = await patchMember(req as never, { params: params("m-target") });
    expect(res.status).toBe(200);
    expect(db.membership.update).toHaveBeenCalled();
  });

  it("cannot remove the last owner", async () => {
    authMock.mockResolvedValue({ user: { id: "owner1" } });
    db.membership.findUnique.mockResolvedValue({ id: "mo", role: "owner" });
    db.membership.findFirst.mockResolvedValue({ id: "m-target", role: "owner", userId: "owner2" });
    db.membership.count.mockResolvedValue(1);

    const res = await deleteMember(new Request("http://localhost/x"), {
      params: params("m-target"),
    });
    expect(res.status).toBe(400);
    expect(db.membership.delete).not.toHaveBeenCalled();
  });
});
