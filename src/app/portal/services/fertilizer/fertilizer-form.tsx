"use client";

import { useState, useRef, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, MapPin, Loader2, Plus, Trash2, ArrowRight } from "lucide-react";
import { submitFertilizerRequest, type ServiceRequestState } from "@/actions/service-requests";

const UNITS = ["bags", "kg", "litres"];

interface ProductRow {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

function newRow(): ProductRow {
  return { id: Math.random().toString(36).slice(2), name: "", quantity: "", unit: "bags" };
}

const initialState: ServiceRequestState = {};

export function FertilizerForm() {
  const [state, formAction] = useFormState(submitFertilizerRequest, initialState);
  const [rows, setRows] = useState<ProductRow[]>([newRow()]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  function updateRow(id: string, field: keyof ProductRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location is not supported on this device.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("Could not get your location. Please allow location access, or type your address below.");
        setLocating(false);
      }
    );
  }

  if (state.success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Your fertilizer request has been submitted. We'll be in touch soon.
        </div>
        <Link
          href="/portal/services/livestock"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Continue to Livestock Loan <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/portal/dashboard" className="block text-center text-sm text-surface-500 hover:text-brand-700">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-surface-700">Crop Type</label>
        <input
          type="text"
          name="crop_type"
          className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          placeholder="e.g. Wheat, Sugarcane, Cotton"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700">Cultivation Date</label>
        <input
          type="date"
          name="cultivation_date"
          min={new Date().toISOString().split("T")[0]}
          className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700">Location</label>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {coords ? "Location captured ✓" : locating ? "Getting your location..." : "Use My Current Location"}
        </button>
        {locationError && <p className="mt-1 text-xs text-red-600">{locationError}</p>}
        <input type="hidden" name="location_lat" value={coords?.lat ?? ""} />
        <input type="hidden" name="location_lng" value={coords?.lng ?? ""} />
        <input
          type="text"
          name="location_address"
          className="mt-2 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          placeholder="Village / area name"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-surface-700">Products Needed</label>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 rounded-lg border border-brand-200 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add Product
          </button>
        </div>

        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2 rounded-lg border border-surface-200 p-2">
              <input
                type="text"
                name="product_name[]"
                value={row.name}
                onChange={(e) => updateRow(row.id, "name", e.target.value)}
                placeholder="e.g. Urea, DAP, Nitrophos"
                className="flex-1 min-w-0 rounded-md border border-surface-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              <input
                type="number"
                name="quantity[]"
                value={row.quantity}
                onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                min="0"
                step="0.1"
                placeholder="Qty"
                className="w-20 rounded-md border border-surface-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              <select
                name="unit[]"
                value={row.unit}
                onChange={(e) => updateRow(row.id, "unit", e.target.value)}
                className="w-24 rounded-md border border-surface-200 px-1 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                className="shrink-0 rounded-md p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700">Additional Notes (optional)</label>
        <textarea
          name="notes"
          rows={3}
          className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          placeholder="Anything else we should know?"
        />
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? "Submitting..." : "Submit Request"}
    </button>
  );
}
