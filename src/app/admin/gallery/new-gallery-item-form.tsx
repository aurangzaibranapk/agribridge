"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveGalleryItem, type ActionState } from "@/actions/cms";
import { Button, Input, Label, Select } from "@/components/ui/form";

const initialState: ActionState = {};

export function NewGalleryItemForm() {
  const [state, formAction] = useFormState(saveGalleryItem, initialState);
  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Add Gallery Item</h2>
      <p className="mb-3 text-xs text-surface-400 dark:text-surface-500">Upload the file to Media Library first, then paste its URL here.</p>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue="photo">
            <option value="photo">Photo</option>
            <option value="video">Video</option>
          </Select>
        </div>
        <div><Label htmlFor="url">File URL *</Label><Input id="url" name="url" required placeholder="https://..." /></div>
        <div><Label htmlFor="caption">Caption</Label><Input id="caption" name="caption" /></div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" defaultValue="Farms">
            <option value="Events">Events</option>
            <option value="Farms">Farms</option>
            <option value="Products">Products</option>
            <option value="Team">Team</option>
          </Select>
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Adding..." : "Add to Gallery"}</Button>;
}
