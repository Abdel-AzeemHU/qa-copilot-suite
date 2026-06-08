import { prisma } from "@/lib/db/prisma";
import { dispatchSlack } from "./slack";
import { dispatchGithub } from "./github";
import { dispatchWebhook } from "./webhook";
import type { DispatchResult, IntegrationEvent, IntegrationRecord } from "./types";

export type { IntegrationEvent } from "./types";

const RELEVANT_TYPES: Record<IntegrationEvent["type"], string[]> = {
  "run.completed": ["slack", "webhook"],
  "bug.created": ["slack", "github", "webhook"],
  test: ["slack", "github", "webhook"],
};

async function runDispatcher(
  integration: IntegrationRecord,
  event: IntegrationEvent,
): Promise<DispatchResult> {
  switch (integration.type) {
    case "slack":
      return dispatchSlack(integration, event);
    case "github":
      return dispatchGithub(integration, event);
    case "webhook":
      return dispatchWebhook(integration, event);
    default:
      return { status: "error", error: `Unknown integration type "${integration.type}"` };
  }
}

/**
 * Fans an event out to every enabled integration on the project whose type
 * is relevant to the event. Never throws — each dispatch is isolated and the
 * Integration row is updated with the outcome (lastTriggeredAt/lastStatus/lastError).
 */
export async function dispatchIntegrationEvent(
  projectId: string,
  event: IntegrationEvent,
): Promise<void> {
  let integrations: IntegrationRecord[];
  try {
    integrations = await prisma.integration.findMany({
      where: {
        projectId,
        enabled: true,
        type: { in: RELEVANT_TYPES[event.type] },
      },
    });
  } catch {
    return;
  }

  await Promise.all(
    integrations.map(async (integration) => {
      let result: DispatchResult;
      try {
        result = await runDispatcher(integration, event);
      } catch (err) {
        result = {
          status: "error",
          error: err instanceof Error ? err.message : "Dispatch failed unexpectedly",
        };
      }

      try {
        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            lastTriggeredAt: new Date(),
            lastStatus: result.status,
            lastError: result.status === "error" ? (result.error ?? "Unknown error") : null,
          },
        });
      } catch {
        // best-effort status tracking; never throw out of dispatch
      }
    }),
  );
}

/** Dispatches a synthetic test event through a single integration (used by the "Send test" UI action). */
export async function dispatchTestEvent(
  integration: IntegrationRecord,
): Promise<DispatchResult> {
  const event: IntegrationEvent = {
    type: "test",
    message: "🔔 This is a test notification from QA Copilot Suite — your integration is working!",
  };

  let result: DispatchResult;
  try {
    result = await runDispatcher(integration, event);
  } catch (err) {
    result = {
      status: "error",
      error: err instanceof Error ? err.message : "Dispatch failed unexpectedly",
    };
  }

  try {
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        lastTriggeredAt: new Date(),
        lastStatus: result.status,
        lastError: result.status === "error" ? (result.error ?? "Unknown error") : null,
      },
    });
  } catch {
    // ignore
  }

  return result;
}
