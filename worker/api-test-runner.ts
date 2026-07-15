import { prisma } from "@/lib/db/prisma";
import { runHelper } from "@/lib/ai/run-helper";
import {
  apiTestCompilerHelper,
  type ApiTestCompilerOutput,
  type ApiAssertion,
} from "@/lib/helpers/api-test-compiler";
import { getProviderForOwner } from "@/lib/ai/get-provider";
import { evaluateAll, type ResponseFacts } from "@/lib/api-testing/assert";

const MAX_BODY_STORE = 8000; // chars of response body to persist
const REQUEST_TIMEOUT_MS = 30000;

interface CompiledRequest extends ApiTestCompilerOutput {}

/**
 * Compiles (if needed) and executes one API test case as a real HTTP request,
 * evaluates its assertions, and stores the result on the ApiTestRun row.
 *
 * The compiled request spec is cached on TestCase.compiledRequest so re-runs
 * don't call the LLM again unless the test case changed.
 */
export async function runApiTest(apiTestRunId: string): Promise<void> {
  const run = await prisma.apiTestRun.findUnique({
    where: { id: apiTestRunId },
    select: {
      id: true,
      projectId: true,
      testCaseId: true,
      project: { select: { orgId: true } },
    },
  });
  if (!run) return;

  await prisma.apiTestRun.update({
    where: { id: apiTestRunId },
    data: { status: "running", startedAt: new Date() },
  });

  try {
    const tc = await prisma.testCase.findUnique({
      where: { id: run.testCaseId },
      select: {
        id: true,
        title: true,
        steps: true,
        expectedResult: true,
        type: true,
        compiledRequest: true,
        apiEndpoint: {
          select: {
            method: true,
            path: true,
            summary: true,
            parameters: true,
            requestBody: true,
            responses: true,
            apiSpec: { select: { baseUrl: true } },
          },
        },
      },
    });

    if (!tc) throw new Error("Test case not found");
    if (!tc.apiEndpoint) throw new Error("Test case is not linked to an API endpoint");

    const baseUrl = tc.apiEndpoint.apiSpec.baseUrl;
    if (!baseUrl) {
      throw new Error(
        "The API spec has no base URL. Re-import the spec with a servers/baseUrl set.",
      );
    }

    // 1. Compile (cache on the test case).
    let compiled: CompiledRequest;
    if (tc.compiledRequest) {
      compiled = JSON.parse(tc.compiledRequest) as CompiledRequest;
    } else {
      const provider = await getProviderForOwner(run.project.orgId);
      compiled = await runHelper(
        apiTestCompilerHelper,
        {
          baseUrl,
          method: tc.apiEndpoint.method,
          path: tc.apiEndpoint.path,
          endpointSummary: tc.apiEndpoint.summary ?? undefined,
          parameters: JSON.parse(tc.apiEndpoint.parameters),
          requestBody: tc.apiEndpoint.requestBody
            ? JSON.parse(tc.apiEndpoint.requestBody)
            : undefined,
          responses: JSON.parse(tc.apiEndpoint.responses),
          testTitle: tc.title,
          testSteps: JSON.parse(tc.steps) as string[],
          expectedResult: tc.expectedResult ?? "",
          testType: tc.type,
        },
        provider,
      );
      await prisma.testCase.update({
        where: { id: tc.id },
        data: { compiledRequest: JSON.stringify(compiled) },
      });
    }

    // 2. Build the URL.
    const url = buildUrl(baseUrl, compiled.path, compiled.query);

    // 3. Execute.
    const facts = await execute(url, compiled);

    // 4. Evaluate assertions.
    const results = evaluateAll(compiled.assertions as ApiAssertion[], facts);
    const allPassed = results.every((r) => r.passed);

    await prisma.apiTestRun.update({
      where: { id: apiTestRunId },
      data: {
        status: allPassed ? "passed" : "failed",
        method: compiled.method,
        url,
        requestSpec: JSON.stringify(compiled),
        responseCode: facts.status,
        responseTimeMs: facts.timeMs,
        responseBody: facts.bodyText.slice(0, MAX_BODY_STORE),
        assertions: JSON.stringify(results),
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.apiTestRun.update({
      where: { id: apiTestRunId },
      data: {
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
  }
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(base + rel);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  return url.toString();
}

async function execute(
  url: string,
  compiled: CompiledRequest,
): Promise<ResponseFacts> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: compiled.method,
      headers: compiled.headers,
      body: compiled.body,
      signal: controller.signal,
      redirect: "manual",
    });
    const bodyText = await res.text();
    const timeMs = Date.now() - start;

    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    let json: unknown | undefined;
    const ct = headers["content-type"] ?? "";
    if (ct.includes("json")) {
      try {
        json = JSON.parse(bodyText);
      } catch {
        json = undefined;
      }
    }

    return { status: res.status, headers, bodyText, json, timeMs };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs a batch of test cases sequentially, one ApiTestRun per test case.
 * Returns the created run ids.
 */
export async function runApiTestBatch(
  projectId: string,
  testCaseIds: string[],
): Promise<string[]> {
  const runs = await Promise.all(
    testCaseIds.map((testCaseId) =>
      prisma.apiTestRun.create({
        data: { projectId, testCaseId, status: "queued" },
        select: { id: true },
      }),
    ),
  );

  // Execute sequentially to be gentle on the target API.
  void (async () => {
    for (const r of runs) {
      await runApiTest(r.id);
    }
  })();

  return runs.map((r) => r.id);
}
