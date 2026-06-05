"use client";

import { useActionState } from "react";
import {
  generateTestCasesAction,
  type ActionResult,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionResult = {};

export function GenerateForm({
  projectId,
  hasStoredKey,
}: {
  projectId: string;
  hasStoredKey: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    generateTestCasesAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="space-y-1.5">
        <Label htmlFor="requirement">Requirement</Label>
        <Textarea
          id="requirement"
          name="requirement"
          rows={6}
          required
          placeholder="Describe the feature or requirement to generate test cases for…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="targetUrl">Target URL (optional)</Label>
        <Input
          id="targetUrl"
          name="targetUrl"
          type="url"
          placeholder="https://example.com/feature"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="apiKey">
          Claude API key{hasStoredKey ? " (stored — leave blank to reuse)" : ""}
        </Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          placeholder="sk-ant-…"
          required={!hasStoredKey}
        />
        <p className="text-xs text-neutral-500">
          Stored encrypted on the server. Never logged.
        </p>
      </div>
      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate"}
      </Button>
    </form>
  );
}
