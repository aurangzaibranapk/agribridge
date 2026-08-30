"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { t } from "@/lib/i18n/translations";
import { ChevronRight, Info } from "lucide-react";

export type Period = "today" | "7d" | "month" | "season" | "custom" | "all";
export type Basis = "bill" | "work";
type Lang = "en" | "rm" | "ur";

export interface PnlRow {
  bookingId: string;
  bookingNumber: string;
  billNumber: string | null;
  billDate: string | null;
  workDate: string | null;
  bookingDate: string | null;
  cropType: string | null;
  vendorId: string | null;
  vendorName: string | null;
  machineId: string | null;
  machineCode: string | null;
  machineType: string | null;
  machineOwner: string;
  acre: number;
  gross: number;
  vendorShare: number;
  margin: number;
  ownDiesel: number;
  recoverableDiesel: number;
  farmerDiesel: number;
  vendorDiesel: number;
  received: number;
  profit: number;
}

const rs = (v: number) => {
  // Manfi sifar sifar hi hai -- `-0 < 0` ghalat hota hai, is liye bina
  // is lakeer ke safhe par "Rs -0" chhap jata hai.
  const x = v === 0 ? 0 : v;
  return x < 0 ? `- Rs ${Math.abs(x).toLocaleString()}` : `Rs ${x.toLocaleString()}`;
};
const sum = (rows: PnlRow[], f: (r: PnlRow) => number) => rows.reduce((s, r) => s + f(r), 0);

