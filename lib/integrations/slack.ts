import { decrypt } from "@/lib/crypto";
import { formatEventText } from "./format";
import type {
  DispatchResult,
  IntegrationEvent,
  IntegrationRecord,
} from "./types";

/**
 * Posts a simple `text` payload (markdown) to a Slack incoming-webhook URL.
 */
export async function dispatchSlack(
  integration: IntegrationRecord,
  event: IntegrationEvent,
): Promise<DispatchResult> {
  if (!integration.encryptedSecret) {
    return { status: "error", error: "Slack integration is missing a webhook URL" };
  }

  let webhookUrl: string;
  try {
    webhookUrl = decrypt(integration.encryptedSecret);
  } catch {
    return { status: "error", error: "Failed to decrypt Slack webhook URL" };
  }

  let config: { channel?: string } = {};
  try {
    config = JSON.parse(integration.config) as { channel?: string };
  } catch {
    // ignore malformed config
  }

  const text = config.channel
    ? `[${config.channel}] ${formatEventText(event)}`
    : formatEventText(event);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        status: "error",
        error: `Slack webhook responded with ${res.status}: ${body.slice(0, 300)}`,
      };
    }
    return { status: "success" };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Failed to reach Slack",
    };
  }
}
