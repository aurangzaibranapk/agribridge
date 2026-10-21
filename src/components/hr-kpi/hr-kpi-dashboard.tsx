import type { ReactNode } from "react";
import { type HrDashboard, type Kpi, KPI_FORMULAS, EMPLOYMENT_TYPES } from "@/lib/hr-kpi/core";

/**
 * HR KPI Dashboard -- reference tasveer ke mutabiq (malik ki manzoori 21 Oct 2026).
 * Sirf server-render SVG charts: JS ke baghair bhi chalta hai, dark mode Tailwind se.
 * Data na ho to saaf "—" / 0, koi farzi adad nahi.
 */

// Reference tasveer ke rang (malik: "same to same" color grading).
const C = { blue: "#1d6fd8", green: "#22a447", teal: "#14a3a3", amber: "#f5a524", orange: "#f97316", red: "#e5484d", purple: "#8b5cf6", lime: "#65a30d", pink: "#ec4899", sky: "#0ea5e9", navy: "#0b2545" };
const PALETTE = [C.blue, C.green, C.amber, C.purple, C.teal, C.pink, C.orange, C.red];
const card = "rounded-2xl border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900";
const h2 = "mb-3 flex items-center gap-2 font-display text-sm font-semibold text-surface-900 dark:text-white";
const rs = (v: number) => `Rs ${Math.round(v).toLocaleString("en-PK")}`;

