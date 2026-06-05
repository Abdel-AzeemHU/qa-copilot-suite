import { NextResponse } from "next/server";
import { requireUserId, getProjectForUser } from "@/lib/data";
import { toCsv, toGherkin } from "@/lib/export";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; format: string }> },
) {
  const { id, format } = await params;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await getProjectForUser(id, userId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const slug = project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  if (format === "csv") {
    const body = toCsv(project.testCases);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-test-cases.csv"`,
      },
    });
  }

  if (format === "gherkin") {
    const body = toGherkin(project.testCases, project.name);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}.feature"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown format" }, { status: 400 });
}
