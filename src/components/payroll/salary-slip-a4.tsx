import { encodeQr, qrSvgPath } from "@/lib/qr/qr-encode";
import { fmtDate, PAY_METHODS } from "@/lib/payroll/salary-offer";
import { SLIP_COMPANY, type SlipData } from "@/lib/payroll/slip-data";

const n = (x: number) => (Number.isFinite(x) ? Math.round(x).toLocaleString("en-US") : "—");

/** 691 (mockup 5): A4 salary slip -- print aur bank ke liye. */
export function SalarySlipA4({ slip, verifyHref, verifyLabel }: { slip: SlipData; verifyHref: string | null; verifyLabel: string }) {
  const qr = verifyHref ? qrSvgPath(encodeQr(verifyHref)) : null;
  const info: [string, string, string, string][] = [
    ["Naam", slip.staff.name, "Walid ka naam", slip.staff.father ?? "—"],
    ["CNIC", slip.staff.cnic ?? "—", "Ohda", slip.staff.designation ?? "—"],
    ["Shoba", slip.staff.department ?? "—", "Joining", fmtDate(slip.staff.joining)],
    ["Bank", slip.staff.bank ?? "—", "Account", slip.staff.account ?? "—"],
    ["Kaam ke din", slip.workDays, "Employee ID", slip.staff.employeeCode ?? "—"],
  ];
  const pad = Math.max(0, slip.earnings.length - slip.deductions.length);
  const method = slip.payMethod ? PAY_METHODS[slip.payMethod] ?? slip.payMethod : slip.payAccount;
  const cell = "border border-gray-200 px-2 py-1.5";
  return (
    <div className="salary-slip-a4 mx-auto box-border min-h-[1123px] w-[794px] max-w-full bg-white px-12 py-10 font-sans text-[13px] text-gray-900 shadow-sm print:min-h-0 print:w-full print:shadow-none">
      <div className="flex justify-between border-b-4 border-green-700 pb-3.5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#0f3d2a] text-[28px] text-white">🌾</div>
          <div>
            <div className="text-2xl font-extrabold text-[#0f3d2a]">{SLIP_COMPANY.name}</div>
            <div className="text-xs text-gray-500">{SLIP_COMPANY.tagline}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">SALARY SLIP</div>
          <div className="text-[13px]">Tankhwah Parchi</div>
          <div className="text-xs text-gray-500">Slip # {slip.slipNo ?? slip.lineId.slice(0, 8).toUpperCase()}<br />Mahina: {slip.month}</div>
        </div>
      </div>

      <table className="mt-[18px] w-full border-collapse">
        <tbody>{info.map(([a, b, c, d]) => (
          <tr key={a}><td className={`${cell} w-[18%] text-gray-500`}>{a}</td><td className={cell}>{a === "Naam" ? <b>{b}</b> : b}</td><td className={`${cell} w-[18%] text-gray-500`}>{c}</td><td className={cell}>{d}</td></tr>
        ))}</tbody>
      </table>

      <div className="mt-4 flex gap-4">
        <table className="w-full border-collapse self-start">
          <thead><tr><th className={`${cell} bg-green-50 text-left text-green-700`}>Kamai (Earnings)</th><th className={`${cell} bg-green-50 text-right text-green-700`}>Rs</th></tr></thead>
          <tbody>
            {slip.earnings.map((r) => <tr key={r.label}><td className={cell}>{r.label}</td><td className={`${cell} text-right tabular-nums`}>{n(r.amount)}</td></tr>)}
            {Array.from({ length: Math.max(0, slip.deductions.length - slip.earnings.length) }).map((_, i) => <tr key={`pe${i}`}><td className={cell}>&nbsp;</td><td className={cell} /></tr>)}
            <tr><td className={cell}><b>Gross</b></td><td className={`${cell} text-right tabular-nums`}><b>{n(slip.gross)}</b></td></tr>
          </tbody>
        </table>
        <table className="w-full border-collapse self-start">
          <thead><tr><th className={`${cell} bg-red-50 text-left text-red-700`}>Katauti (Deductions)</th><th className={`${cell} bg-red-50 text-right text-red-700`}>Rs</th></tr></thead>
          <tbody>
            {slip.deductions.map((r) => <tr key={r.label}><td className={cell}>{r.label}</td><td className={`${cell} text-right tabular-nums`}>{n(r.amount)}</td></tr>)}
            {Array.from({ length: pad }).map((_, i) => <tr key={`pd${i}`}><td className={cell}>&nbsp;</td><td className={cell} /></tr>)}
            <tr><td className={cell}><b>Kul katauti</b></td><td className={`${cell} text-right tabular-nums`}><b>{n(slip.totalDeductions)}</b></td></tr>
          </tbody>
        </table>
      </div>

      <div className="my-4 flex items-center justify-between rounded-[10px] bg-green-700 px-[18px] py-3.5 text-white print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
        <div><div className="text-xs opacity-85">NET SALARY (Saafi tankhwah)</div><div className="text-[13px]">{slip.netWords}</div></div>
        <div className="text-[28px] font-extrabold tabular-nums">Rs {n(slip.net)}</div>
      </div>

      <table className="w-full border-collapse">
        <tbody><tr>
          <td className={`${cell} w-[18%] text-gray-500`}>Ada ki tareekh</td><td className={cell}>{slip.paidAt ? fmtDate(slip.paidAt) : "Abhi ada nahi"}</td>
          <td className={`${cell} w-[18%] text-gray-500`}>Tareeqa</td><td className={cell}>{[method, slip.payRef ? `Ref ${slip.payRef}` : null].filter(Boolean).join(" · ") || "—"}</td>
        </tr></tbody>
      </table>

      <div className="mt-[60px] flex items-end justify-between">
        <div className="text-center">
          {qr ? (
            <a href={verifyHref ?? undefined} aria-label="Tasdeeq ka QR">
              <svg viewBox={`0 0 ${qr.view} ${qr.view}`} width={110} height={110} shapeRendering="crispEdges" className="border-2 border-[#0f3d2a] bg-white">
                <path d={qr.path} fill="#0f3d2a" />
              </svg>
            </a>
          ) : <div className="h-[110px] w-[110px] border-2 border-dashed border-gray-300" />}
          <div className="mt-1 text-[11px] text-gray-500">Tasdeeq: {slip.verifyCode ?? "—"}<br />{verifyLabel}</div>
        </div>
        <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-2 border-dashed border-green-300 text-xs text-green-700">Mohar (Stamp)</div>
        <div className="w-[200px] text-center"><div className="border-t border-gray-900 pt-1.5 text-xs">Mujaz dastakhat<br />HR / Accounts — {SLIP_COMPANY.name}</div></div>
      </div>
      <p className="mt-10 text-center text-[10px] text-gray-400">Ye computer se bani parchi hai. QR scan kar ke asal hone ki tasdeeq karein.{slip.approvedBy ? ` · Manzoor: ${slip.approvedBy}` : ""}</p>
    </div>
  );
}