function Panel({ title, children, className = "", right }: { title: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`${card} ${className}`}>
      {/* Reference jaisa: har panel ke upar navy patti */}
      <div className="-mx-4 -mt-4 mb-3 flex items-center justify-between gap-2 rounded-t-2xl bg-gradient-to-r from-[#0b2545] to-[#123a6b] px-4 py-2 text-white">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">{title}</h2>
        {right && <span className="text-white [&_*]:!text-white">{right}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="flex min-h-[110px] items-center justify-center rounded-xl border border-dashed border-surface-200 px-3 text-center text-xs text-surface-400 dark:border-surface-700">{text}</p>;
}

function Change({ k, goodWhenDown = false, suffix }: { k: Kpi; goodWhenDown?: boolean; suffix: string }) {
  if (k.change == null) return <span className="text-[11px] text-surface-400">— vs pichla arsa</span>;
  const up = k.change > 0;
  const good = k.change === 0 ? true : goodWhenDown ? !up : up;
  const v = k.unit === "count" ? `${Math.abs(k.change).toFixed(1)}%` : `${Math.abs(k.change).toFixed(1)}${suffix}`;
  return (
    <span className={`text-[11px] font-semibold ${good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {k.change === 0 ? "■" : up ? "▲" : "▼"} {v} <span className="font-normal text-surface-400">vs pichla arsa</span>
    </span>
  );
}

function KpiCard({ label, k, tone, icon, fmt, goodWhenDown, suffix = "" }: { label: string; k: Kpi; tone: string; icon: string; fmt: (v: number) => string; goodWhenDown?: boolean; suffix?: string }) {
  // Reference jaisa: halka rangeen pas-manzar + rangeen kinara + rangeen icon.
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 p-4 shadow-card dark:bg-surface-900" style={{ borderColor: `${tone}66`, background: `linear-gradient(135deg, ${tone}1f, ${tone}0a)` }} data-testid="hr-kpi">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg text-white" style={{ background: tone }} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold" style={{ color: tone }}>{label}</p>
        <p className="text-3xl font-extrabold tabular-nums text-[#0b2545] dark:text-white">{k.value == null ? "—" : fmt(k.value)}</p>
        <Change k={k} goodWhenDown={goodWhenDown} suffix={suffix} />
      </div>
    </div>
  );
}

function Bars({ data, color, height = 150, fmt = (v: number) => String(v) }: { data: { label: string; value: number; color?: string }[]; color?: string; height?: number; fmt?: (v: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 320;
  const bw = (w / data.length) * 0.56;
  return (
    <svg viewBox={`0 0 ${w} ${height + 34}`} className="max-h-[230px] w-full" role="img">
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={0} x2={w} y1={height - g * (height - 16)} y2={height - g * (height - 16)} className="stroke-surface-200 dark:stroke-surface-700" strokeDasharray="3 3" />
      ))}
      {data.map((d, i) => {
        const x = (i + 0.5) * (w / data.length) - bw / 2;
        const h = (d.value / max) * (height - 16);
        return (
          <g key={d.label}>
            <rect x={x} y={height - h} width={bw} height={Math.max(h, d.value ? 2 : 0)} rx={3} fill={d.color ?? color ?? C.blue} />
            <text x={x + bw / 2} y={height - h - 4} textAnchor="middle" fontSize={11} fontWeight={700} className="fill-surface-800 dark:fill-surface-100">{fmt(d.value)}</text>
            <text x={x + bw / 2} y={height + 14} textAnchor="middle" fontSize={9.5} className="fill-surface-500">{d.label.length > 13 ? `${d.label.slice(0, 12)}…` : d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ data, center, sub }: { data: { label: string; value: number }[]; center: string; sub: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = 52;
  const circ = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 140 140" className="h-[140px] w-[140px] shrink-0" role="img">
        <circle cx={70} cy={70} r={r} fill="none" strokeWidth={22} className="stroke-surface-100 dark:stroke-surface-800" />
        {total > 0 &&
          data.map((d, i) => {
            const len = (d.value / total) * circ;
            const el = <circle key={d.label} cx={70} cy={70} r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={22} strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />;
            off += len;
            return el;
          })}
        <text x={70} y={66} textAnchor="middle" fontSize={10} className="fill-surface-500">{sub}</text>
        <text x={70} y={86} textAnchor="middle" fontSize={20} fontWeight={800} className="fill-surface-900 dark:fill-white">{center}</text>
      </svg>
      <ul className="min-w-[140px] flex-1 space-y-1 text-xs">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="truncate text-surface-700 dark:text-surface-200">{d.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{d.value}{total ? <span className="ml-1 font-normal text-surface-400">({Math.round((d.value / total) * 100)}%)</span> : null}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Ring({ pct, label }: { pct: number | null; label: string }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 130 130" className="h-[130px] w-[130px]" role="img">
      <circle cx={65} cy={65} r={r} fill="none" strokeWidth={13} className="stroke-surface-100 dark:stroke-surface-800" />
      {pct != null && <circle cx={65} cy={65} r={r} fill="none" stroke={C.green} strokeWidth={13} strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 65 65)" />}
      <text x={65} y={66} textAnchor="middle" fontSize={22} fontWeight={800} className="fill-surface-900 dark:fill-white">{pct == null ? "—" : `${pct}%`}</text>
      <text x={65} y={84} textAnchor="middle" fontSize={10} className="fill-surface-500">{label}</text>
    </svg>
  );
}

function Gauge({ pct }: { pct: number | null }) {
  const r = 70;
  const half = Math.PI * r;
  return (
    <svg viewBox="0 0 180 105" className="mx-auto w-full max-w-[220px]" role="img">
      <path d="M20 95 A70 70 0 0 1 160 95" fill="none" strokeWidth={16} strokeLinecap="round" className="stroke-surface-100 dark:stroke-surface-800" />
      {pct != null && <path d="M20 95 A70 70 0 0 1 160 95" fill="none" stroke="url(#hrGauge)" strokeWidth={16} strokeLinecap="round" strokeDasharray={`${(pct / 100) * half} ${half}`} />}
      <defs>
        <linearGradient id="hrGauge" x1="0" x2="1">
          <stop offset="0" stopColor={C.blue} />
          <stop offset="1" stopColor={C.green} />
        </linearGradient>
      </defs>
      <text x={90} y={82} textAnchor="middle" fontSize={26} fontWeight={800} className="fill-surface-900 dark:fill-white">{pct == null ? "—" : `${Math.round(pct)}%`}</text>
      <text x={90} y={100} textAnchor="middle" fontSize={10} className="fill-surface-500">Overall Satisfaction</text>
    </svg>
  );
}

function Line({ data }: { data: { label: string; rate: number | null }[] }) {
  const w = 320;
  const h = 140;
  const vals = data.map((d) => d.rate ?? 0);
  const max = Math.max(...vals, 1);
  const pts = data.map((d, i) => ({ x: 20 + (i * (w - 40)) / Math.max(data.length - 1, 1), y: h - 10 - ((d.rate ?? 0) / max) * (h - 30), d }));
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} className="max-h-[230px] w-full" role="img">
      <polyline fill="none" stroke={C.purple} strokeWidth={2.5} points={pts.map((p) => `${p.x},${p.y}`).join(" ")} />
      {pts.map((p) => (
        <g key={p.d.label}>
          <circle cx={p.x} cy={p.y} r={4} fill={C.purple} />
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={10} fontWeight={700} className="fill-surface-800 dark:fill-surface-100">{p.d.rate == null ? "—" : `${p.d.rate}%`}</text>
          <text x={p.x} y={h + 14} textAnchor="middle" fontSize={9.5} className="fill-surface-500">{p.d.label}</text>
        </g>
      ))}
    </svg>
  );
}

function HBar({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs">
        <span className="truncate text-surface-700 dark:text-surface-200">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums">{right}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.min(100, Math.max(value ? 2 : 0, (value / max) * 100)) : 0}%`, background: color }} />
      </div>
    </div>
  );
}

