import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getMembership, roleSatisfies } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MembersManager, type MemberView, type InviteView } from "./members-manager";
import { getOrgUsage } from "@/lib/usage";
import { ORG_LIMITS } from "@/lib/limits";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { orgId } = await params;
  const me = await getMembership(session.user.id, orgId);
  if (!me) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!org) notFound();

  const [memberships, invitations, usage] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { orgId, status: "pending" },
      include: { invitedBy: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getOrgUsage(orgId),
  ]);

  const members: MemberView[] = memberships.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
    joinedAt: m.createdAt.toISOString(),
    isSelf: m.userId === session.user!.id,
  }));

  const pending: InviteView[] = invitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    token: inv.token,
    invitedBy: inv.invitedBy.name ?? inv.invitedBy.email,
    expiresAt: inv.expiresAt.toISOString(),
    expired: inv.expiresAt.getTime() < Date.now(),
  }));

  const isAdmin = roleSatisfies(me.role, "admin");

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Team — {org.name}</CardTitle>
                <CardDescription>
                  Manage who can access this workspace. Owners and admins can invite
                  new members; owners can change roles.
                </CardDescription>
              </div>
              {isAdmin && (
                <a
                  href={`/orgs/${orgId}/audit`}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Audit Log
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <MembersManager
              orgId={orgId}
              myRole={me.role}
              initialMembers={members}
              initialInvites={pending}
            />
          </CardContent>
        </Card>

        {/* Usage section — visible to all members */}
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>
              Current resource usage for this organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Projects</dt>
                <dd className="mt-1 text-2xl font-semibold">
                  {usage.projects}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {ORG_LIMITS.maxProjects}
                  </span>
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Members</dt>
                <dd className="mt-1 text-2xl font-semibold">
                  {usage.members}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {ORG_LIMITS.maxMembersPerOrg}
                  </span>
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Pipeline runs (month)</dt>
                <dd className="mt-1 text-2xl font-semibold">
                  {usage.pipelineRunsThisMonth}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}/ {ORG_LIMITS.maxPipelineRunsPerMonth}
                  </span>
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">Execution runs (month)</dt>
                <dd className="mt-1 text-2xl font-semibold">
                  {usage.executionRunsThisMonth}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
