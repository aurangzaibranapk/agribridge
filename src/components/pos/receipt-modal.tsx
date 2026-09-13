"use client";
import { useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n/translations";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui/form";
import { X, MessageCircle, Mail, Printer } from "lucide-react";

interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface ReceiptData {
  sale_id: string;
  created_at: string;
  payment_mode: string;
  total_amount: number;
  cash_paid: number;
  khata_amount: number;
  outstanding_balance: number;
  seller_name: string;
  seller_phone: string | null;
  cashier_name: string;
  customer_name: string;
  customer_phone: string | null;
  items: ReceiptItem[];
}

export function ReceiptModal({
  saleId,
  onClose,
  lang,
}: {
  saleId: string;
  onClose: () => void;
  /** Zaban server se aati hai -- dekhein pos-client.tsx ka note. */
  lang: Lang;
}) {
  const supabase = createClient();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_sale_receipt", { p_sale_id: saleId });
      setReceipt(data as ReceiptData);
      setLoading(false);
    })();
  }, [saleId]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function buildReceiptText(r: ReceiptData) {
    const lines = [
      `${r.seller_name}`,
      r.seller_phone ? `Ph: ${r.seller_phone}` : "",
      formatDate(r.created_at),
      r.customer_name ? `Customer: ${r.customer_name}` : "",
      "",
      ...r.items.map(
        (item) => `${item.name} x${item.quantity} @ Rs ${item.unit_price.toLocaleString()} = Rs ${item.subtotal.toLocaleString()}`
      ),
      "",
      `${t("pos_grand_total", lang)}: Rs ${r.total_amount.toLocaleString()}`,
    ];
    if (r.cash_paid > 0) lines.push(`Cash Paid: Rs ${r.cash_paid.toLocaleString()}`);
    if (r.khata_amount > 0) lines.push(`Khata (Credit): Rs ${r.khata_amount.toLocaleString()}`);
    if (r.outstanding_balance > 0) lines.push(`${t("pos_outstanding", lang)}: Rs ${r.outstanding_balance.toLocaleString()}`);
    lines.push("", "Thank You for Shopping!", "POS Solution by ZR Technologies", "📞 0312-6513294");
    return lines.filter(Boolean).join("\n");
  }

  function handleWhatsApp() {
    if (!receipt) return;
    const text = encodeURIComponent(buildReceiptText(receipt));
    const phone = receipt.customer_phone ? receipt.customer_phone.replace(/\D/g, "") : "";
    const base = phone ? `https://wa.me/92${phone.replace(/^0/, "")}` : `https://wa.me/`;
    window.open(`${base}?text=${text}`, "_blank");
  }

  async function handleSendEmail() {
    if (!receipt || !emailAddress) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/send-receipt-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailAddress,
          subject: `Receipt from ${receipt.seller_name}`,
          text: buildReceiptText(receipt),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setEmailStatus({ type: "success", text: "Email sent successfully." });
    } catch (err: any) {
      setEmailStatus({ type: "error", text: err.message ?? "Failed to send email." });
    } finally {
      setSendingEmail(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:bg-transparent">
      <div
        id="receipt-print-area"
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-card bg-white p-5 shadow-xl dark:bg-surface-900 print:max-h-none print:shadow-none"
      >
        <div className="mb-3 flex items-center justify-between print:hidden">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("pos_receipt", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading || !receipt ? (
          <p className="py-10 text-center text-sm text-surface-400">{t("pos_receipt_loading", lang)}</p>
        ) : (
          <>
            <div className="text-center">
              <p className="font-display text-base font-semibold text-surface-900 dark:text-white">{receipt.seller_name}</p>
              {receipt.seller_phone && <p className="text-xs text-surface-400">Ph: {receipt.seller_phone}</p>}
              <p className="mt-1 text-xs text-surface-400">{formatDate(receipt.created_at)}</p>
            </div>

            <div className="my-3 border-t border-dashed border-surface-300 dark:border-surface-700" />

            <table className="w-full text-xs">
              <tbody>
                <tr>
                  <td className="py-0.5 text-surface-500">{t("pos_cashier", lang)}</td>
                  <td className="py-0.5 text-right text-surface-900 dark:text-surface-100">{receipt.cashier_name}</td>
                </tr>
                {receipt.customer_name && (
                  <tr>
                    <td className="py-0.5 text-surface-500">{t("pos_customer", lang)}</td>
                    <td className="py-0.5 text-right text-surface-900 dark:text-surface-100">{receipt.customer_name}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-0.5 text-surface-500">{t("pos_payment_mode", lang)}</td>
                  <td className="py-0.5 text-right capitalize text-surface-900 dark:text-surface-100">{receipt.payment_mode}</td>
                </tr>
              </tbody>
            </table>

            <div className="my-3 border-t border-dashed border-surface-300 dark:border-surface-700" />

            <table className="w-full text-xs">
              <thead>
                <tr className="text-surface-500">
                  <td className="pb-1.5">{t("pos_item", lang)}</td>
                  <td className="pb-1.5 text-center">{t("pos_qty", lang)}</td>
                  <td className="pb-1.5 text-right">{t("pos_rate", lang)}</td>
                  <td className="pb-1.5 text-right">{t("pos_total", lang)}</td>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1">{item.name}</td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">{item.unit_price.toLocaleString()}</td>
                    <td className="py-1 text-right">{item.subtotal.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="my-3 border-t border-dashed border-surface-300 dark:border-surface-700" />

            <table className="w-full text-xs">
              <tbody>
                <tr>
                  <td className="py-0.5 text-surface-500">{t("pos_grand_total", lang)}</td>
                  <td className="py-0.5 text-right font-semibold text-surface-900 dark:text-surface-100">
                    Rs {receipt.total_amount.toLocaleString()}
                  </td>
                </tr>
                {receipt.cash_paid > 0 && (
                  <tr>
                    <td className="py-0.5 text-surface-500">{t("pos_cash_paid", lang)}</td>
                    <td className="py-0.5 text-right text-surface-900 dark:text-surface-100">
                      Rs {receipt.cash_paid.toLocaleString()}
                    </td>
                  </tr>
                )}
                {receipt.khata_amount > 0 && (
                  <tr>
                    <td className="py-0.5 font-medium text-red-600">{t("pos_khata_credit", lang)}</td>
                    <td className="py-0.5 text-right font-medium text-red-600">
                      Rs {receipt.khata_amount.toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {receipt.outstanding_balance > 0 && (
              <>
                <div className="my-3 border-t border-dashed border-surface-300 dark:border-surface-700" />
                <table className="w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="py-0.5 font-semibold text-amber-700 dark:text-amber-400">
                        {t("pos_outstanding", lang)}
                      </td>
                      <td className="py-0.5 text-right font-semibold text-amber-700 dark:text-amber-400">
                        Rs {receipt.outstanding_balance.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            <div className="my-3 border-t border-dashed border-surface-300 dark:border-surface-700" />
            <p className="text-center text-xs text-surface-400">{t("pos_thank_you", lang)}</p>
            <p className="text-center text-xs text-surface-400">{t("at_pos_by", lang)}</p>
            <p className="text-center text-xs text-surface-400">📞 0312-6513294</p>

            <div className="mt-4 flex gap-2 print:hidden">
              <Button variant="secondary" className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="secondary" className="flex-1" onClick={handleWhatsApp}>
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setShowEmailForm((v) => !v)}>
                <Mail className="h-4 w-4" />
              </Button>
            </div>

            {showEmailForm && (
              <div className="mt-3 space-y-2 print:hidden">
                <Input
                  type="email"
                  placeholder={t("pos_email_address", lang)}
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                />
                {emailStatus && (
                  <p className={`text-xs ${emailStatus.type === "success" ? "text-brand-600" : "text-red-600"}`}>
                    {emailStatus.text}
                  </p>
                )}
                <Button className="w-full" onClick={handleSendEmail} disabled={sendingEmail || !emailAddress}>
                  {sendingEmail ? "Sending..." : "Send Email"}
                </Button>
              </div>
            )}

            <Button className="mt-3 w-full print:hidden" onClick={onClose}>
              {t("pos_close", lang)}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}