"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createDealer, type ActionState } from "@/actions/dealers";
import { Button, Input, Label } from "@/components/ui/form";
import { MapPin, Loader2 } from "lucide-react";

const initialState: ActionState = {};

export function DealerForm() {
  const [state, formAction] = useFormState(createDealer, initialState);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location is not available on this device.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("Location capture nahi ho saki.");
        setLocating(false);
      }
    );
  }

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">New Dealer</h2>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          Dealer created! An invite email was sent to set their password.
        </p>
      )}
      <form action={formAction} className="space-y-3">
        <div>
          <Label>Business Name *</Label>
          <Input name="business_name" required placeholder="e.g. ABC Traders" />
        </div>
        <div>
          <Label>Email * (invite sent here)</Label>
          <Input name="email" type="email" required />
        </div>
        <div>
          <Label>Phone *</Label>
          <Input name="phone_number" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>District</Label>
            <Input name="district" />
          </div>
          <div>
            <Label>Tehsil</Label>
            <Input name="tehsil" />
          </div>
        </div>

        <div>
          <Label>Dealer ki Location (Marketplace Delivery ke liye lazmi) *</Label>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {coords ? "Location Mil Gayi \u2713" : locating ? "Location Le Rahe Hain..." : "Dealer Ki Location Pin Karein"}
          </button>
          {locationError && <p className="mt-1 text-xs text-red-600">{locationError}</p>}
          <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
          <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
        </div>

        <div className="border-t border-surface-100 pt-3 dark:border-surface-800">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Bank Details (Payment ke liye)</p>
          <div className="space-y-2">
            <div>
              <Label>Bank Name</Label>
              <Input name="bank_name" />
            </div>
            <div>
              <Label>Account Title</Label>
              <Input name="bank_account_title" />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input name="bank_account_number" />
            </div>
            <div>
              <Label>IBAN</Label>
              <Input name="bank_iban" />
            </div>
          </div>
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating..." : "Create Dealer & Send Invite"}</Button>;
}