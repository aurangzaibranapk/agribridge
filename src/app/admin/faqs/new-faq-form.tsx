"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveFaq, type ActionState } from "@/actions/cms";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";

const initialState: ActionState = {};

export function NewFaqForm() {
  const [state, formAction] = useFormState(saveFaq, initialState);
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">New FAQ</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" defaultValue="Ordering & Delivery">
            <option>Ordering & Delivery</option>
            <option>Payments & Khata</option>
            <option>AI Crop Doctor</option>
            <option>Becoming a Dealer</option>
            <option>Becoming an Investor</option>
            <option>Account & Registration</option>
          </Select>
        </div>
        <div><Label htmlFor="question">Question *</Label><Input id="question" name="question" required /></div>
        <div><Label htmlFor="answer">Answer *</Label><Textarea id="answer" name="answer" rows={3} required /></div>
        <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
          <input type="checkbox" name="is_published" defaultChecked /> Published
        </label>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : "Add FAQ"}</Button>;
}
