import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { captureScreenshot } from "@/lib/visual/capture";
import { diffScreenshots } from "@/lib/visual/diff";
import { runVisualTriage } from "@/lib/helpers/visual-triage";
import { getProviderForOwner } from "@/lib/ai/get-provider";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const SCREENSHOTS_DIR = path.join(PUBLIC_DIR, "screenshots");
const RUNS_DIR = path.join(SCREENSHOTS_DIR, "runs");
const BASELINES_DIR = path.join(SCREENSHOTS_DIR, "baselines");
const DIFFS_DIR = path.join(SCREENSHOTS_DIR, "diffs");

function ensureDirs() {
  for (const d of [SCREENSHOTS_DIR, RUNS_DIR, BASELINES_DIR, DIFFS_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export async function runVisualComparison(
  visualRunId: string,
  opts?: { baselineName?: string },
): Promise<void> {
  const run = await prisma.visualRun.findUnique({
    where: { id: visualRunId },
    include: { baseline: true, project: { select: { orgId: true } } },
  });
  if (!run) return;

  try {
    await prisma.visualRun.update({
      where: { id: visualRunId },
      data: { status: "running", startedAt: new Date() },
    });

    ensureDirs();

    const viewport = JSON.parse(run.viewport) as { width: number; height: number };

    // Capture current screenshot
    const currentImageFile = path.join(RUNS_DIR, `${visualRunId}.png`);
    await captureScreenshot({
      url: run.url,
      viewport,
      outputPath: currentImageFile,
    });

    const currentImagePath = `screenshots/runs/${visualRunId}.png`;

    // --- Baseline capture path ---
    if (!run.baselineId) {
      const baselineFile = path.join(BASELINES_DIR, `${visualRunId}.png`);
      fs.copyFileSync(currentImageFile, baselineFile);
      const baselineImagePath = `screenshots/baselines/${visualRunId}.png`;

      const baseline = await prisma.visualBaseline.create({
        data: {
          projectId: run.projectId,
          name: opts?.baselineName ?? `Baseline ${new Date().toISOString()}`,
          url: run.url,
          viewport: run.viewport,
          imagePath: baselineImagePath,
        },
      });

      await prisma.visualRun.update({
        where: { id: visualRunId },
        data: {
          status: "passed",
          imagePath: currentImagePath,
          diffScore: 0,
          baselineId: baseline.id,
          completedAt: new Date(),
        },
      });
      return;
    }

    // --- Comparison path ---
    const baseline = run.baseline!;
    const baselineAbsPath = path.join(PUBLIC_DIR, baseline.imagePath);
    const diffFile = path.join(DIFFS_DIR, `${visualRunId}.png`);

    const diffResult = await diffScreenshots({
      baselinePath: baselineAbsPath,
      currentPath: currentImageFile,
      diffOutputPath: diffFile,
    });

    const diffImagePath = `screenshots/diffs/${visualRunId}.png`;

    // AI triage
    let aiSeverity: string | null = null;
    let aiSummary: string | null = null;
    let aiIntentional: boolean | null = null;
    let aiRecommendation: string | null = null;

    try {
      const orgId = run.project.orgId;
      const provider = await getProviderForOwner(orgId);
      const diffImageBase64 = fs.readFileSync(diffFile).toString("base64");

      const triage = await runVisualTriage(
        {
          url: run.url,
          diffScore: diffResult.diffScore,
          changedPixels: diffResult.changedPixels,
          totalPixels: diffResult.totalPixels,
        },
        diffImageBase64,
        provider,
      );

      aiSeverity = triage.severity;
      aiSummary = triage.summary;
      aiIntentional = triage.intentional;
      aiRecommendation = triage.recommendation;
    } catch {
      // AI triage is non-critical — continue without it
    }

    const status = diffResult.diffScore > run.diffThreshold ? "failed" : "passed";

    await prisma.visualRun.update({
      where: { id: visualRunId },
      data: {
        status,
        imagePath: currentImagePath,
        diffImagePath,
        diffScore: diffResult.diffScore,
        aiSeverity,
        aiSummary,
        aiIntentional,
        completedAt: new Date(),
        // Store recommendation in aiSummary if needed — or keep separate note
        // (schema doesn't have aiRecommendation field; we append it to summary)
        ...(aiRecommendation && aiSummary
          ? { aiSummary: `${aiSummary} [${aiRecommendation}]` }
          : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.visualRun
      .update({
        where: { id: visualRunId },
        data: { status: "error", errorMessage: message, completedAt: new Date() },
      })
      .catch(() => {});
  }
}
