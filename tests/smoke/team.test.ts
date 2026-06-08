import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const membershipFindUnique = vi.fn();
const membershipFindMany = vi.fn();
const projectFindMany = vi.fn();
const projectFindFirst = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    membership: {
      findUnique: (...a: unknown[]) => membershipFindUnique(...a),
      findMany: (...a: unknown[]) => membershipFindMany(...a),
    },
    project: {
      findMany: (...a: unknown[]) => projectFindMany(...a),
      findFirst: (...a: unknown[]) => projectFindFirst(...a),
    },
  },
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import {
  roleSatisfies,
  requireOrgRole,
  getUserOrgIds,
  listProjects,
  getProjectForUser,
} from "@/lib/data";

beforeEach(() => {
  membershipFindUnique.mockReset();
  membershipFindMany.mockReset();
  projectFindMany.mockReset();
  projectFindFirst.mockReset();
});

// --- Role hierarchy ------------------------------------------------------

describe("roleSatisfies", () => {
  it("owner satisfies every requirement", () => {
    expect(roleSatisfies("owner", "owner")).toBe(true);
    expect(roleSatisfies("owner", "admin")).toBe(true);
    expect(roleSatisfies("owner", "member")).toBe(true);
  });

  it("admin satisfies admin and member but not owner", () => {
    expect(roleSatisfies("admin", "owner")).toBe(false);
    expect(roleSatisfies("admin", "admin")).toBe(true);
    expect(roleSatisfies("admin", "member")).toBe(true);
  });

  it("member only satisfies member", () => {
    expect(roleSatisfies("member", "admin")).toBe(false);
    expect(roleSatisfies("member", "member")).toBe(true);
  });

  it("rejects null / unknown roles", () => {
    expect(roleSatisfies(null, "member")).toBe(false);
    expect(roleSatisfies("bogus", "member")).toBe(false);
  });
});

describe("requireOrgRole", () => {
  it("returns the membership when the role is sufficient", async () => {
    membershipFindUnique.mockResolvedValue({ id: "m1", role: "owner" });
    const result = await requireOrgRole("u1", "org1", "admin");
    expect(result).toMatchObject({ id: "m1", role: "owner" });
  });

  it("returns null when the role is insufficient", async () => {
    membershipFindUnique.mockResolvedValue({ id: "m1", role: "member" });
    expect(await requireOrgRole("u1", "org1", "admin")).toBeNull();
  });

  it("returns null when the user is not a member", async () => {
    membershipFindUnique.mockResolvedValue(null);
    expect(await requireOrgRole("u1", "org1", "member")).toBeNull();
  });
});

// --- Membership-based visibility ----------------------------------------

describe("getUserOrgIds", () => {
  it("maps membership rows to org ids", async () => {
    membershipFindMany.mockResolvedValue([{ orgId: "a" }, { orgId: "b" }]);
    expect(await getUserOrgIds("u1")).toEqual(["a", "b"]);
  });
});

describe("membership-based project queries", () => {
  it("listProjects filters by membership", async () => {
    projectFindMany.mockResolvedValue([]);
    await listProjects("u1");
    const arg = projectFindMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      organization: { memberships: { some: { userId: "u1" } } },
    });
  });

  it("getProjectForUser scopes by membership", async () => {
    projectFindFirst.mockResolvedValue(null);
    await getProjectForUser("p1", "u1");
    const arg = projectFindFirst.mock.calls[0][0];
    expect(arg.where).toEqual({
      id: "p1",
      organization: { memberships: { some: { userId: "u1" } } },
    });
  });

  it("a non-member sees no project (findFirst returns null)", async () => {
    projectFindFirst.mockResolvedValue(null);
    expect(await getProjectForUser("p1", "stranger")).toBeNull();
  });
});
