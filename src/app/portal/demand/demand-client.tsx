"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, PackageSearch, Send, Sparkles, Truck, XCircle, Wand2 } from "lucide-react";
import { parseMunshiCommand, munshiQuestion } from "@/lib/demand/munshi-parser";
import { DEMAND_CATEGORIES, DEMAND_CATEGORY_LABELS } from "@/lib/demand/categories";
import { effectivePipeline, PIPELINE_LABELS } from "@/lib/demand/pipeline";

export type DemandProduct = {
  id: string;
  name: string;
  pack_size: string | null;
  unit: string | null;
  is_available: boolean | null;
  is_deleted: boolean | null;
};

export type ProductDemandRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit: string;
  needed_by: string | null;
  purpose: string | null;
  notes: string | null;
  status: string;
  staff_note: string | null;
  pipeline_status?: string | null;
  category?: string | null;
  created_at: string;
  updated_at: string;
};

type DemandForm = {
  productId: string;
  productName: string;
  quantity: string;
  unit: string;
  neededBy: string;
  purpose: string;
  notes: string;
  category: string;
  area: string;
  source: "form" | "munshi";
};

const emptyForm: DemandForm = { productId: "", productName: "", quantity: "", unit: "bag", neededBy: "", purpose: "", notes: "", category: "", area: "", source: "form" };
const statusLabels: Record<string, string> = {
  pending: "Nayi demand",
  reviewing: "Check ho rahi hai",
  approved: "Procurement approve",
  ordered: "Order ho gaya",
  fulfilled: "Product available",
  rejected: "Close",
  cancelled: "Cancel",
};

