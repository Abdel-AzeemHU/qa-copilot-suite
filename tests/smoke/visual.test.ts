import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ============================================================
// Mocks
// ============================================================

// --- Playwright mock ---
const mockScreenshot = vi.fn().mockResolvedValue(undefined);
const mockGoto = vi.fn().mockResolvedValue(undefined);
const mockNewPage = vi.fn().mockResolvedValue({
  goto: mockGoto,
  screenshot: mockScreenshot,
});
const mockNewContext = vi.fn().mockResolvedValue({ newPage: mockNewPage });
const mockBrowserClose = vi.fn().mockResolvedValue(undefined);
const mockLaunch = vi.fn().mockResolvedValue({
  newContext: mockNewContext,
  close: mockBrowserClose,
});

vi.mock("playwright", () => ({
  chromium: { launch: (...args: unknown[]) => mockLaunch(...args) },
}));

// --- pngjs mock ---
vi.mock("pngjs", () => {
  const FAKE_WIDTH = 10;
  const FAKE_HEIGHT = 10;
  const FAKE_DATA = Buffer.alloc(FAKE_WIDTH * FAKE_HEIGHT * 4, 128);
  // Must use a real function/class so `new PNG()` works
  function PNG(this: { data: Buffer }) {
    this.data = Buffer.alloc(FAKE_WIDTH * FAKE_HEIGHT * 4, 0);
  }
  (PNG as unknown as { sync: object }).sync = {
    read: vi.fn().mockReturnValue({ width: FAKE_WIDTH, height: FAKE_HEIGHT, data: FAKE_DATA }),
    write: vi.fn().mockReturnValue(Buffer.from("png-data")),
  };
  return { PNG };
});

// --- pixelmatch mock ---
const fakePixelmatch = vi.fn().mockReturnValue(50); // 50 changed pixels
vi.mock("pixelmatch", () => ({ default: (...args: unknown[]) => fakePixelmatch(...args) }));

// --- fs mock ---
const fakeReadFileSync = vi.fn().mockReturnValue(Buffer.from("fake-png"));
const fakeWriteFileSync = vi.fn();
const fakeMkdirSync = vi.fn();
const fakeCopyFileSync = vi.fn();
const fakeExistsSync = vi.fn().mockReturnValue(true);
const fakeUnlinkSync = vi.fn();
vi.mock("node:fs", () => ({
  default: {
    readFileSync: (...args: unknown[]) => fakeReadFileSync(...args),
    writeFileSync: (...args: unknown[]) => fakeWriteFileSync(...args),
    mkdirSync: (...args: unknown[]) => fakeMkdirSync(...args),
    copyFileSync: (...args: unknown[]) => fakeCopyFileSync(...args),
    existsSync: (...args: unknown[]) => fakeExistsSync(...args),
    unlinkSync: (...args: unknown[]) => fakeUnlinkSync(...args),
  },
  readFileSync: (...args: unknown[]) => fakeReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => fakeWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => fakeMkdirSync(...args),
  copyFileSync: (...args: unknown[]) => fakeCopyFileSync(...args),
  existsSync: (...args: unknown[]) => fakeExistsSync(...args),
  unlinkSync: (...args: unknown[]) => fakeUnlinkSync(...args),
}));

// --- Prisma mock ---
const mockVisualRunFindUnique = vi.fn();
const mockVisualRunUpdate = vi.fn().mockResolvedValue({});
const mockVisualRunCreate = vi.fn().mockResolvedValue({ id: "new-baseline-id" });
const mockVisualBaselineCreate = vi.fn().mockResolvedValue({ id: "baseline-db-id" });

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    visualRun: {
      findUnique: (...args: unknown[]) => mockVisualRunFindUnique(...args),
      update: (...args: unknown[]) => mockVisualRunUpdate(...args),
      create: (...args: unknown[]) => mockVisualRunCreate(...args),
    },
    visualBaseline: {
      create: (...args: unknown[]) => mockVisualBaselineCreate(...args),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue({ orgId: "org1" }),
    },
  },
}));

