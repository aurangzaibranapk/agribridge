import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { WorkClaimsClient } from "./work-claims-client";

export const dynamic = "force-dynamic";

/**
 * Vendor ke bheje hue kaam jin ki tasdeeq baqi hai.
 *
 * Ye qatar alag safhe par is liye hai ke ye kisi ek booking ka kaam
 * nahi -- ye rozana ka kaam hai: subah baith kar dekhna ke raat bhar
 * mein kis kis vendor ne kya bheja. Booking ke safhe par para hua dawa
 * us waqt tak nazar nahi aata jab tak koi wo booking na khole.
 *
 * Yahan tak pohanchne wala raqba abhi bill mein NAHI ginta. Yehi is
 * qatar ka poora maqsad hai.
 */
export default async function WorkClaimsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  // Vendor ke teenon dawe ek hi safhe par. Alag safha banane se wo
  // qatar kabhi nahi dekhi jati jo teesre safhe par ho -- aur jo dawa
  // dekha na jaye wo hamesha "abhi tasdeeq baqi" hi rehta hai.
  const [{ data: claims }, { data: fuelClaims }, { data: cashClaims }, { data: accounts }] = await Promise.all([
    supabase.from("v_machinery_work_claims").select("*").order("work_date"),
    supabase.from("v_machinery_fuel_claims").select("*").order("log_date"),
    supabase.from("v_machinery_vendor_collection_claims").select("*").order("payment_date"),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("fm_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("wc_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("wc_subtitle", lang)}</p>
      </div>

      <WorkClaimsClient
        claims={(claims ?? []).map((c) => ({
          workId: c.work_id as string,
          bookingId: c.booking_id as string,
          bookingNumber: c.booking_number as string,
          farmerName: (c.farmer_name as string | null) ?? "—",
          vendorName: (c.vendor_name as string | null) ?? "—",
          workDate: c.work_date as string,
          area: Number(c.actual_area),
          isFinal: Boolean(c.is_final),
          meterReading: c.meter_reading === null ? null : Number(c.meter_reading),
          photoUrl: c.completion_photo_url as string | null,
          notes: c.notes as string | null,
          daysOld: c.din_purane === null ? null : Number(c.din_purane),
        }))}
        fuelClaims={(fuelClaims ?? []).map((c) => ({
          fuelId: c.fuel_id as string,
          bookingId: c.booking_id as string,
          bookingNumber: c.booking_number as string,
          farmerName: (c.farmer_name as string | null) ?? "—",
          vendorName: (c.vendor_name as string | null) ?? "—",
          logDate: c.log_date as string,
          litres: c.litres === null ? null : Number(c.litres),
          amount: Number(c.amount),
          paidBy: c.paid_by as string,
          notes: c.notes as string | null,
          daysOld: c.din_purane === null ? null : Number(c.din_purane),
        }))}
        cashClaims={(cashClaims ?? []).map((c) => ({
          paymentId: c.payment_id as string,
          bookingId: c.booking_id as string,
          bookingNumber: c.booking_number as string,
          farmerName: (c.farmer_name as string | null) ?? "—",
          vendorName: (c.vendor_name as string | null) ?? "—",
          amount: Number(c.amount ?? 0),
          paymentDate: c.payment_date as string,
          settlement: (c.vendor_settlement as string | null) ?? null,
          reference: (c.reference as string | null) ?? null,
          billBalance: Number(c.bill_ka_baqi ?? 0),
        }))}
        accounts={accounts ?? []}
      />
    </div>
  );
}
