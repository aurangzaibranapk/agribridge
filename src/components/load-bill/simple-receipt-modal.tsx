"use client";
import { X, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/form";

/**
 * Load, Bill, Udhaar, Recovery -- char qism ka ek hi chhota receipt.
 *
 * Malik (16 September): "Mobile Load, Bill Payment, Udhaar aur
 * Recovery -- chaaron ke liye proper related Print Receipt/Slip aur
 * WhatsApp receipt banayein, jisme sirf us transaction ki correct
 * information ho."
 *
 * POS ki `ReceiptModal` ek alag cheez ke liye hai (`pos_sales` se RPC
 * kar ke items ki fehrist laati hai) -- yahan koi item list nahi hoti,
 * sirf ek qatar ka len-den, aur data pehle se safhe ke paas maujood
 * hota hai (na sale_id, na koi nayi query). Isi liye chhota, generic
 * component -- print/WhatsApp ka wahi tareeqa jo ReceiptModal mein hai
 * (@page 80mm, print:static taake khali kaghaz na bache -- 15/16
 * September ki dono ghaltiyan yahan dobara nahi honi chahiye).
 */

interface Row {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "red" | "amber";
}

export function SimpleReceiptModal({
  onClose,
  sellerName,
  title,
  txnNumber,
  date,
  rows,
  totalLabel,
  totalValue,
  customerName,
  customerPhone,
  footerNote,
}: {
  onClose: () => void;
  sellerName: string;
  /** "Mobile Load" / "Bill Payment" / "Udhaar" / "Recovery". */
  title: string;
  txnNumber: string;
  /** ISO waqt. */
  date: string;
  rows: Row[];
  totalLabel: string;
  totalValue: string;
  customerName?: string | null;
  customerPhone?: string | null;
  footerNote?: string | null;
}) {
  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  function buildText() {
    const lines = [
      sellerName,
      title,
      txnNumber,
      formatDate(date),
      customerName ? `Customer: ${customerName}` : "",
      "",
      ...rows.map((r) => `${r.label}: ${r.value}`),
      "",
      `${totalLabel}: ${totalValue}`,
    ];
    if (footerNote) lines.push("", footerNote);
    lines.push("", "Al Rana Traders", "📞 0312-6513294");
    return lines.filter(Boolean).join("\n");
  }

  function handlePrint() {
    window.print();
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(buildText());
    const digits = customerPhone ? customerPhone.replace(/\D/g, "") : "";
    // Customer/farmer records save the number already with "92" (jaise
    // 923009990001), jabke staff load/bill ke waqt "0" wala local number
    // type karta hai (jaise 03211234567) -- dono ko "92XXXXXXXXXX" par
    // le aana hai, "92" do dafa nahi lagana (17 September ka bug: is
    // customer/kisan ke number par 9292... ban raha tha).
    const pkNumber = digits.startsWith("92") ? digits : digits.startsWith("0") ? `92${digits.slice(1)}` : digits ? `92${digits}` : "";
    const base = pkNumber ? `https://wa.me/${pkNumber}` : `https://wa.me/`;
    window.open(`${base}?text=${text}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:static print:block print:h-auto print:min-h-0 print:bg-transparent print:p-0">
      {/* Wahi do sabaq jo POS ki ReceiptModal mein 15/16 September ko
          seekhe gaye: (1) @page bina bataye A4 maan leta hai, (2) modal
          ka apna "screen par center karne wala" wrapper print mein bhi
          laagu rehta hai aur upar-neeche kaghaz khali chhoRta hai. */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 3mm; }
          html, body { margin: 0; background: #fff; }
          /* 19 September, malik: "udhaar ki slip nikalne laga to ye a
             rahi hai" -- peeche wala Staff Sales Desk (Float Balance,
             Cash in Hand waghera) bhi print ho raha tha, kyunke sirf
             receipt ko isolate karne wala rule missing tha. POS ki
             ReceiptModal mein 18 September ko yehi fix hua tha, wahi
             yahan bhi. */
          body * { visibility: hidden; }
          #load-bill-receipt-print, #load-bill-receipt-print * { visibility: visible; }
          #load-bill-receipt-print { position: absolute; left: 0; top: 0; width: 100%; }
          #load-bill-receipt-print, #load-bill-receipt-print * { color: #000 !important; }
          #load-bill-receipt-print .receipt-rule { border-top-width: 1.5px !important; border-color: #000 !important; }
        }
      `}</style>
      <div
        id="load-bill-receipt-print"
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-card bg-white p-5 font-mono text-black shadow-xl dark:bg-surface-900 print:max-h-none print:w-full print:p-0 print:text-[13px] print:shadow-none"
      >
        <div className="mb-3 flex items-center justify-between print:hidden">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Receipt</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="text-center">
          <p className="font-display text-lg font-bold uppercase tracking-wide text-surface-900 dark:text-white">{sellerName}</p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-surface-600 dark:text-surface-300">{title}</p>
          <p className="mt-1 text-xs text-surface-500">
            {txnNumber} · {formatDate(date)}
          </p>
        </div>

        <div className="receipt-rule my-3 border-t-2 border-dashed border-surface-400 dark:border-surface-700" />

        {customerName && (
          <>
            <div className="space-y-1 text-xs">
              <ReceiptRow label="Customer" value={customerName} />
              {customerPhone && <ReceiptRow label="Mobile" value={customerPhone} />}
            </div>
            <div className="receipt-rule my-3 border-t-2 border-dashed border-surface-400 dark:border-surface-700" />
          </>
        )}

        <div className="space-y-1 text-xs">
          {rows.map((r, i) => (
            <ReceiptRow key={i} label={r.label} value={r.value} strong={r.strong} tone={r.tone} />
          ))}
        </div>

        <div className="receipt-rule my-3 border-t-2 border-dashed border-surface-400 dark:border-surface-700" />
        <ReceiptRow label={totalLabel} value={totalValue} strong />

        {footerNote && <p className="mt-2 text-[11px] leading-relaxed text-surface-500">{footerNote}</p>}

        <div className="receipt-rule my-3 border-t-2 border-dashed border-surface-400 dark:border-surface-700" />
        <p className="text-center text-xs font-medium text-surface-600 dark:text-surface-400">Thank You!</p>
        <p className="text-center text-[11px] text-surface-500">📞 0312-6513294</p>

        <div className="mt-4 flex gap-2 print:hidden">
          <Button variant="secondary" className="flex-1" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="secondary" className="flex-1" onClick={handleWhatsApp}>
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
        <Button className="mt-3 w-full print:hidden" onClick={onClose}>
          Band Karein
        </Button>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, strong, tone }: Row) {
  const toneClass =
    tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-700 dark:text-amber-400" : "text-surface-900 dark:text-surface-100";
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={tone ? `font-medium ${toneClass}` : "text-surface-500"}>{label}</span>
      <span className={`shrink-0 whitespace-nowrap text-right tabular-nums ${strong ? "font-semibold" : ""} ${toneClass}`}>{value}</span>
    </div>
  );
}
