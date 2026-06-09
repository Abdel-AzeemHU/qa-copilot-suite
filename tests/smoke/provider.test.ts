import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// OpenAIProvider tests — test the adapter logic directly by injecting a mock
// ---------------------------------------------------------------------------

describe("OpenAIProvider", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("constructs the correct tool-call request and parses JSON arguments", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: JSON.stringify({ result: "ok" }),
                },
              },
            ],
          },
        },
      ],
    });

    const OpenAIConstructor = vi.fn().mockImplementation(function () {
      return { chat: { completions: { create: mockCreate } } };
    }) as unknown as new (opts: { apiKey: string }) => unknown;

    vi.doMock("openai", () => ({ default: OpenAIConstructor }));

    const { OpenAIProvider } = await import("@/lib/ai/openai");
    const provider = new OpenAIProvider("sk-test-key", "gpt-4o");
    expect(provider.name).toBe("openai");

    const result = await provider.generateStructured({
      system: "You are a tester",
      userMessage: "Generate something",
      tool: {
        name: "my_tool",
        description: "A test tool",
        inputSchema: { type: "object", properties: {} },
      },
      maxTokens: 1000,
    });

    expect(result).toEqual({ result: "ok" });
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArg = mockCreate.mock.calls[0][0] as {
      model: string;
      tools: Array<{ type: string; function: { name: string } }>;
      tool_choice: { type: string; function: { name: string } };
      messages: Array<{ role: string; content: string }>;
    };
    expect(callArg.model).toBe("gpt-4o");
    expect(callArg.tools[0]?.type).toBe("function");
    expect(callArg.tools[0]?.function.name).toBe("my_tool");
    expect(callArg.tool_choice).toMatchObject({
      type: "function",
      function: { name: "my_tool" },
    });
    expect(callArg.messages[0]).toMatchObject({
      role: "system",
      content: "You are a tester",
    });
    expect(callArg.messages[1]).toMatchObject({
      role: "user",
      content: "Generate something",
    });
  });

  it("throws when no tool call is returned", async () => {
    const OpenAIConstructor = vi.fn().mockImplementation(function () {
      return {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { tool_calls: [] } }],
            }),
          },
        },
      };
    }) as unknown as new (opts: { apiKey: string }) => unknown;

    vi.doMock("openai", () => ({ default: OpenAIConstructor }));

    const { OpenAIProvider } = await import("@/lib/ai/openai");
    const provider = new OpenAIProvider("sk-test-key");

    await expect(
      provider.generateStructured({
        system: "sys",
        userMessage: "user",
        tool: {
          name: "tool",
          description: "desc",
          inputSchema: { type: "object" },
        },
      }),
    ).rejects.toThrow('did not return a tool call for tool "tool"');
  });
});

// ---------------------------------------------------------------------------
// getProviderForUser tests
// ---------------------------------------------------------------------------

describe("getProviderForUser", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns ClaudeProvider when claude key is stored and active", async () => {
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ activeProvider: "claude" }),
        },
        apiKey: {
          findMany: vi.fn().mockResolvedValue([
            { provider: "claude", encryptedKey: "encrypted-claude", config: null },
          ]),
        },
      },
    }));
    vi.doMock("@/lib/crypto", () => ({
      decrypt: vi.fn().mockReturnValue("plain-claude-key"),
    }));

    const { getProviderForUser } = await import("@/lib/ai/get-provider");
    const { ClaudeProvider } = await import("@/lib/ai/claude");
    const provider = await getProviderForUser("user-1");
    expect(provider).toBeInstanceOf(ClaudeProvider);
    expect(provider.name).toBe("claude");
  });

  it("returns OpenAIProvider when openai is active", async () => {
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ activeProvider: "openai" }),
        },
        apiKey: {
          findMany: vi.fn().mockResolvedValue([
            { provider: "openai", encryptedKey: "encrypted-openai", config: null },
          ]),
        },
      },
    }));
    vi.doMock("@/lib/crypto", () => ({
      decrypt: vi.fn().mockReturnValue("plain-openai-key"),
    }));
    const OpenAIConstructor = vi.fn().mockImplementation(function () {
      return { chat: { completions: { create: vi.fn() } } };
    }) as unknown as new (opts: { apiKey: string }) => unknown;
    vi.doMock("openai", () => ({ default: OpenAIConstructor }));

    const { getProviderForUser } = await import("@/lib/ai/get-provider");
    const { OpenAIProvider } = await import("@/lib/ai/openai");
    const provider = await getProviderForUser("user-2");
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe("openai");
  });

  it("throws when no key is found", async () => {
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ activeProvider: "claude" }),
        },
        apiKey: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    }));
    vi.doMock("@/lib/crypto", () => ({
      decrypt: vi.fn(),
    }));

    const { getProviderForUser } = await import("@/lib/ai/get-provider");
    await expect(getProviderForUser("user-3")).rejects.toThrow(
      "No API key found",
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/user/provider — switching gate test
// ---------------------------------------------------------------------------

describe("PATCH /api/user/provider", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 400 when switching to a provider with no stored key", async () => {
    vi.doMock("@/auth", () => ({
      auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
    }));
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        apiKey: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      },
    }));

    const { PATCH } = await import("@/app/api/user/provider/route");
    const req = new Request("http://localhost/api/user/provider", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeProvider: "openai" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/No API key stored for openai/);
  });

  it("switches successfully when key exists", async () => {
    vi.doMock("@/auth", () => ({
      auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
    }));
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        apiKey: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ provider: "openai", encryptedKey: "enc" }),
        },
        user: {
          update: vi.fn().mockResolvedValue({}),
        },
      },
    }));

    const { PATCH } = await import("@/app/api/user/provider/route");
    const req = new Request("http://localhost/api/user/provider", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeProvider: "openai" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      activeProvider: string;
    };
    expect(body.success).toBe(true);
    expect(body.activeProvider).toBe("openai");
  });
});
