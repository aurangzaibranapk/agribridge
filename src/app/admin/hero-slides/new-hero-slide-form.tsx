"use client";
import { useFormState, useFormStatus } from "react-dom";
import { saveHeroSlide, type ActionState } from "@/actions/cms";
import { Button, Input, Label } from "@/components/ui/form";

const initialState: ActionState = {};

export function NewHeroSlideForm() {
  const [state, formAction] = useFormState(saveHeroSlide, initialState);
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">New Slide</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      <form action={formAction} className="space-y-3">
        <div><Label htmlFor="image_url">Desktop Image URL * (1600x510px)</Label><Input id="image_url" name="image_url" required placeholder="https://..." /></div>
        <div><Label htmlFor="mobile_image_url">Mobile Image URL (optional - agar khali chhode to Desktop Image hi use hogi)</Label><Input id="mobile_image_url" name="mobile_image_url" placeholder="https://..." /></div>
        <div><Label htmlFor="headline">Headline *</Label><Input id="headline" name="headline" required /></div>
        <div><Label htmlFor="subheadline">Subheadline</Label><Input id="subheadline" name="subheadline" /></div>
        <div><Label htmlFor="cta_label">Button Text</Label><Input id="cta_label" name="cta_label" placeholder="Browse Products" /></div>
        <div><Label htmlFor="cta_url">Button Link</Label><Input id="cta_url" name="cta_url" placeholder="/products" /></div>
        <div><Label htmlFor="display_order">Order</Label><Input id="display_order" name="display_order" type="number" defaultValue={0} /></div>
        <SubmitButton />
      </form>
    </div>
  );
}
function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : "Add Slide"}</Button>;
}