"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createDriver, updateDriverStatus, type ActionState } from "@/actions/drivers";
import { Plus, X, Phone, Truck, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string | null;
}

interface Driver {
  id: string;
  full_name: string;
  mobile_number: string | null;
  cnic_number: string | null;
  license_number: string | null;
  is_active: boolean;
  vehicles: Vehicle[];
}

export function DriversClient({ drivers }: { drivers: Driver[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const lang = useLang();

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" />{t("dr_add_new", lang)}</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {drivers.map((d) => (
          <div key={d.id} className={`rounded-card border p-4 shadow-card ${d.is_active ? "border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900" : "border-surface-100 bg-surface-50 opacity-60"}`}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium text-surface-900 dark:text-white">{d.full_name}</p>
              <StatusToggle driverId={d.id} isActive={d.is_active} />
            </div>
            {d.mobile_number && (
              <p className="flex items-center gap-1.5 text-xs text-surface-500">
                <Phone className="h-3 w-3" /> {d.mobile_number}
              </p>
            )}
            {d.license_number && <p className="text-xs text-surface-400">License: {d.license_number}</p>}
            {d.vehicles.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-surface-100 pt-2 dark:border-surface-800">
                {d.vehicles.map((v) => (
                  <p key={v.id} className="flex items-center gap-1.5 text-xs text-surface-600 dark:text-surface-400">
                    <Truck className="h-3 w-3" /> {v.vehicle_number} {v.vehicle_type ? `(${v.vehicle_type})` : ""}
                  </p>
                ))}
              </div>
            )}
            <Link href={`/admin/drivers/${d.id}/statement`} className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:underline">
              <LinkIcon className="h-3 w-3" />{t("dr_view_statement", lang)}</Link>
          </div>
        ))}
        {drivers.length === 0 && <p className="col-span-full py-10 text-center text-sm text-surface-400">{t("dr_none", lang)}</p>}
      </div>

      {showAdd && <AddDriverModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function StatusToggle({ driverId, isActive }: { driverId: string; isActive: boolean }) {
  const [, formAction] = useFormState(updateDriverStatus, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="driver_id" value={driverId} />
      <input type="hidden" name="is_active" value={(!isActive).toString()} />
      <button type="submit" className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isActive ? "bg-green-100 text-green-700" : "bg-surface-200 text-surface-500"}`}>
        {isActive ? "Active" : "Inactive"}
      </button>
    </form>
  );
}

function AddDriverModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState(createDriver, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("dr_add_new", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input name="full_name" required placeholder={t("dr_name", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="mobile_number" placeholder={t("c_mobile_number", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="cnic_number" placeholder={t("c_cnic_optional", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="license_number" placeholder={t("dr_license", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div className="border-t border-surface-100 pt-2">
            <p className="mb-1 text-xs font-medium text-surface-500">{t("dr_vehicle_optional", lang)}</p>
            <input name="vehicle_number" placeholder={t("dr_vehicle_no", lang)} className="mb-2 w-full rounded-lg border border-surface-200 p-2 text-sm" />
            <input name="vehicle_type" placeholder={t("dr_vehicle_type", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Driver Add Karein"}</button>;
}