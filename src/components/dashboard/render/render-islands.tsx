"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatRs } from "./format";

function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return r;
}


/** Count-up 0 -> value (1100 ms easeOutCubic). Reduced motion: seedha asal adad. Screen reader ko hamesha asal adad. */
export function CountUp({ value, format = "rs", className }: { value: number | null; format?: "rs" | "int" | "pct"; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<number | null>(value);
  const raf = useRef(0);
  useEffect(() => {
    if (value == null || reduced) { setShown(value); return; }
    const start = performance.now() + 250;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 1100));
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    setShown(0);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, reduced]);
  const fmt = (v: number | null) => (v == null ? "—" : format === "rs" ? formatRs(v) : format === "pct" ? `${v.toFixed(1)}%` : Math.round(v).toLocaleString());
  return (
    <span className={`rd-num ${className ?? ""}`} dir="ltr" aria-label={fmt(value)}>
      <span aria-hidden="true">{fmt(shown)}</span>
    </span>
  );
}

export function Sparkline({ points, color = "#10b981" }: { points: number[]; color?: string }) {
  const d = useMemo(() => {
    if (points.length < 2) return "";
    const max = Math.max(...points, 1);
    return points.map((v, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * 100).toFixed(2)},${(28 - (v / max) * 26).toFixed(2)}`).join(" ");
  }, [points]);
  if (!d) return null;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} pathLength={1} className="rd-draw" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const RANGES = [7, 14, 30] as const;

/** Sales Trend -- wohi loadSalesTrend() ke 30 din; 7D/14D/30D sirf usi data ka hissa dikhate hain. */
export function SalesAreaChart({ points, labels }: { points: { date: string; amount: number }[]; labels: { sale: string; date: string } }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [hover, setHover] = useState<number | null>(null);
  const data = points.slice(-range);
  const W = 600, H = 190, P = 6;
  const max = Math.max(...data.map((p) => p.amount), 1);
  const xy = data.map((p, i) => [P + (i / Math.max(1, data.length - 1)) * (W - 2 * P), H - 18 - (p.amount / max) * (H - 36)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = xy.length ? `${line} L${xy[xy.length - 1][0]},${H - 18} L${xy[0][0]},${H - 18} Z` : "";
  const total = data.reduce((s, p) => s + p.amount, 0);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(((x - P) / (W - 2 * P)) * (data.length - 1)))));
  };
  const h = hover != null ? xy[hover] : null;
  return (
    <div dir="ltr">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs text-surface-500">{range}D · <CountUp key={range} value={total} className="font-semibold text-surface-800 dark:text-surface-100" /></span>
        <div className="flex gap-1 rounded-full bg-surface-100 p-0.5 dark:bg-surface-800" role="tablist">
          {RANGES.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${range === r ? "bg-white text-surface-900 shadow dark:bg-surface-600 dark:text-white" : "text-surface-500"}`}>{r}D</button>
          ))}
        </div>
      </div>
      <svg key={range} viewBox={`0 0 ${W} ${H}`} className="h-[190px] w-full touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`${labels.sale} ${range}D: ${formatRs(total)}`}>
        <defs>
          <linearGradient id="rdArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity=".35" /><stop offset="1" stopColor="#10b981" stopOpacity="0" /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={W} y1={(H - 18) * f} y2={(H - 18) * f} stroke="currentColor" className="text-surface-200 dark:text-surface-800" strokeDasharray="3 4" />)}
        <path d={area} fill="url(#rdArea)" className="rd-fill" />
        <path d={line} fill="none" stroke="#10b981" strokeWidth={2.2} pathLength={1} className="rd-draw" />
        {data.map((p, i) => (i % Math.ceil(data.length / 6) === 0 ? <text key={p.date} x={xy[i][0]} y={H - 3} fontSize={10} textAnchor="middle" className="fill-surface-400">{p.date.slice(5)}</text> : null))}
        {h && hover != null && (
          <g>
            <line x1={h[0]} x2={h[0]} y1={0} y2={H - 18} stroke="#10b981" strokeOpacity=".5" />
            <circle cx={h[0]} cy={h[1]} r={4.5} fill="#10b981" stroke="white" strokeWidth={2} />
            <g transform={`translate(${h[0] > W - 150 ? h[0] - 140 : h[0] + 10},${Math.max(4, h[1] - 40)})`}>
              <rect width={130} height={36} rx={8} className="fill-white dark:fill-surface-800" stroke="#10b981" strokeOpacity=".4" />
              <text x={8} y={14} fontSize={10} className="fill-surface-500">{labels.date}: {data[hover].date}</text>
              <text x={8} y={29} fontSize={12} fontWeight={700} className="fill-surface-900 dark:fill-white">{formatRs(data[hover].amount)}</text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

/** Radial gauge 0 -> value. */
export function Gauge({ value, max, label, display, color = "#10b981" }: { value: number | null; max: number; label: string; display: string; color?: string }) {
  const r = 36, c = 2 * Math.PI * r * 0.75;
  const frac = value == null || max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${label}: ${display}`}>
      <svg viewBox="0 0 90 90" className="h-24 w-24" style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}>
        <circle cx={45} cy={45} r={r} fill="none" strokeWidth={8} strokeLinecap="round" className="stroke-surface-200 dark:stroke-surface-800" strokeDasharray={`${c} ${2 * Math.PI * r}`} transform="rotate(135 45 45)" />
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${c * frac} ${2 * Math.PI * r}`} transform="rotate(135 45 45)" className="rd-fill" />
        <text x={45} y={50} textAnchor="middle" fontSize={15} fontWeight={700} className="fill-surface-900 dark:fill-white">{display}</text>
      </svg>
      <span className="-mt-2 text-[11px] font-medium text-surface-500">{label}</span>
    </div>
  );
}

