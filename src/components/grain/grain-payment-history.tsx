/**
 * Bill / khata ke neeche har payment ki tafseel: tareekh, raqam, account,
 * slip aur ledger TXN number -- taake har staff member dekh sake ke paisa
 * kahan gaya. Hooks nahi, is liye server aur client dono jagah chalta hai.
 */
import { Badge } from "@/components/ui/form";

export interface GrainPaymentHistoryRow {
  id: string;
  date: string;
  amount: number;
  account_name: string | null;
  payment_method: string | null;
  receipt_photo_url: string | null;
  entry_number: string | null;
  notes: string | null;
  slip_href?: string | null;
}

function pkDate(value: string): string {
  const d = String(value ?? "").slice(0, 10);
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}-${m}-${y}` : d;
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Naqad",
  bank_transfer: "Bank transfer",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
};

function rs(value: number): string {
  return `Rs ${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function GrainBillSummary({ total, paid, labelPaid = "Wasool / Ada" }: { total: number; paid: number; labelPaid?: string }) {
  const baqi = Math.round((total - paid) * 100) / 100;
  return (
    <div className="grid grid-cols-3 gap-2 text-center text-xs">
      <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800">
        <p className="text-surface-500">Kul bill</p>
        <p className="font-semibold text-surface-900 dark:text-white">{rs(total)}</p>
      </div>
      <div className="rounded-lg bg-brand-50 p-2 dark:bg-brand-900/30">
        <p className="text-brand-700 dark:text-brand-300">{labelPaid}</p>
        <p className="font-semibold text-brand-800 dark:text-brand-200">{rs(paid)}</p>
      </div>
      <div className={`rounded-lg p-2 ${baqi > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-surface-50 dark:bg-surface-800"}`}>
        <p className={baqi > 0 ? "text-red-600" : "text-surface-500"}>Baqi</p>
        <p className={`font-semibold ${baqi > 0 ? "text-red-700 dark:text-red-300" : "text-surface-900 dark:text-white"}`}>{rs(baqi)}</p>
      </div>
    </div>
  );
}

export function GrainPaymentHistory({ rows, emptyText = "Abhi koi payment darj nahi hui." }: { rows: GrainPaymentHistoryRow[]; emptyText?: string }) {
  if (rows.length === 0) return <p className="py-3 text-center text-xs text-surface-400">{emptyText}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="border-b border-surface-200 text-left text-surface-500 dark:border-surface-700">
            <th className="px-2 py-1.5 font-medium">Tareekh</th>
            <th className="px-2 py-1.5 text-right font-medium">Raqam</th>
            <th className="px-2 py-1.5 font-medium">Account (Bank / Cash)</th>
            <th className="px-2 py-1.5 font-medium">Slip</th>
            <th className="px-2 py-1.5 font-medium">Ledger</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-2 py-1.5 whitespace-nowrap text-surface-700 dark:text-surface-300">{pkDate(r.date)}</td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-surface-900 dark:text-white">{rs(r.amount)}</td>
              <td className="px-2 py-1.5 text-surface-700 dark:text-surface-300">
                {r.account_name ?? "—"}
                {r.payment_method && <span className="block text-[10px] text-surface-400">{METHOD_LABEL[r.payment_method] ?? r.payment_method}</span>}
                {r.notes && <span className="block max-w-[220px] truncate text-[10px] text-surface-400" title={r.notes}>{r.notes}</span>}
              </td>
              <td className="px-2 py-1.5">
                {r.receipt_photo_url ? (
                  <a href={r.receipt_photo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                    {/\.pdf($|\?)/i.test(r.receipt_photo_url) ? (
                      "PDF dekhein"
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.receipt_photo_url} alt="Slip" className="h-10 w-10 rounded border border-surface-200 object-cover" />
                    )}
                  </a>
                ) : (
                  <Badge tone="amber">Slip nahi lagi</Badge>
                )}
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                {r.entry_number ? <Badge tone="green">{r.entry_number}</Badge> : <Badge tone="gray">TXN nahi mila</Badge>}
                {r.slip_href && (
                  <a href={r.slip_href} className="ml-1 text-[10px] text-brand-600 hover:underline">Slip</a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
