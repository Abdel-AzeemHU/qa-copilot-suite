import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AcceptButton } from "./accept-button";

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  const expired = invitation
    ? invitation.expiresAt.getTime() < Date.now()
    : false;
  const valid = invitation?.status === "pending" && !expired;

  const loggedIn = Boolean(session?.user?.id);
  const myEmail = session?.user?.email?.toLowerCase() ?? null;
  const emailMatches =
    invitation && myEmail ? invitation.email.toLowerCase() === myEmail : false;

  // Already a member?
  let alreadyMember = false;
  if (invitation && session?.user?.id) {
    alreadyMember = Boolean(
      await prisma.membership.findUnique({
        where: {
          userId_orgId: { userId: session.user.id, orgId: invitation.orgId },
        },
      }),
    );
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Team invitation</CardTitle>
            {invitation ? (
              <CardDescription>
                You&apos;ve been invited to join{" "}
                <strong>{invitation.organization.name}</strong> as{" "}
                <Badge variant={invitation.role === "admin" ? "info" : "secondary"}>
                  {invitation.role}
                </Badge>
                <br />
                Invited by {invitation.invitedBy.name ?? invitation.invitedBy.email}.
              </CardDescription>
            ) : (
              <CardDescription>This invitation could not be found.</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!invitation ? (
              <p className="text-sm text-neutral-600">
                The invitation link is invalid.
              </p>
            ) : invitation.status === "revoked" ? (
              <p className="text-sm text-red-700">This invitation was revoked.</p>
            ) : expired ? (
              <p className="text-sm text-red-700">This invitation has expired.</p>
            ) : invitation.status === "accepted" ? (
              <p className="text-sm text-neutral-600">
                This invitation has already been accepted.
              </p>
            ) : !loggedIn ? (
              <div className="space-y-3 text-sm text-neutral-600">
                <p>
                  Sign in (or create an account) with{" "}
                  <strong>{invitation.email}</strong> to accept this invitation.
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/login?callbackUrl=/invitations/${token}`}
                    className={buttonVariants()}
                  >
                    Sign in
                  </Link>
                  <Link
                    href={`/register?callbackUrl=/invitations/${token}`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Create account
                  </Link>
                </div>
              </div>
            ) : alreadyMember ? (
              <div className="space-y-3 text-sm text-neutral-600">
                <p>You&apos;re already a member of this organization.</p>
                <Link href="/dashboard" className={buttonVariants()}>
                  Go to dashboard
                </Link>
              </div>
            ) : !emailMatches ? (
              <p className="text-sm text-red-700">
                This invitation was sent to <strong>{invitation.email}</strong>, but
                you&apos;re signed in as {session?.user?.email}. Sign in with the
                invited address to accept.
              </p>
            ) : valid ? (
              <AcceptButton token={token} />
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
