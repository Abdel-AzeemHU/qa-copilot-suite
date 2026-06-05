import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getProjectForUser } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StaticReviewOutput } from "@/lib/helpers/static-review";
import { ReviewForm } from "./review-form";

function severityVariant(severity: string): BadgeProps["variant"] {
  if (severity === "critical") return "high";
  if (severity === "major") return "medium";
  return "low";
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  const latest = await prisma.staticReview.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  const review: StaticReviewOutput | null = latest
    ? (JSON.parse(latest.output) as StaticReviewOutput)
    : null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Static / Peer Review</CardTitle>
            <CardDescription>{project.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewForm projectId={project.id} />
          </CardContent>
        </Card>

        {review ? (
          <Card>
            <CardHeader>
              <CardTitle>Review results — score {review.overallScore}/100</CardTitle>
              <CardDescription>{review.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              {review.findings.length === 0 ? (
                <p className="text-sm text-neutral-500">No findings.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Suggestion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {review.findings.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant="secondary">{f.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={severityVariant(f.severity)}>
                            {f.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{f.description}</TableCell>
                        <TableCell>{f.suggestion}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </>
  );
}
