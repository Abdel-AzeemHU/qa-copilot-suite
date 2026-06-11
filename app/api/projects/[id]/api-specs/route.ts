import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound, badRequest } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  parseOpenApiSpec,
  looksLikeOpenApi,
} from "@/lib/api-testing/parse-openapi";
import {
  parsePostmanCollection,
  looksLikePostmanCollection,
} from "@/lib/api-testing/parse-postman";

const createSchema = z.object({
  name: z.string().min(1, "A name is required"),
  content: z.string().min(1, "Spec content is required"),
  sourceType: z.enum(["openapi", "postman"]).optional(),
});

// GET /api/projects/[id]/api-specs — list specs (with endpoint counts)
export const GET = withHandler(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organization: { memberships: { some: { userId: session.user.id } } },
      },
      select: { id: true },
    });
    if (!project) throw notFound("Project not found");

    const specs = await prisma.apiSpec.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        sourceType: true,
        baseUrl: true,
        createdAt: true,
        _count: { select: { endpoints: true } },
      },
    });

    return NextResponse.json({ specs });
  },
);

// POST /api/projects/[id]/api-specs — upload + parse a spec
export const POST = withHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId } = await params;

    const rl = rateLimit(
      `${session.user.id}:POST /api/projects/${projectId}/api-specs`,
      10,
      10 * 60 * 1000,
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
        { status: 429 },
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organization: { memberships: { some: { userId: session.user.id } } },
      },
      select: { id: true, orgId: true },
    });
    if (!project) throw notFound("Project not found");

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { name, content } = parsed.data;
    let sourceType = parsed.data.sourceType;

    if (!sourceType) {
      if (looksLikeOpenApi(content)) sourceType = "openapi";
      else if (looksLikePostmanCollection(content)) sourceType = "postman";
      else {
        throw badRequest(
          "Could not detect spec type. Provide a valid OpenAPI/Swagger document or Postman collection export.",
        );
      }
    }

    let result;
    try {
      result =
        sourceType === "openapi"
          ? parseOpenApiSpec(content)
          : parsePostmanCollection(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse spec";
      throw badRequest(`Failed to parse spec: ${message}`);
    }

    if (result.endpoints.length === 0) {
      throw badRequest("No endpoints found in the provided spec.");
    }

    const spec = await prisma.apiSpec.create({
      data: {
        projectId,
        name,
        sourceType,
        rawContent: content,
        baseUrl: result.baseUrl,
        endpoints: {
          create: result.endpoints.map((ep) => ({
            method: ep.method,
            path: ep.path,
            operationId: ep.operationId,
            summary: ep.summary,
            description: ep.description,
            parameters: JSON.stringify(ep.parameters ?? []),
            requestBody: ep.requestBody ? JSON.stringify(ep.requestBody) : null,
            responses: JSON.stringify(ep.responses ?? {}),
            tags: JSON.stringify(ep.tags ?? []),
          })),
        },
      },
      select: { id: true, name: true, sourceType: true, baseUrl: true, _count: { select: { endpoints: true } } },
    });

    logAudit({
      orgId: project.orgId,
      userId: session.user.id,
      action: "api-spec.import",
      entityType: "ApiSpec",
      entityId: spec.id,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ spec }, { status: 201 });
  },
);
