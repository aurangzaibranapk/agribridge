import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { computeShiftCash } from "@/lib/pos/shift-cash";
import { PrintShiftSlip } from "./print-button";

export const dynamic = "force-dynamic";

function money(value: number | null | undefined) {
  return `Rs ${Number(value ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function localTime(value: string | null) {
  return value ? new Date(value).toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }) : "—";
}

export default async function ShiftSlipPage({ params }: { params: { shiftId: string } }) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const [{ data: profile }, { data: shift }] = await Promise.all([
    service.from("profiles").select("role, branch_id, is_active").eq("id", user.id).maybeSingle(),
    service.from("pos_shifts").select("id, shift_number, staff_id, counter_id, status, opening_cash, expected_cash, counted_cash, difference, closing_note, opened_at, closed_at, cash_handover_id").eq("id", params.shiftId).maybeSingle(),
  ]);
  if (!profile?.is_active || !shift || shift.status !== "closed") notFound();

  const { data: counter } = await service.from("pos_counters").select("name, shop_id, branch_id").eq("id", shift.counter_id).maybeSingle();
  const allowed = shift.staff_id === user.id || UNRESTRICTED_ROLES.includes(profile.role) || profile.role === "finance" || (profile.role === "manager" && !!counter?.branch_id && counter.branch_id === profile.branch_id);
  if (!allowed) notFound();

  const [{ data: staff }, { data: shop }, { data: handover }, summary] = await Promise.all([
    service.from("profiles").select("full_name").eq("id", shift.staff_id).maybeSingle(),
    counter?.shop_id ? service.from("shops").select("name").eq("id", counter.shop_id).maybeSingle() : Promise.resolve({ data: null }),
    shift.cash_handover_id ? service.from("cash_handovers").select("status").eq("id", shift.cash_handover_id).maybeSingle() : Promise.resolve({ data: null }),
    computeShiftCash(shift.id, Number(shift.opening_cash)),
  ]);
  const counted = Number(shift.counted_cash ?? 0);
  const expected = Number(shift.expected_cash ?? 0);
  const difference = Number(shift.difference ?? counted - expected);
  const rows: [string, string][] = [
    ["Gross sale", money(summary.totalSales)],
    ["Returns", money(summary.returnsTotal)],
    ["Net sale", money(summary.totalSales - summary.returnsTotal)],
    ["Cash sales", money(summary.cashSalesTotal)],
    ["Digital payments", money(summary.digitalTotal)],
    ["Khata", money(summary.khataTotal)],
    ["Bill payments", money(summary.billTotal)],
    ["Mobile load", money(summary.loadTotal)],
    ["Bank Transfer", money(summary.bankTransferTotal)],
    ["Service fees", money(summary.serviceChargeTotal)],
    ["Recovery — sab tareeqe", money(summary.recoveryTotal)],
    ["Cash recovery", money(summary.recoveryCashTotal)],
    ["Cash udhaar diya", money(summary.udhaarGivenCashTotal)],
    ["Opening cash", money(shift.opening_cash)],
    ["Expected cash", money(expected)],
    ["Ginti hui cash — office jama karani hai", money(counted)],
    ["Farq", money(difference)],
  ];
  const handoverStatus = handover?.status === "received" ? "Office/Finance ne tasdeeq kar di" : handover ? "Bheja gaya — receiving tasdeeq baqi" : "Office receiving baqi";

  return (
    <main className="mx-auto max-w-xl p-4 text-surface-900 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href="/admin/pos" className="text-sm font-medium text-brand-700">← POS par wapas</Link>
        <PrintShiftSlip />
      </div>
      <section className="rounded-xl border border-surface-300 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <p className="text-center text-xs font-semibold uppercase tracking-widest">AgriBridge</p>
        <h1 className="mt-1 text-center text-xl font-bold">Daily POS Cash Slip</h1>
        <p className="mt-1 text-center text-xs text-surface-500">Shift band hone par cash ke sath office jama karayein</p>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1 border-y border-surface-300 py-3 text-sm">
          <span>Shift: <strong>{shift.shift_number}</strong></span><span>Staff: <strong>{staff?.full_name ?? "—"}</strong></span>
          <span>Shop: <strong>{shop?.name ?? "—"}</strong></span><span>Counter: <strong>{counter?.name ?? "—"}</strong></span>
          <span>Khuli: <strong>{localTime(shift.opened_at)}</strong></span><span>Band: <strong>{localTime(shift.closed_at)}</strong></span>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between border-b pb-1 text-xs font-semibold uppercase"><span>Detail</span><span>Amount</span></div>
          {rows.map(([label, value]) => <div key={label} className={`flex justify-between gap-4 border-b border-surface-100 py-1 ${label.startsWith("Ginti") ? "font-bold" : ""}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>)}
        </div>
        {summary.accountMovements.length > 0 && <div className="mt-4">
          <h2 className="mb-2 text-sm font-bold">Account mein aaya / gaya — isi shift ka linked record</h2>
          <table className="w-full text-xs"><thead><tr className="border-b"><th className="py-1 text-left">Account</th><th className="text-right">Aaya</th><th className="text-right">Gaya</th><th className="text-right">Net</th></tr></thead>
            <tbody>{summary.accountMovements.map((a) => <tr key={a.accountId} className="border-b border-surface-100"><td className="py-2">{a.name}</td><td className="text-right tabular-nums">{money(a.received)}</td><td className="text-right tabular-nums">{money(a.paid)}</td><td className="text-right tabular-nums">{money(a.net)}</td></tr>)}</tbody>
          </table>
        </div>}
        {shift.closing_note && <p className="mt-3 text-xs">Closing note: {shift.closing_note}</p>}
        <p className="mt-4 rounded border border-surface-300 p-2 text-xs font-semibold">Cash handover: {handoverStatus}</p>
        <p className="mt-2 text-[11px] text-surface-500">Ye shift closing slip hai. Cash ki office receiving alag se tasdeeq hogi.</p>
        <div className="mt-10 grid grid-cols-2 gap-6 text-xs">
          <div className="border-t border-surface-500 pt-2">Staff dastakhat</div>
          <div className="border-t border-surface-500 pt-2">Office receiving: naam, dastakhat, waqt</div>
        </div>
      </section>
    </main>
  );
}
