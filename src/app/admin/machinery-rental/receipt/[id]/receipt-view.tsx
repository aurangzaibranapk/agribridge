"use client";
import Link from "next/link";
import { t, type Lang } from "@/lib/i18n/translations";
import { Printer, MessageCircle, ArrowLeft } from "lucide-react";

interface Receipt {
  paymentId: string;
  receiptNumber: string;
  bookingId: string;
  bookingNumber: string;
  billNumber: string | null;
  farmerName: string;
  farmerCode: string;
  farmerPhone: string | null;
  village: string | null;
  kind: string;
  amount: number;
  method: string;
  paymentDate: string;
  reference: string | null;
  receivedByName: string | null;
  custodyName: string | null;
  receivedLocation: string | null;
  previousBalance: number;
  newBalance: number;
}

export function ReceiptView({ receipt, lang, title }: { receipt: Receipt; lang: Lang; title: string }) {
  const settled = receipt.newBalance <= 0.01;

  // Wohi baat jo kaghaz par hai, wohi WhatsApp par. Do jagah do alag
  // jumle likhne se kisan ke paas do mukhtalif kahaniyan pahunchti
  // hain, aur wo hamesha us kahani ko yaad rakhta hai jo us ke haq
  // mein ho.
  const message = [
    `Al Rana Traders — AgriBridge`,
    `Raseed ${receipt.receiptNumber}`,
    ``,
    `${receipt.farmerName}${receipt.farmerCode ? ` (${receipt.farmerCode})` : ""}`,
    `Booking: ${receipt.bookingNumber}`,
    `Tareekh: ${new Date(receipt.paymentDate).toLocaleDateString()}`,
    ``,
    `Mili raqam: Rs ${receipt.amount.toLocaleString()}`,
    `Pehla baqi: Rs ${receipt.previousBalance.toLocaleString()}`,
    settled ? `Naya baqi: Rs 0 — HISAAB POORA` : `Naya baqi: Rs ${receipt.newBalance.toLocaleString()}`,
    ``,
    `Shukriya.`,
  ].join("\n");

  const wa = receipt.farmerPhone
    ? `https://wa.me/${receipt.farmerPhone.replace(/\D/g, "").replace(/^0/, "92")}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/admin/machinery-rental/booking/${receipt.bookingId}`}
          className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" /> {receipt.bookingNumber}
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-700 dark:border-surface-700 dark:text-surface-300"
          >
            <Printer className="h-4 w-4" /> {t("mc_print", lang)}
          </button>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              <MessageCircle className="h-4 w-4" />{t("at_whatsapp", lang)}</a>
          )}
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-200 pb-3 text-center dark:border-surface-700">
          <h1 className="font-display text-lg font-bold text-surface-900 dark:text-white">{t("sh_company", lang)}</h1>
          <p className="text-xs text-surface-500">{title}</p>
          <p className="mt-1 font-mono text-sm font-medium text-surface-800 dark:text-surface-200">
            {receipt.receiptNumber}
          </p>
        </div>

        <dl className="mt-4 space-y-1.5 text-sm">
          <Line label={t("mc_farmer", lang)} value={receipt.farmerName} strong />
          {receipt.farmerCode && <Line label={t("farmer_code", lang)} value={receipt.farmerCode} />}
          {receipt.village && <Line label={t("mc_village", lang)} value={receipt.village} />}
          <Line label={t("mc_booking_no", lang)} value={receipt.bookingNumber} />
          {receipt.billNumber && <Line label={t("mc_bill_label", lang)} value={receipt.billNumber} />}
          <Line label={t("mc_date", lang)} value={new Date(receipt.paymentDate).toLocaleDateString()} />
          <Line label={t("mc_method", lang)} value={receipt.method} />
          {receipt.reference && <Line label={t("mc_reference", lang)} value={receipt.reference} />}
          {receipt.receivedByName && <Line label={t("mr_received_by", lang)} value={receipt.receivedByName} />}
          {receipt.receivedLocation && (
            <Line
              label={t("mc_cash_where", lang)}
              value={receipt.receivedLocation === "field" ? t("mc_cash_field", lang) : t("mc_cash_office", lang)}
            />
          )}
        </dl>

        <div className="mt-4 rounded-lg border border-surface-200 p-3 dark:border-surface-700">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-surface-600 dark:text-surface-300">{t("mr_amount_received", lang)}</span>
            <span className="font-display text-2xl font-bold text-surface-900 dark:text-white">
              Rs {receipt.amount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Do adad jo raqam se bhi zyada dekhe jate hain. */}
        <div className="mt-3 space-y-1 rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800">
          <Line label={t("mr_previous_balance", lang)} value={`Rs ${receipt.previousBalance.toLocaleString()}`} />
          <div className="flex justify-between border-t border-surface-200 pt-1 font-semibold dark:border-surface-700">
            <span>{t("mr_new_balance", lang)}</span>
            <span className={settled ? "text-brand-700 dark:text-brand-300" : "text-red-600 dark:text-red-400"}>
              Rs {receipt.newBalance.toLocaleString()}
            </span>
          </div>
        </div>

        <p
          className={`mt-3 rounded-lg py-2 text-center font-display text-sm font-semibold ${
            settled
              ? "bg-brand-50 text-brand-800 dark:bg-brand-950/30 dark:text-brand-200"
              : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          }`}
        >
          {settled
            ? t("mr_paid_full", lang)
            : `${t("mc_outstanding", lang)} Rs ${receipt.newBalance.toLocaleString()}`}
        </p>

        <p className="mt-4 text-center text-xs text-surface-400">{t("mr_receipt_footer", lang)}</p>
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-surface-500">{label}</dt>
      <dd className={strong ? "font-medium text-surface-900 dark:text-white" : "text-surface-700 dark:text-surface-300"}>
        {value}
      </dd>
    </div>
  );
}
