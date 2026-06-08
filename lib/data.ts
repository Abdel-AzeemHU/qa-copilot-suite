import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";

/**
 * Returns the authenticated user's id, or throws if not signed in.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    redirect("/login");
  }
  return id;
}

// --- Role hierarchy & membership helpers -----------------------------------

export type OrgRole = "owner" | "admin" | "member";

const ROLE_RANK: Record<OrgRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

/**
 * True if `role` satisfies (is at least as privileged as) `minRole`.
 */
export function roleSatisfies(
  role: string | null | undefined,
  minRole: OrgRole,
): boolean {
  if (!role || !(role in ROLE_RANK)) return false;
  return ROLE_RANK[role as OrgRole] >= ROLE_RANK[minRole];
}

/**
 * Returns the ids of every organization the user is a member of.
 */
export async function getUserOrgIds(userId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { orgId: true },
  });
  return memberships.map((m) => m.orgId);
}

/**
 * Returns the user's membership row for an org, or null if they're not a member.
 */
export async function getMembership(userId: string, orgId: string) {
  return prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
}

/**
 * Returns the membership row if the user meets `minRole` in the org, else null.
 */
export async function requireOrgRole(
  userId: string,
  orgId: string,
  minRole: OrgRole,
) {
  const membership = await getMembership(userId, orgId);
  if (!membership || !roleSatisfies(membership.role, minRole)) return null;
  return membership;
}

/**
 * Returns the user's default organization, creating one on first access.
 * Also ensures the owner has a Membership row (backfill-on-access).
 */
export async function getOrCreateDefaultOrg(userId: string): Promise<string> {
  const existing = await prisma.organization.findFirst({
    where: { memberships: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;

  // Legacy orgs may have an ownerId but no membership row; adopt one.
  const owned = await prisma.organization.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  });
  if (owned) {
    await prisma.membership.upsert({
      where: { userId_orgId: { userId, orgId: owned.id } },
      update: {},
      create: { userId, orgId: owned.id, role: "owner" },
    });
    return owned.id;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const org = await prisma.organization.create({
    data: {
      name: user?.name ? `${user.name}'s Workspace` : "My Workspace",
      ownerId: userId,
      memberships: {
        create: { userId, role: "owner" },
      },
    },
  });
  return org.id;
}

/**
 * Lists projects across every organization the authenticated user belongs to.
 */
export async function listProjects(userId: string) {
  return prisma.project.findMany({
    where: { organization: { memberships: { some: { userId } } } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { testCases: true } } },
  });
}

/**
 * Fetches a project the user can access (via membership), including its test
 * cases. Returns null if not found or the user is not a member of its org.
 */
export async function getProjectForUser(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      organization: { memberships: { some: { userId } } },
    },
    include: { testCases: { orderBy: { createdAt: "desc" } } },
  });
}

/**
 * Fetches a single test case scoped to a project the user can access.
 */
export async function getTestCaseForUser(testCaseId: string, userId: string) {
  return prisma.testCase.findFirst({
    where: {
      id: testCaseId,
      project: { organization: { memberships: { some: { userId } } } },
    },
    include: { project: true },
  });
}

/**
 * Returns the decrypted Claude API key for the user, or null if none stored.
 */
export async function getClaudeApiKeyRecord(userId: string) {
  return prisma.apiKey.findUnique({
    where: { userId_provider: { userId, provider: "claude" } },
  });
}

/**
 * Fetches a project with the data needed to ground chat responses: its test
 * cases, test plans, and full chat history. Returns null if the user is not a
 * member of the project's org.
 */
export async function getProjectChatContext(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      organization: { memberships: { some: { userId } } },
    },
    include: {
      testCases: { orderBy: { createdAt: "desc" }, take: 50 },
      testPlans: { orderBy: { createdAt: "desc" }, take: 5 },
      chatMessages: { orderBy: { createdAt: "asc" } },
    },
  });
}
