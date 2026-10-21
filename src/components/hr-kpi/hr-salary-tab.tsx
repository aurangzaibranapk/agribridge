import type { ReactNode } from "react";
import type { Kpi } from "@/lib/hr-kpi/core";
import { type SalaryDashboard, type SalFilters, SALARY_FORMULAS } from "@/lib/hr-kpi/salary";

/** Tankhwah (Salary Analysis) tab -- doosri reference tasveer ke mutabiq. Sirf server SVG. */
const card = "rounded-2xl border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900";
const rs = (v: number) => `Rs ${Math.round(v).toLocaleString("en-PK")}`;
const rsK = (v: number) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(Math.round(v)));
// Reference ke rang: blue / green / orange / purple / teal.
const PAL = ["#1d6fd8", "#22a447", "#f97316", "#8b5cf6", "#14a3a3", "#ec4899", "#f5a524"];
const STATUS_LABEL = { active: "Active", on_leave: "On Leave", terminated: "Terminated" } as const;

function Box({ title, children, className = "", green }: { title: string; children: ReactNode; className?: string; green?: boolean }) {
  return (
    <section className={`${card} ${className}`}>
      <h2 className={`mb-3 -mx-4 -mt-4 rounded-t-2xl bg-gradient-to-r ${green ? "from-[#15803d] to-[#22a447]" : "from-[#0b3d91] to-[#1d6fd8]"} px-4 py-1.5 font-display text-sm font-semibold text-white`}>{title}</h2>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-surface-200 px-3 text-center text-xs text-surface-400 dark:border-surface-700">{text}</p>;
}
function Card({ label, k, fmt, color, icon, goodDown }: { label: string; k: Kpi; fmt: (v: number) => string; color: string; icon: string; goodDown?: boolean }) {
  const ch = k.change;
  const good = ch == null || ch === 0 ? true : goodDown ? ch < 0 : ch > 0;
  return (
    <div className="rounded-2xl border-2 p-4 text-center shadow-card dark:bg-surface-900" style={{ borderColor: `${color}80`, background: `linear-gradient(180deg, ${color}24, ${color}08)` }} data-testid="sal-kpi">
      <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full text-xl" style={{ background: `${color}2e`, color }} aria-hidden>{icon}</div>
      <p className="text-xs font-bold" style={{ color }}>{label}</p>
      <p className="my-1 text-3xl font-extrabold tabular-nums text-[#0b2545] dark:text-white">{k.value == null ? "—" : fmt(k.value)}</p>
      <p className={`text-[11px] font-semibold ${ch == null ? "text-surface-400" : good ? "text-emerald-600" : "text-red-600"}`}>
        {ch == null ? "—" : `${ch > 0 ? "▲" : ch < 0 ? "▼" : "■"} ${Math.abs(ch).toFixed(1)}${k.unit === "count" ? "%" : " pts"}`}
        <span className="block font-normal text-surface-400">vs pichla mahina</span>
      </p>
    </div>
  );
}

function TrendChart({ t }: { t: SalaryDashboard["trend"] }) {
  const w = 340, h = 170;
  const maxC = Math.max(...t.map((x) => x.cost ?? 0), 1);
  const maxH = Math.max(...t.map((x) => x.headcount), 1);
  const step = (w - 40) / t.length;
  const pts = t.map((x, i) => `${30 + i * step + step / 2},${h - 10 - (x.headcount / maxH) * (h - 40)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} className="max-h-[230px] w-full" role="img">
      {t.map((x, i) => {
        const bh = ((x.cost ?? 0) / maxC) * (h - 40);
        const cx = 30 + i * step + step / 2;
        return (
          <g key={x.month}>
            <rect x={cx - step * 0.3} y={h - 10 - bh} width={step * 0.6} height={bh} rx={3} fill="#1d6fd8" />
            <text x={cx} y={h - 14 - bh} textAnchor="middle" fontSize={9.5} fontWeight={700} className="fill-surface-700 dark:fill-surface-200">{x.cost == null ? "—" : rsK(x.cost)}</text>
            <text x={cx} y={h + 6} textAnchor="middle" fontSize={10} className="fill-surface-500">{x.label}</text>
          </g>
        );
      })}
      <polyline fill="none" stroke="#f97316" strokeWidth={2.5} points={pts} />
      {t.map((x, i) => <circle key={x.month} cx={30 + i * step + step / 2} cy={h - 10 - (x.headcount / maxH) * (h - 40)} r={3.5} fill="#f97316" />)}
      <g fontSize={10}><rect x={30} y={h + 14} width={10} height={8} fill="#1d6fd8" /><text x={44} y={h + 22} className="fill-surface-600 dark:fill-surface-300">Payroll Cost (Rs)</text><circle cx={160} cy={h + 18} r={4} fill="#f97316" /><text x={168} y={h + 22} className="fill-surface-600 dark:fill-surface-300">Headcount</text></g>
    </svg>
  );
}

function VBars({ data }: { data: { label: string; value: number }[] }) {
  const w = 320, h = 150;
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} className="max-h-[230px] w-full" role="img">
      {data.map((d, i) => {
        const bh = (d.value / max) * (h - 24);
        const x = i * step + step * 0.2;
        return (
          <g key={d.label}>
            <rect x={x} y={h - bh} width={step * 0.6} height={Math.max(bh, d.value ? 2 : 0)} rx={3} fill={PAL[i % PAL.length]} />
            <text x={x + step * 0.3} y={h - bh - 4} textAnchor="middle" fontSize={10} fontWeight={700} className="fill-surface-800 dark:fill-surface-100">{rsK(d.value)}</text>
            <text x={x + step * 0.3} y={h + 14} textAnchor="middle" fontSize={9.5} className="fill-surface-500">{d.label.length > 11 ? `${d.label.slice(0, 10)}…` : d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Donut({ data, total }: { data: { label: string; count: number }[]; total: number }) {
  const r = 50, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <svg viewBox="0 0 130 130" className="h-[130px] w-[130px]" role="img">
        <circle cx={65} cy={65} r={r} fill="none" strokeWidth={22} className="stroke-surface-100 dark:stroke-surface-800" />
        {data.map((d, i) => {
          const len = total ? (d.count / total) * c : 0;
          const el = <circle key={d.label} cx={65} cy={65} r={r} fill="none" stroke={PAL[i % PAL.length]} strokeWidth={22} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform="rotate(-90 65 65)" />;
          off += len;
          return el;
        })}
        <text x={65} y={62} textAnchor="middle" fontSize={10} className="fill-surface-500">Total</text>
        <text x={65} y={80} textAnchor="middle" fontSize={20} fontWeight={800} className="fill-surface-900 dark:fill-white">{total}</text>
      </svg>
      <ul className="flex-1 space-y-1 text-xs">
        {data.map((d, i) => <li key={d.label} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: PAL[i % PAL.length] }} />{d.label}<span className="ml-auto font-semibold">{total ? Math.round((d.count / total) * 100) : 0}%</span></li>)}
      </ul>
    </div>
  );
}

function Scatter({ pts, r2 }: { pts: SalaryDashboard["scatter"]; r2: number | null }) {
  const w = 320, h = 170;
  const maxS = Math.max(...pts.map((p) => p.salary), 1);
  const X = (r: number) => 30 + ((r - 1) / 4) * (w - 50);
  const Y = (s: number) => h - 10 - (s / maxS) * (h - 30);
  return (
    <svg viewBox={`0 0 ${w} ${h + 26}`} className="max-h-[230px] w-full" role="img">
      <line x1={30} y1={h - 10} x2={w - 20} y2={h - 10} className="stroke-surface-300 dark:stroke-surface-600" />
      <line x1={30} y1={10} x2={30} y2={h - 10} className="stroke-surface-300 dark:stroke-surface-600" />
      {pts.map((p, i) => <circle key={`${p.name}${i}`} cx={X(p.rating) + ((i % 5) - 2) * 3} cy={Y(p.salary)} r={4.5} fill="#1d6fd8" opacity={0.85}><title>{`${p.name}: ${p.rating} / ${rs(p.salary)}`}</title></circle>)}
      {[1, 2, 3, 4, 5].map((r) => <text key={r} x={X(r)} y={h + 4} textAnchor="middle" fontSize={10} className="fill-surface-500">{r}</text>)}
      <text x={w / 2} y={h + 20} textAnchor="middle" fontSize={10} className="fill-surface-500">Performance Rating (1 Poor – 5 Excellent)</text>
      {r2 != null && <text x={w - 24} y={22} textAnchor="end" fontSize={11} fontWeight={700} className="fill-surface-700 dark:fill-surface-200">R² = {r2}</text>}
    </svg>
  );
}

function Slicer({ title, name, options, current }: { title: string; name: string; options: { v: string; l: string }[]; current: string | null }) {
  return (
    <fieldset className="rounded-xl border border-surface-200 p-2 dark:border-surface-700">
      <legend className="px-1 text-xs font-bold text-surface-700 dark:text-surface-200">{title}</legend>
      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
        {[{ v: "", l: "All" }, ...options].map((o) => (
          <button key={o.v || "all"} name={name} value={o.v} className={`rounded-md px-2 py-1 text-left text-xs ${(current ?? "") === o.v ? "bg-[#1d6fd8] font-semibold text-white" : "bg-[#eef4ff] text-surface-700 hover:bg-[#dbeafe] dark:bg-surface-800 dark:text-surface-200"}`}>{o.l}</button>
        ))}
      </div>
    </fieldset>
  );
}

export function HrSalaryTab({ s, f, basePath, keep }: { s: SalaryDashboard; f: SalFilters; basePath: string; keep: Record<string, string> }) {
  const k = s.kpis;
  const totalHead = s.headDept.reduce((a, d) => a + d.count, 0);
  const hidden = (except: string) => Object.entries({ ...keep, s_dept: f.dept ?? "", s_status: f.status ?? "", s_desig: f.desig ?? "", s_year: f.year ?? "" }).filter(([n, v]) => n !== except && v).map(([n, v]) => <input key={n} type="hidden" name={n} value={v} />);
  return (
    <div className="space-y-3 rounded-3xl bg-[#eef4fb] p-3 dark:bg-[#071a33]" data-testid="hr-salary-tab">
      <header className="rounded-2xl bg-gradient-to-r from-[#071a33] via-[#0b2545] to-[#123a6b] px-5 py-4 text-center text-white">
        <h2 className="font-display text-3xl font-extrabold">Salary Smart Analysis</h2>
        <p className="font-display text-2xl font-extrabold text-[#facc15]">KPI Vision Dashboard</p>
        <p className="text-sm text-slate-200">Behtar tankhwah | Behtar log | Mazboot karobar</p>
      </header>
      <p className="text-xs text-surface-500">🔒 Tankhwah ka data sirf Owner / HR / Admin ko. Due date: har mahine ki tankhwah agle mahine ki {s.dueDay} tareekh tak.{s.missingSalary ? ` ${s.missingSalary} active staff ki tankhwah darj nahi.` : ""}</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card label="Total Employees" k={k.employees} fmt={(v) => String(v)} color="#1d6fd8" icon="👥" />
        <Card label="Total Payroll Cost" k={k.payroll} fmt={rs} color="#22a447" icon="💵" goodDown />
        <Card label="Average Salary" k={k.avgSalary} fmt={rs} color="#8b5cf6" icon="💰" />
        <Card label="On-Time Payment %" k={k.onTime} fmt={(v) => `${v}%`} color="#f97316" icon="⏰" />
        <Card label="New Hires" k={k.newHires} fmt={(v) => String(v)} color="#14a3a3" icon="🧑‍💼" />
        <Card label="Attrition Rate" k={k.attrition} fmt={(v) => `${v}%`} color="#e5484d" icon="📉" goodDown />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Box title="Payroll Cost Trend">{s.trend.some((x) => x.cost != null) || s.trend.some((x) => x.headcount) ? <TrendChart t={s.trend} /> : <Empty text="Abhi koi payroll run ya tankhwah nahi." />}</Box>
        <Box title="Salary by Department">{s.byDept.length ? <VBars data={s.byDept.map((d) => ({ label: d.label, value: d.avg }))} /> : <Empty text="Kisi ki tankhwah darj nahi -- HR → Tankhwah ka Dhancha." />}</Box>
        <Box title="Headcount by Department">{totalHead ? <Donut data={s.headDept} total={totalHead} /> : <Empty text="Koi active mulazim nahi." />}</Box>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Box title="Employee Data">
          {s.table.length ? (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-xs" data-testid="sal-table">
                <thead className="sticky top-0 bg-[#dbeafe] text-left text-[#0b2545] dark:bg-[#0b2545] dark:text-slate-100"><tr><th className="p-1.5">Employee ID</th><th>Naam</th><th>Department</th><th>Designation</th><th className="text-right">Monthly Salary</th><th className="pl-2">Join Date</th><th>Status</th></tr></thead>
                <tbody>
                  {s.table.map((r) => (
                    <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800">
                      <td className="p-1.5 font-mono">{r.code}</td><td>{r.name}</td><td>{r.dept}</td><td>{r.desig}</td>
                      <td className="text-right tabular-nums">{r.salary == null ? "—" : rs(r.salary)}</td><td className="pl-2">{r.join ?? "—"}</td>
                      <td><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : r.status === "on_leave" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{STATUS_LABEL[r.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty text="Is filter mein koi mulazim nahi." />}
        </Box>
        <Box title="Slicers">
          <div className="grid grid-cols-2 gap-2">
            <form method="get" action={basePath}>{hidden("s_dept")}<Slicer title="Department" name="s_dept" current={f.dept} options={s.slicers.depts.map((d) => ({ v: d.key, l: d.label }))} /></form>
            <form method="get" action={basePath}>{hidden("s_status")}<Slicer title="Status" name="s_status" current={f.status} options={[{ v: "active", l: "Active" }, { v: "on_leave", l: "On Leave" }, { v: "terminated", l: "Terminated" }]} /></form>
            <form method="get" action={basePath}>{hidden("s_desig")}<Slicer title="Designation" name="s_desig" current={f.desig} options={s.slicers.desigs.map((d) => ({ v: d, l: d }))} /></form>
            <form method="get" action={basePath}>{hidden("s_year")}<Slicer title="Join Date (Year)" name="s_year" current={f.year} options={s.slicers.years.map((y) => ({ v: y, l: y }))} /></form>
          </div>
        </Box>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Box title="Salary Distribution">{s.histogram.some((b) => b.count) ? <VBarsCount data={s.histogram} /> : <Empty text="Tankhwah darj nahi." />}</Box>
        <Box title="Performance Rating vs. Salary">{s.scatter.length ? <Scatter pts={s.scatter} r2={s.r2} /> : <Empty text="Manzoor shuda review aur tankhwah dono chahiye." />}</Box>
      </div>

      <Box title="Key KPI Formulas" green>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-surface-500"><th className="p-1.5">KPI</th><th>Formula</th><th>Tafseel</th></tr></thead>
            <tbody>{SALARY_FORMULAS.map((x) => <tr key={x.kpi} className="border-t border-surface-100 dark:border-surface-800"><td className="p-1.5 font-semibold">{x.kpi}</td><td className="font-mono text-[11px]">{x.formula}</td><td className="text-surface-500">{x.desc}</td></tr>)}</tbody>
          </table>
        </div>
      </Box>
    </div>
  );
}

function VBarsCount({ data }: { data: { label: string; count: number }[] }) {
  const w = 340, h = 150;
  const max = Math.max(...data.map((d) => d.count), 1);
  const step = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 34}`} className="max-h-[230px] w-full" role="img">
      {data.map((d, i) => {
        const bh = (d.count / max) * (h - 24);
        return (
          <g key={d.label}>
            <rect x={i * step + 6} y={h - bh} width={step - 12} height={bh} rx={2} fill="#1d6fd8" />
            <text x={i * step + step / 2} y={h - bh - 4} textAnchor="middle" fontSize={11} fontWeight={700} className="fill-surface-800 dark:fill-surface-100">{d.count}</text>
            <text x={i * step + step / 2} y={h + 14} textAnchor="middle" fontSize={9.5} className="fill-surface-500">{d.label}</text>
          </g>
        );
      })}
      <text x={w / 2} y={h + 30} textAnchor="middle" fontSize={10} className="fill-surface-500">Salary Range (Rs)</text>
    </svg>
  );
}
