"use client";
import { useMemo, useState } from "react";
import { Download, Upload, FileSpreadsheet, Search, Users, LandPlot, PackageSearch, PenLine, MapPinOff, Wheat } from "lucide-react";
import { PinMap } from "@/components/maps/pin-map";
import type { AdminBooking } from "@/lib/campaigns/season-data";

const KIND = { seed: "Beej", fertilizer: "Khaad", pesticide: "Spray" } as const;
const sel = "rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100";

export function BookingsDashboard({ campaign, bookings, isAdmin }: { campaign: { id: string; name: string; deadline: string }; bookings: AdminBooking[]; isAdmin: boolean }) {
  const [q, setQ] = useState(""); const [village, setVillage] = useState(""); const [kind, setKind] = useState(""); const [pin, setPin] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const villages = useMemo(() => [...new Set(bookings.map((b) => b.village).filter(Boolean))].sort() as string[], [bookings]);
  const rows = bookings.filter((b) => {
    const t = q.trim().toLowerCase();
    if (t && !`${b.farmerName} ${b.phone ?? ""} ${b.farmerCode ?? ""}`.toLowerCase().includes(t)) return false;
    if (village && b.village !== village) return false;
    if (kind === "custom" ? !b.lines.some((l) => l.custom) : kind && !b.lines.some((l) => l.kind === kind)) return false;
    const has = b.farms.some((f) => f.lat != null);
    if (pin === "yes" && !has) return false; if (pin === "no" && has) return false;
    return true;
  });
  const acres = rows.reduce((s, b) => s + b.bookingAcres, 0);
  const custom = rows.reduce((s, b) => s + b.lines.filter((l) => l.custom).length, 0);
  const noPin = rows.reduce((s, b) => s + b.farms.filter((f) => f.lat == null).length, 0);
  const pins = rows.flatMap((b) => b.farms.filter((f) => f.lat != null).map((f, i) => ({ id: `${b.id}-${i}`, lat: f.lat!, lng: f.lng!, label: `${b.farmerName} · ${f.name} (${f.acres} ac)`, active: active === b.id, color: active === b.id ? "#e5484d" : b.lines.some((l) => l.custom) ? "#d97706" : "#16a34a" })));
  const qty = (b: AdminBooking, k: keyof typeof KIND) => b.lines.filter((l) => l.kind === k).reduce((s, l) => s + l.quantity, 0);
  const kpis = [
    { label: "Bookings", value: rows.length.toLocaleString("en-PK"), icon: Users, cls: "from-emerald-700 to-emerald-500" },
    { label: "Kul rakba", value: `${acres.toLocaleString("en-PK")} acre`, icon: LandPlot, cls: "from-sky-700 to-blue-500" },
    { label: "Demand lines", value: rows.reduce((s, b) => s + b.lines.length, 0).toLocaleString("en-PK"), icon: PackageSearch, cls: "from-amber-600 to-amber-400" },
    { label: "Apni products", value: `${custom} review`, icon: PenLine, cls: "from-violet-700 to-fuchsia-500" },
  ];
  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-emerald-800 via-emerald-600 to-amber-500 px-6 py-5 text-white shadow-card">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold"><Wheat className="h-6 w-6" />Season Bookings</h1>
          <p className="text-sm text-white/90">{campaign.name} · tamam kisanon ki demand aur farms · sirf gandum</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <a href="/admin/season-bookings/template" className={btn}><FileSpreadsheet className="h-4 w-4" />Template</a>}
          {isAdmin && <a href="#import" className={btn}><Upload className="h-4 w-4" />Import sheet</a>}
          <a href={`/admin/season-bookings/export?campaign=${campaign.id}&format=csv&sheet=summary`} className={btn}><Download className="h-4 w-4" />CSV: Summary</a>
          <a href={`/admin/season-bookings/export?campaign=${campaign.id}&format=csv&sheet=lines`} className={btn}><Download className="h-4 w-4" />CSV: Demand lines</a>
          <a href={`/admin/season-bookings/export?campaign=${campaign.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-800 shadow hover:bg-emerald-50"><Download className="h-4 w-4" />Export Excel (sab kisan)</a>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => { const I = k.icon; return (
          <div key={k.label} className={`rounded-2xl bg-gradient-to-br ${k.cls} p-4 text-white shadow-card`}>
            <div className="flex items-center justify-between text-sm text-white/90">{k.label}<I className="h-5 w-5 text-white/80" /></div>
            <div className="mt-2 font-display text-2xl font-semibold">{k.value}</div>
          </div>); })}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <select aria-label="Gaon" value={village} onChange={(e) => setVillage(e.target.value)} className={sel}><option value="">Gaon: Sab</option>{villages.map((v) => <option key={v}>{v}</option>)}</select>
        <select aria-label="Qism" value={kind} onChange={(e) => setKind(e.target.value)} className={sel}><option value="">Qism: Sab</option><option value="seed">Beej</option><option value="fertilizer">Khaad</option><option value="pesticide">Spray</option><option value="custom">Apni product</option></select>
        <select aria-label="Pin" value={pin} onChange={(e) => setPin(e.target.value)} className={sel}><option value="">Pin: Sab</option><option value="yes">Pin laga</option><option value="no">Pin nahi</option></select>
        <label className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-surface-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kisan / phone / code" className={`${sel} w-full pl-9`} /></label>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="rounded-2xl border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">🗺️ Farms map</h3>
          <PinMap pins={pins} height={380} fitKey={`${rows.length}-${village}-${kind}-${pin}`} />
          <p className="mt-2 flex flex-wrap gap-3 text-xs text-surface-500"><span>🟢 Booking</span><span>🟠 Apni product wali</span><span className="inline-flex items-center gap-1"><MapPinOff className="h-3.5 w-3.5" />Pin nahi: {noPin} farm</span></p>
        </section>
        <section className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900 lg:col-span-3">
          <div className="max-h-[460px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-50 text-xs text-surface-500 dark:bg-surface-950"><tr>{["Kisan", "Farms", "Acre", "Beej / Khaad / Spray", "Apni", "Pin"].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {rows.map((b) => { const pinned = b.farms.filter((f) => f.lat != null).length; return (
                  <tr key={b.id} onMouseEnter={() => setActive(b.id)} onMouseLeave={() => setActive(null)} className={`${active === b.id ? "bg-emerald-50/70 dark:bg-emerald-500/5" : ""}`}>
                    <td className="px-3 py-2.5"><div className="font-medium text-surface-900 dark:text-white">{b.farmerName}</div><div className="text-xs text-surface-500">{b.phone ?? "—"}{b.village ? ` · ${b.village}` : ""}</div></td>
                    <td className="px-3 py-2.5 text-surface-700 dark:text-surface-300">{b.farms.map((f) => f.name).join(", ") || "—"}</td>
                    <td className="px-3 py-2.5 font-semibold text-surface-900 dark:text-white">{b.bookingAcres}</td>
                    <td className="px-3 py-2.5 text-surface-700 dark:text-surface-300">{qty(b, "seed")} / {qty(b, "fertilizer")} / {qty(b, "pesticide")}</td>
                    <td className="px-3 py-2.5">{b.lines.some((l) => l.custom) ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{b.lines.filter((l) => l.custom).length}</span> : <span className="text-surface-400">—</span>}</td>
                    <td className="px-3 py-2.5">{pinned === b.farms.length && pinned ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">✓ {pinned}</span> : <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">{b.farms.length - pinned} baqi</span>}</td>
                  </tr>); })}
                {!rows.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-surface-500">Abhi koi booking nahi.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
