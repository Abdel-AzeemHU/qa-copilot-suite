import { prisma } from "@/lib/db/prisma";
import { checkContract, type ContractIssue } from "@/lib/api-testing/contract";

const REQUEST_TIMEOUT_MS = 15000;
const SAFE_METHODS = new Set(["GET", "HEAD"]);

/**
 * Runs a contract check for every endpoint of an ApiSpec against the live API:
 * probes each endpoint and verifies the response matches the documented
 * contract (status codes + response schema structure).
 *
 * Safety: by default only GET/HEAD endpoints are probed; POST/PUT/PATCH/DELETE
 * are skipped unless the run was created with includeUnsafe (they can mutate
 * real data). Path parameters are substituted with example values from the
 * spec where available, else "1".
 */
export async function runContractCheck(contractRunId: string): Promise<void> {
  const run = await prisma.contractRun.findUnique({
    where: { id: contractRunId },
    select: {
      id: true,
      includeUnsafe: true,
      apiSpec: {
        select: {
          baseUrl: true,
          endpoints: {
            select: {
              id: true,
              method: true,
              path: true,
              parameters: true,
              responses: true,
            },
            orderBy: [{ path: "asc" }, { method: "asc" }],
          },
        },
      },
    },
  });
  if (!run) return;

  await prisma.contractRun.update({
    where: { id: contractRunId },
    data: { status: "running", startedAt: new Date() },
  });

  try {
    const baseUrl = run.apiSpec.baseUrl;
    if (!baseUrl) {
      throw new Error(
        "The API spec has no base URL — re-import it with servers/baseUrl set.",
      );
    }

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const ep of run.apiSpec.endpoints) {
      const method = ep.method.toUpperCase();

      if (!SAFE_METHODS.has(method) && !run.includeUnsafe) {
        skipped++;
        await prisma.contractResult.create({
          data: {
            contractRunId,
            endpointId: ep.id,
            method,
            path: ep.path,
            status: "skipped",
            detail:
              "Non-GET method skipped for safety — enable 'include unsafe methods' to probe it",
          },
        });
        continue;
      }

      const url = buildProbeUrl(baseUrl, ep.path, ep.parameters);
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(url, {
            method,
            signal: controller.signal,
            redirect: "manual",
            headers: { accept: "application/json" },
          });
        } finally {
          clearTimeout(timer);
        }
        const bodyText = method === "HEAD" ? "" : await res.text();
        const durationMs = Date.now() - start;

        const documented = JSON.parse(ep.responses) as Record<string, never>;
        const issues: ContractIssue[] =
          method === "HEAD"
            ? []
            : checkContract(documented, {
                status: res.status,
                bodyText,
                contentType: res.headers.get("content-type") ?? "",
              });

        const violations = issues.filter((i) => i.severity === "violation");
        const ok = violations.length === 0;
        if (ok) passed++;
        else failed++;

        await prisma.contractResult.create({
          data: {
            contractRunId,
            endpointId: ep.id,
            method,
            path: ep.path,
            status: ok ? "passed" : "failed",
            responseCode: res.status,
            durationMs,
            issues: JSON.stringify(issues.map((i) => `${i.severity}: ${i.message}`)),
          },
        });
      } catch (err) {
        failed++;
        await prisma.contractResult.create({
          data: {
            contractRunId,
            endpointId: ep.id,
            method,
            path: ep.path,
            status: "error",
            durationMs: Date.now() - start,
            detail: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }

    await prisma.contractRun.update({
      where: { id: contractRunId },
      data: {
        status: failed > 0 ? "failed" : "passed",
        totalEndpoints: run.apiSpec.endpoints.length,
        passedCount: passed,
        failedCount: failed,
        skippedCount: skipped,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.contractRun.update({
      where: { id: contractRunId },
      data: {
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
  }
}

/** Substitutes {param} placeholders with example values from the spec, else "1". */
function buildProbeUrl(baseUrl: string, path: string, parametersJson: string): string {
  let examples: Record<string, string> = {};
  try {
    const params = JSON.parse(parametersJson) as Array<{
      name?: string;
      in?: string;
      example?: unknown;
      schema?: { example?: unknown; default?: unknown };
    }>;
    for (const p of params) {
      if (p.in === "path" && p.name) {
        const ex = p.example ?? p.schema?.example ?? p.schema?.default;
        examples[p.name] = ex != null ? String(ex) : "1";
      }
    }
  } catch {
    examples = {};
  }

  const concrete = path.replace(/\{([^}]+)\}/g, (_, name: string) =>
    encodeURIComponent(examples[name] ?? "1"),
  );
  const base = baseUrl.replace(/\/+$/, "");
  return base + (concrete.startsWith("/") ? concrete : `/${concrete}`);
}
