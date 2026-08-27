"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { adjustStock, transferStock, type ActionState } from "@/actions/inventory";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { AlertTriangle, Package, DollarSign, Settings2, ArrowLeftRight, X } from "lucide-react";

interface InventoryRow {
  id: string;
  product_id: string;
  batch_id: string | null;
  product_name: string;
  pack_size: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  warehouse_id: string;
  warehouse_name: string;
  quantity_on_hand: number;
  purchase_price: number;
  min_stock_threshold: number;
}

interface Warehouse {
  id: string;
  name: string;
}

const initialState: ActionState = {};

export function InventoryClient({ rows, warehouses }: { rows: InventoryRow[]; warehouses: Warehouse[] }) {
  const [adjustTarget, setAdjustTarget] = useState<InventoryRow | null>(null);
  const [transferTarget, setTransferTarget] = useState<InventoryRow | null>(null);

  const totalValue = useMemo(
    () => rows.reduce((sum, r) => sum + r.quantity_on_hand * r.purchase_price, 0),
    [rows]
  );
  const lowStockRows = useMemo(
    () => rows.filter((r) => r.min_stock_threshold > 0 && r.quantity_on_hand <= r.min_stock_threshold),
    [rows]
  );

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center gap-2 text-surface-500">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Stock Lines</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{rows.length}</p>
        </Card>
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 text-brand-600">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Stock Value</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-brand-700 dark:text-brand-300">
            Rs {totalValue.toLocaleString()}
          </p>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Low Stock Items</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-red-700 dark:text-red-300">
            {lowStockRows.length}
          </p>
        </Card>
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-4 py-3 font-medium text-surface-500">Product</th>
              <th className="px-4 py-3 font-medium text-surface-500">Warehouse</th>
              <th className="px-4 py-3 font-medium text-surface-500">Batch</th>
              <th className="px-4 py-3 font-medium text-surface-500">Expiry</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">Qty</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">Value</th>
              <th className="px-4 py-3 font-medium text-surface-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isLow = r.min_stock_threshold > 0 && r.quantity_on_hand <= r.min_stock_threshold;
              return (
                <tr key={r.id} className={`border-b border-surface-100 last:border-0 dark:border-surface-800 ${isLow ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">
                    {r.product_name}{r.pack_size ? ` (${r.pack_size})` : ""}
                  </td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{r.warehouse_name}</td>
                  <td className="px-4 py-3 text-surface-500">{r.batch_number ?? "-"}</td>
                  <td className="px-4 py-3 text-surface-500">{r.expiry_date ?? "-"}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${isLow ? "text-red-600" : "text-surface-800 dark:text-surface-200"}`}>
                    {r.quantity_on_hand}
                    {isLow && <span className="ml-1 text-xs">(Low)</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">
                    Rs {(r.quantity_on_hand * r.purchase_price).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setAdjustTarget(r)} className="text-surface-400 hover:text-brand-600" title="Adjust Stock">
                        <Settings2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => setTransferTarget(r)} className="text-surface-400 hover:text-brand-600" title="Transfer Stock">
                        <ArrowLeftRight className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-surface-400">
                  No inventory yet. Receive a purchase order to add stock.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {adjustTarget && (
        <AdjustModal row={adjustTarget} onClose={() => setAdjustTarget(null)} />
      )}
      {transferTarget && (
        <TransferModal row={transferTarget} warehouses={warehouses} onClose={() => setTransferTarget(null)} />
      )}
    </div>
  );
}

function AdjustModal({ row, onClose }: { row: InventoryRow; onClose: () => void }) {
  const [state, formAction] = useFormState(adjustStock, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Adjust Stock</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-surface-500">
          {row.product_name} - {row.warehouse_name} (Current: {row.quantity_on_hand})
        </p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Adjusted successfully.</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="inventory_id" value={row.id} />
          <div>
            <Label>Direction</Label>
            <Select name="direction" defaultValue="decrease">
              <option value="increase">Increase</option>
              <option value="decrease">Decrease (damage/loss)</option>
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" name="quantity" min={0.001} step="0.001" required />
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea name="reason" rows={2} required placeholder="e.g. Damaged in storage" />
          </div>
          <SubmitButton label="Apply Adjustment" />
        </form>
      </div>
    </div>
  );
}

function TransferModal({ row, warehouses, onClose }: { row: InventoryRow; warehouses: Warehouse[]; onClose: () => void }) {
  const [state, formAction] = useFormState(transferStock, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Transfer Stock</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-surface-500">
          {row.product_name} - currently at {row.warehouse_name} (Qty: {row.quantity_on_hand})
        </p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Transferred successfully.</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="product_id" value={row.product_id} />
          <input type="hidden" name="batch_id" value={row.batch_id ?? ""} />
          <div>
            <Label>From Warehouse</Label>
            <Select name="from_warehouse_id" defaultValue={row.warehouse_id} disabled>
              <option value={row.warehouse_id}>{row.warehouse_name}</option>
            </Select>
          </div>
          <div>
            <Label>To Warehouse</Label>
            <Select name="to_warehouse_id" required>
              <option value="">- select -</option>
              {warehouses.filter((w) => w.id !== row.warehouse_id).map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" name="quantity" min={0.001} max={row.quantity_on_hand} step="0.001" required />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <SubmitButton label="Transfer Stock" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Processing..." : label}</Button>;
}