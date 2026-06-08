import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.ENCRYPTION_KEY ??= "test-encryption-key-xxxxxxxxxxxx";

import { encrypt } from "@/lib/crypto";
import { computeWebhookSignature } from "@/lib/integrations/webhook";

// --- Mocks ---

const integrationUpdates: Array<{ id: unknown; data: Record<string, unknown> }> = [];
const findManyIntegrations = vi.fn();
const updateIntegration = vi.fn(
  async ({ where, data }: { where: { id: unknown }; data: Record<string, unknown> }) => {
    integrationUpdates.push({ id: where.id, data });
    return {};
  },
);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    integration: {
      findMany: (...args: unknown[]) => findManyIntegrations(...args),
      update: (...args: unknown[]) => updateIntegration(...args),
    },
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { dispatchIntegrationEvent } from "@/lib/integrations/dispatch";

const SECRET = "super-secret-value";

function makeIntegration(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "int1",
    projectId: "proj1",
    type: "slack",
    name: "Test integration",
    config: "{}",
    encryptedSecret: encrypt(SECRET),
    enabled: true,
    ...overrides,
  };
}

describe("computeWebhookSignature", () => {
  it("computes a stable sha256 HMAC hex digest prefixed with sha256=", () => {
    const sig = computeWebhookSignature("my-secret", '{"hello":"world"}');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    // deterministic for the same inputs
    expect(computeWebhookSignature("my-secret", '{"hello":"world"}')).toBe(sig);
    // differs when payload changes
    expect(computeWebhookSignature("my-secret", '{"hello":"there"}')).not.toBe(sig);
  });
});

describe("dispatchIntegrationEvent", () => {
  beforeEach(() => {
    integrationUpdates.length = 0;
    findManyIntegrations.mockReset();
    updateIntegration.mockClear();
    fetchMock.mockReset();
  });

  it("posts a formatted text payload to a Slack webhook and records success", async () => {
    const integration = makeIntegration({
      type: "slack",
      config: JSON.stringify({ channel: "#qa" }),
      encryptedSecret: encrypt("https://hooks.slack.com/services/T000/B000/XXXX"),
    });
    findManyIntegrations.mockResolvedValue([integration]);
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });

    await dispatchIntegrationEvent("proj1", {
      type: "run.completed",
      run: {
        id: "run12345678",
        projectId: "proj1",
        status: "passed",
        result: "passed",
        targetUrl: "https://example.com",
        errorMessage: null,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.slack.com/services/T000/B000/XXXX");
    const body = JSON.parse(init.body as string) as { text: string };
    expect(body.text).toContain("#qa");
    expect(body.text).toContain("run12345");
    expect(body.text.toLowerCase()).toContain("passed");

    expect(integrationUpdates).toHaveLength(1);
    expect(integrationUpdates[0].data.lastStatus).toBe("success");
    expect(integrationUpdates[0].data.lastError).toBeNull();
  });

  it("creates a GitHub issue for bug.created events and records errors on non-2xx", async () => {
    const integration = makeIntegration({
      type: "github",
      config: JSON.stringify({ repo: "my-org/my-repo" }),
      encryptedSecret: encrypt("ghp_faketoken"),
    });
    findManyIntegrations.mockResolvedValue([integration]);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "Validation failed",
    });

    await dispatchIntegrationEvent("proj1", {
      type: "bug.created",
      bugReport: {
        id: "bug12345678",
        projectId: "proj1",
        output: JSON.stringify({
          title: "Login button is unresponsive",
          summary: "Clicking login does nothing",
          severity: "high",
          expectedBehavior: "User is logged in",
          actualBehavior: "Nothing happens",
        }),
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://api.github.com/repos/my-org/my-repo/issues");
    expect(init.headers.Authorization).toBe("Bearer ghp_faketoken");
    expect(init.headers.Accept).toBe("application/vnd.github+json");
    const body = JSON.parse(init.body as string) as { title: string; body: string };
    expect(body.title).toBe("Login button is unresponsive");
    expect(body.body).toContain("Expected behavior");

    expect(integrationUpdates).toHaveLength(1);
    expect(integrationUpdates[0].data.lastStatus).toBe("error");
    expect(integrationUpdates[0].data.lastError).toContain("422");
  });

  it("signs generic webhook payloads with HMAC-SHA256 when a secret is configured", async () => {
    const secret = "webhook-signing-secret";
    const integration = makeIntegration({
      type: "webhook",
      config: JSON.stringify({ url: "https://example.com/hooks/qa" }),
      encryptedSecret: encrypt(secret),
    });
    findManyIntegrations.mockResolvedValue([integration]);
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });

    await dispatchIntegrationEvent("proj1", {
      type: "bug.created",
      bugReport: {
        id: "bug1",
        projectId: "proj1",
        output: JSON.stringify({ title: "Some bug" }),
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://example.com/hooks/qa");
    const payload = init.body as string;
    const expectedSig = computeWebhookSignature(secret, payload);
    expect(init.headers["X-QA-Copilot-Signature"]).toBe(expectedSig);

    const parsed = JSON.parse(payload) as { event: string; bugReport: { id: string } };
    expect(parsed.event).toBe("bug.created");
    expect(parsed.bugReport.id).toBe("bug1");

    expect(integrationUpdates[0].data.lastStatus).toBe("success");
  });

  it("never throws when fetch rejects, and records the error", async () => {
    const integration = makeIntegration({
      type: "webhook",
      config: JSON.stringify({ url: "https://example.com/hooks/qa" }),
      encryptedSecret: null,
    });
    findManyIntegrations.mockResolvedValue([integration]);
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      dispatchIntegrationEvent("proj1", {
        type: "run.completed",
        run: {
          id: "run1",
          projectId: "proj1",
          status: "failed",
          result: "failed",
          targetUrl: "https://example.com",
          errorMessage: "boom",
        },
      }),
    ).resolves.toBeUndefined();

    expect(integrationUpdates[0].data.lastStatus).toBe("error");
    expect(integrationUpdates[0].data.lastError).toContain("network down");
  });

  it("only dispatches to integrations of relevant types for the event", async () => {
    findManyIntegrations.mockResolvedValue([]);

    await dispatchIntegrationEvent("proj1", {
      type: "run.completed",
      run: {
        id: "run1",
        projectId: "proj1",
        status: "passed",
        result: "passed",
        targetUrl: "https://example.com",
        errorMessage: null,
      },
    });

    expect(findManyIntegrations).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { in: ["slack", "webhook"] },
        }),
      }),
    );
  });
});
