import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getProjectForUser } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { CiSetup, type CiTokenView, type CiRunView } from "./ci-setup";

export default async function CiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const tokens = await prisma.projectApiToken.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  const recentRuns = await prisma.pipelineRun.findMany({
    where: { projectId: id, ciMetadata: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      summary: true,
      ciMetadata: true,
      createdAt: true,
    },
  });

  const tokenViews: CiTokenView[] = tokens.map((t) => ({
    id: t.id,
    name: t.name,
    tokenPrefix: t.tokenPrefix,
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    expiresAt: t.expiresAt?.toISOString() ?? null,
    revokedAt: t.revokedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));

  const runViews: CiRunView[] = recentRuns.map((r) => {
    let ref: string | null = null;
    let commit: string | null = null;
    let prNumber: number | null = null;
    try {
      const meta = JSON.parse(r.ciMetadata ?? "{}") as {
        ref?: string | null;
        commit?: string | null;
        prNumber?: number | null;
      };
      ref = meta.ref ?? null;
      commit = meta.commit ?? null;
      prNumber = meta.prNumber ?? null;
    } catch {
      // ignore malformed metadata
    }
    return {
      id: r.id,
      status: r.status,
      summary: r.summary,
      ref,
      commit,
      prNumber,
      createdAt: r.createdAt.toISOString(),
    };
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.qacopilot.dev";

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">CI / CD Integration</h1>
          <p className="mt-1 text-neutral-500">
            Run the QA pipeline automatically from GitHub Actions or any CI
            system using a project API token.
          </p>
        </div>
        <CiSetup
          projectId={id}
          appUrl={appUrl}
          initialTokens={tokenViews}
          recentRuns={runViews}
        />
      </main>
    </>
  );
}
