import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getMembership } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MembersManager, type MemberView, type InviteView } from "./members-manager";

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

  const [memberships, invitations] = await Promise.all([
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

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Team — {org.name}</CardTitle>
            <CardDescription>
              Manage who can access this workspace. Owners and admins can invite
              new members; owners can change roles.
            </CardDescription>
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
      </main>
    </>
  );
}
