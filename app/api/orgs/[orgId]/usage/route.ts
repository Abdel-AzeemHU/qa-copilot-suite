import { auth } from "@/auth";
import { getMembership } from "@/lib/data";
import { getOrgUsage } from "@/lib/usage";
import { ORG_LIMITS } from "@/lib/limits";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/orgs/[orgId]/usage — returns current usage vs limits for the org.
 * Accessible by all members.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const me = await getMembership(session.user.id, orgId);
  if (!me) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const usage = await getOrgUsage(orgId);

  return NextResponse.json({
    usage,
    limits: ORG_LIMITS,
  });
}
