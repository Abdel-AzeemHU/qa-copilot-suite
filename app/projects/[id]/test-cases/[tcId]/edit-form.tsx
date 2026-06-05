"use client";

import { useActionState } from "react";
import {
  updateTestCaseAction,
  type ActionResult,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PRIORITIES,
  TEST_TYPES,
} from "@/lib/helpers/test-case-generator";

const initialState: ActionResult = {};

export interface EditFormProps {
  id: string;
  title: string;
  preconditions: string;
  steps: string; // newline-separated
  expectedResult: string;
  priority: string;
  type: string;
}

export function EditForm(props: EditFormProps) {
  const [state, formAction, pending] = useActionState(
    updateTestCaseAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={props.id} />
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={props.title} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            defaultValue={props.priority}
            className="flex h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            defaultValue={props.type}
            className="flex h-9 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
          >
            {TEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="preconditions">Preconditions</Label>
        <Textarea
          id="preconditions"
          name="preconditions"
          defaultValue={props.preconditions}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="steps">Steps (one per line)</Label>
        <Textarea
          id="steps"
          name="steps"
          rows={6}
          defaultValue={props.steps}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expectedResult">Expected result</Label>
        <Textarea
          id="expectedResult"
          name="expectedResult"
          defaultValue={props.expectedResult}
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
