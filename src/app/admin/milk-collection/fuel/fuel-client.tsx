"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addVehicle, logFuelEntry, saveFuelRateSettings, type ActionState } from "@/actions/fuel";
import { AlertTriangle, Bike, Plus, X, Settings, Image as ImageIcon } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
}

interface Vehicle {
  id: string;
  vehicle_name: string;
  registration_no: string | null;
  assigned_rider: string | null;
  expected_km_per_liter: number;
  branch_name: string | null;
}

interface FuelLog {
  id: string;
  log_date: string;
  opening_km: number;
  closing_km: number;
  km_travelled: number;
  fuel_liters_purchased: number | null;
  fuel_cost: number | null;
  km_per_liter: number | null;
  fuel_cost_per_liter_milk: number | null;
  is_anomaly: boolean;
  vehicle_name: string;
  meter_photo_url: string | null;
}

interface RateSettings {
  petrol_rate: number;
  diesel_rate: number;
  margin: number;
  generator_expected_hours_per_liter: number;
}

export function FuelClient({ vehicles, logs, rateSettings, branches }: { vehicles: Vehicle[]; logs: FuelLog[]; rateSettings: RateSettings; branches: Branch[] }) {
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const lang = useLang();
  const [showSettings, setShowSettings] = useState(false);
  const anomalyCount = logs.filter((l) => l.is_anomaly).length;

  return (
    <div>
      {anomalyCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" /> {anomalyCount} entry mein fuel efficiency anomaly hai — dhyan dein.
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Motorcycles ({vehicles.length})</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-xs font-medium text-surface-600 hover:bg-surface-50">
            <Settings className="h-3.5 w-3.5" /> Rate Settings (Rs {rateSettings.petrol_rate + rateSettings.margin}/L)
          </button>
          <button onClick={() => setShowAddVehicle(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700">
            <Plus className="h-3.5 w-3.5" />{t("at_add_vehicle", lang)}</button>
        </div>
      </div>
      {showAddVehicle && <AddVehicleModal branches={branches} onClose={() => setShowAddVehicle(false)} />}
      {showSettings && <RateSettingsModal settings={rateSettings} onClose={() => setShowSettings(false)} />}

      <div className="mb-6 flex flex-wrap gap-2">
        {vehicles.map((v) => (
          <span key={v.id} className="flex items-center gap-1.5 rounded-full bg-surface-100 px-3 py-1.5 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300">
            <Bike className="h-3.5 w-3.5" /> {v.vehicle_name} {v.assigned_rider ? `(${v.assigned_rider})` : ""} - {v.expected_km_per_liter} km/L {v.branch_name ? `| ${v.branch_name}` : ""}
          </span>
        ))}
        {vehicles.length === 0 && <p className="text-sm text-surface-400">{t("mf_no_vehicle", lang)}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_vehicle", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mf_km", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mf_km_per_l", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_cost", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_photo", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_status", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className={`border-b border-surface-100 last:border-0 dark:border-surface-800 ${l.is_anomaly ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                    <td className="px-3 py-2 text-surface-500">{l.log_date}</td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{l.vehicle_name}</td>
                    <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">{l.km_travelled}</td>
                    <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">{l.km_per_liter?.toFixed(1) ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">{l.fuel_cost ? `Rs ${l.fuel_cost.toFixed(0)}` : "-"}</td>
                    <td className="px-3 py-2">
                      {l.meter_photo_url ? (
                        <a href={l.meter_photo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                          <ImageIcon className="h-3.5 w-3.5" />{t("at_view", lang)}</a>
                      ) : (
                        <span className="text-xs text-surface-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {l.is_anomaly ? (
                        <span className="flex w-fit items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-3 w-3" />{t("at_check", lang)}</span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{t("mf_ok", lang)}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">{t("mf_no_entry", lang)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <FuelLogForm vehicles={vehicles} />
      </div>
    </div>
  );
}

function AddVehicleModal({ branches, onClose }: { branches: Branch[]; onClose: () => void }) {
  const [state, formAction] = useFormState(addVehicle, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("mf_add_motorcycle", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input name="vehicle_name" required placeholder={t("mf_vehicle_name", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="registration_no" placeholder={t("mf_reg_no", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="assigned_rider" placeholder={t("mf_rider_name", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          {branches.length > 0 && (
            <select name="branch_id" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">- Chiller/Branch Select Karein -</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <div>
            <label className="text-xs text-surface-500">{t("mf_expected_kmpl", lang)}</label>
            <input type="number" step="0.1" name="expected_km_per_liter" defaultValue="45" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <SubmitButton label={t("mf_add_vehicle", lang)} />
        </form>
      </div>
    </div>
  );
}

function RateSettingsModal({ settings, onClose }: { settings: RateSettings; onClose: () => void }) {
  const [state, formAction] = useFormState(saveFuelRateSettings, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("mf_todays_rate", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs text-surface-500">{t("mf_rate_note", lang)}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <div>
            <label className="text-xs text-surface-500">{t("mf_petrol_rate", lang)}</label>
            <input type="number" step="0.01" name="petrol_rate" defaultValue={settings.petrol_rate} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-surface-500">{t("mf_diesel_rate", lang)}</label>
            <input type="number" step="0.01" name="diesel_rate" defaultValue={settings.diesel_rate} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-surface-500">{t("mf_margin", lang)}</label>
            <input type="number" step="0.01" name="margin" defaultValue={settings.margin} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-surface-500">{t("at_generator_hours", lang)}</label>
            <input type="number" step="0.01" name="generator_expected_hours_per_liter" defaultValue={settings.generator_expected_hours_per_liter} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <SubmitButton label={t("c_save", lang)} />
        </form>
      </div>
    </div>
  );
}

function FuelLogForm({ vehicles }: { vehicles: Vehicle[] }) {
  const [state, formAction] = useFormState(logFuelEntry, initialState);
  const lang = useLang();
  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-sm font-semibold text-surface-900 dark:text-white">{t("mf_daily_log", lang)}</h2>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("mf_log_saved", lang)}</p>}
      <form action={formAction} encType="multipart/form-data" className="space-y-2">
        <select name="vehicle_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">- Vehicle Select Karein -</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.vehicle_name} {v.branch_name ? `(${v.branch_name})` : ""}</option>
          ))}
        </select>
        <input type="date" name="log_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="0.1" name="opening_km" required placeholder={t("mf_opening_km", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="0.1" name="closing_km" required placeholder={t("mf_closing_km", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <input type="number" step="0.1" name="fuel_liters_purchased" placeholder={t("mf_litres", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <p className="text-xs text-surface-400">{t("mf_cost_auto", lang)}</p>
        <input name="route_name" placeholder={t("mf_route_name", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <input type="number" step="0.1" name="milk_volume_collected" placeholder={t("mf_milk_that_day", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <div>
          <label className="text-xs text-surface-500">{t("mf_odometer_photo", lang)}</label>
          <input type="file" name="meter_photo" accept="image/*" className="mt-1 w-full text-xs" />
        </div>
        <textarea name="notes" rows={2} placeholder={t("c_notes", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <SubmitButton label={t("mf_save_log", lang)} />
      </form>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}