"use client";

import { useActionState } from "react";
import {
  generateAutomationCode,
  type ActionResult,
} from "@/app/actions-phase2";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: ActionResult = {};

export function AutomationForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(
    generateAutomationCode,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="framework">Framework</Label>
          <select
            id="framework"
            name="framework"
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
            defaultValue="playwright"
          >
            <option value="playwright">Playwright</option>
            <option value="selenium">Selenium</option>
            <option value="rest-assured">REST Assured</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="language">Language</Label>
          <select
            id="language"
            name="language"
            className="h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
            defaultValue="typescript"
          >
            <option value="typescript">TypeScript</option>
            <option value="java">Java</option>
          </select>
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate code"}
      </Button>
    </form>
  );
}
