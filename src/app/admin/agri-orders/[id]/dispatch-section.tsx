"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createDispatch, confirmDelivery, type ActionState } from "@/actions/agri-dispatch";
import { Truck, X, MapPin, Check } from "lucide-react";
import type { OrderPermissions } from "@/lib/order-permissions";

const initialState: ActionState = {};

interface OrderItem {
  id: string;
  product_name: string;
  batch_no: string | null;
  expiry_date: string | null;
  order_qty: number;
}

interface DispatchItem {
  id: string;
  product_name: string;
  dispatched_qty: number;
}

interface Dispatch {
  id: string;
  dispatch_number: string;
  vehicle_no: string | null;
  driver_name: string | null;
  driver_mobile: string | null;
  transporter: string | null;
  dispatch_date: string;
  expected_delivery_date: string | null;
  delivery_location: string | null;
  status: string;
}

interface Delivery {
  id: string;
  delivered_date: string;
  receiver_name: string;
  delivered_qty: number | null;
  short_qty: number | null;
  damaged_qty: number | null;
  delivery_photo_url: string | null;
  delivery_challan_url: string | null;
}

interface Driver {
  id: string;
  full_name: string;
  mobile_number: string | null;
  vehicle_number: string;
}

interface CurrentUserIdentity {
  name: string;
  mobile: string;
}

