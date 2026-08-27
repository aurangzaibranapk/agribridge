"use client";
import { useFormState, useFormStatus } from "react-dom";
import { saveWarehouse, type ActionState } from "@/actions/inventory";
import { Button, Input, Label, Textarea } from "@/components/ui/form";

const initialState: ActionState = {};

export function WarehouseForm() {
  const [state, formAction] = useFormState(saveWarehouse, initialState);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">New Warehouse</h2>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          Warehouse added.
        </p>
      )}
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="wh-name">Warehouse Name *</Label>
          <Input id="wh-name" name="name" required placeholder="e.g. North Store" />
        </div>
        <div>
          <Label htmlFor="wh-code">Code *</Label>
          <Input id="wh-code" name="code" required placeholder="e.g. NORTH" />
        </div>
        <div>
          <Label htmlFor="wh-address">Address</Label>
          <Textarea id="wh-address" name="address" rows={2} />
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : "Add Warehouse"}</Button>;
}