import { createHmac } from "node:crypto";
import { decrypt } from "@/lib/crypto";
import type {
  DispatchResult,
  IntegrationEvent,
  IntegrationRecord,
} from "./types";

/** Computes the `X-QA-Copilot-Signature` HMAC-SHA256 hex digest for a payload. */
export function computeWebhookSignature(secret: string, payload: string): string {
  return `sha256=${createHmac("sha256", secret).update(payload, "utf8").digest("hex")}`;
}

function eventEntity(event: IntegrationEvent): Record<string, unknown> {
  switch (event.type) {
    case "run.completed":
      return { run: event.run };
    case "bug.created":
      return { bugReport: event.bugReport };
    case "test":
      return { message: event.message };
  }
}

/**
 * POSTs a JSON payload `{ event, ...entity }` to the configured URL. If a
 * signing secret is stored, an `X-QA-Copilot-Signature` header is computed
 * over the raw JSON body (HMAC-SHA256), mirroring the Stripe/GitHub pattern.
 */
export async function dispatchWebhook(
  integration: IntegrationRecord,
  event: IntegrationEvent,
): Promise<DispatchResult> {
  let config: { url?: string } = {};
  try {
    config = JSON.parse(integration.config) as { url?: string };
  } catch {
    return { status: "error", error: "Webhook integration has invalid config" };
  }

  const url = config.url;
  if (!url) {
    return { status: "error", error: "Webhook integration is missing a URL" };
  }

  const payload = JSON.stringify({
    event: event.type,
    timestamp: new Date().toISOString(),
    ...eventEntity(event),
  });

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (integration.encryptedSecret) {
    try {
      const secret = decrypt(integration.encryptedSecret);
      headers["X-QA-Copilot-Signature"] = computeWebhookSignature(secret, payload);
    } catch {
      return { status: "error", error: "Failed to decrypt webhook signing secret" };
    }
  }

  try {
    const res = await fetch(url, { method: "POST", headers, body: payload });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        status: "error",
        error: `Webhook responded with ${res.status}: ${body.slice(0, 300)}`,
      };
    }
    return { status: "success" };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Failed to reach webhook URL",
    };
  }
}
