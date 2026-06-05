"use client";

import { useActionState } from "react";
import { runStaticReview, type ActionResult } from "@/app/actions-phase2";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionResult = {};

export function ReviewForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(
    runStaticReview,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="space-y-1.5">
        <Label htmlFor="artifactType">Artifact type</Label>
        <select
          id="artifactType"
          name="artifactType"
          className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
          defaultValue="requirement"
        >
          <option value="requirement">Requirement</option>
          <option value="user-story">User story</option>
          <option value="test-case">Test case</option>
          <option value="test-plan">Test plan</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="text">Artifact text</Label>
        <Textarea
          id="text"
          name="text"
          rows={8}
          required
          placeholder="Paste the requirement or test artifact text to review…"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Reviewing…" : "Run review"}
      </Button>
    </form>
  );
}
