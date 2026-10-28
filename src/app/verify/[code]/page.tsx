import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { MONTHS_RU } from "@/lib/payroll/compute";
import { SLIP_COMPANY } from "@/lib/payroll/slip-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Salary slip ki tasdeeq", robots: { index: false, follow: false } };

/** 691: QR se public tasdeeq -- sirf mehdood maloomat (CNIC, bank, kattautiyan nahi). */
export default async function VerifySlipPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code).trim().toUpperCase().slice(0, 32);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createClient() as any;
  const { data, error } = /^VRF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) ? await sb.rpc("fn_verify_salary_slip", { p_code: code }) : { data: null, error: null };
  const d = error ? null : data;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-[#0f3d2a] px-6 py-5 text-white">
          <div className="text-lg font-bold">🌾 {SLIP_COMPANY.name}</div>
          <div className="text-xs text-green-100">Salary slip ki tasdeeq</div>
        </div>
        <div className="space-y-3 p-6 text-sm text-gray-800">
          {d ? (
            <>
              <div className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 font-semibold text-green-800">✓ Ye slip asli hai — hamare record mein darj hai.</div>
              {[
                ["Slip #", d.slip_no ?? "—"],
                ["Naam", d.name ?? "—"],
                ["Ohda", d.designation ?? "—"],
                ["Mahina", `${MONTHS_RU[(d.pay_month ?? 1) - 1]} ${d.pay_year}`],
                ["Net tankhwah", `Rs ${Math.round(Number(d.net)).toLocaleString("en-US")}`],
                ["Halat", d.paid ? "Ada ho chuki" : "Manzoor — adaigi baqi"],
              ].map(([k, v]) => <div key={k} className="flex justify-between border-b border-gray-100 pb-2"><span className="text-gray-500">{k}</span><span className="font-medium">{v}</span></div>)}
              <p className="text-xs text-gray-400">Tasdeeqi code: {code}. Ziyada maloomat (CNIC, bank, kattautiyan) yahan nahi dikhai jaati.</p>
            </>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700">✗ Ye code hamare record mein nahi mila. Slip jaali ho sakti hai — HR se rabta karein.</div>
          )}
        </div>
      </div>
    </main>
  );
}
