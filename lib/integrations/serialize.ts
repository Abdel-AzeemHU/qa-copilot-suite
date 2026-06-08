export interface IntegrationRow {
  id: string;
  type: string;
  name: string;
  config: string;
  encryptedSecret: string | null;
  enabled: boolean;
  lastTriggeredAt: Date | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: Date;
}

/** Shapes an Integration row for client responses — never exposes secrets. */
export function serializeIntegration(integration: IntegrationRow) {
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(integration.config) as Record<string, unknown>;
  } catch {
    // ignore malformed config
  }

  return {
    id: integration.id,
    type: integration.type,
    name: integration.name,
    config,
    enabled: integration.enabled,
    hasSecret: Boolean(integration.encryptedSecret),
    lastTriggeredAt: integration.lastTriggeredAt
      ? integration.lastTriggeredAt.toISOString()
      : null,
    lastStatus: integration.lastStatus,
    lastError: integration.lastError,
    createdAt: integration.createdAt.toISOString(),
  };
}
