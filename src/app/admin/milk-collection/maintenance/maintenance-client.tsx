"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { logMaintenance, recordFundWithdrawal, type ActionState } from "@/actions/maintenance";
import { Wrench, AlertTriangle, PiggyBank, X } from "lucide-react";

const initialState: ActionState = {};

interface Vehicle {
  id: string;
  vehicle_name: string;
  last_service_km: number;
  service_interval_km: number;
  current_km: number;
}

interface MaintenanceLog {
  id: string;
  service_date: string;
  description: string;
  cost: number;
  km_at_service: number;
  vehicle_name: string;
}

export function MaintenanceClient({
  vehicles,
  logs,
  fundBalance,
  monthlyContribution,
}: {
  vehicles: Vehicle[];
  logs: MaintenanceLog[];
  fundBalance: number;
  monthlyContribution: number;
}) {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const dueVehicles = vehicles.filter((v) => v.current_km - v.last_service_km >= v.service_interval_km);

  return (
    <div>
      {dueVehicles.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {dueVehicles.length} vehicle(s) ki service due hai: {dueVehicles.map((v) => v.vehicle_name).join(", ")}
        </div>
      )}

      <div className="mb-6 rounded-card border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-900/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              <PiggyBank className="h-3.5 w-3.5" /> Motorcycle Replacement Fund
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-brand-900 dark:text-brand-100">Rs {fundBalance.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-brand-600 dark:text-brand-400">Rs {monthlyContribution.toLocaleString()}/month khud jama hoti hai</p>
          </div>
          <button onClick={() => setShowWithdraw(true)} className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50">
            Withdrawal Karein
          </button>
        </div>
      </div>
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Vehicle Status</h2>
          <div className="mb-6 space-y-2">
            {vehicles.map((v) => {
              const kmSinceService = v.current_km - v.last_service_km;
              const isDue = kmSinceService >= v.service_interval_km;
              return (
                <div key={v.id} className={`rounded-lg border p-3 text-sm ${isDue ? "border-amber-200 bg-amber-50" : "border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-surface-800 dark:text-surface-200">{v.vehicle_name}</span>
                    {isDue && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Service Due</span>}
                  </div>
                  <p className="mt-1 text-xs text-surface-500">
                    Last Service: {v.last_service_km} km | Ab Tak: {kmSinceService.toFixed(0)} km chal chuki hai (har {v.service_interval_km} km par service)
                  </p>
                </div>
              );
            })}
          </div>

          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Maintenance History</h2>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">Date</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Vehicle</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Detail</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Cost</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 text-surface-500">{l.service_date}</td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{l.vehicle_name}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{l.description}</td>
                    <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {l.cost.toLocaleString()}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-surface-400">Abhi koi maintenance record nahi hai.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <MaintenanceForm vehicles={vehicles} />
      </div>
    </div>
  );
}

function MaintenanceForm({ vehicles }: { vehicles: Vehicle[] }) {
  const [state, formAction] = useFormState(logMaintenance, initialState);
  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold text-surface-900 dark:text-white">
        <Wrench className="h-4 w-4" /> Service/Maintenance Log Karein
      </h2>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Log save ho gaya.</p>}
      <form action={formAction} className="space-y-2">
        <select name="vehicle_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">- Vehicle Select Karein -</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.vehicle_name}</option>
          ))}
        </select>
        <input type="date" name="service_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <input type="number" step="0.1" name="km_at_service" required placeholder="KM Reading (is waqt)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <textarea name="description" required rows={2} placeholder="Kya kaam hua (oil change, tyre, waghera)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <input type="number" step="0.01" name="cost" placeholder="Cost (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
        <SubmitButton label="Save Karein" />
      </form>
    </div>
  );
}

function WithdrawModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useFormState(recordFundWithdrawal, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Fund Se Nikalein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="date" name="withdrawal_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="0.01" name="amount" required placeholder="Amount (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="reason" required rows={2} placeholder="Wajah (e.g. Nayi motorcycle khareedi)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label="Withdrawal Save Karein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}