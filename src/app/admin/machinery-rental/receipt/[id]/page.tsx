import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ReceiptView } from "./receipt-view";

export const dynamic = "force-dynamic";

/**
 * Ek adaigi ki raseed.
 *
 * Booking ki slip se alag, jaan boojh kar: ek booking par kai adaigiyan
 * hoti hain, aur kisan ko us adaigi ka kaghaz chahiye jo us ne ABHI ki
 * hai.
 *
 * Sab se ahem do adad wo hain jo raqam se bhi zyada dekhe jate hain:
 * pehle kitna baqi tha, aur ab kitna hai.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: r } = await supabase
    .from("v_machinery_payment_receipts")
    .select("*")
    .eq("payment_id", id)
    .maybeSingle();

  if (!r) notFound();

  return (
    <ReceiptView
      lang={lang}
      receipt={{
        paymentId: r.payment_id as string,
        receiptNumber: (r.receipt_number as string | null) ?? "—",
        bookingId: r.booking_id as string,
        bookingNumber: (r.booking_number as string) ?? "—",
        billNumber: (r.bill_number as string | null) ?? null,
        farmerName: (r.farmer_name as string | null) ?? "—",
        farmerCode: (r.farmer_code as string | null) ?? "",
        farmerPhone: (r.farmer_phone as string | null) ?? null,
        village: (r.village as string | null) ?? null,
        kind: (r.kind as string) ?? "final",
        amount: Number(r.amount ?? 0),
        method: (r.method as string) ?? "cash",
        paymentDate: r.payment_date as string,
        reference: (r.reference as string | null) ?? null,
        receivedByName: (r.received_by_name as string | null) ?? null,
        custodyName: (r.custody_name as string | null) ?? null,
        receivedLocation: (r.received_location as string | null) ?? null,
        previousBalance: Number(r.pehla_baqi ?? 0),
        newBalance: Number(r.naya_baqi ?? 0),
      }}
      title={t("mr_receipt_title", lang)}
    />
  );
}
