"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";
import {
  requireUserId,
  getProjectForUser,
  getClaudeApiKeyRecord,
} from "@/lib/data";
import { ClaudeProvider } from "@/lib/ai/claude";
import { dispatchIntegrationEvent } from "@/lib/integrations/dispatch";
import { runHelper } from "@/lib/ai/run-helper";
import type { LLMProvider } from "@/lib/ai/provider";
import {
  automationCodeGeneratorHelper,
  FRAMEWORKS,
  LANGUAGES,
} from "@/lib/helpers/automation-code-generator";
import { testPlannerHelper } from "@/lib/helpers/test-planner";
import {
  bugReporterHelper,
  SEVERITIES,
} from "@/lib/helpers/bug-reporter";
import {
  staticReviewHelper,
  ARTIFACT_TYPES,
} from "@/lib/helpers/static-review";

export interface ActionResult {
  error?: string;
}

/**
 * Resolves the user's Claude provider using their stored, encrypted API key.
 * Returns either a provider or an error message.
 */
async function resolveProvider(
  userId: string,
): Promise<{ provider?: LLMProvider; error?: string }> {
  const record = await getClaudeApiKeyRecord(userId);
  if (!record) {
    return {
      error:
        "No Claude API key found. Add one on the Generate test cases page first.",
    };
  }
  const key = decrypt(record.encryptedKey);
  return { provider: new ClaudeProvider(key) };
}

// --- Automation code generator ---

export async function generateAutomationCode(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const projectId = String(formData.get("projectId") ?? "");
  const framework = String(formData.get("framework") ?? "");
  const language = String(formData.get("language") ?? "");

  if (!FRAMEWORKS.includes(framework as (typeof FRAMEWORKS)[number])) {
    return { error: "Invalid framework" };
  }
  if (!LANGUAGES.includes(language as (typeof LANGUAGES)[number])) {
    return { error: "Invalid language" };
  }

  const project = await getProjectForUser(projectId, userId);
  if (!project) return { error: "Project not found" };
  if (project.testCases.length === 0) {
    return { error: "This project has no test cases to automate yet." };
  }

  const { provider, error } = await resolveProvider(userId);
  if (!provider) return { error };

  const testCases = project.testCases.map((tc) => ({
    title: tc.title,
    preconditions: tc.preconditions ?? undefined,
    steps: JSON.parse(tc.steps) as string[],
    expectedResult: tc.expectedResult ?? undefined,
  }));

  try {
    const output = await runHelper(
      automationCodeGeneratorHelper,
      {
        framework: framework as (typeof FRAMEWORKS)[number],
        language: language as (typeof LANGUAGES)[number],
        testCases,
      },
      provider,
    );
    await prisma.automationRun.create({
      data: {
        projectId,
        framework,
        language,
        files: JSON.stringify(output.files),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return { error: `Automation code generation failed: ${message}` };
  }

  revalidatePath(`/projects/${projectId}/automation`);
  return {};
}

// --- Test planner ---

export async function generateTestPlan(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const projectId = String(formData.get("projectId") ?? "");
  const input = {
    description: String(formData.get("description") ?? ""),
    scope: String(formData.get("scope") ?? ""),
    teamSize: Number(formData.get("teamSize") ?? 0),
    sprintLengthDays: Number(formData.get("sprintLengthDays") ?? 0),
  };

  const project = await getProjectForUser(projectId, userId);
  if (!project) return { error: "Project not found" };

  const { provider, error } = await resolveProvider(userId);
  if (!provider) return { error };

  try {
    const output = await runHelper(testPlannerHelper, input, provider);
    await prisma.testPlan.create({
      data: {
        projectId,
        input: JSON.stringify(input),
        output: JSON.stringify(output),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return { error: `Test plan generation failed: ${message}` };
  }

  revalidatePath(`/projects/${projectId}/test-plan`);
  return {};
}

// --- Bug reporter ---

export async function generateBugReport(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const projectId = String(formData.get("projectId") ?? "");
  const severity = String(formData.get("severity") ?? "");
  if (!SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) {
    return { error: "Invalid severity" };
  }
  const input = {
    description: String(formData.get("description") ?? ""),
    stepsToReproduce: String(formData.get("stepsToReproduce") ?? ""),
    environment: String(formData.get("environment") ?? ""),
    severity: severity as (typeof SEVERITIES)[number],
  };

  const project = await getProjectForUser(projectId, userId);
  if (!project) return { error: "Project not found" };

  const { provider, error } = await resolveProvider(userId);
  if (!provider) return { error };

  try {
    const output = await runHelper(bugReporterHelper, input, provider);
    const bugReport = await prisma.bugReport.create({
      data: {
        projectId,
        input: JSON.stringify(input),
        output: JSON.stringify(output),
      },
    });

    dispatchIntegrationEvent(bugReport.projectId, {
      type: "bug.created",
      bugReport: {
        id: bugReport.id,
        projectId: bugReport.projectId,
        output: bugReport.output,
      },
    }).catch(() => {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return { error: `Bug report generation failed: ${message}` };
  }

  revalidatePath(`/projects/${projectId}/bug-report`);
  return {};
}

// --- Static review ---

export async function runStaticReview(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const projectId = String(formData.get("projectId") ?? "");
  const artifactType = String(formData.get("artifactType") ?? "");
  if (
    !ARTIFACT_TYPES.includes(artifactType as (typeof ARTIFACT_TYPES)[number])
  ) {
    return { error: "Invalid artifact type" };
  }
  const input = {
    artifactType: artifactType as (typeof ARTIFACT_TYPES)[number],
    text: String(formData.get("text") ?? ""),
  };

  const project = await getProjectForUser(projectId, userId);
  if (!project) return { error: "Project not found" };

  const { provider, error } = await resolveProvider(userId);
  if (!provider) return { error };

  try {
    const output = await runHelper(staticReviewHelper, input, provider);
    await prisma.staticReview.create({
      data: {
        projectId,
        input: JSON.stringify(input),
        output: JSON.stringify(output),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review failed";
    return { error: `Static review failed: ${message}` };
  }

  revalidatePath(`/projects/${projectId}/review`);
  return {};
}
