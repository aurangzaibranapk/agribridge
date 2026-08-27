"use client";
import { useFormState, useFormStatus } from "react-dom";
import { saveBranchLocation, type ActionState } from "@/actions/branches";
import { MapPin, Check } from "lucide-react";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius: number;
}

export function BranchLocationForm({ branch }: { branch: Branch }) {
  const [state, formAction] = useFormState(saveBranchLocation, initialState);
  const isSet = branch.latitude != null && branch.longitude != null;

  return (
    <form
      action={formAction}
      className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900"
    >
      <input type="hidden" name="branch_id" value={branch.id} />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-surface-900 dark:text-white">{branch.name}</h3>
          {branch.address && <p className="text-xs text-surface-500">{branch.address}</p>}
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
            isSet ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {isSet ? <Check className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
          {isSet ? "Jagah darj hai" : "Jagah nahi darj"}
        </span>
      </div>

      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Mahfooz ho gaya.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="text-xs font-medium text-surface-600">Latitude</label>
          <input
            name="latitude"
            defaultValue={branch.latitude ?? ""}
            placeholder="31.4504"
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">Longitude</label>
          <input
            name="longitude"
            defaultValue={branch.longitude ?? ""}
            placeholder="73.1350"
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600">Daira (meter)</label>
          <input
            name="attendance_radius_meters"
            type="number"
            min={20}
            max={20000}
            defaultValue={branch.radius}
            className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
          />
        </div>
        <div className="flex items-end">
          <SaveButton />
        </div>
      </div>

      <p className="mt-2 text-xs text-surface-500">Dono khane khali chhoR kar mahfooz karein to jagah hat jayegi.</p>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Ho raha hai..." : "Mahfooz Karein"}
    </button>
  );
}
