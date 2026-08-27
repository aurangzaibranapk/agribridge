"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { recordRouteCollection, updateChillerReceived, type ActionState } from "@/actions/milk-routes";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
}

interface RouteEntry {
  id: string;
  route_name: string;
  rider_name: string | null;
  collection_date: string;
  shift: string;
  field_collected_volume: number;
  chiller_received_volume: number | null;
  shortage_liters: number | null;
  shortage_percentage: number | null;
  is_red_alert: boolean;
  branch_name: string | null;
}

export function RoutesClient({ entries, branches }: { entries: RouteEntry[]; branches: Branch[] }) {
  const redAlertCount = entries.filter((e) => e.is_red_alert).length;

  return (
    <div>
      {redAlertCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" /> {redAlertCount} route(s) mein shortage threshold se zyada gap hai — dhyan dein.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">Date</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Chiller</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Route/Rider</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Field (L)</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Chiller (L)</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Shortage %</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className={`border-b border-surface-100 last:border-0 dark:border-surface-800 ${e.is_red_alert ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                    <td className="px-3 py-2 text-surface-500">{e.collection_date}</td>
                    <td className="px-3 py-2 text-surface-500">{e.branch_name ?? "-"}</td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{e.route_name} {e.rider_name ? `(${e.rider_name})` : ""}</td>
                    <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">{e.field_collected_volume}</td>
                    <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">
                      {e.chiller_received_volume ?? <ChillerInput entryId={e.id} />}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-surface-700 dark:text-surface-300">
                      {e.shortage_percentage !== null ? `${e.shortage_percentage.toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-3 py-2">
                      {e.chiller_received_volume === null ? (
                        <span className="text-xs text-surface-400">Pending</span>
                      ) : e.is_red_alert ? (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-3 w-3" /> Red Alert
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">Abhi koi route entry nahi hai.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <NewRouteEntryForm branches={branches} />
      </div>
    </div>
  );
}

function ChillerInput({ entryId }: { entryId: string }) {
  const [state, formAction] = useFormState(updateChillerReceived, initialState);
  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="entry_id" value={entryId} />
      <input type="number" step="0.1" name="chiller_received_volume" placeholder="Add" required className="w-20 rounded-lg border border-surface-200 p-1 text-xs" />
      <button type="submit" className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700">Save</button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

function NewRouteEntryForm({ branches }: { branches: Branch[] }) {
  const [state, formAction] = useFormState(recordRouteCollection, initialState);
  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-sm font-semibold text-surface-900 dark:text-white">Field Collection Entry</h2>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Entry save ho gayi.</p>}
      <form action={formAction} className="space-y-2">
        {branches.length > 0 && (
          <select name="branch_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Chiller/Branch Select Karein -</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <input name="route_name" required placeholder="Route Naam" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <input name="rider_name" placeholder="Rider Naam (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" name="collection_date" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-surface-200 p-2 text-sm" />
          <select name="shift" className="rounded-lg border border-surface-200 p-2 text-sm">
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
        <input type="number" step="0.1" name="field_collected_volume" required placeholder="Field Collected Volume (L)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <input type="number" step="0.1" name="chiller_received_volume" placeholder="Chiller Received Volume (L) - agar pata hai" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Entry Save Karein"}</button>;
}