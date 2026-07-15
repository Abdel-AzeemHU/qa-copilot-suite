import { prisma } from "@/lib/db/prisma";
import { dispatchSlack } from "./slack";
import { dispatchGithub } from "./github";
import { dispatchWebhook } from "./webhook";
import { createJiraBugReport, fetchJiraStories, pushTestCasesToJira } from "./jira";
import type { JiraConfig } from "./jira";
import { decrypt } from "@/lib/crypto";
import type { DispatchResult, IntegrationEvent, IntegrationRecord } from "./types";

export type { IntegrationEvent } from "./types";

const RELEVANT_TYPES: Record<IntegrationEvent["type"], string[]> = {
  "run.completed": ["slack", "webhook"],
  "bug.created": ["slack", "github", "webhook", "jira"],
  "testcases.generated": ["jira"],
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
    case "jira":
      return dispatchJira(integration, event);
    default:
      return { status: "error", error: `Unknown integration type "${integration.type}"` };
  }
}

async function dispatchJira(
  integration: IntegrationRecord,
  event: IntegrationEvent,
): Promise<DispatchResult> {
  if (!integration.encryptedSecret) {
    return { status: "error", error: "Jira integration is missing an API token" };
  }
  let token: string;
  try {
    token = decrypt(integration.encryptedSecret);
  } catch {
    return { status: "error", error: "Failed to decrypt Jira API token" };
  }
  let config: JiraConfig;
  try {
    config = JSON.parse(integration.config) as JiraConfig;
  } catch {
    return { status: "error", error: "Invalid Jira config" };
  }

  try {
    if (event.type === "bug.created") {
      let bugOutput: { title?: string; summary?: string } = {};
      try { bugOutput = JSON.parse(event.bugReport.output) as typeof bugOutput; } catch {}
      await createJiraBugReport(config, token, {
        title: bugOutput.title ?? "Bug from Qaera",
        summary: bugOutput.summary ?? "",
      });
    } else if (event.type === "testcases.generated") {
      if (event.sourceStoryKey) {
        await pushTestCasesToJira(config, token, event.sourceStoryKey, event.testCases);
      }
    }
    return { status: "success" };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

// Re-export for use in the jira stories route
export { fetchJiraStories };

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
    message: "🔔 This is a test notification from Qaera — your integration is working!",
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
