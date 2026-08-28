"use client";
import { useFormState, useFormStatus } from "react-dom";
import { assignVehicleToStaff, type ActionState } from "@/actions/vehicle-logs";
import { Bike, Check } from "lucide-react";

const initialState: ActionState = {};

interface Vehicle {
  id: string;
  name: string;
  registrationNo: string | null;
  expectedKmPerLiter: number;
  assignedProfileId: string | null;
  assignedRider: string | null;
}

export function VehicleAssignForm({ vehicle, staff }: { vehicle: Vehicle; staff: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(assignVehicleToStaff, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
      <input type="hidden" name="vehicle_id" value={vehicle.id} />

      <div className="min-w-40 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-surface-900 dark:text-white">
          <Bike className="h-4 w-4 text-surface-400" /> {vehicle.name}
        </p>
        <p className="text-xs text-surface-500">
          {vehicle.registrationNo ?? "—"} · {vehicle.expectedKmPerLiter} km/L
          {vehicle.assignedRider && <> · purana rider: {vehicle.assignedRider}</>}
        </p>
      </div>

      <div className="min-w-48">
        <label className="text-xs font-medium text-surface-600">Kis staff ke paas</label>
        <select
          name="assigned_profile_id"
          defaultValue={vehicle.assignedProfileId ?? ""}
          className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
        >
          <option value="">- Kisi ke paas nahi -</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <SaveButton />

      {state.error && <p className="w-full rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}
      {state.success && (
        <p className="w-full text-xs text-green-600"><Check className="mr-0.5 inline h-3 w-3" /> Mahfooz ho gaya</p>
      )}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-60 dark:border-surface-700 dark:text-surface-300"
    >
      {pending ? "..." : "Mahfooz"}
    </button>
  );
}
