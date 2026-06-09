"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// --- Types ---

interface VisualBaseline {
  id: string;
  name: string;
  url: string;
  viewport: string;
  imagePath: string;
  createdAt: string;
  runs: Array<{
    status: string;
    diffScore: number | null;
    aiSeverity: string | null;
    createdAt: string;
  }>;
}

interface VisualRun {
  id: string;
  url: string;
  viewport: string;
  status: string;
  diffScore: number | null;
  aiSeverity: string | null;
  aiSummary: string | null;
  baselineId: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface VisualRunDetail extends VisualRun {
  imagePath: string | null;
  diffImagePath: string | null;
  baseline: { id: string; name: string; imagePath: string } | null;
}

// --- Helpers ---

function viewportLabel(viewport: string): string {
  try {
    const v = JSON.parse(viewport) as { width: number; height: number };
    if (v.width >= 1200) return "Desktop";
    if (v.width <= 500) return "Mobile";
    return `${v.width}×${v.height}`;
  } catch {
    return viewport;
  }
}

function diffColor(score: number | null): "secondary" | "low" | "medium" | "high" {
  if (score === null) return "secondary";
  if (score < 0.01) return "low";
  if (score < 0.05) return "medium";
  return "high";
}

function severityColor(s: string | null): "secondary" | "low" | "medium" | "high" {
  if (!s || s === "none") return "secondary";
  if (s === "cosmetic") return "low";
  if (s === "layout") return "medium";
  return "high";
}

function fmtScore(score: number | null): string {
  if (score === null) return "—";
  return `${(score * 100).toFixed(2)}%`;
}

// --- Component ---

export function VisualDashboard({ projectId }: { projectId: string }) {
  const [baselines, setBaselines] = useState<VisualBaseline[]>([]);
  const [runs, setRuns] = useState<VisualRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<VisualRunDetail | null>(null);
  const [diffViewOpen, setDiffViewOpen] = useState(false);

  // New baseline form
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newViewport, setNewViewport] = useState("desktop");
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [bRes, rRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/visual/baselines`),
      fetch(`/api/projects/${projectId}/visual/runs`),
    ]);
    if (bRes.ok) setBaselines((await bRes.json() as { baselines: VisualBaseline[] }).baselines);
    if (rRes.ok) setRuns((await rRes.json() as { runs: VisualRun[] }).runs);
  }, [projectId]);

  useEffect(() => {
    void fetchData();
    const id = setInterval(() => { void fetchData(); }, 5000);
    return () => clearInterval(id);
  }, [fetchData]);

  async function captureBaseline() {
    if (!newName || !newUrl) return;
    setCaptureError(null);
    setCapturing(true);
    try {
      const viewportMap: Record<string, { width: number; height: number }> = {
        desktop: { width: 1440, height: 900 },
        mobile: { width: 390, height: 844 },
      };
      const viewport = viewportMap[newViewport] ?? viewportMap["desktop"]!;
      const res = await fetch(`/api/projects/${projectId}/visual/baselines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, url: newUrl, viewport }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        setCaptureError(err.error ?? "Failed to start capture");
      } else {
        setNewName("");
        setNewUrl("");
        void fetchData();
      }
    } finally {
      setCapturing(false);
    }
  }

  async function runComparison(baselineId: string) {
    await fetch(`/api/projects/${projectId}/visual/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baselineId }),
    });
    void fetchData();
  }

  async function deleteBaseline(baselineId: string) {
    await fetch(`/api/projects/${projectId}/visual/baselines/${baselineId}`, {
      method: "DELETE",
    });
    void fetchData();
  }

  async function openDiff(runId: string) {
    const res = await fetch(`/api/projects/${projectId}/visual/runs/${runId}`);
    if (res.ok) {
      const data = await res.json() as { run: VisualRunDetail };
      setSelectedRun(data.run);
      setDiffViewOpen(true);
    }
  }

  return (
    <div className="space-y-8">
      {/* Capture new baseline */}
      <Card>
        <CardHeader>
          <CardTitle>Capture new baseline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="baseline-name">Name</Label>
              <Input
                id="baseline-name"
                placeholder="Homepage desktop"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="baseline-url">URL</Label>
              <Input
                id="baseline-url"
                placeholder="https://example.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="baseline-viewport">Viewport</Label>
              <select
                id="baseline-viewport"
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                value={newViewport}
                onChange={(e) => setNewViewport(e.target.value)}
              >
                <option value="desktop">Desktop (1440×900)</option>
                <option value="mobile">Mobile (390×844)</option>
              </select>
            </div>
          </div>
          {captureError && (
            <p className="mt-2 text-sm text-red-500">{captureError}</p>
          )}
          <Button
            className="mt-4"
            onClick={() => void captureBaseline()}
            disabled={capturing || !newName || !newUrl}
          >
            {capturing ? "Capturing…" : "Capture baseline"}
          </Button>
        </CardContent>
      </Card>

      {/* Baselines list */}
      <Card>
        <CardHeader>
          <CardTitle>Baselines ({baselines.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {baselines.length === 0 ? (
            <p className="py-4 text-center text-neutral-500">
              No baselines yet. Capture one above.
            </p>
          ) : (
            <div className="space-y-4">
              {baselines.map((b) => {
                const lastRun = b.runs[0];
                return (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-800 p-4"
                  >
                    {b.imagePath && (
                      <div className="relative h-16 w-24 overflow-hidden rounded border border-neutral-700">
                        <Image
                          src={`/${b.imagePath}`}
                          alt={b.name}
                          fill
                          className="object-cover object-top"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{b.name}</p>
                      <p className="text-sm text-neutral-400">{b.url}</p>
                      <div className="mt-1 flex gap-2">
                        <Badge variant="secondary">{viewportLabel(b.viewport)}</Badge>
                        {lastRun && (
                          <>
                            <Badge variant={diffColor(lastRun.diffScore)}>
                              {lastRun.status}
                            </Badge>
                            {lastRun.diffScore !== null && (
                              <span className="text-xs text-neutral-500">
                                {fmtScore(lastRun.diffScore)} diff
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void runComparison(b.id)}
                      >
                        Run comparison
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void deleteBaseline(b.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="py-4 text-center text-neutral-500">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-left text-neutral-400">
                    <th className="pb-2 pr-4">URL</th>
                    <th className="pb-2 pr-4">Viewport</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Diff</th>
                    <th className="pb-2 pr-4">AI Severity</th>
                    <th className="pb-2">Time</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b border-neutral-800/50">
                      <td className="py-2 pr-4 max-w-[180px] truncate text-neutral-300">
                        {r.url}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary">{viewportLabel(r.viewport)}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant={
                            r.status === "passed"
                              ? "low"
                              : r.status === "failed"
                                ? "high"
                                : r.status === "running"
                                  ? "medium"
                                  : "secondary"
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            r.diffScore !== null && r.diffScore > 0.05
                              ? "text-red-400"
                              : r.diffScore !== null && r.diffScore > 0.01
                                ? "text-amber-400"
                                : "text-green-400"
                          }
                        >
                          {fmtScore(r.diffScore)}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {r.aiSeverity ? (
                          <Badge variant={severityColor(r.aiSeverity)}>
                            {r.aiSeverity}
                          </Badge>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="py-2 text-neutral-500 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pl-2">
                        {r.diffScore !== null && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void openDiff(r.id)}
                          >
                            View diff
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diff viewer modal */}
      {diffViewOpen && selectedRun && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setDiffViewOpen(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-neutral-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-4 top-4 text-neutral-400 hover:text-white"
              onClick={() => setDiffViewOpen(false)}
            >
              ✕
            </button>
            <h2 className="mb-4 text-xl font-semibold">Diff viewer</h2>

            <div className="mb-4 grid grid-cols-3 gap-3">
              {/* Baseline */}
              <div>
                <p className="mb-1 text-sm text-neutral-400">Baseline</p>
                {selectedRun.baseline?.imagePath ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded border border-neutral-700">
                    <Image
                      src={`/${selectedRun.baseline.imagePath}`}
                      alt="Baseline"
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded border border-neutral-700 text-neutral-600">
                    No image
                  </div>
                )}
                <p className="mt-1 text-xs text-neutral-500">{selectedRun.baseline?.name}</p>
              </div>
              {/* Current */}
              <div>
                <p className="mb-1 text-sm text-neutral-400">Current</p>
                {selectedRun.imagePath ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded border border-neutral-700">
                    <Image
                      src={`/${selectedRun.imagePath}`}
                      alt="Current"
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded border border-neutral-700 text-neutral-600">
                    No image
                  </div>
                )}
              </div>
              {/* Diff */}
              <div>
                <p className="mb-1 text-sm text-neutral-400">Diff (red = changed)</p>
                {selectedRun.diffImagePath ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded border border-neutral-700">
                    <Image
                      src={`/${selectedRun.diffImagePath}`}
                      alt="Diff"
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded border border-neutral-700 text-neutral-600">
                    No diff
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-neutral-400">Diff score: </span>
                <span
                  className={
                    (selectedRun.diffScore ?? 0) > 0.05
                      ? "text-red-400"
                      : (selectedRun.diffScore ?? 0) > 0.01
                        ? "text-amber-400"
                        : "text-green-400"
                  }
                >
                  {fmtScore(selectedRun.diffScore)}
                </span>
              </div>
              <div>
                <span className="text-neutral-400">Status: </span>
                <Badge
                  variant={
                    selectedRun.status === "passed"
                      ? "low"
                      : selectedRun.status === "failed"
                        ? "high"
                        : "secondary"
                  }
                >
                  {selectedRun.status}
                </Badge>
              </div>
            </div>

            {/* AI triage */}
            {selectedRun.aiSeverity && (
              <div className="rounded-lg border border-neutral-800 p-4">
                <h3 className="mb-2 font-medium">AI Triage</h3>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div>
                    <span className="text-neutral-400">Severity: </span>
                    <Badge variant={severityColor(selectedRun.aiSeverity)}>
                      {selectedRun.aiSeverity}
                    </Badge>
                  </div>
                </div>
                {selectedRun.aiSummary && (
                  <p className="mt-2 text-sm text-neutral-300">{selectedRun.aiSummary}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
