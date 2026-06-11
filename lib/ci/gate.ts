import { prisma } from "@/lib/db/prisma";

export type GateVerdict = "pass" | "pass_with_warnings" | "fail" | "pending";

export interface GateResult {
  verdict: GateVerdict;
  /** Human-readable reasons explaining the verdict, in priority order. */
  reasons: string[];
  /** The failure classification of the final run, if any. */
  failureClass: string | null;
  /** True when a matching quarantined flakiness report suppressed a block. */
  quarantineApplied: boolean;
}

/**
 * The merge gate: decides whether a pipeline run should block a PR.
 *
 * Unlike the raw pipeline conclusion (success/failure), the gate is
 * flakiness-aware:
 *  - succeeded                          → pass
 *  - failed, classified "flaky" AND the same code has a quarantined
 *    FlakinessReport in this project    → pass_with_warnings (don't block —
 *    the team has explicitly quarantined this known-flaky test)
 *  - failed, classified "flaky" but NOT quarantined → fail, with advice to
 *    run flakiness detection / quarantine
 *  - failed, classified "environment"   → fail, flagged as retriable
 *  - failed, "real_bug"/"automation"/unclassified → fail
 *  - still running                      → pending
 */
export async function evaluateGate(pipelineRunId: string): Promise<GateResult> {
  const pipeline = await prisma.pipelineRun.findUnique({
    where: { id: pipelineRunId },
    select: {
      id: true,
      projectId: true,
      status: true,
      finalRunId: true,
    },
  });

  if (!pipeline) {
    return {
      verdict: "fail",
      reasons: ["Pipeline run not found"],
      failureClass: null,
      quarantineApplied: false,
    };
  }

  if (pipeline.status === "queued" || pipeline.status === "running") {
    return {
      verdict: "pending",
      reasons: ["Pipeline is still running"],
      failureClass: null,
      quarantineApplied: false,
    };
  }

  if (pipeline.status === "succeeded") {
    return {
      verdict: "pass",
      reasons: ["All pipeline stages succeeded"],
      failureClass: null,
      quarantineApplied: false,
    };
  }

  // Pipeline failed/error — consult the final run's classification.
  const finalRun = pipeline.finalRunId
    ? await prisma.executionRun.findUnique({
        where: { id: pipeline.finalRunId },
        select: {
          failureClass: true,
          failureClassSummary: true,
          generatedCode: true,
        },
      })
    : null;

  const failureClass = finalRun?.failureClass ?? null;

  if (failureClass === "flaky" && finalRun) {
    const quarantined = await prisma.flakinessReport.findFirst({
      where: {
        projectId: pipeline.projectId,
        quarantined: true,
        generatedCode: finalRun.generatedCode,
      },
      select: { id: true },
    });

    if (quarantined) {
      return {
        verdict: "pass_with_warnings",
        reasons: [
          "Failure classified as flaky and this test is quarantined — not blocking the merge",
          finalRun.failureClassSummary ??
            "Known-flaky test failed; investigate when possible",
        ],
        failureClass,
        quarantineApplied: true,
      };
    }

    return {
      verdict: "fail",
      reasons: [
        "Failure classified as flaky but the test is NOT quarantined — blocking",
        "Run flakiness detection and quarantine the test if it is genuinely flaky",
        ...(finalRun.failureClassSummary ? [finalRun.failureClassSummary] : []),
      ],
      failureClass,
      quarantineApplied: false,
    };
  }

  if (failureClass === "environment") {
    return {
      verdict: "fail",
      reasons: [
        "Failure classified as an environment/infrastructure issue — retry recommended",
        ...(finalRun?.failureClassSummary ? [finalRun.failureClassSummary] : []),
      ],
      failureClass,
      quarantineApplied: false,
    };
  }

  if (failureClass === "real_bug") {
    return {
      verdict: "fail",
      reasons: [
        "Failure classified as a REAL BUG in the application — blocking the merge",
        ...(finalRun?.failureClassSummary ? [finalRun.failureClassSummary] : []),
      ],
      failureClass,
      quarantineApplied: false,
    };
  }

  if (failureClass === "automation") {
    return {
      verdict: "fail",
      reasons: [
        "Failure classified as a broken test script — fix or self-heal the automation",
        ...(finalRun?.failureClassSummary ? [finalRun.failureClassSummary] : []),
      ],
      failureClass,
      quarantineApplied: false,
    };
  }

  return {
    verdict: "fail",
    reasons: ["Pipeline failed (no AI classification available)"],
    failureClass: null,
    quarantineApplied: false,
  };
}
