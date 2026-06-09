import { prisma } from "@/lib/db/prisma";
import { getProviderForOwner } from "@/lib/ai/get-provider";
import { runHelper } from "@/lib/ai/run-helper";
import { selectorHealerHelper } from "@/lib/helpers/selector-healer";
import type { DomCandidate } from "./extract-dom";

export async function healSelector(params: {
  projectId: string;
  orgId: string;
  originalSelector: string;
  errorMessage: string;
  domCandidates: DomCandidate[];
  description?: string;
}): Promise<string | null> {
  const { projectId, orgId, originalSelector, errorMessage, domCandidates, description } = params;

  // 1. Cache lookup
  const cached = await prisma.selectorCache.findUnique({
    where: {
      projectId_originalSelector: { projectId, originalSelector },
    },
  });

  if (cached) {
    await prisma.selectorCache.update({
      where: { id: cached.id },
      data: { hitCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    return cached.healedSelector;
  }

  // 2. LLM call
  let result: { healedSelector: string; strategy: string; confidence: number } | null = null;
  try {
    const provider = await getProviderForOwner(orgId);
    result = await runHelper(
      selectorHealerHelper,
      { originalSelector, errorMessage, domCandidates, description },
      provider,
    );
  } catch {
    return null;
  }

  if (!result) return null;

  // 3. Cache store
  await prisma.selectorCache.upsert({
    where: { projectId_originalSelector: { projectId, originalSelector } },
    create: {
      projectId,
      originalSelector,
      healedSelector: result.healedSelector,
      strategy: result.strategy,
      confidence: result.confidence,
      hitCount: 1,
      lastUsedAt: new Date(),
    },
    update: {
      healedSelector: result.healedSelector,
      strategy: result.strategy,
      confidence: result.confidence,
      hitCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  return result.healedSelector;
}
