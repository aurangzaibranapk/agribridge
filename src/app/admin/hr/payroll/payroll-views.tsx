"use client";

import Link from "next/link";
import { chargeableAbsentDays } from "@/lib/payroll/compute";
import { labourLabel, payrollTransactions, type PayAdjustment, type PayAdvance } from "@/lib/payroll/desk";
import { CARD, Pill, TD, TH, pkr, rs } from "@/components/payroll/ui";
import { SO_BTN, SO_BTN2 } from "@/components/payroll/salary-ui";

export function PayrollSwitch({ year, month, branch, view }: { year: number; month: number; branch: string | null; view: string }) {
  const href = (next: string) => {
    const q = new URLSearchParams();
    q.set("m", `${year}-${String(month).padStart(2, "0")}`);
    if (branch) q.set("branch", branch);
    q.set("view", next);
    return `/admin/hr/payroll?${q}`;
  };
  const tab = (id: string, label: string, ur: string) => (
    <Link
      href={href(id)}
      data-testid={`payroll-view-${id}`}
      className={`rounded-xl px-3 py-2 text-sm ${view === id ? "bg-[#0f6e4f] font-semibold text-white" : "border border-slate-200 dark:border-white/10"}`}
    >
      {label} <span className="text-[11px] opacity-70">{ur}</span>
    </Link>
  );
  return (
    <div className="flex flex-wrap gap-2" data-testid="payroll-views">
      {tab("cards", "Cards", "کارڈز")}
      {tab("people", "Log", "لوگ")}
      {tab("tx", "Harkatein", "لین دین")}
    </div>
  );
}

export function PayrollCards({ lines, status }: { lines: any[]; status: string }) {
  if (lines.length === 0) {
    return <p className="text-sm text-slate-500">Abhi hisaab nahi chala. Sirf manzoor shuda salary structure wale staff run mein aate hain.</p>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {lines.map((l) => {
        const tone = labourLabel({ runStatus: status, attendanceFinalized: !!l.attendance_finalized, openItems: Number(l.open_items ?? 0) });
        return (
          <article key={l.id} data-testid="payroll-person-card" className={CARD}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{l.name}</h3>
                <p className="text-xs text-slate-500">{l.designation || "—"}</p>
              </div>
              <Pill tone={tone.tone}>{tone.label}</Pill>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums">{rs(l.net)}</p>
            <p className="mt-1 text-xs text-slate-500">
              Hazir {l.present_days} · Ghair-hazir {chargeableAbsentDays(l)} · Qist {+l.advance_deduction ? `− ${pkr(l.advance_deduction)}` : "—"}
            </p>
            {status === "draft" && <p className="mt-2 text-[11px] text-slate-500">Raqam badalne ke liye Log kholen.</p>}
            {(status === "approved" || status === "paid") && (
              <div className="mt-3 flex gap-2">
                <Link className={SO_BTN} href={`/admin/hr/payslip/${l.id}`}>Salary slip</Link>
                <a className={SO_BTN2} href={`/api/hr/payslip/${l.id}/pdf`}>PDF</a>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function PayrollTx({
  year,
  month,
  runStatus,
  payable,
  runRead,
  advances,
  adjustments,
}: {
  year: number;
  month: number;
  runStatus: string | null;
  payable: number | null;
  runRead: boolean;
  advances: PayAdvance[] | null;
  adjustments: PayAdjustment[] | null;
}) {
  const tx = payrollTransactions({ year, month, runStatus, payable, runRead, advances, adjustments });
  return (
    <div className={CARD}>
      <h3 className="mb-2 font-semibold">Harkatein</h3>
      <p className="mb-3 text-xs text-slate-500">Advance ki adaigi aur payroll ka journal. Tankhwah ka formula nahi badla — qist pehle se line mein katti hai.</p>
      {tx.advancesUnread && <p className="mb-2 text-sm text-amber-700">Advance parhe nahi gaye. Sifar mat samjhein.</p>}
      {tx.adjustmentsUnread && <p className="mb-2 text-sm text-amber-700">Badlao ka record parha nahi gaya.</p>}
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={TH}>Kaun / kya</th>
            <th className={TH}>Qism</th>
            <th className={TH}>Tareekh</th>
            <th className={TH}>Halat</th>
            <th className={`${TH} text-right`}>Raqam</th>
          </tr>
        </thead>
        <tbody>
          {tx.rows.map((row) => (
            <tr key={row.id} data-testid="payroll-tx-row">
              <td className={TD}><Link href={row.href} className="font-semibold hover:underline">{row.title}</Link></td>
              <td className={TD}>{row.kind}</td>
              <td className={TD}>{row.when ?? "—"}</td>
              <td className={TD}>{row.status}</td>
              <td className={`${TD} text-right tabular-nums ${row.amount != null && row.amount < 0 ? "text-red-600" : ""}`}>
                {row.amount == null ? "—" : row.amount < 0 ? `− ${pkr(Math.abs(row.amount))}` : pkr(row.amount)}
              </td>
            </tr>
          ))}
          {tx.rows.length === 0 && (
            <tr><td className={TD} colSpan={5}>Is mahine koi harkat nahi — na ada shuda advance, na manzoor payroll.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