export function DemandCenterClient({ farmerName, products, demands }: { farmerName: string; products: DemandProduct[]; demands: ProductDemandRow[] }) {
  const [form, setForm] = useState<DemandForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState(demands);
  const [munshiText, setMunshiText] = useState("");
  const [munshiReply, setMunshiReply] = useState("");

  function askMunshi() {
    const p = parseMunshiCommand(munshiText, products.map((x) => ({ id: x.id, name: x.name })));
    setForm((cur) => ({
      ...cur,
      productId: p.productId ?? "",
      productName: p.productName ?? cur.productName,
      quantity: p.quantity !== null ? String(p.quantity) : cur.quantity,
      unit: p.unit ?? cur.unit,
      category: p.category ?? cur.category,
      purpose: p.crop ? `${p.acres ? `${p.acres} acre ` : ""}${p.crop}` : cur.purpose,
      source: "munshi",
    }));
    setMunshiReply(munshiQuestion(p));
  }

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending" || r.status === "reviewing").length,
    fulfilled: rows.filter((r) => r.status === "fulfilled").length,
  }), [rows]);

  function chooseProduct(value: string) {
    const product = products.find((p) => p.id === value);
    setForm((current) => ({ ...current, productId: value, productName: product?.name ?? current.productName, unit: product?.unit || current.unit }));
  }

  async function submitDemand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!form.productName.trim() || !form.quantity.trim()) {
      setMessage("Product aur quantity zaroor likhein.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/farmer-demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Demand save nahi ho saki.");
      setRows((current) => [data.demand as ProductDemandRow, ...current]);
      setForm(emptyForm);
      setMunshiText("");
      setMunshiReply("");
      setMessage("Demand save ho gayi hai. Product arrange hone par aap ko bataya jayega.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Demand save nahi ho saki.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8" dir="ltr">
      <Link href="/portal/dashboard" className="text-sm text-surface-500 hover:text-brand-700">← Dashboard par wapas</Link>
      <div className="mt-5 rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-200"><Sparkles className="h-5 w-5" /><span className="text-sm font-semibold">AgriBridge Digital Munshi</span></div>
            <h1 className="mt-2 text-2xl font-bold">Kisan Demand Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-emerald-50">Assalam-o-Alaikum {farmerName}. Jo product stock mein nahi hai us ki demand yahan save karein. Payment abhi zaroori nahi.</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 text-center"><PackageSearch className="mx-auto h-8 w-8 text-emerald-200" /><p className="mt-2 text-xs text-emerald-100">Aap ki demands</p><p className="text-3xl font-bold">{stats.total}</p></div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total demands" value={stats.total} icon={<PackageSearch className="h-5 w-5" />} />
        <SummaryCard label="Pending / checking" value={stats.pending} icon={<Clock3 className="h-5 w-5" />} />
        <SummaryCard label="Products arranged" value={stats.fulfilled} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-semibold text-surface-900">Nayi product demand</h2>
          <p className="mt-1 text-sm text-surface-500">Product stock mein na ho to bhi demand register karein.</p>
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-emerald-900"><Wand2 className="h-4 w-4" /> Digital Munshi — likh kar batayein / لکھ کر بتائیں</label>
            <div className="mt-2 flex gap-2">
              <input value={munshiText} onChange={(e) => setMunshiText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); askMunshi(); } }} placeholder="mujhe 20 boriyan urea chahiye" className="h-10 flex-1 rounded-lg border border-emerald-200 px-3 text-sm" />
              <button type="button" onClick={askMunshi} className="rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white">Samjho</button>
            </div>
            {munshiReply && <p className="mt-2 text-sm text-emerald-900">Munshi: {munshiReply}</p>}
            <p className="mt-1 text-xs text-emerald-800">Munshi sirf neeche form bharta hai. Save aap khud karte hain.</p>
          </div>
          <form onSubmit={submitDemand} className="mt-5 space-y-4">
            <div><label className="text-sm font-medium text-surface-700">Product select karein</label><select value={form.productId} onChange={(e) => chooseProduct(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-surface-200 bg-white px-3 text-sm"><option value="">Product list se select karein</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.is_available ? " — stock available" : " — demand required"}</option>)}</select></div>
            <div><label className="text-sm font-medium text-surface-700">Ya product ka naam likhein</label><input value={form.productName} onChange={(e) => setForm((x) => ({ ...x, productName: e.target.value }))} placeholder="Wanda, Khal, seed, pesticide..." className="mt-1 h-11 w-full rounded-xl border border-surface-200 px-3 text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-surface-700">Quantity</label><input inputMode="decimal" value={form.quantity} onChange={(e) => setForm((x) => ({ ...x, quantity: e.target.value }))} placeholder="Misal: 5" className="mt-1 h-11 w-full rounded-xl border border-surface-200 px-3 text-sm" /></div>
              <div><label className="text-sm font-medium text-surface-700">Unit</label><select value={form.unit} onChange={(e) => setForm((x) => ({ ...x, unit: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-surface-200 bg-white px-3 text-sm"><option value="bag">Bori/bag</option><option value="kg">KG</option><option value="liter">Liter</option><option value="packet">Packet</option><option value="bottle">Bottle</option><option value="piece">Piece</option><option value="other">Other</option></select></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="text-sm font-medium text-surface-700">Kab chahiye?</label><input type="date" value={form.neededBy} onChange={(e) => setForm((x) => ({ ...x, neededBy: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-surface-200 px-3 text-sm" /></div>
              <div><label className="text-sm font-medium text-surface-700">Kis liye?</label><input value={form.purpose} onChange={(e) => setForm((x) => ({ ...x, purpose: e.target.value }))} placeholder="Wheat, Wanda, animals, spray" className="mt-1 h-11 w-full rounded-xl border border-surface-200 px-3 text-sm" /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="text-sm font-medium text-surface-700">Qism (category)</label><select value={form.category} onChange={(e) => setForm((x) => ({ ...x, category: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-surface-200 bg-white px-3 text-sm"><option value="">Chunein (optional)</option>{DEMAND_CATEGORIES.map((c) => <option key={c} value={c}>{DEMAND_CATEGORY_LABELS[c].rm} / {DEMAND_CATEGORY_LABELS[c].ur}</option>)}</select></div>
              <div><label className="text-sm font-medium text-surface-700">Ilaqa / gaon (optional)</label><input value={form.area} onChange={(e) => setForm((x) => ({ ...x, area: e.target.value }))} placeholder="Profile mein gaon na ho to likhein" className="mt-1 h-11 w-full rounded-xl border border-surface-200 px-3 text-sm" /></div>
            </div>
            <div><label className="text-sm font-medium text-surface-700">Extra note</label><textarea value={form.notes} onChange={(e) => setForm((x) => ({ ...x, notes: e.target.value }))} rows={3} placeholder="Brand, delivery ya koi aur baat" className="mt-1 w-full rounded-xl border border-surface-200 px-3 py-3 text-sm" /></div>
            {message && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
            <button type="submit" disabled={saving} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"><Send className="h-4 w-4" />{saving ? "Save ho raha hai..." : "Demand save karein"}</button>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-surface-900">Meri demands</h2>
          <p className="text-sm text-surface-500">Har demand ka status yahan milega.</p>
          <div className="mt-3 space-y-3">{rows.length === 0 ? <div className="rounded-2xl border border-dashed border-surface-300 bg-white p-8 text-center text-sm text-surface-500">Abhi koi demand save nahi hui.</div> : rows.map((row) => <DemandCard key={row.id} row={row} />)}</div>
        </section>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Important:</strong> Demand register karna order ya advance payment nahi hai. Product arrange hone par confirmation li jayegi.</div>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white p-4 shadow-card"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</div><div><p className="text-xs text-surface-500">{label}</p><p className="text-2xl font-bold text-surface-900">{value}</p></div></div>;
}

function DemandCard({ row }: { row: ProductDemandRow }) {
  const tone = row.status === "fulfilled" || row.status === "approved" || row.status === "ordered" ? "bg-emerald-50 text-emerald-700" : row.status === "rejected" || row.status === "cancelled" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700";
  return <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-surface-900">{row.product_name}</p><p className="mt-1 text-sm text-surface-500">{row.quantity} {row.unit}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{row.pipeline_status ? PIPELINE_LABELS[effectivePipeline(row)] : (statusLabels[row.status] ?? row.status)}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-surface-500"><span>Demand: {new Date(row.created_at).toLocaleDateString()}</span><span>Needed: {row.needed_by || "Jab available ho"}</span></div>{row.staff_note && <div className="mt-3 rounded-xl bg-surface-50 p-3 text-sm text-surface-700"><div className="flex items-center gap-2 font-medium"><Truck className="h-4 w-4" /> Munshi update</div><p className="mt-1">{row.staff_note}</p></div>}{row.status === "fulfilled" && <div className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Product arrange ho gaya—order confirm karein.</div>}{row.status === "rejected" && <div className="mt-3 flex items-center gap-2 text-sm text-rose-700"><XCircle className="h-4 w-4" /> Is demand ko filhal close kar diya gaya hai.</div>}</div>;
}
