import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";
import { ClaudeProvider } from "./claude";
import { OpenAIProvider } from "./openai";
import type { LLMProvider } from "./provider";

/**
 * Returns the appropriate LLMProvider for a given user. Uses the user's
 * activeProvider setting to choose; falls back to whichever key exists if only
 * one is stored. Throws if no API key is found.
 */
export async function getProviderForUser(userId: string): Promise<LLMProvider> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeProvider: true },
  });

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: { provider: true, encryptedKey: true, config: true },
  });

  const activeProvider = user?.activeProvider ?? "claude";

  // Try the user's preferred provider first, then fall back to any available key.
  const preferred = apiKeys.find((k) => k.provider === activeProvider);
  const fallback = apiKeys[0];
  const keyRecord = preferred ?? fallback;

  if (!keyRecord) {
    throw new Error(
      "No API key found. Add a Claude or OpenAI API key in Settings to continue.",
    );
  }

  const apiKey = decrypt(keyRecord.encryptedKey);
  const model = keyRecord.config
    ? (JSON.parse(keyRecord.config) as { model?: string }).model
    : undefined;

  if (keyRecord.provider === "openai") {
    return new OpenAIProvider(apiKey, model ?? "gpt-4o");
  }
  return new ClaudeProvider(apiKey);
}

/**
 * Returns the LLMProvider for the owner of an organization. Used by workers
 * that only have access to an org ID, not a user session.
 */
export async function getProviderForOwner(orgId: string): Promise<LLMProvider> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  });

  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  return getProviderForUser(org.ownerId);
}
