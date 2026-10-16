"use client";
import { useState } from "react";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { submitCampaignBooking, type BookingState } from "@/actions/campaign-booking";
import { LINE_KINDS, LINE_KIND_LABELS, type LineKind } from "@/lib/campaigns/booking";

export type CampaignProduct = { id: string; name: string; pack_size: string | null; unit: string | null };
type Line = { kind: LineKind; productId: string; quantity: string; unit: string };
const KIND_FROM_CATEGORY: Record<string, LineKind> = { seed: "seed", fertilizer: "fertilizer", pesticide: "pesticide" };
const cls = "rounded-lg border border-surface-200 p-2 text-sm";

export function CampaignBookingForm({ campaign, open, products, existing }: {
  campaign: { id: string; name: string; crop: string; deadline: string; description: string | null };
  open: boolean;
  products: CampaignProduct[];
  existing: null | { acres: number; notes: string; lines: { product_id: string; quantity: number; unit: string; category: string | null }[] };
}) {
  const [state, action] = useFormState(submitCampaignBooking, {} as BookingState);
  const [acres, setAcres] = useState(existing ? String(existing.acres) : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    existing?.lines.length
      ? existing.lines.map((l) => ({ kind: KIND_FROM_CATEGORY[l.category ?? ""] ?? "seed", productId: l.product_id, quantity: String(l.quantity), unit: l.unit }))
      : LINE_KINDS.map((k) => ({ kind: k, productId: "", quantity: "", unit: "bag" }))
  );
  const set = (i: number, p: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const dl = campaign.deadline.split("-").reverse().join("-");

  return (
    <form action={action} className="space-y-3 rounded-card border border-surface-200 bg-white p-4">
      <div>
        <h2 className="font-semibold">{campaign.name}</h2>
        <p className="text-xs text-surface-500">Aakhri taareekh: {dl} · Booking par koi payment nahi.</p>
        {campaign.description && <p className="mt-1 text-sm text-surface-600">{campaign.description}</p>}
      </div>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>}
      <input type="hidden" name="campaign_id" value={campaign.id} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <label className="block text-sm font-medium">Rakba (acres)
        <input name="acres" value={acres} onChange={(e) => setAcres(e.target.value)} inputMode="decimal" required disabled={!open} className={`${cls} mt-1 w-full`} />
      </label>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <select value={l.kind} onChange={(e) => set(i, { kind: e.target.value as LineKind })} disabled={!open} className={`${cls} col-span-3`}>
              {LINE_KINDS.map((k) => <option key={k} value={k}>{LINE_KIND_LABELS[k]}</option>)}
            </select>
            <select value={l.productId} onChange={(e) => set(i, { productId: e.target.value })} disabled={!open} className={`${cls} col-span-5`}>
              <option value="">— product chunein —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.pack_size ? ` (${p.pack_size})` : ""}</option>)}
            </select>
            <input value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} inputMode="decimal" placeholder="Miqdar" disabled={!open} className={`${cls} col-span-2`} />
            <select value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} disabled={!open} className={`${cls} col-span-2`}>
              {["bag", "kg", "litre", "bottle", "packet", "other"].map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        ))}
        {open && <button type="button" onClick={() => setLines([...lines, { kind: "fertilizer", productId: "", quantity: "", unit: "bag" }])} className="text-sm font-medium text-brand-700">+ aur product</button>}
      </div>
      <label className="block text-sm font-medium">Notes
        <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!open} className={`${cls} mt-1 w-full`} rows={2} />
      </label>
      {open ? (
        <button className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white">{existing ? "Booking update karein" : "Booking bhejein"}</button>
      ) : (
        <p className="text-sm text-surface-500">Booking band ho chuki hai.</p>
      )}
    </form>
  );
}