export function DispatchSection({
  orderId,
  orderStatus,
  orderItems,
  dispatch,
  delivery,
  permissions,
  drivers,
  dispatchItems,
  currentUserIdentity,
}: {
  orderId: string;
  orderStatus: string;
  orderItems: OrderItem[];
  dispatch: Dispatch | null;
  delivery: Delivery | null;
  permissions: OrderPermissions;
  drivers: Driver[];
  dispatchItems: DispatchItem[];
  currentUserIdentity: CurrentUserIdentity;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
        <Truck className="h-4 w-4" /> Dispatch & Delivery
      </h3>

      {!dispatch && orderStatus === "approved" && permissions.canCreateDispatch && (
        <button onClick={() => setShowCreate(true)} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Dispatch Banayein
        </button>
      )}

      {dispatch && (
        <div className="space-y-1 text-sm">
          <p className="font-mono text-xs text-surface-500">{dispatch.dispatch_number}</p>
          <div className="flex justify-between"><span className="text-surface-500">Vehicle</span><span>{dispatch.vehicle_no ?? "-"}</span></div>
          <div className="flex justify-between"><span className="text-surface-500">Driver</span><span>{dispatch.driver_name ?? "-"} {dispatch.driver_mobile ? `(${dispatch.driver_mobile})` : ""}</span></div>
          <div className="flex justify-between"><span className="text-surface-500">Dispatch Date</span><span>{dispatch.dispatch_date}</span></div>
          {dispatch.delivery_location && <div className="flex justify-between"><span className="text-surface-500">Location</span><span>{dispatch.delivery_location}</span></div>}

          {!delivery && (orderStatus === "dispatched" || orderStatus === "in_transit") && permissions.canConfirmDelivery && (
            <button onClick={() => setShowConfirm(true)} className="mt-3 w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Delivery Confirm Karein
            </button>
          )}

          {delivery && (
            <div className="mt-3 rounded-lg bg-green-50 p-3 text-xs dark:bg-green-950/30">
              <p className="font-medium text-green-800 dark:text-green-300">Delivered - {delivery.receiver_name}</p>
              <p className="text-green-600">{delivery.delivered_date}</p>
              {(delivery.short_qty ?? 0) > 0 && <p className="mt-1 text-amber-700">Short: {delivery.short_qty}</p>}
              {(delivery.damaged_qty ?? 0) > 0 && <p className="text-red-700">Damaged: {delivery.damaged_qty}</p>}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateDispatchModal orderId={orderId} orderItems={orderItems} drivers={drivers} onClose={() => setShowCreate(false)} />
      )}
      {showConfirm && dispatch && (
        <ConfirmDeliveryModal orderId={orderId} dispatchId={dispatch.id} dispatchItems={dispatchItems} currentUserIdentity={currentUserIdentity} onClose={() => setShowConfirm(false)} />
      )}
    </div>
  );
}

function CreateDispatchModal({
  orderId,
  orderItems,
  drivers,
  onClose,
}: {
  orderId: string;
  orderItems: OrderItem[];
  drivers: Driver[];
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(createDispatch, initialState);
  const [rows, setRows] = useState<Record<string, { dispatched_qty: number; short_qty: number; damaged_qty: number }>>(
    Object.fromEntries(orderItems.map((i) => [i.id, { dispatched_qty: i.order_qty, short_qty: 0, damaged_qty: 0 }]))
  );
  const [selectedDriverId, setSelectedDriverId] = useState("");
  if (state.success) setTimeout(onClose, 800);

  function updateRow(itemId: string, field: "dispatched_qty" | "short_qty" | "damaged_qty", value: number) {
    setRows((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  }

  function handleDriverSelect(driverId: string) {
    setSelectedDriverId(driverId);
    const driver = drivers.find((d) => d.id === driverId);
    if (driver) {
      const nameInput = document.querySelector('input[name="driver_name"]') as HTMLInputElement;
      const mobileInput = document.querySelector('input[name="driver_mobile"]') as HTMLInputElement;
      const vehicleInput = document.querySelector('input[name="vehicle_no"]') as HTMLInputElement;
      if (nameInput) nameInput.value = driver.full_name;
      if (mobileInput) mobileInput.value = driver.mobile_number ?? "";
      if (vehicleInput) vehicleInput.value = driver.vehicle_number;
    }
  }

  const itemsJson = JSON.stringify(
    orderItems.map((i) => ({
      order_item_id: i.id,
      product_name: i.product_name,
      batch_no: i.batch_no,
      expiry_date: i.expiry_date,
      ordered_qty: i.order_qty,
      dispatched_qty: rows[i.id]?.dispatched_qty ?? i.order_qty,
      short_qty: rows[i.id]?.short_qty ?? 0,
      damaged_qty: rows[i.id]?.damaged_qty ?? 0,
    }))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Dispatch Banayein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="items_json" value={itemsJson} />

          {drivers.length > 0 && (
            <div>
              <label className="text-xs text-surface-500">Registered Driver Select Karein (optional)</label>
              <select value={selectedDriverId} onChange={(e) => handleDriverSelect(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
                <option value="">- Manually likhein -</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name} {d.vehicle_number ? `(${d.vehicle_number})` : ""}</option>
                ))}
              </select>
            </div>
          )}
          <input name="vehicle_no" placeholder="Vehicle Number" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="driver_name" placeholder="Driver Name" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="driver_mobile" placeholder="Driver Mobile" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="transporter" placeholder="Transporter (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" name="dispatch_date" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-surface-200 p-2 text-sm" />
            <input type="date" name="expected_delivery_date" className="rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <input name="delivery_location" placeholder="Delivery Location" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

          <div>
            <p className="mb-1 text-xs font-medium text-surface-600">Items (agar kam bhej rahe hain to yahan adjust karein)</p>
            {orderItems.map((item) => (
              <div key={item.id} className="mb-2 rounded-lg border border-surface-200 p-2">
                <p className="text-xs font-medium text-surface-800">{item.product_name} (Ordered: {item.order_qty})</p>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="text-[10px] text-surface-400">Dispatch Qty</label>
                    <input type="number" defaultValue={item.order_qty} onChange={(e) => updateRow(item.id, "dispatched_qty", Number(e.target.value))} className="w-full rounded border border-surface-200 p-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-surface-400">Short</label>
                    <input type="number" defaultValue={0} onChange={(e) => updateRow(item.id, "short_qty", Number(e.target.value))} className="w-full rounded border border-surface-200 p-1 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-surface-400">Damaged</label>
                    <input type="number" defaultValue={0} onChange={(e) => updateRow(item.id, "damaged_qty", Number(e.target.value))} className="w-full rounded border border-surface-200 p-1 text-xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <SubmitButton label="Dispatch Banayein" />
        </form>
      </div>
    </div>
  );
}

interface DeliveryItemRow {
  received_qty: number;
  short_qty: number;
  damaged_qty: number;
  reason: string;
}

function ConfirmDeliveryModal({
  orderId,
  dispatchId,
  dispatchItems,
  currentUserIdentity,
  onClose,
}: {
  orderId: string;
  dispatchId: string;
  dispatchItems: DispatchItem[];
  currentUserIdentity: CurrentUserIdentity;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(confirmDelivery, initialState);
  const [rows, setRows] = useState<Record<string, DeliveryItemRow>>(
    Object.fromEntries(dispatchItems.map((i) => [i.id, { received_qty: i.dispatched_qty, short_qty: 0, damaged_qty: 0, reason: "" }]))
  );

  if (state.success) setTimeout(onClose, 800);

  function updateRow(itemId: string, field: keyof DeliveryItemRow, value: string | number) {
    setRows((prev) => {
      const current = { ...prev[itemId], [field]: value };
      return { ...prev, [itemId]: current };
    });
  }

  function markComplete(itemId: string, dispatchedQty: number) {
    updateRow(itemId, "received_qty", dispatchedQty);
    updateRow(itemId, "short_qty", 0);
    updateRow(itemId, "damaged_qty", 0);
    updateRow(itemId, "reason", "");
  }

  const itemsJson = JSON.stringify(
    dispatchItems.map((i) => ({
      dispatch_item_id: i.id,
      product_name: i.product_name,
      dispatched_qty: i.dispatched_qty,
      received_qty: rows[i.id]?.received_qty ?? i.dispatched_qty,
      short_qty: rows[i.id]?.short_qty ?? 0,
      damaged_qty: rows[i.id]?.damaged_qty ?? 0,
      reason: rows[i.id]?.reason ?? "",
    }))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Delivery Confirm Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="dispatch_id" value={dispatchId} />
          <input type="hidden" name="items_json" value={itemsJson} />

          <div>
            <p className="mb-1 text-xs font-medium text-surface-600">Aya Kya - har item check karein</p>
            {dispatchItems.map((item) => {
              const row = rows[item.id];
              const hasDiff = (row?.short_qty ?? 0) > 0 || (row?.damaged_qty ?? 0) > 0;
              return (
                <div key={item.id} className="mb-2 rounded-lg border border-surface-200 p-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium text-surface-800">{item.product_name} (Dispatch: {item.dispatched_qty})</p>
                    <button
                      type="button"
                      onClick={() => markComplete(item.id, item.dispatched_qty)}
                      className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 hover:bg-green-100"
                    >
                      <Check className="h-3 w-3" /> Mukammal Sahi
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="text-[10px] text-surface-400">Received</label>
                      <input
                        type="number"
                        value={row?.received_qty ?? item.dispatched_qty}
                        onChange={(e) => updateRow(item.id, "received_qty", Number(e.target.value))}
                        className="w-full rounded border border-surface-200 p-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-surface-400">Short</label>
                      <input
                        type="number"
                        value={row?.short_qty ?? 0}
                        onChange={(e) => updateRow(item.id, "short_qty", Number(e.target.value))}
                        className="w-full rounded border border-amber-200 p-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-surface-400">Damaged</label>
                      <input
                        type="number"
                        value={row?.damaged_qty ?? 0}
                        onChange={(e) => updateRow(item.id, "damaged_qty", Number(e.target.value))}
                        className="w-full rounded border border-red-200 p-1 text-xs"
                      />
                    </div>
                  </div>
                  {hasDiff && (
                    <input
                      required
                      placeholder="Wajah likhein (zaroori hai)"
                      value={row?.reason ?? ""}
                      onChange={(e) => updateRow(item.id, "reason", e.target.value)}
                      className="mt-1.5 w-full rounded border border-red-300 bg-red-50 p-1.5 text-xs"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label className="text-xs text-surface-500">Receiver Naam (aap ke system record se bhar diya hai, zaroorat ho to badal dein)</label>
            <input name="receiver_name" required defaultValue={currentUserIdentity.name} placeholder="Receiver Naam" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <input name="receiver_cnic" placeholder="Receiver CNIC (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input name="receiver_mobile" defaultValue={currentUserIdentity.mobile} placeholder="Receiver Mobile (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="date" name="delivered_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

          <div>
            <label className="text-xs text-surface-500">Delivery Photo (optional)</label>
            <input type="file" name="delivery_photo" accept="image/*" className="mt-1 w-full text-xs" />
          </div>
          <div>
            <label className="text-xs text-surface-500">Delivery Challan (optional)</label>
            <input type="file" name="delivery_challan" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
          </div>
          <textarea name="notes" rows={2} placeholder="Notes (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

          <SubmitButton label="Delivery Confirm Karein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "..." : label}
    </button>
  );
}