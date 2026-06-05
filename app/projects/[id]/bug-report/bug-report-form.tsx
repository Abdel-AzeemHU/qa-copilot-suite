"use client";

import { useActionState } from "react";
import { generateBugReport, type ActionResult } from "@/app/actions-phase2";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionResult = {};

export function BugReportForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(
    generateBugReport,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="space-y-1.5">
        <Label htmlFor="description">Bug description</Label>
        <Textarea id="description" name="description" rows={4} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="stepsToReproduce">Steps to reproduce</Label>
        <Textarea
          id="stepsToReproduce"
          name="stepsToReproduce"
          rows={4}
          required
          placeholder="Describe the steps, one per line…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="environment">Environment</Label>
        <Textarea
          id="environment"
          name="environment"
          rows={2}
          required
          placeholder="OS, browser, app version, etc."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="severity">Severity</Label>
        <select
          id="severity"
          name="severity"
          className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
          defaultValue="medium"
        >
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate report"}
      </Button>
    </form>
  );
}
