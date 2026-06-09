"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import cronstrue from "cronstrue";

export interface ScheduleView {
  id: string;
  name: string;
  enabled: boolean;
  cronExpr: string;
  targetUrl: string;
  autoHeal: boolean;
  autoBug: boolean;
  notify: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  createdAt: string;
}

function statusVariant(status: string | null): BadgeProps["variant"] {
  if (status === "succeeded") return "low";
  if (status === "failed" || status === "error") return "high";
  return "secondary";
}

function humanCron(expr: string): string {
  try {
    return cronstrue.toString(expr, { verbose: false });
  } catch {
    return expr;
  }
}

export function SchedulesManager({
  projectId,
  initialSchedules,
}: {
  projectId: string;
  initialSchedules: ScheduleView[];
}) {
  const [schedules, setSchedules] = useState<ScheduleView[]>(initialSchedules);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [cronExpr, setCronExpr] = useState("0 9 * * 1-5");
  const [targetUrl, setTargetUrl] = useState("");
  const [autoHeal, setAutoHeal] = useState(true);
  const [autoBug, setAutoBug] = useState(true);
  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [triggerMessages, setTriggerMessages] = useState<Record<string, string>>({});

  const resetForm = () => {
    setName("");
    setCronExpr("0 9 * * 1-5");
    setTargetUrl("");
    setAutoHeal(true);
    setAutoBug(true);
    setNotify(true);
    setFormError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !cronExpr.trim() || !targetUrl.trim()) {
      setFormError("Name, cron expression, and target URL are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), cronExpr: cronExpr.trim(), targetUrl: targetUrl.trim(), autoHeal, autoBug, notify }),
      });
      const data = (await res.json()) as ScheduleView & { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create schedule");
        return;
      }
      setSchedules((prev) => [data, ...prev]);
      setShowForm(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create schedule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (schedule: ScheduleView) => {
    setBusyMap((prev) => ({ ...prev, [schedule.id]: true }));
    try {
      const res = await fetch(
        `/api/projects/${projectId}/schedules/${schedule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !schedule.enabled }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as ScheduleView;
        setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? data : s)));
      }
    } finally {
      setBusyMap((prev) => ({ ...prev, [schedule.id]: false }));
    }
  };

  const handleDelete = async (schedule: ScheduleView) => {
    setBusyMap((prev) => ({ ...prev, [schedule.id]: true }));
    try {
      const res = await fetch(
        `/api/projects/${projectId}/schedules/${schedule.id}`,
        { method: "DELETE" },
      );
      if (res.ok || res.status === 204) {
        setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
      }
    } finally {
      setBusyMap((prev) => ({ ...prev, [schedule.id]: false }));
    }
  };

  const handleTrigger = async (schedule: ScheduleView) => {
    setBusyMap((prev) => ({ ...prev, [schedule.id]: true }));
    setTriggerMessages((prev) => ({ ...prev, [schedule.id]: "" }));
    try {
      const res = await fetch(
        `/api/projects/${projectId}/schedules/trigger`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: schedule.id, targetUrl: schedule.targetUrl }),
        },
      );
      const data = (await res.json()) as { pipelineRunId?: string; error?: string };
      if (res.ok && data.pipelineRunId) {
        setTriggerMessages((prev) => ({
          ...prev,
          [schedule.id]: `Pipeline started: ${data.pipelineRunId!.slice(0, 8)}`,
        }));
      } else {
        setTriggerMessages((prev) => ({
          ...prev,
          [schedule.id]: `Error: ${data.error ?? "unknown"}`,
        }));
      }
    } catch (err) {
      setTriggerMessages((prev) => ({
        ...prev,
        [schedule.id]: `Error: ${err instanceof Error ? err.message : "unknown"}`,
      }));
    } finally {
      setBusyMap((prev) => ({ ...prev, [schedule.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {schedules.length} schedule{schedules.length === 1 ? "" : "s"}
        </p>
        <Button
          type="button"
          variant={showForm ? "outline" : "default"}
          onClick={() => {
            setShowForm((s) => !s);
            if (showForm) resetForm();
          }}
        >
          {showForm ? "Cancel" : "Add schedule"}
        </Button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-md border border-neutral-200 p-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="sched-name">Name</Label>
            <Input
              id="sched-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekday smoke tests"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-cron">Cron expression</Label>
            <Input
              id="sched-cron"
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder="0 9 * * 1-5"
              required
            />
            {cronExpr.trim() ? (
              <p className="text-xs text-neutral-500">
                {humanCron(cronExpr.trim())}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-url">Target URL</Label>
            <Input
              id="sched-url"
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://staging.example.com"
              required
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoHeal}
                onChange={(e) => setAutoHeal(e.target.checked)}
              />
              Auto-heal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoBug}
                onChange={(e) => setAutoBug(e.target.checked)}
              />
              Auto-bug
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
              />
              Notify
            </label>
          </div>
          {formError ? (
            <p className="text-sm text-red-600">{formError}</p>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create schedule"}
          </Button>
        </form>
      ) : null}

      {schedules.length === 0 ? (
        <p className="py-6 text-center text-neutral-500">
          No schedules yet. Add one to automate pipeline runs.
        </p>
      ) : (
        <ul className="space-y-3">
          {schedules.map((schedule) => {
            const busy = busyMap[schedule.id];
            const trigMsg = triggerMessages[schedule.id];
            return (
              <li
                key={schedule.id}
                className="space-y-2 rounded-md border border-neutral-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{schedule.name}</span>
                      <Badge variant={schedule.enabled ? "secondary" : "outline"}>
                        {schedule.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      {schedule.lastStatus ? (
                        <Badge variant={statusVariant(schedule.lastStatus)}>
                          {schedule.lastStatus}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-neutral-600 font-mono">
                      {schedule.cronExpr}
                      <span className="ml-2 text-neutral-400 font-sans text-xs">
                        ({humanCron(schedule.cronExpr)})
                      </span>
                    </p>
                    <p className="text-sm text-neutral-500">{schedule.targetUrl}</p>
                    <div className="mt-1 flex gap-4 text-xs text-neutral-400">
                      {schedule.nextRunAt ? (
                        <span>
                          Next: {new Date(schedule.nextRunAt).toLocaleString()}
                        </span>
                      ) : null}
                      {schedule.lastRunAt ? (
                        <span>
                          Last: {new Date(schedule.lastRunAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => handleTrigger(schedule)}
                    >
                      Trigger now
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => handleToggle(schedule)}
                    >
                      {schedule.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => handleDelete(schedule)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {trigMsg ? (
                  <p
                    className={
                      trigMsg.startsWith("Pipeline")
                        ? "text-sm text-green-700"
                        : "text-sm text-red-600"
                    }
                  >
                    {trigMsg}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
