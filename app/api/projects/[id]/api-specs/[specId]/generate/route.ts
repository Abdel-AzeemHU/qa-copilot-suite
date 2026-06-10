import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withHandler } from "@/lib/api-handler";
import { unauthorized, notFound, badRequest } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { getProviderForUser } from "@/lib/ai/get-provider";
import { runHelper } from "@/lib/ai/run-helper";
import { apiTestGeneratorHelper } from "@/lib/helpers/api-test-generator";

const schema = z.object({
  endpointIds: z.array(z.string()).min(1, "Select at least one endpoint"),
  countPerEndpoint: z.number().int().min(1).max(6).optional(),
});

// POST /api/projects/[id]/api-specs/[specId]/generate — generate API test cases
export const POST = withHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string; specId: string }> },
  ) => {
    const session = await auth();
    if (!session?.user?.id) throw unauthorized();

    const { id: projectId, specId } = await params;

    const rl = rateLimit(
      `${session.user.id}:POST /api/projects/${projectId}/api-specs/generate`,
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

    const spec = await prisma.apiSpec.findFirst({
      where: { id: specId, projectId },
      select: { id: true, baseUrl: true },
    });
    if (!spec) throw notFound("Spec not found");

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { endpointIds, countPerEndpoint } = parsed.data;

    const endpoints = await prisma.apiEndpoint.findMany({
      where: { id: { in: endpointIds }, apiSpecId: specId },
      select: {
        id: true,
        method: true,
        path: true,
        summary: true,
        description: true,
        parameters: true,
        requestBody: true,
        responses: true,
      },
    });
    if (endpoints.length === 0) throw notFound("No matching endpoints found");

    let provider;
    try {
      provider = await getProviderForUser(session.user.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No provider configured";
      throw badRequest(message);
    }

    let output;
    try {
      output = await runHelper(
        apiTestGeneratorHelper,
        {
          baseUrl: spec.baseUrl ?? undefined,
          countPerEndpoint,
          endpoints: endpoints.map((ep) => ({
            id: ep.id,
            method: ep.method,
            path: ep.path,
            summary: ep.summary ?? undefined,
            description: ep.description ?? undefined,
            parameters: JSON.parse(ep.parameters),
            requestBody: ep.requestBody ? JSON.parse(ep.requestBody) : undefined,
            responses: JSON.parse(ep.responses),
          })),
        },
        provider,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      throw badRequest(`API test case generation failed: ${message}`);
    }

    const validEndpointIds = new Set(endpoints.map((e) => e.id));
    const cases = output.cases.filter((c) => validEndpointIds.has(c.endpointId));

    const created = await prisma.testCase.createManyAndReturn({
      data: cases.map((c) => {
        const ep = endpoints.find((e) => e.id === c.endpointId)!;
        return {
          projectId,
          title: c.title,
          preconditions: c.preconditions,
          steps: JSON.stringify(c.steps),
          expectedResult: c.expectedResult,
          priority: c.priority,
          type: "api",
          requirement: `${ep.method} ${ep.path}`,
          targetUrl: spec.baseUrl ? `${spec.baseUrl}${ep.path}` : null,
          apiEndpointId: ep.id,
        };
      }),
      select: { id: true, title: true, type: true, priority: true, apiEndpointId: true },
    });

    logAudit({
      orgId: project.orgId,
      userId: session.user.id,
      action: "api-spec.generate-test-cases",
      entityType: "ApiSpec",
      entityId: specId,
      meta: { count: created.length },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ testCases: created }, { status: 201 });
  },
);
