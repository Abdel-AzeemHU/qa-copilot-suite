"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";

interface RunCard {
  runId: string;
  targetUrl: string;
  status: string;
  result: string | null;
}

const TERMINAL = new Set(["passed", "failed", "error"]);

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "passed") return "low";
  if (status === "failed" || status === "error") return "high";
  if (status === "running") return "medium";
  return "secondary";
}

export function ParallelRunner({ projectId }: { projectId: string }) {
  const [targets, setTargets] = useState<string[]>(["", ""]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunCard[]>([]);
  const [pollingIntervals, setPollingIntervals] = useState<ReturnType<typeof setInterval>[]>([]);

  const addTarget = () => {
    if (targets.length < 5) setTargets((prev) => [...prev, ""]);
  };

  const removeTarget = (i: number) => {
    setTargets((prev) => prev.filter((_, idx) => idx !== i));
  };

  const setTarget = (i: number, val: string) => {
    setTargets((prev) => prev.map((t, idx) => (idx === i ? val : t)));
  };

  const stopPolling = () => {
    setPollingIntervals((prev) => {
      prev.forEach(clearInterval);
      return [];
    });
  };

  const pollRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { id: string; status: string; result: string | null };
      setRuns((prev) =>
        prev.map((r) => (r.runId === runId ? { ...r, status: data.status, result: data.result } : r)),
      );
    } catch {
      // transient
    }
  };

  const handleStart = async () => {
    const validTargets = targets.filter((t) => t.trim());
    if (validTargets.length === 0) {
      setError("Add at least one target URL");
      return;
    }
    setError(null);
    setStarting(true);
    stopPolling();
    setRuns([]);

    try {
      const res = await fetch(`/api/projects/${projectId}/parallel-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: validTargets.map((url) => ({ targetUrl: url })) }),
      });
      const data = (await res.json()) as {
        batchId?: string;
        runIds?: string[];
        error?: string;
      };
      if (!res.ok || !data.runIds) {
        setError(data.error ?? "Failed to start parallel runs");
        return;
      }

      setRuns(
        data.runIds.map((id, idx) => ({
          runId: id,
          targetUrl: validTargets[idx] ?? "",
          status: "queued",
          result: null,
        })),
      );

      const intervals: ReturnType<typeof setInterval>[] = [];
      for (const runId of data.runIds) {
        void pollRun(runId);
        const iv = setInterval(async () => {
          await pollRun(runId);
          // Check if done in state — use a capture trick
          setRuns((prev) => {
            const run = prev.find((r) => r.runId === runId);
            if (run && TERMINAL.has(run.status)) {
              clearInterval(iv);
            }
            return prev;
          });
        }, 2000);
        intervals.push(iv);
      }
      setPollingIntervals(intervals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {targets.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`parallel-url-${i}`}>Target URL {i + 1}</Label>
              <Input
                id={`parallel-url-${i}`}
                type="url"
                value={t}
                onChange={(e) => setTarget(i, e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            {targets.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-6"
                onClick={() => removeTarget(i)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        {targets.length < 5 && (
          <Button type="button" variant="outline" size="sm" onClick={addTarget}>
            + Add URL
          </Button>
        )}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="button" disabled={starting} onClick={handleStart}>
        {starting ? "Starting…" : "Run in Parallel"}
      </Button>

      {runs.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {runs.map((run) => (
            <div
              key={run.runId}
              className="rounded-md border border-neutral-200 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono truncate text-neutral-600">
                  {run.targetUrl}
                </span>
                <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
              </div>
              <p className="text-xs text-neutral-400">Run ID: {run.runId.slice(0, 8)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
