import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";

/**
 * Returns the authenticated user's id, or throws if not signed in.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    throw new Error("Not authenticated");
  }
  return id;
}

/**
 * Returns the user's default organization, creating one on first access.
 * Phase 1 uses a single implicit org per user.
 */
export async function getOrCreateDefaultOrg(userId: string): Promise<string> {
  const existing = await prisma.organization.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const org = await prisma.organization.create({
    data: {
      name: user?.name ? `${user.name}'s Workspace` : "My Workspace",
      ownerId: userId,
    },
  });
  return org.id;
}

/**
 * Lists projects belonging to the authenticated user's organizations.
 */
export async function listProjects(userId: string) {
  return prisma.project.findMany({
    where: { organization: { ownerId: userId } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { testCases: true } } },
  });
}

/**
 * Fetches a project the user owns, including its test cases. Returns null if
 * not found or not owned by the user.
 */
export async function getProjectForUser(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, organization: { ownerId: userId } },
    include: { testCases: { orderBy: { createdAt: "desc" } } },
  });
}

/**
 * Fetches a single test case scoped to a user-owned project.
 */
export async function getTestCaseForUser(
  testCaseId: string,
  userId: string,
) {
  return prisma.testCase.findFirst({
    where: {
      id: testCaseId,
      project: { organization: { ownerId: userId } },
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
 * cases, test plans, and full chat history. Returns null if not user-owned.
 */
export async function getProjectChatContext(
  projectId: string,
  userId: string,
) {
  return prisma.project.findFirst({
    where: { id: projectId, organization: { ownerId: userId } },
    include: {
      testCases: { orderBy: { createdAt: "desc" }, take: 50 },
      testPlans: { orderBy: { createdAt: "desc" }, take: 5 },
      chatMessages: { orderBy: { createdAt: "asc" } },
    },
  });
}
