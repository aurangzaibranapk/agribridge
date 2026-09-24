"use client";
// Server Component nahi -- print button ko onClick chahiye
// Magar data server se chahiye, is liye hybrid approach nahi,
// seedha client par fetch karte hain Supabase browser client se.
// RLS ensure karta hai ke banda sirf apni parchi dekhe.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Printer, ArrowLeft } from "lucide-react";

interface SlipData {
  id: string;
  pay_month: number;
  pay_year: number;
  basic_salary: number;
  bonus: number;
  deductions: number;
  advance_deduction: number;
  net_salary: number;
  status: string;
  paid_date: string | null;
  notes: string | null;
  // joined
  full_name: string;
  role: string;
  designation: string | null;
  employee_code: string | null;
  branch_name: string | null;
}

const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function SalarySlipPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [slip, setSlip] = useState<SlipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Salary payment — RLS ke zariye sirf apni
      const { data: sp, error } = await supabase
        .from("salary_payments")
        .select("id, pay_month, pay_year, basic_salary, bonus, deductions, advance_deduction, net_salary, status, paid_date, notes")
        .eq("id", id)
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error || !sp) { setErr("Parchi nahi mili — ya aap ko is parchi ki ijazat nahi."); setLoading(false); return; }

      // Staff ki details
      const { data: pr } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
      const { data: sd } = await supabase.from("staff_details").select("designation, employee_code, branch_id").eq("profile_id", user.id).maybeSingle();
      let branchName: string | null = null;
      if (sd?.branch_id) {
        const { data: br } = await supabase.from("branches").select("name").eq("id", sd.branch_id).maybeSingle();
        branchName = br?.name ?? null;
      }

      setSlip({
        ...sp,
        full_name: pr?.full_name ?? "—",
        role: pr?.role ?? "—",
        designation: sd?.designation ?? null,
        employee_code: sd?.employee_code ?? null,
        branch_name: branchName,
      });
      setLoading(false);
    })();
  }, [id, router]);

  if (loading) return <div className="p-8 text-center text-sm text-gray-400">Loading...</div>;
  if (err || !slip) return <div className="p-8 text-center text-sm text-red-600">{err ?? "Koi masla aa gaya."}</div>;

  const kati = Number(slip.deductions ?? 0) + Number(slip.advance_deduction ?? 0);
  const monthLabel = `${MONTHS[slip.pay_month]} ${slip.pay_year}`;
  const gross = Number(slip.basic_salary ?? 0) + Number(slip.bonus ?? 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 print:bg-white print:p-0">
      {/* Controls — print mein nazar nahi aate */}
      <div className="mb-4 flex items-center gap-3 print:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" /> Wapas
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      {/* Salary Slip Card */}
      <div className="mx-auto max-w-2xl rounded-xl bg-white shadow-sm print:shadow-none print:max-w-full dark:bg-gray-800 print:bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 px-8 py-6 text-center print:border-gray-300">
          <h1 className="text-xl font-bold text-gray-900 print:text-black">Al Rana Traders</h1>
          {slip.branch_name && (
            <p className="mt-0.5 text-sm text-gray-500 print:text-gray-600">{slip.branch_name}</p>
          )}
          <p className="mt-3 text-base font-semibold text-emerald-700 print:text-black">SALARY SLIP</p>
          <p className="text-sm text-gray-500 print:text-gray-600">{monthLabel}</p>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 px-8 py-5 text-sm border-b border-gray-100 print:border-gray-300">
          <Row label="Naam" value={slip.full_name} />
          <Row label="Employee Code" value={slip.employee_code ?? "—"} />
          <Row label="Designation" value={slip.designation ?? slip.role.replace(/_/g, " ")} />
          <Row label="Status" value={slip.status === "paid" ? "Paid" : "Pending"} />
          {slip.paid_date && <Row label="Payment Date" value={new Date(slip.paid_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} />}
        </div>

        {/* Earnings & Deductions */}
        <div className="grid grid-cols-2 gap-6 px-8 py-5 border-b border-gray-100 print:border-gray-300">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 print:text-gray-600">Aamad (Earnings)</p>
            <AmountRow label="Basic Salary" amount={slip.basic_salary} />
            {Number(slip.bonus ?? 0) > 0 && <AmountRow label="Bonus / Allowance" amount={slip.bonus} />}
            <div className="mt-2 border-t border-gray-200 pt-2 print:border-gray-300">
              <AmountRow label="Gross" amount={gross} bold />
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 print:text-gray-600">Katauti (Deductions)</p>
            {Number(slip.deductions ?? 0) > 0 && <AmountRow label="Katauti" amount={slip.deductions} minus />}
            {Number(slip.advance_deduction ?? 0) > 0 && <AmountRow label="Advance wapsi" amount={slip.advance_deduction} minus />}
            {kati === 0 && <p className="text-sm text-gray-400">—</p>}
            {kati > 0 && (
              <div className="mt-2 border-t border-gray-200 pt-2 print:border-gray-300">
                <AmountRow label="Total katauti" amount={kati} minus bold />
              </div>
            )}
          </div>
        </div>

        {/* Net */}
        <div className="flex items-center justify-between px-8 py-5">
          <p className="text-base font-bold text-gray-900 dark:text-white print:text-black">Net Tankhwah</p>
          <p className="text-2xl font-bold text-emerald-700 print:text-black">
            Rs {Number(slip.net_salary ?? 0).toLocaleString()}
          </p>
        </div>

        {slip.notes && (
          <div className="px-8 pb-5">
            <p className="rounded-lg bg-gray-50 px-4 py-2 text-xs text-gray-500 print:bg-gray-100">{slip.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-100 px-8 py-4 text-center text-[11px] text-gray-400 print:border-gray-300 print:text-gray-500">
          Ye parchi computer se bani hai — dastkhat ki zarurat nahi. AgriBridge HR System
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 print:text-gray-500">{label}</span>
      <span className="mt-0.5 font-medium text-gray-900 dark:text-white print:text-black">{value}</span>
    </div>
  );
}

function AmountRow({ label, amount, minus, bold }: { label: string; amount: number | null; minus?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm mb-1.5 ${bold ? "font-semibold" : ""}`}>
      <span className="text-gray-600 dark:text-gray-300 print:text-gray-700">{label}</span>
      <span className={minus ? "text-red-600 print:text-red-700" : "text-gray-900 dark:text-white print:text-black"}>
        {minus ? "- " : ""}Rs {Number(amount ?? 0).toLocaleString()}
      </span>
    </div>
  );
}
