"use client";
import { useState, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createGrainSale, recordGrainSalePayment, type ActionState } from "@/actions/grain-sales";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { X } from "lucide-react";

const initialState: ActionState = {};

interface Buyer { id: string; business_name: string; contact_person: string | null; phone_number: string | null; }
interface Warehouse { id: string; name: string; }
interface FinanceAccount { id: string; name: string; account_type: string; }
interface Sale {
  id: string;
  sale_number: string;
  buyer_name: string;
  warehouse_name: string;
  grain_type: string;
  quantity_kg: number;
  rate_per_kg: number;
  total_amount: number;
  total_cogs: number;
  profit: number;
  amount_received: number;
  sale_date: string;
}

const GRAIN_LABELS: Record<string, string> = { wheat: "Wheat (Gandum)", rice: "Rice (Chawal)", maize: "Maize (Makai)" };

export function SellGrainClient({
  buyers,
  warehouses,
  financeAccounts,
  sales,
  stockByWarehouseAndType,
}: {
  buyers: Buyer[];
  warehouses: Warehouse[];
  financeAccounts: FinanceAccount[];
  sales: Sale[];
  stockByWarehouseAndType: Record<string, Record<string, number>>;
}) {
  const [payingSale, setPayingSale] = useState<Sale | null>(null);

  return (
    <div className="space-y-6">
      <NewSaleForm buyers={buyers} warehouses={warehouses} financeAccounts={financeAccounts} stockByWarehouseAndType={stockByWarehouseAndType} />

      <div>
        <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Sales History</h3>
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">No.</th>
                <th className="px-3 py-2 font-medium text-surface-500">Buyer</th>
                <th className="px-3 py-2 font-medium text-surface-500">Grain</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">Qty</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">Total</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">Profit</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">Received</th>
                <th className="px-3 py-2 font-medium text-surface-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const remaining = s.total_amount - s.amount_received;
                return (
                  <tr key={s.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 font-mono text-xs text-surface-500">{s.sale_number}</td>
                    <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{s.buyer_name}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{GRAIN_LABELS[s.grain_type]}</td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{s.quantity_kg} kg</td>
                    <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {s.total_amount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-600">Rs {s.profit.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {s.amount_received.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {remaining > 0 && (
                        <button onClick={() => setPayingSale(s)} className="text-xs font-medium text-brand-600 hover:underline">Payment</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sales.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-surface-400">Koi sale nahi hui abhi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payingSale && (
        <SalePaymentModal sale={payingSale} financeAccounts={financeAccounts} onClose={() => setPayingSale(null)} />
      )}
    </div>
  );
}

function NewSaleForm({
  buyers,
  warehouses,
  financeAccounts,
  stockByWarehouseAndType,
}: {
  buyers: Buyer[];
  warehouses: Warehouse[];
  financeAccounts: FinanceAccount[];
  stockByWarehouseAndType: Record<string, Record<string, number>>;
}) {
  const [state, formAction] = useFormState(createGrainSale, initialState);
  const [warehouseId, setWarehouseId] = useState("");
  const [grainType, setGrainType] = useState("wheat");
  const [quantity, setQuantity] = useState("");
  const [rate, setRate] = useState("");
  const [deliveryTerm, setDeliveryTerm] = useState("load_deliver");
  const [bardanaCost, setBardanaCost] = useState("0");
  const [mazdooriCost, setMazdooriCost] = useState("0");

  const availableStock = stockByWarehouseAndType[warehouseId]?.[grainType] ?? 0;
  const total = (parseFloat(quantity) || 0) * (parseFloat(rate) || 0);
  const combinedCost = (parseFloat(bardanaCost) || 0) + (parseFloat(mazdooriCost) || 0);

  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Nayi Sale Karein</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Sale ho gayi, stock nikal gaya.</p>}
      <form action={formAction} className="space-y-3">
        <div>
          <Label>Buyer *</Label>
          <Select name="buyer_id" required>
            <option value="">- select -</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>{b.business_name}{b.contact_person ? ` - ${b.contact_person}` : ""}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Warehouse *</Label>
            <Select name="warehouse_id" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="">- select -</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Grain Type *</Label>
            <Select name="grain_type" value={grainType} onChange={(e) => setGrainType(e.target.value)}>
              <option value="wheat">Wheat (Gandum)</option>
              <option value="rice">Rice (Chawal)</option>
              <option value="maize">Maize (Makai)</option>
            </Select>
          </div>
        </div>
        {warehouseId && (
          <p className="text-xs text-surface-400">Available Stock: <span className="font-medium text-surface-600">{availableStock.toLocaleString()} kg</span></p>
        )}
        <div>
          <Label>Date</Label>
          <Input type="date" name="sale_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Quantity (kg) *</Label>
            <Input type="number" step="0.1" name="quantity_kg" value={quantity} onChange={(e) => setQuantity(e.target.value)} max={availableStock} required />
          </div>
          <div>
            <Label>Rate per kg (Rs.) *</Label>
            <Input type="number" step="0.01" name="rate_per_kg" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </div>
        </div>
        <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
          <Label>Delivery Term (kaise dena hy)</Label>
          <select name="delivery_term" value={deliveryTerm} onChange={(e) => setDeliveryTerm(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="load_deliver">Load Karwa Ke Dena</option>
            <option value="unload_deliver">Unload Dena</option>
            <option value="buyer_pickup">Buyer Khud Uthaye</option>
            <option value="we_deliver">Hum Pohchayein</option>
          </select>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <Label>Bardana Cost (Rs)</Label>
              <Input type="number" step="0.01" name="bardana_cost" value={bardanaCost} onChange={(e) => setBardanaCost(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Mazdoori/Loading Cost (Rs)</Label>
              <Input type="number" step="0.01" name="mazdoori_cost" value={mazdooriCost} onChange={(e) => setMazdooriCost(e.target.value)} placeholder="0" />
            </div>
          </div>
          {combinedCost > 0 && (
            <div>
              <Label>Konsa Account Se Ye Kharcha Gaya *</Label>
              <Select name="cost_account_id" required>
                <option value="">- select -</option>
                {financeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
          )}
          <p className="mt-1 text-[11px] text-surface-400">Ye dono amounts seedha Profit se minus honge (kam ya zyada, jitna marzi likhein).</p>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea name="notes" rows={2} />
        </div>
        <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
          <div className="flex justify-between text-sm"><span className="text-surface-500">Total (Buyer Se)</span><span className="font-medium">Rs {total.toLocaleString()}</span></div>
          {combinedCost > 0 && (
            <div className="flex justify-between text-xs text-red-600"><span>Bardana + Mazdoori</span><span>- Rs {combinedCost.toLocaleString()}</span></div>
          )}
        </div>
        <SubmitButton label="Sale Record Karein" />
      </form>
    </div>
  );
}

function SalePaymentModal({ sale, financeAccounts, onClose }: { sale: Sale; financeAccounts: FinanceAccount[]; onClose: () => void }) {
  const [state, formAction] = useFormState(recordGrainSalePayment, initialState);
  const remaining = sale.total_amount - sale.amount_received;
  if (state.success) setTimeout(onClose, 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Payment Receive Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-surface-500">{sale.buyer_name} - Baaqi: Rs {remaining.toLocaleString()}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Payment record ho gayi.</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="sale_id" value={sale.id} />
          <div>
            <Label>Amount (Rs.) *</Label>
            <Input type="number" step="0.01" name="amount" max={remaining} defaultValue={remaining} required />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select name="payment_method">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="jazzcash">JazzCash</option>
            </Select>
          </div>
          <div>
            <Label>Konsa Account (jahan paisa aya) *</Label>
            <Select name="account_id" required>
              <option value="">- select -</option>
              {financeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <SubmitButton label="Payment Record Karein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : label}</Button>;
}