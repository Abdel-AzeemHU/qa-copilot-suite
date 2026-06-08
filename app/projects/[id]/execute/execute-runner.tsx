"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { HealingPanel } from "./healing-panel";

export interface PastRun {
  id: string;
  status: string;
  targetUrl: string;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface RunStatus {
  id: string;
  status: string;
  targetUrl: string;
  framework: string;
  logs: string | null;
  result: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const TERMINAL = new Set(["passed", "failed", "error"]);

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "passed") return "low";
  if (status === "failed" || status === "error") return "high";
  if (status === "running") return "medium";
  return "secondary";
}

export function ExecuteRunner({
  projectId,
  defaultTargetUrl,
  generatedCode,
  pastRuns,
}: {
  projectId: string;
  defaultTargetUrl: string;
  generatedCode: string;
  pastRuns: PastRun[];
}) {
  const [targetUrl, setTargetUrl] = useState(defaultTargetUrl);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [run, setRun] = useState<RunStatus | null>(null);
  const [selectedPastRunId, setSelectedPastRunId] = useState<string | null>(
    null,
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLPreElement | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [run?.logs]);

  const poll = async (runId: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as RunStatus;
      setRun(data);
      if (TERMINAL.has(data.status)) stopPolling();
    } catch {
      // transient; keep polling
    }
  };

  const handleRun = async () => {
    setError(null);
    setStarting(true);
    stopPolling();
    setRun(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, targetUrl }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Failed to start run");
        return;
      }
      await poll(data.id);
      pollRef.current = setInterval(() => poll(data.id!), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="targetUrl">Target URL</Label>
        <input
          id="targetUrl"
          type="url"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://example.com"
          className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
        />
      </div>

      <div>
        <Label>Automation code to run</Label>
        <pre className="mt-1.5 max-h-64 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">
          {generatedCode || "No automation code generated yet."}
        </pre>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button
        type="button"
        onClick={handleRun}
        disabled={starting || !targetUrl}
      >
        {starting ? "Starting…" : "Run"}
      </Button>

      {run ? (
        <div className="space-y-3 rounded-md border border-neutral-200 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
          </div>

          {TERMINAL.has(run.status) ? (
            <p className="text-sm font-semibold">
              Result:{" "}
              {run.status === "passed"
                ? "✅ Passed"
                : run.status === "failed"
                  ? "❌ Failed"
                  : "⚠️ Error"}
            </p>
          ) : null}

          {run.errorMessage ? (
            <p className="text-sm text-red-600">{run.errorMessage}</p>
          ) : null}

          {run.status === "failed" || run.status === "error" ? (
            <HealingPanel runId={run.id} />
          ) : null}

          <div>
            <Label>Live log output</Label>
            <pre
              ref={logRef}
              className="mt-1.5 max-h-80 overflow-auto rounded-md border border-neutral-200 bg-neutral-950 p-3 text-xs text-neutral-100"
            >
              {run.logs || "(no output yet)"}
            </pre>
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-medium">Execution history</h3>
        {pastRuns.length === 0 ? (
          <p className="text-sm text-neutral-500">No runs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Run</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Target URL</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium">Completed</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pastRuns.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-200">
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(r.status)}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{r.targetUrl}</td>
                    <td className="px-3 py-2 text-neutral-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {r.completedAt
                        ? new Date(r.completedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === "failed" || r.status === "error" ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
                          onClick={() =>
                            setSelectedPastRunId((cur) =>
                              cur === r.id ? null : r.id,
                            )
                          }
                        >
                          {selectedPastRunId === r.id
                            ? "Hide self-heal"
                            : "Self-heal…"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selectedPastRunId ? (
          <div className="mt-4">
            <HealingPanel runId={selectedPastRunId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
