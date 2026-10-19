"use client";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Lock, MapPin, Plus, Trash2, Search, Sprout, FlaskConical, ShieldCheck, PenLine, Check, Loader2, CalendarClock, Wheat } from "lucide-react";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { submitSeasonBooking, type SeasonState } from "@/actions/season-booking";
import { LINE_KINDS, type LineKind } from "@/lib/campaigns/booking";
import { productsForKind, searchProducts, SEASON_CROP, SEASON_CROP_LABEL, UNITS, type CampaignProductRow } from "@/lib/campaigns/season-v2";
import { PinMap } from "@/components/maps/pin-map";

export type CampaignProduct = CampaignProductRow;
export interface FarmDraft { key: string; farmId: string | null; name: string; acres: string; village: string; lat: number | null; lng: number | null; src?: "gps" | "manual_pin"; accuracy?: number | null }
export interface LineDraft { key: string; kind: LineKind; productId: string | null; customName: string | null; quantity: string; unit: string }

const KIND_UI: Record<LineKind, { label: string; icon: typeof Sprout; on: string; off: string }> = {
  seed: { label: "Beej", icon: Sprout, on: "bg-emerald-600 text-white shadow-sm", off: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300" },
  fertilizer: { label: "Khaad", icon: FlaskConical, on: "bg-amber-500 text-white shadow-sm", off: "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300" },
  pesticide: { label: "Spray", icon: ShieldCheck, on: "bg-indigo-600 text-white shadow-sm", off: "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300" },
};
const inp = "w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100";
const card = "rounded-2xl border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900";
let seq = 0; const k = () => `k${++seq}`;

function Submit({ existing }: { existing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:from-emerald-800 disabled:opacity-60">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{existing ? "Booking update karein" : "Booking bhejein"}
    </button>
  );
}

export function CampaignBookingForm({ campaign, open, products, farmerCode, initialFarms, initialLines, initialNotes, existing }: {
  campaign: { id: string; name: string; crop: string; deadline: string; description: string | null };
  open: boolean; products: CampaignProduct[]; farmerCode: string | null;
  initialFarms: FarmDraft[]; initialLines: LineDraft[]; initialNotes: string; existing: boolean;
}) {
  const [state, action] = useFormState(submitSeasonBooking, {} as SeasonState);
  const [farms, setFarms] = useState<FarmDraft[]>(initialFarms.length ? initialFarms : [{ key: k(), farmId: null, name: "", acres: "", village: "", lat: null, lng: null }]);
  const [activeFarm, setActiveFarm] = useState(0);
  const [lines, setLines] = useState<LineDraft[]>(initialLines);
  const [notes, setNotes] = useState(initialNotes);
  const [tab, setTab] = useState<LineKind>("seed");
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);

  const byKind = useMemo(() => Object.fromEntries(LINE_KINDS.map((kk) => [kk, productsForKind(products, kk, SEASON_CROP)])) as Record<LineKind, CampaignProduct[]>, [products]);
  const list = searchProducts(byKind[tab], q);
  const nameOf = (id: string | null) => products.find((p) => p.id === id)?.name ?? "";
  const totalAcres = farms.reduce((s, f) => s + (Number(f.acres) || 0), 0);
  const dl = campaign.deadline.split("-").reverse().join("-");
  const af = farms[activeFarm] ?? farms[0];

  const setFarm = (i: number, p: Partial<FarmDraft>) => setFarms(farms.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const addProduct = (p: CampaignProduct) => {
    if (lines.some((l) => l.productId === p.id)) return;
    setLines([...lines, { key: k(), kind: tab, productId: p.id, customName: null, quantity: tab === "pesticide" ? "" : String(Math.max(1, Math.round(totalAcres)) || ""), unit: p.unit && (UNITS as readonly string[]).includes(p.unit) ? p.unit : tab === "pesticide" ? "packet" : "bag" }]);
  };
  const addCustom = () => {
    const n = custom.trim(); if (n.length < 2) return;
    setLines([...lines, { key: k(), kind: tab, productId: null, customName: n, quantity: "", unit: "bag" }]); setCustom("");
  };
  const gps = () => {
    if (!navigator.geolocation) { setGpsMsg("Is phone par GPS nahi."); return; }
    setGpsMsg("Location le rahe hain…");
    navigator.geolocation.getCurrentPosition(
      (p) => { setFarm(activeFarm, { lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6, src: "gps", accuracy: Math.round(p.coords.accuracy) }); setGpsMsg(`GPS accuracy ±${Math.round(p.coords.accuracy)} m`); },
      () => setGpsMsg("Location nahi mili. Map par tap kar ke pin lagayein."), { enableHighAccuracy: true, timeout: 10000 });
  };

  return (
    <form action={action} className="overflow-hidden rounded-3xl border border-surface-200 bg-surface-50 shadow-card dark:border-surface-800 dark:bg-surface-950">
      <input type="hidden" name="campaign_id" value={campaign.id} />
      <input type="hidden" name="crop" value={SEASON_CROP} />
      <input type="hidden" name="farms" value={JSON.stringify(farms.map(({ key: _k, ...f }) => f))} />
      <input type="hidden" name="lines" value={JSON.stringify(lines.map(({ key: _k, ...l }) => l))} />

      <header className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-emerald-800 via-emerald-600 to-amber-500 px-6 py-5 text-white">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Wheat className="h-5 w-5" />{campaign.name}</h2>
          <p className="mt-0.5 text-sm text-white/90">{campaign.description?.split(":")[0] ?? "Kisan Eco Mahabali"} · <CalendarClock className="inline h-3.5 w-3.5" /> Aakhri taareekh {dl} · Booking par koi payment nahi</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full border border-white/40 bg-white/15 px-3 py-1">Wheat Credit Plan</span>
          {farmerCode && <span className="rounded-full border border-white/40 bg-white/15 px-3 py-1">{farmerCode}</span>}
        </div>
      </header>

      <div className="space-y-5 p-5">
        {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{state.error}</p>}
        {state.success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">{state.message}</p>}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className={card}>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">1 · Fasal</h3>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm dark:border-surface-700 dark:bg-surface-950">
              <Lock className="h-4 w-4 text-surface-500" /><b className="text-surface-900 dark:text-white">{SEASON_CROP_LABEL}</b>
              <span className="text-xs text-surface-500">— abhi sirf gandum credit plan</span>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white">2 · Mere farms</h3>
              <span className="text-xs text-surface-500">Kul rakba <b className="text-surface-900 dark:text-white">{totalAcres.toLocaleString("en-PK")} acre</b></span>
            </div>
            <div className="mt-2 space-y-2">
              {farms.map((f, i) => (
                <div key={f.key} onClick={() => setActiveFarm(i)} className={`rounded-xl border p-3 transition ${i === activeFarm ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/15 dark:bg-emerald-500/5" : "border-surface-200 dark:border-surface-700"}`}>
                  <div className="grid grid-cols-12 gap-2">
                    <input aria-label="Farm ka naam" placeholder="Farm ka naam (maslan Dera Wala)" value={f.name} onChange={(e) => setFarm(i, { name: e.target.value })} disabled={!open} className={`${inp} col-span-12 sm:col-span-5`} />
                    <input aria-label="Acre" placeholder="Acre" inputMode="decimal" value={f.acres} onChange={(e) => setFarm(i, { acres: e.target.value })} disabled={!open} className={`${inp} col-span-4 sm:col-span-2`} />
                    <input aria-label="Gaon" placeholder="Gaon / mauza" value={f.village} onChange={(e) => setFarm(i, { village: e.target.value })} disabled={!open} className={`${inp} col-span-6 sm:col-span-4`} />
                    {open && farms.length > 1 && <button type="button" aria-label="Farm hatayein" onClick={(e) => { e.stopPropagation(); setFarms(farms.filter((_, j) => j !== i)); setActiveFarm(0); }} className="col-span-2 sm:col-span-1 grid place-items-center rounded-lg text-surface-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <p className={`mt-1.5 flex items-center gap-1 text-xs ${f.lat != null ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                    <MapPin className="h-3.5 w-3.5" />{f.lat != null ? `Pin lag gaya · ${f.lat.toFixed(5)}, ${f.lng!.toFixed(5)}` : "Pin abhi nahi — farm chun kar map par tap karein"}
                  </p>
                </div>
              ))}
              {open && <button type="button" onClick={() => { setFarms([...farms, { key: k(), farmId: null, name: "", acres: "", village: "", lat: null, lng: null }]); setActiveFarm(farms.length); }} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-surface-300 px-3 py-2 text-sm font-medium text-surface-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-surface-600 dark:text-surface-300"><Plus className="h-4 w-4" />Naya farm</button>}
            </div>
          </section>

          <section className={card}>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white"><MapPin className="h-4 w-4 text-red-500" />Farm location pin — {af?.name || `Farm ${activeFarm + 1}`}</h3>
              {open && <button type="button" onClick={gps} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600">📡 Meri location</button>}
            </div>
            <PinMap className="mt-3" height={290} fitKey={`${activeFarm}`}
              pins={farms.filter((f) => f.lat != null).map((f) => ({ id: f.key, lat: f.lat!, lng: f.lng!, color: f.key === af?.key ? "#e5484d" : "#16a34a", label: f.name || "Farm", active: f.key === af?.key }))}
              onPick={open ? (lat, lng) => { setFarm(activeFarm, { lat, lng, src: "manual_pin", accuracy: null }); setGpsMsg(null); } : undefined} />
            <p className="mt-2 text-xs text-surface-500">{gpsMsg ?? "Map par tap kar ke pin lagayein, ya khet par khare ho kar \"Meri location\" dabayein."}</p>
          </section>
        </div>

        <section className={card}>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white">3 · Zaroorat ka saman</h3>
          <div className="mt-3 flex flex-wrap gap-2" role="tablist">
            {LINE_KINDS.map((kk) => { const U = KIND_UI[kk]; const I = U.icon; return (
              <button key={kk} type="button" role="tab" aria-selected={tab === kk} onClick={() => { setTab(kk); setQ(""); }} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${tab === kk ? U.on : U.off}`}>
                <I className="h-4 w-4" />{U.label} <span className="opacity-75">({byKind[kk].length})</span>
              </button>); })}
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <label className="relative block"><Search className="absolute start-3 top-2.5 h-4 w-4 text-surface-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${KIND_UI[tab].label} talash karein…`} className={`${inp} ps-9`} disabled={!open} />
              </label>
              <ul className="mt-2 max-h-64 divide-y divide-surface-100 overflow-auto rounded-xl border border-surface-200 dark:divide-surface-800 dark:border-surface-700">
                {list.map((p) => { const added = lines.some((l) => l.productId === p.id); return (
                  <li key={p.id}><button type="button" disabled={!open || added} onClick={() => addProduct(p)} className="flex w-full items-center justify-between px-3 py-2.5 text-start text-sm hover:bg-surface-50 disabled:cursor-default dark:hover:bg-surface-800/60">
                    <span className="text-surface-800 dark:text-surface-100">{p.name}{p.pack_size && <span className="ms-1 text-xs text-surface-500">({p.pack_size})</span>}</span>
                    {added ? <span className="text-xs font-semibold text-emerald-600">✓ Shamil</span> : <Plus className="h-4 w-4 text-surface-400" />}
                  </button></li>); })}
                {!list.length && <li className="px-3 py-4 text-center text-sm text-surface-500">{tab === "seed" ? "Gandum ka beej list mein nahi — neeche apna likhein." : "Koi product nahi mili."}</li>}
              </ul>
              {open && <div className="mt-3 flex gap-2 rounded-xl border border-dashed border-surface-300 p-2 dark:border-surface-600">
                <PenLine className="mt-2 h-4 w-4 shrink-0 text-surface-400" />
                <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} placeholder="Product nahi mili? Apni product likhein" className="min-w-0 flex-1 bg-transparent text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none dark:text-surface-100" />
                <button type="button" onClick={addCustom} className="rounded-lg bg-surface-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-surface-900">Shamil karein</button>
              </div>}
            </div>
            <div>
              <div className="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 text-xs text-surface-500 dark:bg-surface-950"><tr><th className="px-3 py-2 text-start font-medium">Item</th><th className="px-2 py-2 text-start font-medium">Qism</th><th className="px-2 py-2 text-start font-medium">Miqdar</th><th /></tr></thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {lines.map((l) => (
                      <tr key={l.key}>
                        <td className="px-3 py-2 text-surface-800 dark:text-surface-100">{l.productId ? nameOf(l.productId) : l.customName}{!l.productId && <span className="ms-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Admin review</span>}</td>
                        <td className="px-2 py-2 text-xs text-surface-500">{KIND_UI[l.kind].label}</td>
                        <td className="px-2 py-2"><div className="flex gap-1">
                          <input aria-label="Miqdar" value={l.quantity} onChange={(e) => setLines(lines.map((x) => (x.key === l.key ? { ...x, quantity: e.target.value } : x)))} inputMode="decimal" disabled={!open} className={`${inp} w-16 px-2 py-1`} />
                          <select aria-label="Unit" value={l.unit} onChange={(e) => setLines(lines.map((x) => (x.key === l.key ? { ...x, unit: e.target.value } : x)))} disabled={!open} className={`${inp} w-20 px-1 py-1`}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
                        </div></td>
                        <td className="pe-2">{open && <button type="button" aria-label="Hatayein" onClick={() => setLines(lines.filter((x) => x.key !== l.key))} className="p-1 text-surface-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}</td>
                      </tr>
                    ))}
                    {!lines.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-surface-500">Bayen list se beej, khaad aur spray chunein.</td></tr>}
                  </tbody>
                </table>
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} name="notes" rows={2} placeholder="Notes (ikhtiyari)" disabled={!open} className={`${inp} mt-3`} />
              <div className="mt-3 flex justify-end">{open ? <Submit existing={existing} /> : <p className="text-sm text-surface-500">Booking band ho chuki hai.</p>}</div>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