const FUNNEL_COLORS = [C.blue, C.green, "#eab308", C.orange, C.purple];

export interface HrDashboardViewProps {
  d: HrDashboard;
  departments: { key: string; label: string }[];
  branches: { id: string; name: string }[];
  demoLabel?: string;
  basePath?: string;
}

const NAV = [
  { href: "/admin/hr-dashboard", label: "Overview", icon: "▦" },
  { href: "/admin/hr", label: "Employee Details", icon: "👥" },
  { href: "/admin/hr/attendance", label: "Attendance", icon: "🗓" },
  { href: "/admin/hr/performance", label: "Performance", icon: "📈" },
  { href: "/admin/hr/recruitment", label: "Recruitment", icon: "🔍" },
  { href: "/admin/hr/training", label: "Training & Development", icon: "🎓" },
  { href: "/admin/hr/joining-exit", label: "Joining / Attrition", icon: "↪" },
  { href: "/admin/hr/targets", label: "Dept Targets", icon: "🎯" },
  { href: "/admin/my-hr", label: "Pulse Survey", icon: "☺" },
];

export function HrKpiDashboardView({ d, departments, branches, demoLabel, basePath = "/admin/hr-dashboard" }: HrDashboardViewProps) {
  const k = d.kpis;
  const sel = "w-full rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-900";
  const funnelMax = Math.max(d.funnel[0]?.count ?? 0, 1);
  const reasonsMax = Math.max(...d.exitReasons.map((r) => r.pct), 1);
  const female = d.gender.find((g) => g.key === "female")?.count ?? 0;
  const salesMax = Math.max(...d.extras.staffSales.map((s) => s.amount), 1);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-3 rounded-3xl bg-[#eef4fb] p-3 pb-6 dark:bg-[#071a33]" data-testid="hr-kpi-dashboard">
      {demoLabel && <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-2 text-center text-sm font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">{demoLabel}</div>}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#071a33] via-[#0b2545] to-[#123a6b] px-5 py-4 text-white shadow-card">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">HR KPI <span className="text-[#4ade80]">DASHBOARD</span></h1>
          <p className="text-sm text-slate-200">People &nbsp;|&nbsp; Performance &nbsp;|&nbsp; Progress</p>
        </div>
        <p className="text-right font-display text-base italic text-[#86efac]">Khush staff,<br />kamyab karobar</p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden rounded-2xl bg-[#0b2545] p-3 text-sm text-slate-100 lg:block" aria-label="HR">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-[#123a6b] ${n.href === basePath ? "bg-[#22a447] font-semibold" : ""}`}>
                  <span aria-hidden>{n.icon}</span>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 px-2 font-display text-lg italic text-[#86efac]">Achha HR, achhi team!</p>
          <ul className="mt-3 space-y-1 px-2 text-xs text-[#86efac]">
            {["Attract", "Develop", "Engage", "Retain"].map((x) => <li key={x}>✔ {x}</li>)}
          </ul>
        </nav>

        <div className="min-w-0 space-y-3">
          <nav className="flex gap-1.5 overflow-x-auto lg:hidden" aria-label="HR">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${n.href === basePath ? "bg-brand-700 text-white" : "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-200"}`}>{n.label}</a>
            ))}
          </nav>

          <form method="get" action={basePath} className="grid grid-cols-2 gap-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]" data-testid="hr-filters">
            <div className={`${card} col-span-2 !p-2.5 md:col-span-1`}>
              <p className="mb-1 text-[11px] font-bold text-surface-600 dark:text-surface-300">Date Range</p>
              <div className="flex items-center gap-1">
                <input type="date" name="from" defaultValue={d.filters.from} className={sel} aria-label="Se" />
                <span className="text-xs text-surface-400">to</span>
                <input type="date" name="to" defaultValue={d.filters.to} className={sel} aria-label="Tak" />
              </div>
            </div>
            <label className={`${card} !p-2.5`}>
              <span className="mb-1 block text-[11px] font-bold text-surface-600 dark:text-surface-300">Department</span>
              <select name="dept" defaultValue={d.filters.department ?? ""} className={sel}>
                <option value="">All</option>
                {departments.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
            </label>
            <label className={`${card} !p-2.5`}>
              <span className="mb-1 block text-[11px] font-bold text-surface-600 dark:text-surface-300">Location / Branch</span>
              <select name="branch" defaultValue={d.filters.branchId ?? ""} className={sel}>
                <option value="">All</option>
                {branches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label className={`${card} !p-2.5`}>
              <span className="mb-1 block text-[11px] font-bold text-surface-600 dark:text-surface-300">Employment Type</span>
              <select name="etype" defaultValue={d.filters.employmentType ?? ""} className={sel}>
                <option value="">All</option>
                {EMPLOYMENT_TYPES.map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}
              </select>
            </label>
            <div className="col-span-2 flex items-stretch gap-2 md:col-span-1">
              <button type="submit" className="rounded-xl bg-[#1d6fd8] px-3 text-xs font-bold text-white hover:bg-[#1859b0]">Lagao</button>
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-[#0b2545] px-3 py-2 text-white">
                <span aria-hidden className="text-xl">👤</span>
                <div><p className="text-[10px] text-slate-300">Total Employees</p><p className="text-xl font-extrabold tabular-nums">{d.employeeCount}</p></div>
              </div>
            </div>
          </form>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="Total Employees" k={k.total} tone={C.green} icon="👥" fmt={(v) => String(v)} />
            <KpiCard label="New Hires" k={k.newHires} tone={C.blue} icon="＋" fmt={(v) => String(v)} />
            <KpiCard label="Attrition Rate" k={k.attrition} tone={C.purple} icon="↪" fmt={(v) => `${v}%`} goodWhenDown suffix=" pts" />
            <KpiCard label="Avg. Time to Hire" k={k.timeToHire} tone={C.orange} icon="⏱" fmt={(v) => `${v} Days`} goodWhenDown suffix=" din" />
            <KpiCard label="Employee Engagement" k={k.engagement} tone={C.teal} icon="☺" fmt={(v) => `${v}%`} suffix=" pts" />
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
            <Panel title="Headcount Trend">
              {d.headcountTrend.some((x) => x.count) ? <Bars data={d.headcountTrend.map((x) => ({ label: x.label, value: x.count }))} /> : <Empty text="Abhi koi mulazim nahi -- HR file mein staff aur joining date darj karein." />}
            </Panel>
            <Panel title="Department-wise Employees">
              {d.departments.length ? <Donut data={d.departments.map((x) => ({ label: x.label, value: x.count }))} center={String(d.employeeCount)} sub="Total" /> : <Empty text="Koi mulazim nahi." />}
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="Attendance Rate">
              {d.attendance.present + d.attendance.absent ? (
                <div className="flex flex-wrap items-center gap-4">
                  <Ring pct={d.attendance.rate} label="Present" />
                  <div className="space-y-2 text-xs">
                    <div className="rounded-xl bg-surface-50 p-2.5 dark:bg-surface-800">
                      <p className="text-surface-500">Absent</p>
                      <p className="text-xl font-bold tabular-nums">{d.attendance.absentRate ?? 0}%</p>
                      <Change k={{ value: d.attendance.absentRate, prev: d.attendance.prevAbsent, change: d.attendance.prevAbsent == null || d.attendance.absentRate == null ? null : d.attendance.absentRate - d.attendance.prevAbsent, unit: "pct" }} goodWhenDown suffix=" pts" />
                    </div>
                    <p className="text-surface-500">Present {d.attendance.present} · Absent {d.attendance.absent} · Late {d.attendance.late}</p>
                    <Change k={{ value: d.attendance.rate, prev: d.attendance.prevRate, change: d.attendance.prevRate == null || d.attendance.rate == null ? null : d.attendance.rate - d.attendance.prevRate, unit: "pct" }} suffix=" pts" />
                  </div>
                </div>
              ) : (
                <Empty text="Is arse mein hazri ki koi entry nahi." />
              )}
            </Panel>
            <Panel title="Performance Rating">
              {d.ratings.some((r) => r.count) ? (
                <Bars data={d.ratings.map((r, i) => ({ label: r.label, value: r.count, color: [C.green, C.blue, C.amber, C.purple, C.red][i] }))} height={130} />
              ) : (
                <Empty text="Koi manzoor shuda review nahi -- HR → Performance se review darj karein." />
              )}
            </Panel>
            <Panel title="Gender Diversity">
              {d.employeeCount ? <Donut data={d.gender.filter((g) => g.count || g.key !== "none").map((g) => ({ label: g.label, value: g.count }))} center={String(d.employeeCount)} sub={`Female ${d.employeeCount ? Math.round((female / d.employeeCount) * 100) : 0}%`} /> : <Empty text="Koi mulazim nahi." />}
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="Recruitment Funnel">
              {d.funnel[0]?.count ? (
                <div className="space-y-1.5" data-testid="hr-funnel">
                  {d.funnel.map((s, i) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <div className="flex w-[55%] justify-center">
                        <div className="h-7 rounded" style={{ width: `${Math.max(18, (s.count / funnelMax) * 100)}%`, background: FUNNEL_COLORS[i], clipPath: "polygon(0 0,100% 0,92% 100%,8% 100%)" }} />
                      </div>
                      <span className="flex-1 text-xs text-surface-700 dark:text-surface-200">{s.label}</span>
                      <span className="text-xs font-bold tabular-nums">{s.count} <span className="font-normal text-surface-400">({s.pct}%)</span></span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="Is arse mein koi application nahi -- HR → Recruitment se candidate darj karein." />
              )}
            </Panel>
            <Panel title="Training & Development" right={<span className="text-[10px] text-surface-400">ghante</span>}>
              {d.training.some((t) => t.sessions) ? <Bars data={d.training.map((t, i) => ({ label: t.label, value: t.hours, color: [C.blue, C.green, C.amber, C.purple][i] }))} height={130} /> : <Empty text="Koi training darj nahi -- HR → Training se darj karein." />}
            </Panel>
            <Panel title="Employee Satisfaction">
              <Gauge pct={d.satisfaction.pct} />
              <p className="text-center text-xs">
                {d.satisfaction.pct == null ? (
                  <span className="text-surface-400">Kam se kam 3 staff ka mahana pulse chahiye</span>
                ) : (
                  <>
                    <Change k={{ value: d.satisfaction.pct, prev: d.satisfaction.prev, change: d.satisfaction.prev == null ? null : d.satisfaction.pct - d.satisfaction.prev, unit: "pct" }} suffix=" pts" />
                    <span className="ml-1 text-surface-400">· {d.satisfaction.responses} jawab</span>
                  </>
                )}
              </p>
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="Attrition Rate Trend">
              {d.attritionTrend.some((x) => x.rate != null) ? <Line data={d.attritionTrend} /> : <Empty text="Headcount nahi -- trend nahi ban sakta." />}
            </Panel>
            <Panel title="Top Reasons for Leaving">
              {d.exitReasons.length ? (
                <div className="space-y-2.5">{d.exitReasons.map((r, i) => <HBar key={r.key} label={r.label} value={r.pct} max={reasonsMax} color={PALETTE[i % PALETTE.length]} right={`${r.pct}%`} />)}</div>
              ) : (
                <Empty text="Is arse mein kisi ne nahi chhora." />
              )}
            </Panel>
            <Panel title="Employee Performance vs. Target" right={<span className="flex gap-2 text-[10px]"><span style={{ color: C.green }}>■ Actual</span><span style={{ color: C.blue }}>■ Target</span></span>}>
              {d.perfVsTarget.length ? (
                <div className="space-y-3">
                  {d.perfVsTarget.map((p) => (
                    <div key={p.key}>
                      <p className="mb-1 text-xs font-semibold">{p.label}</p>
                      <HBar label="Actual" value={p.actual} max={Math.max(p.target, p.actual)} color={C.green} right={`${p.pct}%`} />
                      <div className="mt-1"><HBar label="Target" value={p.target} max={Math.max(p.target, p.actual)} color={C.blue} right={rs(p.target)} /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="Koi manzoor shuda target nahi -- HR → Dept Targets se darj karein." />
              )}
            </Panel>
          </div>

          <h2 className="pt-2 font-display text-base font-bold text-surface-900 dark:text-white">AgriBridge: staff ka kaam aur paisa</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="Staff ki bikri (POS)">
              {d.extras.staffSales.length ? (
                <div className="space-y-2">{d.extras.staffSales.map((s) => <HBar key={s.name} label={`${s.name} · ${s.bills} bills`} value={s.amount} max={salesMax} color={C.blue} right={rs(s.amount)} />)}</div>
              ) : (
                <Empty text="Is arse mein POS bikri nahi." />
              )}
            </Panel>
            <Panel title="Shift closing aur cash farq">
              <table className="w-full text-xs">
                <tbody>
                  <tr><td className="py-1">Band shiftain</td><td className="text-right font-bold">{d.extras.shifts.closed}</td></tr>
                  <tr><td className="py-1">Khuli shiftain</td><td className="text-right font-bold">{d.extras.shifts.open}</td></tr>
                  <tr><td className="py-1">Cash kam nikla</td><td className="text-right font-bold">{d.extras.shifts.short} dafa</td></tr>
                  {d.extras.shifts.byStaff.slice(0, 4).map((s) => (
                    <tr key={s.name} className="border-t border-surface-100 dark:border-surface-800">
                      <td className="py-1">{s.name} ({s.shifts})</td>
                      <td className={`text-right font-bold tabular-nums ${s.diff < 0 ? "text-red-600" : ""}`}>{rs(s.diff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
            <Panel title="Tankhwah: wajib vs diya">
              {d.extras.salary.runs ? (
                <div className="space-y-2">
                  <HBar label="Wajib (manzoor payroll)" value={d.extras.salary.due} max={d.extras.salary.due} color={C.blue} right={rs(d.extras.salary.due)} />
                  <HBar label="Diya" value={d.extras.salary.paid} max={d.extras.salary.due} color={C.green} right={rs(d.extras.salary.paid)} />
                  <HBar label="Baqi" value={d.extras.salary.pending} max={d.extras.salary.due} color={C.red} right={rs(d.extras.salary.pending)} />
                </div>
              ) : (
                <Empty text="Is arse ka payroll run nahi bana." />
              )}
            </Panel>
            <Panel title="Advance / Qist">
              <table className="w-full text-xs">
                <tbody>
                  <tr><td className="py-1">Khule qist plan</td><td className="text-right font-bold">{d.extras.qist.plans}</td></tr>
                  <tr><td className="py-1">Baqi raqam</td><td className="text-right font-bold tabular-nums">{rs(d.extras.qist.outstanding)}</td></tr>
                  <tr><td className="py-1">Late qistain</td><td className={`text-right font-bold ${d.extras.qist.overdue ? "text-red-600" : ""}`}>{d.extras.qist.overdue}</td></tr>
                  <tr><td className="py-1">Advance manzoori/adaigi baqi</td><td className="text-right font-bold">{d.extras.qist.advancesPending}</td></tr>
                </tbody>
              </table>
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
            <Panel title="Key HR KPI Formulas">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#0b2545] text-left text-white"><th className="px-2 py-1.5">KPI</th><th className="px-2 py-1.5">Formula</th><th className="px-2 py-1.5">Tafseel</th></tr></thead>
                  <tbody>
                    {KPI_FORMULAS.map((f) => (
                      <tr key={f.kpi} className="border-t border-surface-100 dark:border-surface-800"><td className="px-2 py-1.5 font-semibold">{f.kpi}</td><td className="px-2 py-1.5 font-mono text-[11px]">{f.formula}</td><td className="px-2 py-1.5 text-surface-500">{f.desc}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <section className={`${card} border-[#c4b5fd] bg-[#f3efff] dark:border-purple-900 dark:bg-purple-950/30`}>
              <h2 className="mb-3 -mx-4 -mt-4 rounded-t-2xl bg-gradient-to-r from-[#6d28d9] to-[#8b5cf6] px-4 py-2 font-display text-sm font-semibold text-white">💡 Insights & Next Steps</h2>
              {d.insights.length ? (
                <ul className="space-y-1.5 text-xs" data-testid="hr-insights">{d.insights.map((x) => <li key={x} className="flex gap-2"><span className="text-emerald-600">✔</span>{x}</li>)}</ul>
              ) : (
                <p className="text-xs text-surface-500">Sab theek -- koi khaas baat nahi.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
