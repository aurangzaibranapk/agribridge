"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { createGRN, submitWarehouseExplanation, finalizeGrnDiscrepancy, type ActionState } from "@/actions/agri-grn";
import { ClipboardCheck, X, AlertTriangle, Check } from "lucide-react";
import type { OrderPermissions } from "@/lib/order-permissions";

const initialState: ActionState = {};

interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  batch_no: string | null;
  expiry_date: string | null;
  order_qty: number;
  unit_price: number;
}

interface GrnRecord {
  id: string;
  grn_number: string;
  ordered_value: number;
  received_value: number;
  shortage_amount: number;
  damage_amount: number;
  payable_amount: number;
  discrepancy_status: string;
  warehouse_notes: string | null;
  final_payable_amount: number | null;
}

interface DeliveryInfo {
  received_qty: number;
  short_qty: number;
  damaged_qty: number;
  reason: string | null;
}

interface ItemRow {
  received_qty: number;
  difference_type: string;
  seal_condition: string;
  packaging_condition: string;
  quality_status: string;
  rejection_reason: string;
}

export function GrnSection({
  orderId,
  dispatchId,
  orderStatus,
  orderItems,
  grn,
  permissions,
  deliveryInfoByOrderItem,
}: {
  orderId: string;
  dispatchId: string | null;
  orderStatus: string;
  orderItems: OrderItem[];
  grn: GrnRecord | null;
  permissions: OrderPermissions;
  deliveryInfoByOrderItem: Record<string, DeliveryInfo>;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
        <ClipboardCheck className="h-4 w-4" /> GRN (Goods Receiving)
      </h3>

      {!grn && orderStatus === "delivered" && permissions.canCreateGrn && (
        <button onClick={() => setShowCreate(true)} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700">
          GRN Banayein
        </button>
      )}

      {grn && (
        <div className="space-y-1 text-sm">
          <p className="font-mono text-xs text-surface-500">{grn.grn_number}</p>
          <div className="flex justify-between"><span className="text-surface-500">Ordered Value</span><span>Rs {grn.ordered_value.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-surface-500">Received Value</span><span>Rs {grn.received_value.toLocaleString()}</span></div>
          <div className="flex justify-between text-red-600"><span>Shortage</span><span>- Rs {grn.shortage_amount.toLocaleString()}</span></div>
          <div className="flex justify-between text-red-600"><span>Damage</span><span>- Rs {grn.damage_amount.toLocaleString()}</span></div>
          <div className="flex justify-between border-t border-surface-100 pt-1 font-semibold dark:border-surface-800">
            <span>{grn.discrepancy_status === "completed" ? "Payable Amount" : "Proposed Payable"}</span>
            <span>Rs {(grn.final_payable_amount ?? grn.payable_amount).toLocaleString()}</span>
          </div>
          <p className="mt-1 text-xs text-green-600">Stock inventory mein add ho chuka hai.</p>

          {grn.discrepancy_status === "pending_warehouse_review" && (
            <div className="mt-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Discrepancy mili hai - Warehouse ki wajah ka intezar hai</p>
              {(permissions.role === "warehouse" || ["super_admin", "admin", "owner"].includes(permissions.role ?? "")) && (
                <WarehouseExplanationForm orderId={orderId} grnId={grn.id} />
              )}
            </div>
          )}

          {grn.discrepancy_status === "pending_finance_review" && (
            <div className="mt-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
              <p className="text-xs font-semibold text-blue-700">Warehouse Wajah:</p>
              <p className="mt-0.5 text-xs text-blue-600">{grn.warehouse_notes}</p>
              {(permissions.role === "finance" || ["super_admin", "admin", "owner"].includes(permissions.role ?? "")) && (
                <FinalizeForm orderId={orderId} grnId={grn.id} suggestedAmount={grn.payable_amount} />
              )}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateGrnModal orderId={orderId} dispatchId={dispatchId} orderItems={orderItems} deliveryInfoByOrderItem={deliveryInfoByOrderItem} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function WarehouseExplanationForm({ orderId, grnId }: { orderId: string; grnId: string }) {
  const router = useRouter();
  const [state, formAction] = useFormState(submitWarehouseExplanation, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success]);

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="grn_id" value={grnId} />
      {state.error && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}
      <textarea name="warehouse_notes" required rows={2} placeholder="Wajah likhein (jaise: packing mein hi kam tha, transit mein damage hua)" className="w-full rounded-lg border border-surface-200 p-2 text-xs" />
      <SubmitButton label="Wajah Bhejein" />
    </form>
  );
}

function FinalizeForm({ orderId, grnId, suggestedAmount }: { orderId: string; grnId: string; suggestedAmount: number }) {
  const router = useRouter();
  const [state, formAction] = useFormState(finalizeGrnDiscrepancy, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success]);

  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="grn_id" value={grnId} />
      {state.error && <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}
      <div>
        <label className="text-[10px] text-blue-600">Final Payable Amount (Rs)</label>
        <input type="number" step="0.01" name="final_payable_amount" defaultValue={suggestedAmount} required className="mt-0.5 w-full rounded-lg border border-blue-200 p-2 text-xs" />
      </div>
      <textarea name="finance_notes" rows={2} placeholder="Notes (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-xs" />
      <SubmitButton label="Finalize Karein" />
    </form>
  );
}

function CreateGrnModal({
  orderId,
  dispatchId,
  orderItems,
  deliveryInfoByOrderItem,
  onClose,
}: {
  orderId: string;
  dispatchId: string | null;
  orderItems: OrderItem[];
  deliveryInfoByOrderItem: Record<string, DeliveryInfo>;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(createGRN, initialState);
  const [discountAdjustment, setDiscountAdjustment] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState(0);

  // Pre-fill everything from what the branch already confirmed at
  // Delivery Confirm time - the warehouse just double-checks and
  // submits, instead of re-entering numbers that were already recorded.
  const [rows, setRows] = useState<Record<string, ItemRow>>(
    Object.fromEntries(
      orderItems.map((i) => {
        const info = deliveryInfoByOrderItem[i.id];
        const hasDiff = info && (info.short_qty > 0 || info.damaged_qty > 0);
        return [
          i.id,
          {
            received_qty: info ? info.received_qty : i.order_qty,
            difference_type: hasDiff ? (info!.short_qty > 0 ? "Short" : "Damaged") : "None",
            seal_condition: "Good",
            packaging_condition: hasDiff ? "Damaged" : "Good",
            quality_status: hasDiff ? "Accepted with Difference" : "Accepted",
            rejection_reason: info?.reason ?? "",
          },
        ];
      })
    )
  );
  if (state.success) setTimeout(onClose, 800);

  function updateRow(itemId: string, field: keyof ItemRow, value: string | number) {
    setRows((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  }

  const liveReceivedValue = orderItems.reduce((sum, i) => sum + (rows[i.id]?.received_qty ?? i.order_qty) * i.unit_price, 0);
  const liveShortage = orderItems.reduce((sum, i) => {
    const row = rows[i.id];
    if (row?.difference_type !== "Short") return sum;
    return sum + Math.abs((row.received_qty ?? i.order_qty) - i.order_qty) * i.unit_price;
  }, 0);
  const liveDamage = orderItems.reduce((sum, i) => {
    const row = rows[i.id];
    if (row?.difference_type !== "Damaged") return sum;
    return sum + Math.abs((row.received_qty ?? i.order_qty) - i.order_qty || row.received_qty) * i.unit_price;
  }, 0);
  const liveTotalPayable = liveReceivedValue - liveShortage - liveDamage - discountAdjustment + additionalCharges;

  const itemsJson = JSON.stringify(
    orderItems.map((i) => ({
      order_item_id: i.id,
      product_id: i.product_id,
      product_name: i.product_name,
      batch_no: i.batch_no,
      expiry_date: i.expiry_date,
      manufacturing_date: null,
      unit_price: i.unit_price,
      ordered_qty: i.order_qty,
      received_qty: rows[i.id]?.received_qty ?? i.order_qty,
      difference_type: rows[i.id]?.difference_type ?? "None",
      seal_condition: rows[i.id]?.seal_condition ?? "Good",
      packaging_condition: rows[i.id]?.packaging_condition ?? "Good",
      quality_status: rows[i.id]?.quality_status ?? "Accepted",
      rejection_reason: rows[i.id]?.rejection_reason ?? "",
    }))
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">GRN Banayein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">
          Delivery ke waqt jo quantities confirm hui thin, wo yahan khud aa gayi hain — bas check kar ke submit karein.
          Accepted items khud shop ki inventory mein add ho jayenge.
        </p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="dispatch_id" value={dispatchId ?? ""} />
          <input type="hidden" name="items_json" value={itemsJson} />

          <input type="date" name="receiving_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />

          {orderItems.map((item) => {
            const info = deliveryInfoByOrderItem[item.id];
            const row = rows[item.id];
            return (
              <div key={item.id} className="rounded-lg border border-surface-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-surface-800">{item.product_name} (Ordered: {item.order_qty})</p>
                  {info && (info.short_qty > 0 || info.damaged_qty > 0) && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      <AlertTriangle className="h-3 w-3" /> Delivery pe farak mila tha
                    </span>
                  )}
                  {info && info.short_qty === 0 && info.damaged_qty === 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                      <Check className="h-3 w-3" /> Delivery pe sahi mila tha
                    </span>
                  )}
                </div>
                {info?.reason && (
                  <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">Delivery Wajah: {info.reason}</p>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className="text-[10px] text-surface-400">Received Qty</label>
                    <input type="number" value={row.received_qty} onChange={(e) => updateRow(item.id, "received_qty", Number(e.target.value))} className="w-full rounded border border-surface-200 p-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-surface-400">Difference</label>
                    <select value={row.difference_type} onChange={(e) => updateRow(item.id, "difference_type", e.target.value)} className="w-full rounded border border-surface-200 p-1.5 text-xs">
                      <option>None</option>
                      <option>Short</option>
                      <option>Excess</option>
                      <option>Damaged</option>
                      <option>Wrong Product</option>
                      <option>Expired</option>
                      <option>Batch Issue</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-surface-400">Seal Condition</label>
                    <input value={row.seal_condition} onChange={(e) => updateRow(item.id, "seal_condition", e.target.value)} className="w-full rounded border border-surface-200 p-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-surface-400">Quality Status</label>
                    <select value={row.quality_status} onChange={(e) => updateRow(item.id, "quality_status", e.target.value)} className="w-full rounded border border-surface-200 p-1.5 text-xs">
                      <option>Accepted</option>
                      <option>Accepted with Difference</option>
                      <option>Rejected</option>
                    </select>
                  </div>
                </div>
                {row.quality_status === "Rejected" && (
                  <input placeholder="Rejection Reason" value={row.rejection_reason} onChange={(e) => updateRow(item.id, "rejection_reason", e.target.value)} className="mt-2 w-full rounded border border-red-200 p-1.5 text-xs" />
                )}
              </div>
            );
          })}

          <div className="rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm dark:bg-surface-800">
            <div className="flex justify-between"><span className="text-surface-500">Received Value (jitna stock aya)</span><span>Rs {liveReceivedValue.toLocaleString()}</span></div>
            {liveShortage > 0 && <div className="flex justify-between text-red-600"><span>Shortage</span><span>- Rs {liveShortage.toLocaleString()}</span></div>}
            {liveDamage > 0 && <div className="flex justify-between text-red-600"><span>Damage</span><span>- Rs {liveDamage.toLocaleString()}</span></div>}
            {additionalCharges > 0 && <div className="flex justify-between text-blue-600"><span>Charges (Freight, wagera)</span><span>+ Rs {additionalCharges.toLocaleString()}</span></div>}
            {discountAdjustment > 0 && <div className="flex justify-between text-red-600"><span>Discount Adjustment</span><span>- Rs {discountAdjustment.toLocaleString()}</span></div>}
            <div className="mt-1 flex justify-between border-t border-surface-200 pt-1 font-semibold dark:border-surface-700"><span>Total Payable</span><span>Rs {liveTotalPayable.toLocaleString()}</span></div>
          </div>
          <div>
            <label className="text-xs text-surface-500">Charges - Freight/Loading wagera (Rs) - agar nahi lena to 0 rakhein</label>
            <input type="number" name="additional_charges" value={additionalCharges} onChange={(e) => setAdditionalCharges(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
            <p className="mt-1 text-[11px] text-surface-400">Agar yahan amount daali to ye stock ki cost mein shamil ho jayegi (asal landed cost).</p>
          </div>
          <div>
            <label className="text-xs text-surface-500">Discount Adjustment (Rs)</label>
            <input type="number" name="discount_adjustment" value={discountAdjustment} onChange={(e) => setDiscountAdjustment(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label="GRN Submit Karein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}