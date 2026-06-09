import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProjectForUser } from "@/lib/data";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function priorityVariant(priority: string): BadgeProps["variant"] {
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            {project.description ? (
              <p className="mt-1 text-neutral-500">{project.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/projects/${project.id}/generate`}
              className={buttonVariants()}
            >
              Generate test cases
            </Link>
            <a
              href={`/projects/${project.id}/export/csv`}
              className={buttonVariants({ variant: "outline" })}
            >
              Export CSV
            </a>
            <a
              href={`/projects/${project.id}/export/gherkin`}
              className={buttonVariants({ variant: "outline" })}
            >
              Export Gherkin
            </a>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={`/projects/${project.id}/automation`}
            className={buttonVariants({ variant: "outline" })}
          >
            Automation Code
          </Link>
          <Link
            href={`/projects/${project.id}/test-plan`}
            className={buttonVariants({ variant: "outline" })}
          >
            Test Plan
          </Link>
          <Link
            href={`/projects/${project.id}/bug-report`}
            className={buttonVariants({ variant: "outline" })}
          >
            Bug Report
          </Link>
          <Link
            href={`/projects/${project.id}/review`}
            className={buttonVariants({ variant: "outline" })}
          >
            Static Review
          </Link>
          <Link
            href={`/projects/${project.id}/chat`}
            className={buttonVariants({ variant: "outline" })}
          >
            QA Chat
          </Link>
          <Link
            href={`/projects/${project.id}/execute`}
            className={buttonVariants({ variant: "outline" })}
          >
            Run Tests
          </Link>
          <Link
            href={`/projects/${project.id}/pipeline`}
            className={buttonVariants({ variant: "outline" })}
          >
            Pipeline
          </Link>
          <Link
            href={`/projects/${project.id}/traceability`}
            className={buttonVariants({ variant: "outline" })}
          >
            Traceability
          </Link>
          <Link
            href={`/projects/${project.id}/integrations`}
            className={buttonVariants({ variant: "outline" })}
          >
            Integrations
          </Link>
          <Link
            href={`/projects/${project.id}/schedules`}
            className={buttonVariants({ variant: "outline" })}
          >
            Schedules
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Test cases ({project.testCases.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {project.testCases.length === 0 ? (
              <p className="py-6 text-center text-neutral-500">
                No test cases yet. Generate some to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.testCases.map((tc) => (
                    <TableRow key={tc.id}>
                      <TableCell className="font-medium">
                        {tc.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{tc.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant(tc.priority)}>
                          {tc.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/projects/${project.id}/test-cases/${tc.id}`}
                          className="text-sm underline"
                        >
                          Edit
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