export function PnlClient({
  rows, lang, period, basis, from, to, seasonLabel,
}: {
  rows: PnlRow[];
  lang: Lang;
  period: Period;
  basis: Basis;
  from: string | null;
  to: string | null;
  seasonLabel: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [drill, setDrill] = useState<null | string>(null);

  function go(next: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    router.push(`?${p.toString()}`);
  }

  const tot = useMemo(() => {
    const acre = sum(rows, (r) => r.acre);
    const margin = sum(rows, (r) => r.margin);
    const ownDiesel = sum(rows, (r) => r.ownDiesel);
    const profit = sum(rows, (r) => r.profit);
    return {
      bookings: rows.length,
      acre,
      gross: sum(rows, (r) => r.gross),
      vendorShare: sum(rows, (r) => r.vendorShare),
      margin,
      ownDiesel,
      profit,
      received: sum(rows, (r) => r.received),
      recoverable: sum(rows, (r) => r.recoverableDiesel),
      farmerDiesel: sum(rows, (r) => r.farmerDiesel),
      // Sifar acre par taqseem nahi -- warna NaN ya Infinity chhap jata.
      perAcre: acre > 0 ? Math.round((profit / acre) * 100) / 100 : null,
    };
  }, [rows]);

  /** Goshware -- sab isi ek fehrist se bante hain, alag query se nahi. */
  const groups = useMemo(() => {
    const by = (key: (r: PnlRow) => string | null, name: (r: PnlRow) => string) => {
      const m = new Map<string, { label: string; rows: PnlRow[] }>();
      for (const r of rows) {
        const k = key(r);
        if (k === null) continue;
        const g = m.get(k) ?? { label: name(r), rows: [] };
        g.rows.push(r);
        m.set(k, g);
      }
      return [...m.entries()]
        .map(([k, g]) => ({
          key: k,
          label: g.label,
          rows: g.rows,
          acre: sum(g.rows, (r) => r.acre),
          gross: sum(g.rows, (r) => r.gross),
          vendorShare: sum(g.rows, (r) => r.vendorShare),
          profit: sum(g.rows, (r) => r.profit),
          perAcre: sum(g.rows, (r) => r.acre) > 0
            ? Math.round((sum(g.rows, (r) => r.profit) / sum(g.rows, (r) => r.acre)) * 100) / 100
            : null,
        }))
        .sort((a, b) => b.profit - a.profit);
    };
    const monthKey = basis === "work" ? (r: PnlRow) => r.workDate : (r: PnlRow) => r.billDate;
    return {
      machine: by((r) => r.machineId, (r) => `${r.machineType ?? "-"}${r.machineCode ? ` · ${r.machineCode}` : ""}`),
      vendor: by((r) => r.vendorId, (r) => r.vendorName ?? "-"),
      crop: by((r) => r.cropType ?? "darj nahi", (r) => r.cropType ?? "darj nahi"),
      month: by(
        (r) => (monthKey(r) ? monthKey(r)!.slice(0, 7) : null),
        (r) => monthKey(r)!.slice(0, 7)
      ).sort((a, b) => a.key.localeCompare(b.key)),
    };
  }, [rows, basis]);

  const periods: Array<[Period, string]> = [
    ["today", t("mp_today", lang)],
    ["7d", t("mp_7days", lang)],
    ["month", t("mp_this_month", lang)],
    ["season", seasonLabel ? `${t("mp_season", lang)} · ${seasonLabel}` : t("mp_season", lang)],
    ["custom", t("mp_custom", lang)],
    ["all", t("mp_all", lang)],
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("mc_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold text-surface-900 dark:text-white">
          {t("mp_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("mp_subtitle", lang)}</p>
      </div>

      {/* ---- Arsa aur nazariya ---- */}
      <div className="flex flex-wrap items-center gap-2">
        {periods.map(([p, label]) => (
          <button
            key={p}
            onClick={() => go({ period: p })}
            className={
              period === p
                ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-surface-700 ring-1 ring-surface-200 hover:bg-surface-50 dark:bg-surface-900 dark:text-surface-200 dark:ring-surface-700"
            }
          >
            {label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-surface-200 dark:bg-surface-700" />
        {(["bill", "work"] as Basis[]).map((b) => (
          <button
            key={b}
            onClick={() => go({ basis: b })}
            className={
              basis === b
                ? "rounded-lg bg-surface-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-surface-100 dark:text-surface-900"
                : "rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-surface-500 ring-1 ring-surface-200 hover:bg-surface-50 dark:bg-surface-900 dark:ring-surface-700"
            }
          >
            {b === "bill" ? t("mp_basis_bill", lang) : t("mp_basis_work", lang)}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-surface-200 bg-white p-3 dark:border-surface-800 dark:bg-surface-900">
          <div>
            <label className="text-xs text-surface-500">{t("mp_from", lang)}</label>
            <input
              type="date" defaultValue={from ?? ""} id="pnl-from"
              className="mt-1 block rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
            />
          </div>
          <div>
            <label className="text-xs text-surface-500">{t("mp_to_date", lang)}</label>
            <input
              type="date" defaultValue={to ?? ""} id="pnl-to"
              className="mt-1 block rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
            />
          </div>
          <button
            onClick={() =>
              go({
                period: "custom",
                from: (document.getElementById("pnl-from") as HTMLInputElement)?.value || null,
                to: (document.getElementById("pnl-to") as HTMLInputElement)?.value || null,
              })
            }
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            {t("mp_apply", lang)}
          </button>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-surface-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("mp_basis_note", lang)}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-card border border-surface-200 bg-white p-10 text-center text-surface-400 dark:border-surface-800 dark:bg-surface-900">
          {t("mp_none_in_period", lang)}
        </div>
      ) : (
        <>
          {/* ---- KPI ---- */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={t("mp_kpi_acres", lang)} value={`${tot.acre} acre`}
              sub={`${tot.bookings} ${t("mp_bookings_word", lang)}`} onClick={() => setDrill(drill === "all" ? null : "all")} on={drill === "all"} />
            <Kpi label={t("mp_gross", lang)} value={rs(tot.gross)}
              sub={t("mp_kpi_acres", lang)} onClick={() => setDrill(drill === "all" ? null : "all")} on={drill === "all"} />
            <Kpi label={t("mp_vendor_share", lang)} value={rs(tot.vendorShare)} tone="neutral"
              sub={t("mp_by_vendor", lang)} onClick={() => setDrill(drill === "vendor" ? null : "vendor")} on={drill === "vendor"} />
            <Kpi label={t("mp_kpi_margin", lang)} value={rs(tot.margin)} tone="good"
              sub="4030 Machinery Income" onClick={() => setDrill(drill === "all" ? null : "all")} on={drill === "all"} />
            <Kpi label={t("mp_kpi_expense", lang)} value={rs(tot.ownDiesel)} tone={tot.ownDiesel > 0 ? "bad" : "neutral"}
              sub={t("mp_own_diesel", lang)} onClick={() => setDrill(drill === "diesel" ? null : "diesel")} on={drill === "diesel"} />
            <Kpi label={t("mp_kpi_net", lang)} value={rs(tot.profit)} big
              tone={tot.profit >= 0 ? "good" : "bad"}
              sub={tot.profit >= 0 ? t("mp_profit_word", lang) : t("mp_loss_word", lang)}
              onClick={() => setDrill(drill === "all" ? null : "all")} on={drill === "all"} />
            <Kpi label={t("mp_per_acre", lang)}
              value={tot.perAcre === null ? "—" : rs(tot.perAcre)}
              tone={tot.perAcre === null ? "neutral" : tot.perAcre >= 0 ? "good" : "bad"}
              sub={tot.acre > 0 ? `${tot.acre} acre` : t("mp_not_tracked", lang)} />
            <Kpi label={t("mp_received", lang)} value={rs(tot.received)} tone="neutral"
              sub={t("mp_three", lang)} />
          </div>

          {drill && <Drill kind={drill} rows={rows} lang={lang} onClose={() => setDrill(null)} />}

          {/* ---- Munafa kaise banta hai ---- */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card lg:col-span-2 dark:border-surface-800 dark:bg-surface-900">
              <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">
                {t("mp_breakdown", lang)}
              </h2>
              <Row label={t("mp_gross", lang)} value={tot.gross} />
              <Row label={t("mp_vendor_share", lang)} value={-tot.vendorShare} />
              <div className="my-1 border-t border-surface-100 dark:border-surface-800" />
              <Row label={t("mp_kpi_margin", lang)} value={tot.margin} strong />
              <Row label={t("mp_own_diesel", lang)} value={-tot.ownDiesel} />

              {/* Jo kharche machinery abhi darj hi nahi karti. Inhen Rs 0
                  likhna jhoot hota: sifar kehta hai "tasdeeq shuda: kuch
                  kharch nahi hua", jabke sach ye hai ke koi khana hi nahi. */}
              <NotTracked label={t("mp_repairs", lang)} lang={lang} />
              <NotTracked label={t("mp_transport", lang)} lang={lang} />
              <NotTracked label={t("mp_operator", lang)} lang={lang} />

              <div className="mt-2 flex items-baseline justify-between border-t-2 border-surface-200 pt-2 dark:border-surface-700">
                <span className="font-display text-lg font-bold">{t("mp_kpi_net", lang)}</span>
                <span className="text-right">
                  <span className={`block font-display text-xl font-bold ${tot.profit >= 0 ? "text-brand-700 dark:text-brand-300" : "text-red-600 dark:text-red-400"}`}>
                    {rs(tot.profit)}
                  </span>
                  {/* Sirf rang par bharosa nahi -- lafz bhi likha hai. */}
                  <span className={`text-xs font-medium ${tot.profit >= 0 ? "text-brand-700 dark:text-brand-300" : "text-red-600 dark:text-red-400"}`}>
                    {tot.profit >= 0 ? t("mp_profit_word", lang) : t("mp_loss_word", lang)}
                    {tot.perAcre !== null && ` · ${rs(tot.perAcre)} ${t("mp_per_acre", lang)}`}
                  </span>
                </span>
              </div>

              <p className="mt-3 rounded-lg bg-surface-50 px-3 py-2 text-xs leading-relaxed text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                {t("mp_not_tracked_note", lang)}
              </p>
            </div>

            {/* ---- Diesel kis ka, aur teen alag cheezein ---- */}
            <div className="space-y-4">
              <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
                <h2 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-white">
                  {t("mc_diesel_section", lang)}
                </h2>
                <Row label={t("mp_own_diesel", lang)} value={tot.ownDiesel} />
                <Row label={t("mp_recoverable", lang)} value={tot.recoverable} />
                <Row label={t("mp_farmer_diesel", lang)} value={tot.farmerDiesel} />
                <p className="mt-2 text-xs leading-relaxed text-surface-500">{t("mp_diesel_note", lang)}</p>
              </div>

              <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
                <h2 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-white">
                  {t("mp_three", lang)}
                </h2>
                <Row label={t("mp_gross", lang)} value={tot.gross} />
                <Row label={t("mp_received", lang)} value={tot.received} />
                <Row label={t("mp_kpi_net", lang)} value={tot.profit} strong />
              </div>
            </div>
          </div>

          {/* ---- Charts ---- */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("mp_chart_trend", lang)}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={groups.month.map((g) => ({
                  name: g.key, billing: g.gross, lagat: g.vendorShare, munafa: g.profit,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={((v: number) => rs(v)) as never} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="billing" name={t("mp_gross", lang)} fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="lagat" name={t("mp_vendor_share", lang)} fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="munafa" name={t("mp_profit_word", lang)} fill="#16a34a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title={t("mp_chart_machine", lang)}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={groups.machine.map((g) => ({ name: g.label, munafa: g.profit }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={((v: number) => rs(v)) as never} />
                  <ReferenceLine y={0} stroke="#64748b" />
                  <Bar dataKey="munafa" name={t("mp_profit_word", lang)} radius={[3, 3, 0, 0]}>
                    {groups.machine.map((g) => (
                      <Cell key={g.key} fill={g.profit >= 0 ? "#16a34a" : "#dc2626"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title={t("mp_chart_per_acre", lang)}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={groups.machine.filter((g) => g.perAcre !== null)
                  .map((g) => ({ name: g.label, per: g.perAcre as number }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={((v: number) => rs(v)) as never} />
                  <ReferenceLine y={0} stroke="#64748b" />
                  <Bar dataKey="per" name={t("mp_per_acre", lang)} radius={[3, 3, 0, 0]}>
                    {groups.machine.filter((g) => g.perAcre !== null).map((g) => (
                      <Cell key={g.key} fill={(g.perAcre as number) >= 0 ? "#16a34a" : "#dc2626"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title={t("mp_by_vendor", lang)}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={groups.vendor.map((g) => ({ name: g.label, margin: g.profit }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={((v: number) => rs(v)) as never} />
                  <ReferenceLine y={0} stroke="#64748b" />
                  <Bar dataKey="margin" name={t("mp_kpi_margin", lang)} radius={[3, 3, 0, 0]}>
                    {groups.vendor.map((g) => (
                      <Cell key={g.key} fill={g.profit >= 0 ? "#16a34a" : "#dc2626"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          {/* ---- Goshware ---- */}
          <Group title={t("mp_by_machine", lang)} groups={groups.machine} lang={lang} perAcre />
          <Group title={t("mp_by_vendor", lang)} groups={groups.vendor} lang={lang} />
          <Group title={t("mp_by_crop", lang)} groups={groups.crop} lang={lang} />
          <Group title={t("mp_by_month", lang)} groups={groups.month} lang={lang} />
        </>
      )}
    </div>
  );
}

function Kpi({
  label, value, sub, tone = "neutral", big, onClick, on,
}: {
  label: string; value: string; sub?: string;
  tone?: "good" | "bad" | "neutral"; big?: boolean;
  onClick?: () => void; on?: boolean;
}) {
  const colour =
    tone === "good" ? "text-brand-700 dark:text-brand-300"
      : tone === "bad" ? "text-red-600 dark:text-red-400"
        : "text-surface-900 dark:text-surface-100";
  const inner = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{label}</p>
      <p className={`mt-1 font-display font-bold tabular-nums ${big ? "text-2xl" : "text-lg"} ${colour}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-surface-400">{sub}</p>}
    </>
  );
  const cls = `rounded-card border p-3 text-left shadow-card transition ${
    on ? "border-brand-400 bg-brand-50/40 dark:border-brand-600 dark:bg-brand-900/10"
       : "border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900"
  }`;
  return onClick
    ? <button onClick={onClick} className={`${cls} hover:border-brand-300`}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{title}</h2>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-0.5 text-sm ${strong ? "font-medium" : ""}`}>
      <span className="text-surface-600 dark:text-surface-300">{label}</span>
      <span className="shrink-0 tabular-nums text-surface-800 dark:text-surface-200">{rs(value)}</span>
    </div>
  );
}

/**
 * Wo lakeer jis ka data hai hi nahi.
 *
 * "Rs 0" aur "hisaab nahi rakha jata" do bilkul alag baatein hain.
 * Sifar kehta hai: dekh liya, kuch kharch nahi hua. Ye kehta hai:
 * hum ne dekha hi nahi. Dono ko ek jaisa likhna wahi ghalti hai jis
 * se aadmi jhoote munafe par bharosa kar baithta hai.
 */
function NotTracked({ label, lang }: { label: string; lang: Lang }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-sm">
      <span className="text-surface-400">{label}</span>
      <span className="shrink-0 rounded bg-surface-100 px-1.5 py-0.5 text-xs font-medium text-surface-500 dark:bg-surface-800 dark:text-surface-400">
        {t("mp_not_tracked", lang)}
      </span>
    </div>
  );
}

function Group({
  title, groups, lang, perAcre,
}: {
  title: string;
  groups: Array<{ key: string; label: string; rows: PnlRow[]; acre: number; gross: number; profit: number; perAcre: number | null }>;
  lang: Lang;
  perAcre?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (groups.length === 0) return null;
  return (
    <div className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="border-b border-surface-100 px-4 py-3 font-display text-base font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
        {title}
      </h2>
      <div className="divide-y divide-surface-100 dark:divide-surface-800">
        {groups.map((g) => (
          <div key={g.key}>
            <button
              onClick={() => setOpen(open === g.key ? null : g.key)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-50 dark:hover:bg-surface-800/50"
            >
              <ChevronRight className={`h-4 w-4 shrink-0 text-surface-400 transition ${open === g.key ? "rotate-90" : ""}`} />
              <span className="flex-1 truncate font-medium text-surface-800 dark:text-surface-200">{g.label}</span>
              <span className="shrink-0 tabular-nums text-xs text-surface-500">{g.acre} acre</span>
              <span className="shrink-0 tabular-nums text-xs text-surface-500">{rs(g.gross)}</span>
              <span className={`w-28 shrink-0 text-right tabular-nums font-medium ${g.profit >= 0 ? "text-brand-700 dark:text-brand-300" : "text-red-600 dark:text-red-400"}`}>
                {rs(g.profit)}
              </span>
              {perAcre && (
                <span className="hidden w-24 shrink-0 text-right tabular-nums text-xs text-surface-400 sm:block">
                  {g.perAcre === null ? "—" : `${rs(g.perAcre)}/acre`}
                </span>
              )}
            </button>
            {open === g.key && <BookingList rows={g.rows} lang={lang} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Har adad ke peeche ki asal bookingein -- yahan se seedha booking ke safhe tak. */
function BookingList({ rows, lang }: { rows: PnlRow[]; lang: Lang }) {
  return (
    <div className="overflow-x-auto bg-surface-50/60 px-4 py-2 dark:bg-surface-800/30">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-surface-400">
            <th className="py-1 pr-3 font-medium">{t("mc_booking_page", lang)}</th>
            <th className="py-1 pr-3 font-medium">{t("mp_from", lang)}</th>
            <th className="py-1 pr-3 text-right font-medium">Acre</th>
            <th className="py-1 pr-3 text-right font-medium">{t("mp_gross", lang)}</th>
            <th className="py-1 pr-3 text-right font-medium">{t("mp_vendor_share", lang)}</th>
            <th className="py-1 pr-3 text-right font-medium">{t("mp_own_diesel", lang)}</th>
            <th className="py-1 text-right font-medium">{t("mp_kpi_net", lang)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bookingId} className="border-t border-surface-100 dark:border-surface-800">
              <td className="py-1.5 pr-3">
                <Link href={`/admin/machinery-rental/booking/${r.bookingId}`} className="font-mono text-brand-700 hover:underline dark:text-brand-300">
                  {r.bookingNumber}
                </Link>
                {r.billNumber && <span className="ml-1.5 text-surface-400">{r.billNumber}</span>}
              </td>
              <td className="py-1.5 pr-3 text-surface-500">{r.billDate ?? "—"}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{r.acre}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{rs(r.gross)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-surface-500">{rs(r.vendorShare)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-surface-500">{rs(r.ownDiesel)}</td>
              <td className={`py-1.5 text-right tabular-nums font-medium ${r.profit >= 0 ? "text-brand-700 dark:text-brand-300" : "text-red-600 dark:text-red-400"}`}>
                {rs(r.profit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** KPI card par click -- us adad ke peeche ki asal qatarein. */
function Drill({ kind, rows, lang, onClose }: { kind: string; rows: PnlRow[]; lang: Lang; onClose: () => void }) {
  const shown = kind === "diesel" ? rows.filter((r) => r.ownDiesel > 0) : rows;
  return (
    <div className="rounded-card border border-brand-200 bg-white shadow-card dark:border-brand-800 dark:bg-surface-900">
      <div className="flex items-center justify-between border-b border-surface-100 px-4 py-2 dark:border-surface-800">
        <span className="text-sm font-medium text-surface-700 dark:text-surface-200">
          {shown.length} {t("mp_bookings_word", lang)}
        </span>
        <button onClick={onClose} className="text-xs text-surface-500 hover:text-surface-800">✕</button>
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-surface-400">{t("mp_empty", lang)}</p>
      ) : (
        <BookingList rows={shown} lang={lang} />
      )}
    </div>
  );
}
