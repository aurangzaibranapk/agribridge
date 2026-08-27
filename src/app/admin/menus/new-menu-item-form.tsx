"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveMenuItem, type ActionState } from "@/actions/cms";
import { Button, Input, Label, Select } from "@/components/ui/form";

const initialState: ActionState = {};

export function NewMenuItemForm() {
  const [state, formAction] = useFormState(saveMenuItem, initialState);
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">New Menu Item</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="menu_location">Location</Label>
          <Select id="menu_location" name="menu_location" defaultValue="header">
            <option value="header">Header</option>
            <option value="footer">Footer</option>
          </Select>
        </div>
        <div><Label htmlFor="label">Label *</Label><Input id="label" name="label" required /></div>
        <div><Label htmlFor="url">URL *</Label><Input id="url" name="url" required placeholder="/products" /></div>
        <div><Label htmlFor="display_order">Order</Label><Input id="display_order" name="display_order" type="number" defaultValue={0} /></div>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : "Add Menu Item"}</Button>;
}
