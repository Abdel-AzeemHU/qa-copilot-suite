import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { parsePlaywrightScript } from "@/lib/recorder/parse-actions";
import { toRunnableScript } from "@/lib/recorder/to-runnable";
import { runHelper } from "@/lib/ai/run-helper";
import type { LLMProvider } from "@/lib/ai/provider";
import {
  recordingSummarizerHelper,
  recordingSummarizerOutputSchema,
} from "@/lib/helpers/recording-summarizer";

// --- parse-actions -------------------------------------------------------

const SAMPLE_CODEGEN = `
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.getByLabel('Email').fill('x@y.com');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Welcome')).toBeVisible();
});
`;

describe("parsePlaywrightScript", () => {
  const actions = parsePlaywrightScript(SAMPLE_CODEGEN);

  it("parses navigation", () => {
    const nav = actions[0];
    expect(nav.type).toBe("navigate");
    expect(nav.humanText).toContain("https://example.com/login");
  });

  it("parses fill with label into human text", () => {
    const email = actions.find((a) => a.target === "Email field");
    expect(email?.type).toBe("fill");
    expect(email?.humanText).toBe("Type 'x@y.com' into the Email field");
  });

  it("masks password values", () => {
    const pw = actions.find((a) => a.target === "Password field");
    expect(pw?.type).toBe("fill");
    expect(pw?.value).toBe("••••");
    expect(pw?.humanText).not.toContain("hunter2");
    expect(pw?.humanText).toContain("••••");
  });

  it("parses click with role + name", () => {
    const click = actions.find((a) => a.type === "click");
    expect(click?.target).toBe("'Submit' button");
    expect(click?.humanText).toBe("Click the 'Submit' button");
  });

  it("parses keyboard press", () => {
    const press = actions.find((a) => a.type === "press");
    expect(press?.value).toBe("Enter");
  });

  it("parses assertions", () => {
    const assert = actions.find((a) => a.type === "assert");
    expect(assert?.humanText).toContain("Verify");
  });
});

// --- to-runnable ---------------------------------------------------------

describe("toRunnableScript", () => {
  const out = toRunnableScript(SAMPLE_CODEGEN);

  it("imports from the playwright package (not @playwright/test)", () => {
    expect(out).toContain("import { chromium } from 'playwright'");
    expect(out).not.toContain("@playwright/test");
  });

  it("wraps the body in an async IIFE and launches a browser", () => {
    expect(out).toMatch(/\(async \(\) => \{/);
    expect(out).toContain("await chromium.launch()");
  });

  it("reads the base URL from the runtime env", () => {
    expect(out).toContain(
      "process.env.PLAYWRIGHT_TARGET_URL ?? process.env.TARGET_URL",
    );
    expect(out).toContain("page.goto(baseUrl)");
  });

  it("preserves recorded actions", () => {
    expect(out).toContain("getByRole('button', { name: 'Submit' }).click()");
  });
});

// --- recording-summarizer helper ----------------------------------------

function makeMockProvider(payload: unknown): LLMProvider {
  return {
    name: "mock",
    generateStructured: vi.fn().mockResolvedValue(payload),
  };
}

const validOutput = {
  title: "User logs in successfully",
  description: "Verifies the login flow.",
  preconditions: "A registered user exists.",
  expectedResult: "The dashboard is shown.",
  priority: "high",
  type: "functional",
  suggestedAssertions: ["URL changes to /dashboard"],
};

describe("recording-summarizer helper", () => {
  const input = {
    startUrl: "https://example.com/login",
    actions: parsePlaywrightScript(SAMPLE_CODEGEN),
  };

  it("validates input, calls provider, returns schema-valid output", async () => {
    const provider = makeMockProvider(validOutput);
    const result = await runHelper(recordingSummarizerHelper, input, provider);
    expect(() =>
      recordingSummarizerOutputSchema.parse(result),
    ).not.toThrow();
    const call = (provider.generateStructured as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.tool.name).toBe("record_test_case");
    expect(call.userMessage).toContain("https://example.com/login");
  });

  it("rejects bad output", async () => {
    const provider = makeMockProvider({ title: "x" });
    await expect(
      runHelper(recordingSummarizerHelper, input, provider),
    ).rejects.toThrow();
  });

  it("rejects empty action list on input", () => {
    expect(() =>
      recordingSummarizerHelper.inputSchema.parse({
        startUrl: "x",
        actions: [],
      }),
    ).toThrow();
  });
});

// --- session registry ----------------------------------------------------

const spawnMock = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));
vi.mock("node:fs/promises", () => ({
  mkdtemp: vi.fn().mockResolvedValue("/tmp/qa-recorder-test"),
  readFile: vi.fn().mockResolvedValue(SAMPLE_CODEGEN),
  rm: vi.fn().mockResolvedValue(undefined),
}));

function makeCodegenChild(): EventEmitter & {
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  killed: boolean;
} {
  const child = new EventEmitter() as EventEmitter & {
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
    killed: boolean;
  };
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = vi.fn(() => {
    // Emulate codegen exiting after a kill request.
    setImmediate(() => child.emit("exit", 0));
    return true;
  });
  return child;
}

describe("recorder session registry", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("start registers a session; stop removes it and parses actions", async () => {
    vi.useFakeTimers();
    const child = makeCodegenChild();
    spawnMock.mockReturnValue(child);

    const { startRecording, stopRecording, _getSessions } = await import(
      "@/lib/recorder/launch-recorder"
    );

    const startP = startRecording({ startUrl: "https://example.com" });
    // Advance past the 1500ms probe window — process stays alive.
    await vi.advanceTimersByTimeAsync(1600);
    const started = await startP;
    vi.useRealTimers();

    expect("sessionId" in started).toBe(true);
    if (!("sessionId" in started)) return;
    expect(_getSessions().has(started.sessionId)).toBe(true);

    const result = await stopRecording(started.sessionId);
    expect(_getSessions().has(started.sessionId)).toBe(false);
    expect("actions" in result).toBe(true);
    if ("actions" in result) {
      expect(result.actions.length).toBeGreaterThan(0);
      expect(child.kill).toHaveBeenCalled();
    }
  });

  it("returns RECORDER_UNAVAILABLE when codegen exits immediately", async () => {
    const child = makeCodegenChild();
    spawnMock.mockReturnValue(child);

    const { startRecording } = await import(
      "@/lib/recorder/launch-recorder"
    );

    const startP = startRecording({ startUrl: "https://example.com" });
    // Simulate an immediate launch failure (no display) on the next tick.
    setImmediate(() => {
      child.stderr.emit("data", Buffer.from("Missing X server or $DISPLAY"));
      child.emit("exit", 1);
    });
    const res = await startP;

    expect("error" in res && res.error).toBe("RECORDER_UNAVAILABLE");
  });
});
