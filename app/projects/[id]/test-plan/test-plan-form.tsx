"use client";

import { useActionState } from "react";
import { generateTestPlan, type ActionResult } from "@/app/actions-phase2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionResult = {};

export function TestPlanForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(
    generateTestPlan,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="space-y-1.5">
        <Label htmlFor="description">Project description</Label>
        <Textarea id="description" name="description" rows={4} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scope">Scope</Label>
        <Textarea id="scope" name="scope" rows={3} required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="teamSize">Team size</Label>
          <Input
            id="teamSize"
            name="teamSize"
            type="number"
            min={1}
            defaultValue={3}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sprintLengthDays">Sprint length (days)</Label>
          <Input
            id="sprintLengthDays"
            name="sprintLengthDays"
            type="number"
            min={1}
            defaultValue={14}
            required
          />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate plan"}
      </Button>
    </form>
  );
}
