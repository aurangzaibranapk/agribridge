"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { selfCheckIn, selfCheckOut, type ActionState } from "@/actions/hr";
import { MapPin, LogIn, LogOut, Loader2, CheckCircle2 } from "lucide-react";

const initialState: ActionState = {};

interface TodayRecord {
  check_in_at: string | null;
  check_out_at: string | null;
}

export function CheckinClient({ today }: { today: TodayRecord | null }) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const checkedIn = !!today?.check_in_at;
  const checkedOut = !!today?.check_out_at;

  function captureLocation(): Promise<void> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocError("Location is not supported on this device.");
        resolve();
        return;
      }
      setLocating(true);
      setLocError(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocating(false);
          resolve();
        },
        () => {
          setLocError("Could not get your location. Please allow location access.");
          setLocating(false);
          resolve();
        }
      );
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-card border border-surface-200 bg-white p-6 text-center shadow-card dark:border-surface-800 dark:bg-surface-900">
        <p className="text-sm text-surface-500">{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>

        {checkedIn && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Checked in at {new Date(today!.check_in_at!).toLocaleTimeString()}
          </p>
        )}
        {checkedOut && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-blue-700">
            <CheckCircle2 className="h-4 w-4" /> Checked out at {new Date(today!.check_out_at!).toLocaleTimeString()}
          </p>
        )}

        <button
          type="button"
          onClick={captureLocation}
          disabled={locating}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {coords ? "Location Captured" : locating ? "Getting Location..." : "Capture My Location"}
        </button>
        {locError && <p className="mt-1 text-xs text-red-600">{locError}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <CheckInForm coords={coords} disabled={checkedIn} />
          <CheckOutForm coords={coords} disabled={!checkedIn || checkedOut} />
        </div>
      </div>
    </div>
  );
}

function CheckInForm({ coords, disabled }: { coords: { lat: number; lng: number } | null; disabled: boolean }) {
  const [state, formAction] = useFormState(selfCheckIn, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
      <ActionButton icon={LogIn} label="Check In" disabled={disabled} color="brand" />
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function CheckOutForm({ coords, disabled }: { coords: { lat: number; lng: number } | null; disabled: boolean }) {
  const [state, formAction] = useFormState(selfCheckOut, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
      <ActionButton icon={LogOut} label="Check Out" disabled={disabled} color="surface" />
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function ActionButton({ icon: Icon, label, disabled, color }: { icon: any; label: string; disabled: boolean; color: "brand" | "surface" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium disabled:opacity-40 ${
        color === "brand" ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-surface-300 text-surface-700 hover:bg-surface-50"
      }`}
    >
      <Icon className="h-4 w-4" /> {pending ? "..." : label}
    </button>
  );
}