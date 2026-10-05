"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { adjustStock, type ActionState } from "@/actions/inventory";
import { Card } from "@/components/ui/layout-primitives";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";

type Product = { id: string; name: string; pack_size: string | null; purchase_price: number | null };
type Warehouse = { id: string; name: string };

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save manual entry"}</Button>;
}

export function ManualStockEntry({ products, warehouses }: { products: Product[]; warehouses: Warehouse[] }) {
  const [state, formAction] = useFormState(adjustStock, initialState);
  const [productId, setProductId] = useState("");
  const selected = products.find((p) => p.id === productId);

  return (
    <Card className="mb-4 border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="mb-3">
        <h2 className="font-semibold text-surface-900 dark:text-white">Manual Stock Entry</h2>
        <p className="text-xs text-surface-600 dark:text-surface-400">All active products—including zero-stock products—can be entered here. This creates a red-flagged audit movement; old records are not changed.</p>
      </div>
      {state.error && <p className="mb-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="mb-3 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-700">Manual stock entry saved.</p>}
      <form action={formAction} className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label>Product</Label>
          <Select name="product_id" value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">Select product ({products.length})</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.pack_size ? ` (${p.pack_size})` : ""}</option>)}
          </Select>
        </div>
        <div>
          <Label>Warehouse</Label>
          <Select name="warehouse_id" required>
            <option value="">Select location</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        </div>
        <div><Label>Direction</Label><Select name="direction" defaultValue="increase"><option value="increase">Credit / IN</option><option value="decrease">Debit / OUT</option></Select></div>
        <div><Label>Quantity</Label><Input name="quantity" type="number" min="0.001" step="0.001" required /></div>
        <div><Label>Rate</Label><Input name="rate" type="number" min="0" step="0.01" defaultValue={selected?.purchase_price ?? ""} /></div>
        <div className="md:col-span-4"><Label>Reason / note</Label><Textarea name="notes" required placeholder="Reason, source, physical count or approval reference" /></div>
        <div><Label>Bill / reference</Label><Input name="bill_no" placeholder="Optional" /></div>
        <div className="flex items-end"><SubmitButton /></div>
      </form>
    </Card>
  );
}
