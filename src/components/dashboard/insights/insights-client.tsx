"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

/** Reduced motion ka ehtiraam -- animation band. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** Adad ginti karte hue barhta hai (ticking). Reduced motion par seedha. */
export function CountUp({ value, format }: { value: number; format: "rs" | "int" | "pct" }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(0);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      prev.current = value;
      return;
    }
    const start = prev.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else prev.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  const text = format === "rs" ? `Rs ${Math.round(shown).toLocaleString("en-PK")}` : format === "pct" ? `${shown.toFixed(1)}%` : Math.round(shown).toLocaleString("en-PK");
  return <span className="tabular-nums">{text}</span>;
}

export function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 26;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / Math.max(values.length - 1, 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} aria-hidden className="text-brand-600 dark:text-brand-400">
      <polyline fill="none" stroke="currentColor" strokeWidth={2} points={pts} />
    </svg>
  );
}

export interface KpiCardProps {
  label: string;
  value: number;
  format: "rs" | "int" | "pct";
  sub: string;
  spark: number[];
  empty?: boolean;
  note?: string | null;
}

export function KpiCards({ cards }: { cards: KpiCardProps[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" data-testid="cc-kpis">
      {cards.map((c) => (
        <div key={c.label} className="rounded-card border border-surface-200 bg-white p-3.5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-[11px] font-medium text-surface-500">{c.label}</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-surface-900 dark:text-white">{c.empty ? "—" : <CountUp value={c.value} format={c.format} />}</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="text-[10px] text-surface-400">{c.sub}</span>
            <Sparkline values={c.spark} />
          </div>
          {c.note && <p className="mt-1 text-[10px] leading-snug text-amber-700 dark:text-amber-400">{c.note}</p>}
        </div>
      ))}
    </div>
  );
}

/** URL ke query params badal kar naya link (baqi params waise hi). */
function useHref() {
  const pathname = usePathname();
  const sp = useSearchParams();
  return (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname ?? "";
  };
}

const TF_LABELS: Record<string, string> = { live: "Live", aaj: "Aaj", "7d": "7D", "30d": "30D", "1y": "1Y" };

export function TrendCard({ points, tf, title }: { points: { label: string; amount: number }[]; tf: string; title: string }) {
  const href = useHref();
  const reduced = usePrefersReducedMotion();
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">{title}</h2>
        <div className="flex gap-1" role="tablist" aria-label="Timeframe">
          {Object.entries(TF_LABELS).map(([k, l]) => (
            <Link
              key={k}
              href={href({ cc_tf: k })}
              scroll={false}
              role="tab"
              aria-selected={tf === k}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${tf === k ? "bg-brand-700 text-white" : "bg-surface-100 text-surface-600 hover:bg-brand-50 dark:bg-surface-800 dark:text-surface-300"}`}
            >
              {k === "live" && <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 ${reduced ? "" : "animate-pulse"}`} />}
              {l}
            </Link>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="ccTrendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={14} />
          <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }}
            labelStyle={{ color: "#cbd5e1" }}
            formatter={(value) => [`Rs ${Number(value).toLocaleString("en-PK")}`, "Bikri"]}
          />
          <Area type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={2.5} fill="url(#ccTrendFill)" isAnimationActive={!reduced} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const DONUT = ["#15803d", "#65a30d", "#0d9488", "#ca8a04", "#ea580c", "#7c3aed", "#94a3b8"];

/** Donut: legend par mouse/focus -- baqi hisse halke. */
export function CategoryDonut({ slices }: { slices: { name: string; amount: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const total = slices.reduce((a, s) => a + s.amount, 0);
  if (!slices.length || total <= 0) return <p className="py-6 text-center text-sm text-surface-400">—</p>;
  const focus = active ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative h-[150px] w-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="amount" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={1} isAnimationActive={!reduced}>
              {slices.map((s, i) => (
                <Cell key={s.name} fill={DONUT[i % DONUT.length]} opacity={active == null || active === i ? 1 : 0.25} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="max-w-[80px] truncate text-[10px] text-surface-500">{slices[focus].name}</span>
          <span className="text-sm font-bold text-surface-900 dark:text-white">{((slices[focus].amount / total) * 100).toFixed(1)}%</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-[11px]">
        {slices.map((s, i) => (
          <li
            key={s.name}
            tabIndex={0}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className={`flex cursor-default items-center gap-1.5 transition-opacity ${active == null || active === i ? "opacity-100" : "opacity-30"}`}
          >
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: DONUT[i % DONUT.length] }} />
            <span className="truncate text-surface-700 dark:text-surface-200">{s.name}</span>
            <span className="ml-auto tabular-nums text-surface-500">Rs {Math.round(s.amount).toLocaleString("en-PK")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Filter bar: dukan, category, tareekh. GET form -- URL share ho sakta hai. */
export function InsightsFilterBar({
  shops,
  categories,
  shopId,
  categoryId,
  from,
  to,
  tf,
}: {
  shops: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  shopId: string | null;
  categoryId: string | null;
  from: string;
  to: string;
  tf: string;
}) {
  const pathname = usePathname();
  const sel = "rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-800 dark:border-surface-700 dark:bg-surface-900 dark:text-brand-300";
  return (
    <form method="get" action={pathname ?? undefined} className="flex flex-wrap items-center gap-2" data-testid="cc-filters">
      <span className="text-xs font-bold text-surface-700 dark:text-surface-200">Filters:</span>
      <input type="hidden" name="cc_tf" value={tf} />
      <label className="sr-only" htmlFor="cc_shop">Dukan</label>
      <select id="cc_shop" name="cc_shop" defaultValue={shopId ?? ""} className={sel}>
        <option value="">Dukan: Sab dukanen</option>
        {shops.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor="cc_cat">Category</label>
      <select id="cc_cat" name="cc_cat" defaultValue={categoryId ?? ""} className={sel}>
        <option value="">Category: Sab</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <input type="date" name="cc_from" defaultValue={from} max={to} className={sel} aria-label="Se" />
      <input type="date" name="cc_to" defaultValue={to} className={sel} aria-label="Tak" />
      <button type="submit" className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800">Lagao</button>
      <Link href={pathname ?? "/admin/command-center"} className="text-xs text-surface-500 hover:underline">Saaf karein</Link>
    </form>
  );
}

/** Taaza bikri -- nayi qatar aate hi chamakti hai (LiveRefresh page ko taaza karta hai). */
export function LiveFeed({ rows }: { rows: { id: string; at: string; shop: string; mode: string; amount: number; customer: string | null }[] }) {
  const reduced = usePrefersReducedMotion();
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (seen.current) {
      const n = new Set(rows.filter((r) => !seen.current!.has(r.id)).map((r) => r.id));
      setFresh(n);
    }
    seen.current = new Set(rows.map((r) => r.id));
  }, [rows]);
  if (!rows.length) return <p className="py-6 text-center text-sm text-surface-400">—</p>;
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <ul className="divide-y divide-surface-100 text-xs dark:divide-surface-800" data-testid="cc-live-feed" aria-live="polite">
      {rows.map((r) => (
        <li key={r.id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 py-1.5 ${fresh.has(r.id) && !reduced ? "animate-pulse bg-brand-50 dark:bg-surface-800" : ""}`}>
          <span className="tabular-nums text-surface-500">{fmt.format(new Date(r.at))}</span>
          <span className="truncate text-surface-700 dark:text-surface-200">
            {r.shop.replace(/^Kisaan\s+/i, "").replace(/\s+Mahabali$/i, "")} · <span className="capitalize">{r.mode}</span>
            {r.customer ? ` · ${r.customer}` : ""}
          </span>
          <span className="font-semibold tabular-nums text-surface-900 dark:text-white">Rs {Math.round(r.amount).toLocaleString("en-PK")}</span>
        </li>
      ))}
    </ul>
  );
}