// --- getProviderForOwner mock ---
const mockGenerateStructured = vi.fn().mockResolvedValue({
  severity: "cosmetic",
  summary: "Minor color change",
  intentional: false,
  recommendation: "Investigate",
});
const mockGenerateWithVision = vi.fn().mockResolvedValue({
  severity: "layout",
  summary: "Button moved",
  intentional: false,
  recommendation: "Reject — likely regression",
});

vi.mock("@/lib/ai/get-provider", () => ({
  getProviderForOwner: vi.fn().mockResolvedValue({
    name: "claude",
    generateStructured: (...args: unknown[]) => mockGenerateStructured(...args),
    generateWithVision: (...args: unknown[]) => mockGenerateWithVision(...args),
  }),
}));

// ============================================================
// Import units under test AFTER mocks
// ============================================================

import { captureScreenshot } from "@/lib/visual/capture";
import { diffScreenshots } from "@/lib/visual/diff";
import { runVisualComparison } from "@/worker/visual-runner";
import { runVisualTriage } from "@/lib/helpers/visual-triage";

// ============================================================
// Tests
// ============================================================

describe("captureScreenshot", () => {
  beforeEach(() => {
    mockLaunch.mockClear();
    mockNewContext.mockClear();
    mockNewPage.mockClear();
    mockGoto.mockClear();
    mockScreenshot.mockClear();
    mockBrowserClose.mockClear();
  });

  it("launches chromium headless, navigates, takes fullPage screenshot, closes browser", async () => {
    await captureScreenshot({
      url: "https://example.com",
      viewport: { width: 1440, height: 900 },
      outputPath: "/tmp/test.png",
    });

    expect(mockLaunch).toHaveBeenCalledWith({ headless: true });
    expect(mockNewContext).toHaveBeenCalledWith({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });
    expect(mockGoto).toHaveBeenCalledWith("https://example.com", {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    expect(mockScreenshot).toHaveBeenCalledWith({
      path: "/tmp/test.png",
      fullPage: true,
    });
    expect(mockBrowserClose).toHaveBeenCalled();
  });

  it("closes browser even if screenshot throws", async () => {
    mockScreenshot.mockRejectedValueOnce(new Error("screenshot failed"));
    await expect(
      captureScreenshot({
        url: "https://example.com",
        viewport: { width: 390, height: 844 },
        outputPath: "/tmp/test2.png",
      }),
    ).rejects.toThrow("screenshot failed");
    expect(mockBrowserClose).toHaveBeenCalled();
  });
});

describe("diffScreenshots", () => {
  it("reads both PNGs, calls pixelmatch, writes diff, returns correct diffScore", async () => {
    const result = await diffScreenshots({
      baselinePath: "/tmp/baseline.png",
      currentPath: "/tmp/current.png",
      diffOutputPath: "/tmp/diff.png",
    });

    expect(fakeReadFileSync).toHaveBeenCalledWith("/tmp/baseline.png");
    expect(fakeReadFileSync).toHaveBeenCalledWith("/tmp/current.png");
    expect(fakePixelmatch).toHaveBeenCalled();
    expect(fakeWriteFileSync).toHaveBeenCalledWith(
      "/tmp/diff.png",
      expect.any(Buffer),
    );

    expect(result.changedPixels).toBe(50);
    expect(result.totalPixels).toBe(10 * 10); // FAKE_WIDTH * FAKE_HEIGHT
    expect(result.diffScore).toBeCloseTo(50 / (10 * 10));
    expect(result.diffImagePath).toBe("/tmp/diff.png");
  });
});

describe("runVisualComparison", () => {
  beforeEach(() => {
    mockVisualRunFindUnique.mockReset();
    mockVisualRunUpdate.mockClear();
    mockVisualBaselineCreate.mockClear();
    fakeCopyFileSync.mockClear();
    mockGenerateWithVision.mockClear();
  });

  it("baseline-capture path: no baselineId → creates baseline, marks passed", async () => {
    mockVisualRunFindUnique.mockResolvedValue({
      id: "run1",
      projectId: "proj1",
      baselineId: null,
      url: "https://example.com",
      viewport: JSON.stringify({ width: 1440, height: 900 }),
      diffThreshold: 0.01,
      project: { orgId: "org1" },
      baseline: null,
    });

    await runVisualComparison("run1");

    expect(mockVisualBaselineCreate).toHaveBeenCalled();

    const lastUpdate = mockVisualRunUpdate.mock.calls.at(-1)?.[0]?.data as Record<string, unknown>;
    expect(lastUpdate?.status).toBe("passed");
    expect(lastUpdate?.diffScore).toBe(0);
  });

  it("comparison path: with baselineId → diffs, stores results", async () => {
    mockVisualRunFindUnique.mockResolvedValue({
      id: "run2",
      projectId: "proj1",
      baselineId: "baseline1",
      url: "https://example.com",
      viewport: JSON.stringify({ width: 1440, height: 900 }),
      diffThreshold: 0.01,
      project: { orgId: "org1" },
      baseline: {
        id: "baseline1",
        imagePath: "screenshots/baselines/baseline1.png",
      },
    });

    await runVisualComparison("run2");

    const lastUpdate = mockVisualRunUpdate.mock.calls.at(-1)?.[0]?.data as Record<string, unknown>;
    expect(lastUpdate?.diffScore).toBeDefined();
    expect(lastUpdate?.diffImagePath).toBeDefined();
    // Status depends on diffScore vs threshold
    expect(["passed", "failed"]).toContain(lastUpdate?.status);
  });

  it("error path: capture fails → status=error", async () => {
    mockVisualRunFindUnique.mockResolvedValue({
      id: "run3",
      projectId: "proj1",
      baselineId: null,
      url: "https://example.com",
      viewport: JSON.stringify({ width: 1440, height: 900 }),
      diffThreshold: 0.01,
      project: { orgId: "org1" },
      baseline: null,
    });

    mockLaunch.mockRejectedValueOnce(new Error("chromium not found"));

    await runVisualComparison("run3");

    const lastUpdate = mockVisualRunUpdate.mock.calls.at(-1)?.[0]?.data as Record<string, unknown>;
    expect(lastUpdate?.status).toBe("error");
    expect(typeof lastUpdate?.errorMessage).toBe("string");
  });

  it("does nothing when run record is missing", async () => {
    mockVisualRunFindUnique.mockResolvedValue(null);
    await runVisualComparison("missing");
    expect(mockVisualRunUpdate).not.toHaveBeenCalled();
  });
});

describe("runVisualTriage", () => {
  it("validates output schema with vision provider", async () => {
    const { getProviderForOwner } = await import("@/lib/ai/get-provider");
    const provider = await (getProviderForOwner as ReturnType<typeof vi.fn>)("org1");

    const result = await runVisualTriage(
      { url: "https://example.com", diffScore: 0.05, changedPixels: 500, totalPixels: 10000 },
      "base64data",
      provider,
    );

    expect(result.severity).toBe("layout");
    expect(result.summary).toBeTruthy();
    expect(typeof result.intentional).toBe("boolean");
    expect(result.recommendation).toBeTruthy();
  });

  it("falls back to text description when generateWithVision not available", async () => {
    const textOnlyProvider = {
      name: "openai",
      generateStructured: mockGenerateStructured,
      // no generateWithVision
    };

    const result = await runVisualTriage(
      { url: "https://example.com", diffScore: 0.02, changedPixels: 200, totalPixels: 10000 },
      null,
      textOnlyProvider,
    );

    expect(mockGenerateStructured).toHaveBeenCalled();
    expect(result.severity).toBe("cosmetic");
  });
});
