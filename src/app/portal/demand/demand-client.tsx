"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, PackageSearch, Search, Send, Sparkles, Truck, XCircle, Wand2, Plus, Check } from "lucide-react";
import { parseMunshiCommand, munshiQuestion } from "@/lib/demand/munshi-parser";
import {
  DEMAND_CATEGORY_LABELS, DEMAND_GROUPS, DEMAND_GROUP_INFO, FEED_TYPES, UNIT_LABELS,
  countByGroup, demandCategoryFor, demandRowGroup, filterProducts, groupOfDemandCategory, normalizeUnit, subLabel, subsForGroup,
  type DemandGroup,
} from "@/lib/demand/categories";
import { effectivePipeline, PIPELINE_LABELS } from "@/lib/demand/pipeline";

export type DemandProduct = {
  id: string;
  name: string;
  pack_size: string | null;
  unit: string | null;
  is_available: boolean | null;
  is_deleted: boolean | null;
  category_id?: string | null;
  group: DemandGroup;
  sub: string | null;
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

const emptyForm: DemandForm = { productId: "", productName: "", quantity: "", unit: "packet", neededBy: "", purpose: "", notes: "", category: "", area: "", source: "form" };
const statusLabels: Record<string, string> = {
  pending: "Nayi demand",
  reviewing: "Check ho rahi hai",
  approved: "Procurement approve",
  ordered: "Order ho gaya",
  fulfilled: "Product available",
  rejected: "Close",
  cancelled: "Cancel",
};

const TONES: Record<string, { card: string; on: string; icon: string; pill: string; chipOn: string; bar: string; ring: string; text: string }> = {
  amber: { card: "hover:border-amber-300", on: "border-amber-500 bg-gradient-to-br from-amber-50 to-white shadow-lg shadow-amber-200/60 dark:from-amber-950/50 dark:to-[#101d36] dark:shadow-none", icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", chipOn: "border-amber-500 bg-amber-500 text-white", bar: "bg-amber-500", ring: "focus-within:border-amber-500 focus-within:ring-amber-500/20", text: "text-amber-600 dark:text-amber-300" },
  green: { card: "hover:border-green-300", on: "border-green-600 bg-gradient-to-br from-green-50 to-white shadow-lg shadow-green-200/60 dark:from-green-950/50 dark:to-[#101d36] dark:shadow-none", icon: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300", pill: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300", chipOn: "border-green-600 bg-green-600 text-white", bar: "bg-green-600", ring: "focus-within:border-green-600 focus-within:ring-green-600/20", text: "text-green-700 dark:text-green-300" },
  rose: { card: "hover:border-rose-300", on: "border-rose-600 bg-gradient-to-br from-rose-50 to-white shadow-lg shadow-rose-200/60 dark:from-rose-950/50 dark:to-[#101d36] dark:shadow-none", icon: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", pill: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300", chipOn: "border-rose-600 bg-rose-600 text-white", bar: "bg-rose-600", ring: "focus-within:border-rose-600 focus-within:ring-rose-600/20", text: "text-rose-600 dark:text-rose-300" },
  violet: { card: "hover:border-violet-300", on: "border-violet-600 bg-gradient-to-br from-violet-50 to-white shadow-lg shadow-violet-200/60 dark:from-violet-950/50 dark:to-[#101d36] dark:shadow-none", icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", pill: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300", chipOn: "border-violet-600 bg-violet-600 text-white", bar: "bg-violet-600", ring: "focus-within:border-violet-600 focus-within:ring-violet-600/20", text: "text-violet-600 dark:text-violet-300" },
  orange: { card: "hover:border-orange-300", on: "border-orange-600 bg-gradient-to-br from-orange-50 to-white shadow-lg shadow-orange-200/60 dark:from-orange-950/50 dark:to-[#101d36] dark:shadow-none", icon: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", pill: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300", chipOn: "border-orange-600 bg-orange-600 text-white", bar: "bg-orange-600", ring: "focus-within:border-orange-600 focus-within:ring-orange-600/20", text: "text-orange-600 dark:text-orange-300" },
  sky: { card: "hover:border-sky-300", on: "border-sky-500 bg-gradient-to-br from-sky-50 to-white shadow-lg shadow-sky-200/60 dark:from-sky-950/50 dark:to-[#101d36] dark:shadow-none", icon: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", pill: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300", chipOn: "border-sky-500 bg-sky-500 text-white", bar: "bg-sky-500", ring: "focus-within:border-sky-500 focus-within:ring-sky-500/20", text: "text-sky-600 dark:text-sky-300" },
};
const tone = (g: DemandGroup) => TONES[DEMAND_GROUP_INFO[g].tone];
const CARD = "rounded-2xl border border-surface-200 bg-white p-5 shadow-card dark:border-[#1e3160] dark:bg-[#101d36]";
const INPUT = "mt-1 h-11 w-full rounded-xl border border-surface-200 bg-white px-3 text-sm text-surface-900 dark:border-[#1e3160] dark:bg-[#0c1830] dark:text-slate-100";
const LABEL = "text-sm font-medium text-surface-700 dark:text-slate-200";
const CHIP_BASE = "rounded-full border px-3 py-1.5 text-xs font-medium transition";
const CHIP_OFF = "border-surface-200 bg-white text-surface-700 hover:bg-surface-50 dark:border-[#1e3160] dark:bg-[#0c1830] dark:text-slate-200";
/** Active chip ka rang alag class -- bg-white se takrao nahi. */
const chip = (on: boolean, onCls: string) => `${CHIP_BASE} ${on ? `${onCls} font-semibold` : CHIP_OFF}`;

export function DemandCenterClient({ farmerName, products, demands }: { farmerName: string; products: DemandProduct[]; demands: ProductDemandRow[] }) {
  const [form, setForm] = useState<DemandForm>(emptyForm);
  const [group, setGroup] = useState<DemandGroup | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [feedType, setFeedType] = useState<string>("wanda");
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState(demands);
  const [rowFilter, setRowFilter] = useState<DemandGroup | "all">("all");
  const [munshiText, setMunshiText] = useState("");
  const [munshiReply, setMunshiReply] = useState("");

  const counts = useMemo(() => countByGroup(products), [products]);
  const productGroup = useMemo(() => new Map(products.map((p) => [p.id, p.group])), [products]);
  const subs = useMemo(() => (group ? subsForGroup(products, group) : []), [products, group]);
  const list = useMemo(() => (group ? filterProducts(products, group, sub, query) : []), [products, group, sub, query]);
  const groupTotal = group ? filterProducts(products, group, sub, "").length : 0;

  function pickGroup(g: DemandGroup) {
    setGroup(g); setSub(null); setQuery(""); setListOpen(false); setMessage("");
    setForm((cur) => ({ ...cur, productId: "", productName: "", unit: DEMAND_GROUP_INFO[g].defaultUnit, category: demandCategoryFor(g, null, feedType) }));
  }

  function askMunshi() {
    const p = parseMunshiCommand(munshiText, products.map((x) => ({ id: x.id, name: x.name })));
    const hitGroup = p.productId ? productGroup.get(p.productId) : undefined;
    const g = hitGroup ?? groupOfDemandCategory(p.category) ?? group;
    if (g) { setGroup(g); setSub(null); }
    if (p.category && FEED_TYPES.includes(p.category)) setFeedType(p.category);
    setForm((cur) => ({
      ...cur,
      productId: p.productId ?? "",
      productName: p.productName ?? cur.productName,
      quantity: p.quantity !== null ? String(p.quantity) : cur.quantity,
      unit: p.unit ?? (g ? DEMAND_GROUP_INFO[g].defaultUnit : cur.unit),
      category: p.category ?? (g ? demandCategoryFor(g, null, feedType) : cur.category),
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

  const rowGroups = useMemo(() => {
    const m = new Map<DemandGroup, ProductDemandRow[]>();
    for (const r of rows) { const g = demandRowGroup(r, productGroup); m.set(g, [...(m.get(g) ?? []), r]); }
    return m;
  }, [rows, productGroup]);

  function chooseProduct(product: DemandProduct) {
    setForm((current) => ({
      ...current,
      productId: product.id,
      productName: product.name,
      unit: normalizeUnit(product.unit || product.pack_size, product.group),
      category: demandCategoryFor(product.group, product.sub, feedType),
    }));
    setQuery(product.name);
    setListOpen(false);
  }

  function chooseFeedType(t: string) {
    setFeedType(t);
    setForm((cur) => ({ ...cur, category: t }));
  }

  async function submitDemand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!group) { setMessage("Pehle upar se qism chunein (Karyana, Khaad, Spray...)."); return; }
    if (!form.productName.trim() || !form.quantity.trim()) {
      setMessage("Product aur quantity zaroor likhein.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/farmer-demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, category: form.category || demandCategoryFor(group, null, feedType) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Demand save nahi ho saki.");
      setRows((current) => [{ ...(data.demand as ProductDemandRow), category: data.demand?.category ?? form.category }, ...current]);
      setForm({ ...emptyForm, unit: DEMAND_GROUP_INFO[group].defaultUnit, category: demandCategoryFor(group, null, feedType) });
      setQuery("");
      setMunshiText("");
      setMunshiReply("");
      setMessage("Demand save ho gayi hai. Product arrange hone par aap ko bataya jayega.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Demand save nahi ho saki.");
    } finally {
      setSaving(false);
    }
  }

  const info = group ? DEMAND_GROUP_INFO[group] : null;
  const t = group ? tone(group) : null;
  const shownGroups = DEMAND_GROUPS.filter((g) => rowGroups.has(g) && (rowFilter === "all" || rowFilter === g));

  return (
    <div className="pf-fit mx-auto max-w-7xl px-4 py-8 sm:px-6 fit:gap-2.5 fit:py-3" dir="ltr">
      <Link href="/portal/dashboard" className="text-sm text-surface-500 hover:text-brand-700 dark:text-slate-400 fit:hidden">← Dashboard par wapas</Link>
      <div className="mt-5 rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 p-6 text-white shadow-xl fit:rounded-2xl fit:px-5 fit:py-3 dark:from-emerald-900 dark:via-cyan-950 dark:to-[#0a1428]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-200"><Sparkles className="h-5 w-5" /><span className="text-sm font-semibold">AgriBridge Digital Munshi</span></div>
            <h1 className="mt-2 text-2xl font-bold fit:mt-0.5 fit:text-xl">Kisan Demand Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-emerald-50 fit:mt-0.5 fit:text-xs">Assalam-o-Alaikum {farmerName}. Pehle qism chunein — phir sirf usi qism ki list aayegi. <span dir="rtl" lang="ur">پہلے قسم چنیں</span></p>
          </div>
          <div className="hidden gap-2 text-xs fit:flex">
            <span className="rounded-xl bg-white/10 px-3 py-1.5">Total <b className="ms-1 text-base">{stats.total}</b></span>
            <span className="rounded-xl bg-white/10 px-3 py-1.5">Pending <b className="ms-1 text-base">{stats.pending}</b></span>
            <span className="rounded-xl bg-white/10 px-3 py-1.5">Arranged <b className="ms-1 text-base">{stats.fulfilled}</b></span>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 text-center fit:hidden"><PackageSearch className="mx-auto h-8 w-8 text-emerald-200" /><p className="mt-2 text-xs text-emerald-100">Aap ki demands</p><p className="text-3xl font-bold">{stats.total}</p></div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 fit:hidden">
        <SummaryCard label="Total demands" value={stats.total} icon={<PackageSearch className="h-5 w-5" />} />
        <SummaryCard label="Pending / checking" value={stats.pending} icon={<Clock3 className="h-5 w-5" />} />
        <SummaryCard label="Products arranged" value={stats.fulfilled} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      {/* STEP 1 -- qism */}
      <section className={`mt-6 ${CARD} fit:px-4 fit:py-2.5`} data-testid="demand-groups">
        <p className="text-[11px] font-bold tracking-widest text-emerald-600 dark:text-emerald-400">STEP 1 · QISM CHUNEIN</p>
        <h2 className="mt-1 text-lg font-semibold text-surface-900 dark:text-white fit:hidden">What do you need? · Kya chahiye? · <span dir="rtl" lang="ur">آپ کو کیا چاہیے؟</span></h2>
        <div className="mt-4 grid grid-cols-3 gap-2.5 md:grid-cols-6 fit:mt-1.5 fit:gap-2">
          {DEMAND_GROUPS.map((g) => {
            const gi = DEMAND_GROUP_INFO[g]; const gt = tone(g); const on = group === g;
            return (
              <button key={g} type="button" onClick={() => pickGroup(g)} aria-pressed={on} data-group={g}
                className={`relative rounded-2xl border-2 p-3 text-start transition fit:px-3 fit:py-2 ${on ? gt.on : `border-surface-200 bg-white dark:border-[#1e3160] dark:bg-[#0c1830] ${gt.card}`}`}>
                <span className={`absolute end-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${gt.pill}`}>{counts[g]}</span>
                {on && <span className={`absolute end-11 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-white ${gt.bar}`}><Check className="h-3 w-3" /></span>}
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl fit:h-7 fit:w-7 fit:text-base ${gt.icon}`}>{gi.icon}</span>
                <span className="mt-2 block text-sm font-bold fit:mt-1 text-surface-900 dark:text-white">{gi.en}</span>
                <span className="block text-[11px] text-surface-500 dark:text-slate-400">{gi.rm}</span>
                <span dir="rtl" lang="ur" className="mt-0.5 block text-end text-xs text-surface-600 dark:text-slate-300">{gi.ur}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="pf-grow pf-grid mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px] fit:grid-cols-[minmax(0,1fr)_440px] fit:gap-2.5">
        <section className={`${CARD} pf-panel pf-navy fit:p-4`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-[11px] font-bold tracking-widest ${t ? t.text : "text-surface-400"}`}>STEP 2 · {info ? info.rm.toUpperCase() : "NAYI DEMAND"}</p>
              <h2 className="mt-1 text-lg font-semibold text-surface-900 dark:text-white">Nayi demand · <span dir="rtl" lang="ur">نئی طلب</span></h2>
            </div>
            {info && t && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${t.pill}`}>{info.icon} {info.en}</span>}
          </div>

          <div className="pf-body fit:-me-2 fit:pe-2">
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40 fit:mt-2">
            <label className="flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-200"><Wand2 className="h-4 w-4" /> Digital Munshi — likh kar batayein / لکھ کر بتائیں</label>
            <div className="mt-2 flex gap-2">
              <input value={munshiText} onChange={(e) => setMunshiText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); askMunshi(); } }} placeholder="mujhe 20 boriyan urea chahiye" className="h-10 flex-1 rounded-lg border border-emerald-200 bg-white px-3 text-sm dark:border-emerald-900 dark:bg-[#0c1830] dark:text-slate-100" />
              <button type="button" onClick={askMunshi} className="rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white">Samjho</button>
            </div>
            {munshiReply && <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-200">Munshi: {munshiReply}</p>}
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">Munshi sirf neeche form bharta hai. Save aap khud karte hain.</p>
          </div>

          {!group || !info || !t ? (
            <div className="mt-5 rounded-2xl border border-dashed border-surface-300 p-8 text-center text-sm text-surface-500 dark:border-[#1e3160] dark:text-slate-400" data-testid="pick-group-first">
              ☝️ Upar se qism chunein — Karyana, Khaad, Spray, Beej ya Wanda. <span dir="rtl" lang="ur">اوپر سے قسم چنیں</span>
            </div>
          ) : (
          <form onSubmit={submitDemand} className="mt-5 space-y-4">
            {group === "feed" ? (
              <div><label className={LABEL}>Type</label>
                <div className="mt-2 flex flex-wrap gap-2">{FEED_TYPES.map((ft) => <button key={ft} type="button" onClick={() => chooseFeedType(ft)} className={chip(feedType === ft, t.chipOn)}>{DEMAND_CATEGORY_LABELS[ft].rm} · <span lang="ur">{DEMAND_CATEGORY_LABELS[ft].ur}</span></button>)}</div></div>
            ) : subs.length > 1 ? (
              <div><label className={LABEL}>Type <span className="font-normal text-surface-400">(optional)</span></label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSub(null)} className={chip(sub === null, t.chipOn)}>Sab ({counts[group]})</button>
                  {subs.map((s) => <button key={s.name} type="button" onClick={() => setSub(s.name)} className={chip(sub === s.name, t.chipOn)}>{subLabel(s.name)} ({s.count})</button>)}
                </div></div>
            ) : null}

            <div>
              <label className={LABEL}>{info.en} product dhoondein <span className="font-normal text-surface-400">· sirf {info.rm} list</span></label>
              <div className={`mt-1 flex h-11 items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 focus-within:ring-4 dark:border-[#1e3160] dark:bg-[#0c1830] ${t.ring}`}>
                <Search className="h-4 w-4 text-surface-400" />
                <input value={query} onFocus={() => setListOpen(true)} onChange={(e) => { setQuery(e.target.value); setListOpen(true); if (form.productId) setForm((x) => ({ ...x, productId: "" })); }}
                  placeholder="Naam likh kar dhoondein..." className="h-full flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus:outline-none focus:ring-0 text-surface-900 outline-none dark:text-slate-100" aria-label="Product search" />
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${t.pill}`}>{list.length} / {groupTotal}</span>
              </div>
              {listOpen && (
                <div className="mt-1.5 max-h-72 overflow-auto rounded-2xl border border-surface-200 bg-white shadow-xl dark:border-[#1e3160] dark:bg-[#0c1830]" role="listbox" data-testid="product-list">
                  {list.slice(0, 80).map((p) => (
                    <button key={p.id} type="button" role="option" aria-selected={form.productId === p.id} onClick={() => chooseProduct(p)}
                      className="flex w-full items-center justify-between gap-3 border-t border-surface-100 px-3 py-2.5 text-start text-sm first:border-t-0 hover:bg-surface-50 dark:border-[#1e3160] dark:hover:bg-[#14244a]">
                      <span><span className="block font-medium text-surface-900 dark:text-slate-100">{p.name}</span><span className="block text-xs text-surface-500 dark:text-slate-400">{[p.sub ? subLabel(p.sub) : null, p.pack_size].filter(Boolean).join(" · ") || info.rm}</span></span>
                      <span className={`whitespace-nowrap text-[11px] font-semibold ${p.is_available ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>● {p.is_available ? "Stock mein" : "Demand"}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => { setForm((x) => ({ ...x, productId: "", productName: query.trim() })); setListOpen(false); }}
                    className="flex w-full items-center gap-2 border-t border-surface-100 px-3 py-2.5 text-start text-sm text-surface-500 hover:bg-surface-50 dark:border-[#1e3160] dark:text-slate-400 dark:hover:bg-[#14244a]">
                    <Plus className="h-4 w-4" /> List mein nahi? {query.trim() ? `“${query.trim()}” ` : ""}apna naam likh kar demand karein
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className={LABEL}>Ya apna product likhein <span className="font-normal text-surface-400">· {info.rm} qism mein save hoga</span></label>
              <div className="mt-1 flex h-11 items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 dark:border-[#1e3160] dark:bg-[#0c1830]">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${t.pill}`}>{info.icon} {info.en}</span>
                <input value={form.productName} onChange={(e) => setForm((x) => ({ ...x, productName: e.target.value, productId: "" }))} placeholder={info.placeholder} className="h-full flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus:outline-none focus:ring-0 text-surface-900 outline-none dark:text-slate-100" aria-label="Product name" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className={LABEL}>Quantity · <span lang="ur">مقدار</span></label><input inputMode="decimal" value={form.quantity} onChange={(e) => setForm((x) => ({ ...x, quantity: e.target.value }))} placeholder="Misal: 5" className={INPUT} /></div>
              <div><label className={LABEL}>Unit <span className="font-normal text-surface-400">({info.rm} default)</span></label>
                <div className="mt-2 flex flex-wrap gap-1.5" data-testid="unit-chips">{info.units.map((u) => <button key={u} type="button" onClick={() => setForm((x) => ({ ...x, unit: u }))} className={chip(form.unit === u, t.chipOn)}>{UNIT_LABELS[u]}</button>)}</div></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className={LABEL}>Kab chahiye?</label><input type="date" value={form.neededBy} onChange={(e) => setForm((x) => ({ ...x, neededBy: e.target.value }))} className={INPUT} /></div>
              <div><label className={LABEL}>Kis liye?</label><input value={form.purpose} onChange={(e) => setForm((x) => ({ ...x, purpose: e.target.value }))} placeholder={group === "karyana" ? "Ghar / dukaan" : group === "feed" ? "Maal / janwar" : "Fasal: gandum, kapas..."} className={INPUT} /></div>
            </div>
            <div><label className={LABEL}>Ilaqa / gaon (optional)</label><input value={form.area} onChange={(e) => setForm((x) => ({ ...x, area: e.target.value }))} placeholder="Profile mein gaon na ho to likhein" className={INPUT} /></div>
            <div><label className={LABEL}>Extra note</label><textarea value={form.notes} onChange={(e) => setForm((x) => ({ ...x, notes: e.target.value }))} rows={3} placeholder="Brand, delivery ya koi aur baat" className="mt-1 w-full rounded-xl border border-surface-200 bg-white px-3 py-3 text-sm dark:border-[#1e3160] dark:bg-[#0c1830] dark:text-slate-100" /></div>
            {message && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">{message}</div>}
            <button type="submit" disabled={saving} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-semibold text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"><Send className="h-4 w-4" />{saving ? "Save ho raha hai..." : `${info.en} demand save karein`} · <span lang="ur">محفوظ کریں</span></button>
            <p className="text-xs text-surface-500 dark:text-slate-400">Payment abhi zaroori nahi. Product aane par confirmation li jayegi.</p>
          </form>
          )}
          {!group && message && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{message}</div>}
          </div>
        </section>

        <section className={`${CARD} pf-panel pf-navy fit:p-4`}>
          <div className="flex items-baseline justify-between"><h2 className="text-lg font-semibold text-surface-900 dark:text-white">Meri demands · <span lang="ur">میری طلب</span></h2><span className="text-xs text-surface-500 dark:text-slate-400">{rows.length} total</span></div>
          <p className="text-sm text-surface-500 dark:text-slate-400">Har demand ka status yahan milega.</p>
          {rows.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5" data-testid="row-filters">
              <button type="button" onClick={() => setRowFilter("all")} className={chip(rowFilter === "all", "border-teal-700 bg-teal-700 text-white")}>Sab {rows.length}</button>
              {DEMAND_GROUPS.filter((g) => rowGroups.has(g)).map((g) => <button key={g} type="button" onClick={() => setRowFilter(g)} className={chip(rowFilter === g, tone(g).chipOn)}>{DEMAND_GROUP_INFO[g].icon} {DEMAND_GROUP_INFO[g].rm.split(" /")[0]} {rowGroups.get(g)!.length}</button>)}
            </div>
          )}
          <div className="pf-body mt-2 fit:-me-2 fit:pe-2">
            {rows.length === 0 ? <div className="mt-3 rounded-2xl border border-dashed border-surface-300 p-8 text-center text-sm text-surface-500 dark:border-[#1e3160] dark:text-slate-400">Abhi koi demand save nahi hui.</div> :
              shownGroups.map((g) => (
                <div key={g} data-row-group={g}>
                  <div className="mt-4 flex items-center gap-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tone(g).pill}`}>{DEMAND_GROUP_INFO[g].icon} {DEMAND_GROUP_INFO[g].rm.split(" /")[0]} · <span lang="ur">{DEMAND_GROUP_INFO[g].ur.split(" /")[0]}</span></span><span className="text-xs text-surface-500">{rowGroups.get(g)!.length}</span></div>
                  <div className="mt-2 space-y-2.5">{rowGroups.get(g)!.map((row) => <DemandCard key={row.id} row={row} bar={tone(g).bar} />)}</div>
                </div>
              ))}
          </div>
        </section>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 fit:px-3 fit:py-1.5 fit:text-xs dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><strong>Important:</strong> Demand register karna order ya advance payment nahi hai. Product arrange hone par confirmation li jayegi.</div>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white p-4 shadow-card dark:border-[#1e3160] dark:bg-[#101d36]"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-emerald-500/15 dark:text-emerald-300">{icon}</div><div><p className="text-xs text-surface-500 dark:text-slate-400">{label}</p><p className="text-2xl font-bold text-surface-900 dark:text-white">{value}</p></div></div>;
}

function DemandCard({ row, bar }: { row: ProductDemandRow; bar: string }) {
  const toneCls = row.status === "fulfilled" || row.status === "approved" || row.status === "ordered" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : row.status === "rejected" || row.status === "cancelled" ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return <div className="flex gap-3 rounded-2xl border border-surface-200 bg-white p-3.5 shadow-card dark:border-[#1e3160] dark:bg-[#0c1830]"><div className={`w-1 shrink-0 rounded ${bar}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-surface-900 dark:text-slate-100">{row.product_name}{!row.product_id && <span className="ms-1.5 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">APNA</span>}</p><p className="mt-0.5 text-sm text-surface-500 dark:text-slate-400">{row.quantity} {UNIT_LABELS[row.unit as keyof typeof UNIT_LABELS] ?? row.unit}</p></div><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${toneCls}`}>{row.pipeline_status ? PIPELINE_LABELS[effectivePipeline(row)] : (statusLabels[row.status] ?? row.status)}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-surface-500 dark:text-slate-400"><span>Demand: {new Date(row.created_at).toLocaleDateString()}</span><span>Needed: {row.needed_by || "Jab available ho"}</span></div>{row.staff_note && <div className="mt-3 rounded-xl bg-surface-50 p-3 text-sm text-surface-700 dark:bg-[#14244a] dark:text-slate-200"><div className="flex items-center gap-2 font-medium"><Truck className="h-4 w-4" /> Munshi update</div><p className="mt-1">{row.staff_note}</p></div>}{row.status === "fulfilled" && <div className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Product arrange ho gaya—order confirm karein.</div>}{row.status === "rejected" && <div className="mt-3 flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300"><XCircle className="h-4 w-4" /> Is demand ko filhal close kar diya gaya hai.</div>}</div></div>;
}
