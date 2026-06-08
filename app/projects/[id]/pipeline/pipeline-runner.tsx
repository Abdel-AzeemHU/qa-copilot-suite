"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export interface PastPipeline {
  id: string;
  status: string;
  targetUrl: string;
  summary: string | null;
  finalRunId: string | null;
  bugReportId: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface Stage {
  id: string;
  name: string;
  sequence: number;
  status: string;
  detail: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface PipelineStatus {
  id: string;
  status: string;
  targetUrl: string;
  finalRunId: string | null;
  bugReportId: string | null;
  summary: string | null;
  errorMessage: string | null;
  stages: Stage[];
}

const TERMINAL = new Set(["succeeded", "failed", "error"]);

function pipelineVariant(status: string): BadgeProps["variant"] {
  if (status === "succeeded") return "low";
  if (status === "failed" || status === "error") return "high";
  if (status === "running") return "medium";
  return "secondary";
}

function stageVariant(status: string): BadgeProps["variant"] {
  if (status === "succeeded") return "low";
  if (status === "failed") return "high";
  if (status === "running") return "medium";
  if (status === "skipped") return "secondary";
  return "outline";
}

const STAGE_LABELS: Record<string, string> = {
  execute: "Execute",
  heal: "Self-heal",
  bug: "File bug",
  notify: "Notify",
  report: "Report",
};

export function PipelineRunner({
  projectId,
  defaultTargetUrl,
  recentPipelines,
}: {
  projectId: string;
  defaultTargetUrl: string;
  recentPipelines: PastPipeline[];
}) {
  const [targetUrl, setTargetUrl] = useState(defaultTargetUrl);
  const [autoHeal, setAutoHeal] = useState(true);
  const [autoBug, setAutoBug] = useState(true);
  const [notify, setNotify] = useState(true);
  const [maxHealAttempts, setMaxHealAttempts] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const poll = async (id: string) => {
    try {
      const res = await fetch(`/api/pipelines/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as PipelineStatus;
      setPipeline(data);
      if (TERMINAL.has(data.status)) stopPolling();
    } catch {
      // transient; keep polling
    }
  };

  const handleRun = async () => {
    setError(null);
    setStarting(true);
    stopPolling();
    setPipeline(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/pipelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          autoHeal,
          autoBug,
          notify,
          maxHealAttempts,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Failed to start pipeline");
        return;
      }
      await poll(data.id);
      pollRef.current = setInterval(() => poll(data.id!), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start pipeline");
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

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoHeal}
            onChange={(e) => setAutoHeal(e.target.checked)}
          />
          Auto self-heal on failure
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoBug}
            onChange={(e) => setAutoBug(e.target.checked)}
          />
          Auto file bug report
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Notify integrations
        </label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="maxHealAttempts">Max heal attempts (1–3)</Label>
        <input
          id="maxHealAttempts"
          type="number"
          min={1}
          max={3}
          value={maxHealAttempts}
          onChange={(e) =>
            setMaxHealAttempts(
              Math.min(3, Math.max(1, Number(e.target.value) || 1)),
            )
          }
          className="h-9 w-24 rounded-md border border-neutral-300 bg-white px-3 text-sm"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button
        type="button"
        onClick={handleRun}
        disabled={starting || !targetUrl}
      >
        {starting ? "Starting…" : "Run pipeline"}
      </Button>

      {pipeline ? (
        <div className="space-y-4 rounded-md border border-neutral-200 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Pipeline status:</span>
            <Badge variant={pipelineVariant(pipeline.status)}>
              {pipeline.status}
            </Badge>
          </div>

          {/* Stage tracker */}
          <ol className="space-y-2">
            {pipeline.stages.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-neutral-400">
                    {s.sequence}
                  </span>
                  <span className="text-sm font-medium">
                    {STAGE_LABELS[s.name] ?? s.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {s.detail ? (
                    <span className="max-w-md truncate text-xs text-neutral-500">
                      {summarizeDetail(s.detail)}
                    </span>
                  ) : null}
                  <Badge variant={stageVariant(s.status)}>{s.status}</Badge>
                </div>
              </li>
            ))}
          </ol>

          {pipeline.summary ? (
            <p className="text-sm font-medium">{pipeline.summary}</p>
          ) : null}
          {pipeline.errorMessage ? (
            <p className="text-sm text-red-600">{pipeline.errorMessage}</p>
          ) : null}

          {TERMINAL.has(pipeline.status) ? (
            <div className="flex flex-wrap gap-4 text-sm">
              {pipeline.finalRunId ? (
                <Link
                  href={`/projects/${projectId}/execute`}
                  className="text-blue-700 underline-offset-2 hover:underline"
                >
                  Final run: {pipeline.finalRunId.slice(0, 8)}
                </Link>
              ) : null}
              {pipeline.bugReportId ? (
                <Link
                  href={`/projects/${projectId}/bug-report`}
                  className="text-blue-700 underline-offset-2 hover:underline"
                >
                  Bug report: {pipeline.bugReportId.slice(0, 8)}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-medium">Recent pipelines</h3>
        {recentPipelines.length === 0 ? (
          <p className="text-sm text-neutral-500">No pipeline runs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Pipeline</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Summary</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentPipelines.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-200">
                    <td className="px-3 py-2 font-mono text-xs">
                      {p.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={pipelineVariant(p.status)}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {p.summary ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function summarizeDetail(detail: string): string {
  try {
    const obj = JSON.parse(detail) as Record<string, unknown>;
    if (obj.reason) return String(obj.reason);
    if (obj.error) return `error: ${String(obj.error)}`;
    if (obj.result) return `result: ${String(obj.result)}`;
    if (obj.bugReportId)
      return `bug ${String(obj.bugReportId).slice(0, 8)}`;
    if ("healed" in obj)
      return obj.healed
        ? "healed"
        : obj.likelyBug
          ? "likely bug"
          : "not healed";
    if (obj.summary) return String(obj.summary);
    return "";
  } catch {
    return detail.slice(0, 80);
  }
}
