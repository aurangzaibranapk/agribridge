"use client";
import { useFormState, useFormStatus } from "react-dom";
import { updateFarmingOverview, type FarmerProfileState } from "@/actions/farmer-profile";
import { Button, Input, Label } from "@/components/ui/form";

const initialState: FarmerProfileState = {};

interface Farmer {
  crop_types: string[];
}

export function FarmingOverviewForm({ farmer }: { farmer: Farmer }) {
  const [state, formAction] = useFormState(updateFarmingOverview, initialState);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card mb-6">
      <h2 className="font-display text-sm font-semibold text-surface-900">Farming Overview</h2>
      {state.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Saved.</p>}
      <form action={formAction} className="mt-3 space-y-3">
        <div>
          <Label htmlFor="crop_types">Type of Crops</Label>
          <Input id="crop_types" name="crop_types" defaultValue={(farmer.crop_types ?? []).join(", ")} placeholder="Wheat, Rice" />
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Save Farming Overview"}</Button>;
}