"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { setMilkCollectionType, saveMilkRateSettings, type ActionState } from "@/actions/milk";
import { Truck, Home, History } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Farmer {
  id: string;
  full_name: string;
  farmer_code: string;
  milk_collection_type: string | null;
}

interface RateSettings {
  standard_rate: number;
  self_dropoff_incentive: number;
  snf_constant: number;
  reference_ts: number;
}

interface Migration {
  id: string;
  farmer_name: string;
  old_type: string | null;
  new_type: string;
  changed_at: string;
}

export function FarmerSettingsPanel({ farmers, rateSettings, migrations }: { farmers: Farmer[]; rateSettings: RateSettings; migrations: Migration[] }) {
  const lang = useLang();
  const [tab, setTab] = useState<"farmers" | "rates" | "history">("farmers");

  return (
    <div className="mt-8">
      <div className="mb-4 flex gap-2 border-b border-surface-200 dark:border-surface-800">
        <TabButton active={tab === "farmers"} onClick={() => setTab("farmers")} label={t("fs_farmer_type", lang)} />
        <TabButton active={tab === "rates"} onClick={() => setTab("rates")} label={t("fs_rate_settings", lang)} />
        <TabButton active={tab === "history"} onClick={() => setTab("history")} label={t("fs_migration_history", lang)} />
      </div>

      {tab === "farmers" && <FarmerTypeList farmers={farmers} />}
      {tab === "rates" && <RateSettingsForm settings={rateSettings} />}
      {tab === "history" && <MigrationHistory migrations={migrations} />}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-brand-600 text-brand-700 dark:text-brand-400" : "border-transparent text-surface-500 hover:text-surface-700"}`}
    >
      {label}
    </button>
  );
}

function FarmerTypeList({ farmers }: { farmers: Farmer[] }) {
  const lang = useLang();
  return (
    <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
            <th className="px-3 py-2 font-medium text-surface-500">{t("c_farmer", lang)}</th>
            <th className="px-3 py-2 font-medium text-surface-500">{t("fs_current_type", lang)}</th>
            <th className="px-3 py-2 font-medium text-surface-500">{t("fs_change", lang)}</th>
          </tr>
        </thead>
        <tbody>
          {farmers.map((f) => (
            <tr key={f.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
              <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{f.full_name} <span className="text-xs text-surface-400">({f.farmer_code})</span></td>
              <td className="px-3 py-2">
                {f.milk_collection_type === "self_dropoff" ? (
                  <span className="flex w-fit items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"><Home className="h-3 w-3" />{t("fs_self_dropoff", lang)}</span>
                ) : f.milk_collection_type === "field_collection" ? (
                  <span className="flex w-fit items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"><Truck className="h-3 w-3" />{t("fs_field_collection", lang)}</span>
                ) : (
                  <span className="text-xs text-surface-400">{t("fs_not_set", lang)}</span>
                )}
              </td>
              <td className="px-3 py-2">
                <TypeChangeForm farmerId={f.id} />
              </td>
            </tr>
          ))}
          {farmers.length === 0 && (
            <tr><td colSpan={3} className="px-3 py-8 text-center text-surface-400">{t("fs_no_farmer", lang)}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TypeChangeForm({ farmerId }: { farmerId: string }) {
  const lang = useLang();
  const [, fieldAction] = useFormState(setMilkCollectionType, initialState);
  const [, dropoffAction] = useFormState(setMilkCollectionType, initialState);
  return (
    <div className="flex gap-1.5">
      <form action={fieldAction}>
        <input type="hidden" name="farmer_id" value={farmerId} />
        <input type="hidden" name="milk_collection_type" value="field_collection" />
        <button type="submit" className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">{t("fs_field_collection", lang)}</button>
      </form>
      <form action={dropoffAction}>
        <input type="hidden" name="farmer_id" value={farmerId} />
        <input type="hidden" name="milk_collection_type" value="self_dropoff" />
        <button type="submit" className="rounded-lg border border-brand-200 px-2 py-1 text-xs text-brand-700 hover:bg-brand-50">{t("fs_self_dropoff", lang)}</button>
      </form>
    </div>
  );
}

function RateSettingsForm({ settings }: { settings: RateSettings }) {
  const lang = useLang();
  const [state, formAction] = useFormState(saveMilkRateSettings, initialState);
  return (
    <div className="max-w-md rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("fs_settings_saved", lang)}</p>}
      <form action={formAction} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-surface-600 dark:text-surface-300">{t("fs_standard_rate", lang)}</label>
          <input type="number" step="0.01" name="standard_rate" defaultValue={settings.standard_rate} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600 dark:text-surface-300">{t("fs_dropoff_incentive", lang)}</label>
          <input type="number" step="0.01" name="self_dropoff_incentive" defaultValue={settings.self_dropoff_incentive} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600 dark:text-surface-300">{t("fs_snf_constant", lang)}</label>
          <input type="number" step="0.001" name="snf_constant" defaultValue={settings.snf_constant} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-surface-600 dark:text-surface-300">{t("fs_reference_ts", lang)}</label>
          <input type="number" step="0.1" name="reference_ts" defaultValue={settings.reference_ts} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}

function MigrationHistory({ migrations }: { migrations: Migration[] }) {
  const lang = useLang();
  return (
    <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
            <th className="px-3 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
            <th className="px-3 py-2 font-medium text-surface-500">{t("c_farmer", lang)}</th>
            <th className="px-3 py-2 font-medium text-surface-500">{t("fs_change", lang)}</th>
          </tr>
        </thead>
        <tbody>
          {migrations.map((m) => (
            <tr key={m.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
              <td className="px-3 py-2 text-surface-500">{new Date(m.changed_at).toLocaleDateString()}</td>
              <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{m.farmer_name}</td>
              <td className="px-3 py-2 text-surface-600 dark:text-surface-400">
                {m.old_type ?? "Not Set"} → <strong>{m.new_type}</strong>
              </td>
            </tr>
          ))}
          {migrations.length === 0 && (
            <tr><td colSpan={3} className="px-3 py-8 text-center text-surface-400 flex items-center justify-center gap-1"><History className="h-4 w-4" />{t("fs_no_change_history", lang)}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Settings Save Karein"}</button>;
}