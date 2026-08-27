"use client";
import { useFormState, useFormStatus } from "react-dom";
import { saveBranch, type ActionState } from "@/actions/branches";
import { Button, Input, Label, Textarea } from "@/components/ui/form";

const initialState: ActionState = {};

export function BranchForm() {
  const [state, formAction] = useFormState(saveBranch, initialState);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">New Shop/Branch</h2>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          Shop added.
        </p>
      )}
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="branch-name">Shop Name *</Label>
          <Input id="branch-name" name="name" required placeholder="e.g. Jhang Bazaar Shop" />
        </div>
        <div>
          <Label htmlFor="district">District</Label>
          <Input id="district" name="district" />
        </div>
        <div>
          <Label htmlFor="tehsil">Tehsil</Label>
          <Input id="tehsil" name="tehsil" />
        </div>
        <div>
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" name="address" rows={2} />
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : "Add Shop"}</Button>;
}