const DEPT_COLOR = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#6366f1", "#84cc16"];

/** Sales by Department -- wohi depts.revenue (purane donut jaisa). */
export function DeptDonut({ slices, empty }: { slices: { key: string; label: string; amount: number }[]; empty: string }) {
  const real = slices.filter((s) => s.amount > 0);
  const total = real.reduce((s, m) => s + m.amount, 0);
  if (total <= 0) return <p className="py-6 text-center text-xs text-surface-400">{empty}</p>;
  const r = 40, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-[130px] w-[130px] shrink-0 -rotate-90" aria-hidden="true">
        {real.map((s, i) => {
          const len = (s.amount / total) * C;
          const el = <circle key={s.key} cx={50} cy={50} r={r} fill="none" stroke={DEPT_COLOR[i % DEPT_COLOR.length]} strokeWidth={14} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} className="rd-fill" style={{ animationDelay: `${600 + i * 80}ms` }} />;
          acc += len;
          return el;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {real.map((s, i) => (
          <li key={s.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DEPT_COLOR[i % DEPT_COLOR.length] }} /><span className="truncate">{s.label}</span></span>
            <span className="rd-num font-semibold" dir="ltr">{formatRs(s.amount)} · {((s.amount / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Purana / Naya look -- cookie yaad rakhti hai, default purana. */
export function LookToggle({ current, labels }: { current: "old" | "new"; labels: { old: string; new: string } }) {
  const go = (look: "old" | "new") => {
    document.cookie = `ab_dash_look=${look}; path=/; max-age=31536000; samesite=lax`;
    const u = new URL(window.location.href);
    u.searchParams.set("look", look);
    window.location.href = u.toString();
  };
  return (
    <div className="inline-flex rounded-lg border border-surface-200 bg-white p-0.5 text-xs font-semibold shadow-sm dark:border-surface-700 dark:bg-surface-900" data-testid="look-toggle">
      {(["old", "new"] as const).map((k) => (
        <button key={k} type="button" onClick={() => go(k)} aria-pressed={current === k} className={`rounded-md px-2.5 py-1.5 transition ${current === k ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800"}`}>{labels[k]}</button>
      ))}
    </div>
  );
}
