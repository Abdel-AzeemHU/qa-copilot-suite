"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { signIn } from "@/auth";
import {
  requireUserId,
  getOrCreateDefaultOrg,
  getProjectForUser,
  getClaudeApiKeyRecord,
} from "@/lib/data";
import { ClaudeProvider } from "@/lib/ai/claude";
import { runHelper } from "@/lib/ai/run-helper";
import {
  testCaseGeneratorHelper,
  PRIORITIES,
  TEST_TYPES,
} from "@/lib/helpers/test-case-generator";

export interface ActionResult {
  error?: string;
}

// --- Auth ---

const registerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function registerAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name: name ?? null, passwordHash },
  });

  await signIn("credentials", {
    email,
    password,
    redirectTo: "/dashboard",
  });
  return {};
}

export async function loginAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
    return {};
  } catch (err) {
    // next-auth throws a redirect on success; re-throw those.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    return { error: "Invalid email or password" };
  }
}

// --- Projects ---

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
});

export async function createProjectAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const orgId = await getOrCreateDefaultOrg(userId);
  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      orgId,
    },
  });
  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}

// --- API key ---

const apiKeySchema = z.object({
  apiKey: z.string().min(10, "Enter a valid API key"),
});

export async function saveApiKeyAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = apiKeySchema.safeParse({ apiKey: formData.get("apiKey") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const encryptedKey = encrypt(parsed.data.apiKey);
  await prisma.apiKey.upsert({
    where: { userId_provider: { userId, provider: "claude" } },
    create: { userId, provider: "claude", encryptedKey },
    update: { encryptedKey },
  });
  return {};
}

// --- Test case generation ---

const generateSchema = z.object({
  projectId: z.string().min(1),
  requirement: z.string().min(1, "A requirement is required"),
  targetUrl: z.string().optional(),
  apiKey: z.string().optional(),
});

export async function generateTestCasesAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = generateSchema.safeParse({
    projectId: formData.get("projectId"),
    requirement: formData.get("requirement"),
    targetUrl: formData.get("targetUrl") || undefined,
    apiKey: formData.get("apiKey") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { projectId, requirement, targetUrl, apiKey } = parsed.data;

  const project = await getProjectForUser(projectId, userId);
  if (!project) {
    return { error: "Project not found" };
  }

  // Resolve API key: a freshly provided key is stored (encrypted) and used;
  // otherwise fall back to the stored key.
  let resolvedKey = apiKey?.trim() || "";
  if (resolvedKey) {
    const encryptedKey = encrypt(resolvedKey);
    await prisma.apiKey.upsert({
      where: { userId_provider: { userId, provider: "claude" } },
      create: { userId, provider: "claude", encryptedKey },
      update: { encryptedKey },
    });
  } else {
    const record = await getClaudeApiKeyRecord(userId);
    if (!record) {
      return {
        error:
          "No Claude API key found. Paste one into the API key field to continue.",
      };
    }
    resolvedKey = decrypt(record.encryptedKey);
  }

  let output;
  try {
    const provider = new ClaudeProvider(resolvedKey);
    output = await runHelper(
      testCaseGeneratorHelper,
      { requirement, targetUrl: targetUrl ?? "" },
      provider,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return { error: `Test case generation failed: ${message}` };
  }

  await prisma.testCase.createMany({
    data: output.cases.map((c) => ({
      projectId,
      title: c.title,
      preconditions: c.preconditions,
      steps: JSON.stringify(c.steps),
      expectedResult: c.expectedResult,
      priority: c.priority,
      type: c.type,
      requirement,
      targetUrl: targetUrl ?? null,
    })),
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

// --- Edit test case ---

const updateTestCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  preconditions: z.string().optional(),
  steps: z.string().optional(), // newline-separated
  expectedResult: z.string().optional(),
  priority: z.enum(PRIORITIES),
  type: z.enum(TEST_TYPES),
});

export async function updateTestCaseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = updateTestCaseSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    preconditions: formData.get("preconditions") || undefined,
    steps: formData.get("steps") || undefined,
    expectedResult: formData.get("expectedResult") || undefined,
    priority: formData.get("priority"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { id, title, preconditions, steps, expectedResult, priority, type } =
    parsed.data;

  // Ownership check.
  const existing = await prisma.testCase.findFirst({
    where: { id, project: { organization: { ownerId: userId } } },
    select: { id: true, projectId: true },
  });
  if (!existing) {
    return { error: "Test case not found" };
  }

  const stepsArray = (steps ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  await prisma.testCase.update({
    where: { id },
    data: {
      title,
      preconditions: preconditions ?? null,
      steps: JSON.stringify(stepsArray),
      expectedResult: expectedResult ?? null,
      priority,
      type,
    },
  });

  revalidatePath(`/projects/${existing.projectId}/test-cases/${id}`);
  redirect(`/projects/${existing.projectId}`);
}
