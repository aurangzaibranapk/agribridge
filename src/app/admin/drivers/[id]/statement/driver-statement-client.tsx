"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addDriverPayment, addMaintenanceRecord, type ActionState } from "@/actions/driver-statement";
import { Plus, X, MapPin } from "lucide-react";
import Link from "next/link";

const initialState: ActionState = {};

interface Trip {
  id: string;
  dispatch_number: string;
  dispatch_date: string;
  delivery_location: string | null;
  status: string;
  order_id: string;
  order_number: string | null;
  shop_name: string | null;
}

interface Payment {
  id: string;
  amount: number;
  payment_type: string;
  payment_date: string;
  notes: string | null;
}

interface Maintenance {
  id: string;
  maintenance_type: string;
  amount: number;
  odometer_km: number | null;
  maintenance_date: string;
  notes: string | null;
}

export function DriverStatementClient({
  driverId,
  vehicleId,
  trips,
  payments,
  maintenance,
}: {
  driverId: string;
  vehicleId: string | null;
  trips: Trip[];
  payments: Payment[];
  maintenance: Maintenance[];
}) {
  const [tab, setTab] = useState<"trips" | "payments" | "maintenance">("trips");
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg border border-surface-200 p-1 dark:border-surface-800">
        {(["trips", "payments", "maintenance"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${tab === t ? "bg-brand-600 text-white" : "text-surface-500 hover:bg-surface-50"}`}
          >
            {t === "trips" ? "Trip History" : t === "payments" ? "Salary Payments" : "Vehicle Maintenance"}
          </button>
        ))}
      </div>

      {tab === "trips" && (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          {trips.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-surface-400">Koi trip nahi hai.</p>
          ) : (
            trips.map((t) => (
              <Link
                key={t.id}
                href={`/admin/agri-orders/${t.order_id}`}
                className="flex items-center justify-between border-b border-surface-100 px-4 py-3 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800"
              >
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{t.order_number} - {t.shop_name}</p>
                  <p className="flex items-center gap-1 text-xs text-surface-400">
                    <MapPin className="h-3 w-3" /> {t.delivery_location ?? "-"} | {t.dispatch_date}
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{t.status.replace(/_/g, " ")}</span>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === "payments" && (
        <div>
          <div className="mb-2 flex justify-end">
            <button onClick={() => setShowAddPayment(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
              <Plus className="h-3.5 w-3.5" /> Payment Add Karein
            </button>
          </div>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            {payments.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-surface-400">Koi payment record nahi hai.</p>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-surface-100 px-4 py-3 last:border-0 dark:border-surface-800">
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{p.payment_type}</p>
                    <p className="text-xs text-surface-400">{p.payment_date} {p.notes ? `- ${p.notes}` : ""}</p>
                  </div>
                  <p className="text-sm font-semibold text-surface-900 dark:text-white">Rs {p.amount.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
          {showAddPayment && <AddPaymentModal driverId={driverId} onClose={() => setShowAddPayment(false)} />}
        </div>
      )}

      {tab === "maintenance" && (
        <div>
          <div className="mb-2 flex justify-end">
            {vehicleId ? (
              <button onClick={() => setShowAddMaintenance(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                <Plus className="h-3.5 w-3.5" /> Maintenance/Fuel Add Karein
              </button>
            ) : (
              <p className="text-xs text-surface-400">Is driver ke sath koi vehicle linked nahi hai.</p>
            )}
          </div>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            {maintenance.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-surface-400">Koi maintenance/fuel record nahi hai.</p>
            ) : (
              maintenance.map((m) => (
                <div key={m.id} className="flex items-center justify-between border-b border-surface-100 px-4 py-3 last:border-0 dark:border-surface-800">
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{m.maintenance_type}</p>
                    <p className="text-xs text-surface-400">
                      {m.maintenance_date} {m.odometer_km ? `- ${m.odometer_km} km` : ""} {m.notes ? `- ${m.notes}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-surface-900 dark:text-white">Rs {m.amount.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
          {showAddMaintenance && vehicleId && (
            <AddMaintenanceModal driverId={driverId} vehicleId={vehicleId} onClose={() => setShowAddMaintenance(false)} />
          )}
        </div>
      )}
    </div>
  );
}

function AddPaymentModal({ driverId, onClose }: { driverId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(addDriverPayment, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Driver Payment Add Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="driver_id" value={driverId} />
          <select name="payment_type" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="Salary">Salary</option>
            <option value="Advance">Advance</option>
            <option value="Bonus">Bonus</option>
            <option value="Other">Other</option>
          </select>
          <input type="number" step="0.01" name="amount" required placeholder="Amount (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="notes" rows={2} placeholder="Notes (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label="Payment Add Karein" />
        </form>
      </div>
    </div>
  );
}

function AddMaintenanceModal({ driverId, vehicleId, onClose }: { driverId: string; vehicleId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(addMaintenanceRecord, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Maintenance/Fuel Record Add Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="driver_id" value={driverId} />
          <input type="hidden" name="vehicle_id" value={vehicleId} />
          <select name="maintenance_type" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Type Select Karein -</option>
            <option value="Diesel/Fuel">Diesel/Fuel</option>
            <option value="Oil Change">Oil Change</option>
            <option value="Tyre">Tyre</option>
            <option value="Service">General Service</option>
            <option value="Repair">Repair</option>
            <option value="Other">Other</option>
          </select>
          <input type="number" step="0.01" name="amount" placeholder="Amount (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" name="odometer_km" placeholder="Odometer (Km) - optional" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="date" name="maintenance_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="notes" rows={2} placeholder="Notes (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label="Record Add Karein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}