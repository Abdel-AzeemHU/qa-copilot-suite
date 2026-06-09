import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { requireOrgRole } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { orgId } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));

  const membership = await requireOrgRole(session.user.id, orgId, "admin");
  if (!membership) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!org) notFound();

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where: { orgId } }),
    prisma.auditLog.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ]);

  // Fetch user info for actors in this page.
  const userIds = [...new Set(entries.map((e) => e.userId).filter(Boolean) as string[])];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Audit Log — {org.name}</CardTitle>
            <CardDescription>
              Security and data-relevant actions recorded for this organization.
              Showing page {page} of {totalPages} ({total} total entries).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Time</th>
                    <th className="pb-2 pr-4 font-medium">Actor</th>
                    <th className="pb-2 pr-4 font-medium">Action</th>
                    <th className="pb-2 pr-4 font-medium">Entity</th>
                    <th className="pb-2 pr-4 font-medium">IP</th>
                    <th className="pb-2 font-medium">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No audit entries yet.
                      </td>
                    </tr>
                  )}
                  {entries.map((entry) => {
                    const actor = entry.userId ? userMap[entry.userId] : null;
                    const metaStr = entry.meta
                      ? entry.meta.length > 80
                        ? entry.meta.slice(0, 80) + "…"
                        : entry.meta
                      : "-";
                    return (
                      <tr key={entry.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {entry.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                        </td>
                        <td className="py-2 pr-4 max-w-[160px] truncate">
                          {actor ? (actor.name ?? actor.email) : (entry.userId ?? "-")}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {entry.action}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {entry.entityType ?? "-"}
                          {entry.entityId ? (
                            <span className="ml-1 opacity-60">
                              {entry.entityId.slice(0, 8)}…
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {entry.ip ?? "-"}
                        </td>
                        <td className="py-2 font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                          {metaStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex gap-2 justify-end text-sm">
                {page > 1 && (
                  <a
                    href={`?page=${page - 1}`}
                    className="rounded border px-3 py-1 hover:bg-muted"
                  >
                    Previous
                  </a>
                )}
                <span className="px-3 py-1 text-muted-foreground">
                  {page} / {totalPages}
                </span>
                {page < totalPages && (
                  <a
                    href={`?page=${page + 1}`}
                    className="rounded border px-3 py-1 hover:bg-muted"
                  >
                    Next
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
