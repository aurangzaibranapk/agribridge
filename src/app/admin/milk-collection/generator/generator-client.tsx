"use client";
import { useFormState, useFormStatus } from "react-dom";
import { logGeneratorEntry, type ActionState } from "@/actions/generator";
import { AlertTriangle, Zap, Image as ImageIcon } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
}

interface GeneratorLog {
  id: string;
  log_date: string;
  hours_run: number;
  diesel_liters_purchased: number | null;
  diesel_cost: number | null;
  liters_per_hour: number | null;
  electricity_units: number | null;
  is_anomaly: boolean;
  meter_photo_url: string | null;
  branch_name: string | null;
}

export function GeneratorClient({ logs, branches }: { logs: GeneratorLog[]; branches: Branch[] }) {
  const anomalyCount = logs.filter((l) => l.is_anomaly).length;
  const lang = useLang();

  return (
    <div>
      {anomalyCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" /> {anomalyCount} entry mein diesel efficiency anomaly hai — dhyan dein.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("mo_chiller", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mo_hours_run", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mo_diesel_l", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_cost", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_photo", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_status", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className={`border-b border-surface-100 last:border-0 dark:border-surface-800 ${l.is_anomaly ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                    <td className="px-3 py-2 text-surface-500">{l.log_date}</td>
                    <td className="px-3 py-2 text-surface-500">{l.branch_name ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">{l.hours_run}</td>
                    <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">{l.diesel_liters_purchased ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">{l.diesel_cost ? `Rs ${l.diesel_cost.toFixed(0)}` : "-"}</td>
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
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">{t("mo_no_generator_log", lang)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <GeneratorLogForm branches={branches} />
      </div>
    </div>
  );
}

function GeneratorLogForm({ branches }: { branches: Branch[] }) {
  const [state, formAction] = useFormState(logGeneratorEntry, initialState);
  const lang = useLang();
  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold text-surface-900 dark:text-white">
        <Zap className="h-4 w-4" />{t("at_daily_generator", lang)}</h2>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("mo_log_saved_cost", lang)}</p>}
      <form action={formAction} encType="multipart/form-data" className="space-y-2">
        {branches.length > 0 && (
          <select name="branch_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Chiller/Branch Select Karein -</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <input type="date" name="log_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="0.1" name="opening_hours" required placeholder={t("mo_opening_hours", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="0.1" name="closing_hours" required placeholder={t("mo_closing_hours", lang)} className="rounded-lg border border-surface-200 p-2 text-sm" />
        </div>
        <input type="number" step="0.1" name="diesel_liters_purchased" placeholder={t("mo_diesel_litres", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <p className="text-xs text-surface-400">{t("mo_diesel_cost_auto", lang)}</p>
        <input type="number" step="0.1" name="electricity_units" placeholder={t("mo_electricity_units", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <input type="number" step="0.1" name="milk_volume_chilled" placeholder={t("mo_milk_chilled", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <div>
          <label className="text-xs text-surface-500">{t("mo_generator_photo", lang)}</label>
          <input type="file" name="meter_photo" accept="image/*" className="mt-1 w-full text-xs" />
        </div>
        <textarea name="notes" rows={2} placeholder={t("c_notes", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Log Save Karein"}</button>;
}