"use client";
import { useFormState, useFormStatus } from "react-dom";
import { onboardNewOrganization, type ActionState } from "@/actions/platform";
import { Button, Input, Label } from "@/components/ui/form";

const initialState: ActionState = {};

export function OnboardForm() {
  const [state, formAction] = useFormState(onboardNewOrganization, initialState);

  return (
    <div className="max-w-md rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-white">
        Onboard New Client
      </h2>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          New organization created! An invite email was sent to the admin to set their password.
        </p>
      )}
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="org_name">Company Name *</Label>
          <Input id="org_name" name="org_name" required placeholder="e.g. XYZ Traders" />
        </div>
        <div>
          <Label htmlFor="admin_name">Admin Full Name *</Label>
          <Input id="admin_name" name="admin_name" required />
        </div>
        <div>
          <Label htmlFor="admin_email">Admin Email * (invite sent here)</Label>
          <Input id="admin_email" name="admin_email" type="email" required />
        </div>
        <div>
          <Label htmlFor="admin_phone">Admin Phone</Label>
          <Input id="admin_phone" name="admin_phone" />
        </div>
        <SubmitButton />
      </form>
      <p className="mt-3 text-xs text-surface-400">
        This creates a new isolated tenant with its own data. The admin invited above will only see their own organization's data - never yours.
      </p>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating..." : "Create Organization & Invite Admin"}</Button>;
}