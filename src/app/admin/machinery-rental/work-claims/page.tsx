import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { canDo } from "@/lib/access/guard";
import { Card } from "@/components/ui/layout-primitives";
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
 *
 * Do marhala (9 September): fuel aur vendor-collection ke dawon mein
 * Manager pehle iqrar karta hai (claimed -> manager_confirmed, koi
 * ledger post nahi), phir Finance/Owner FINAL manzoor karta hai
 * (manager_confirmed -> verified). Work claim (raqba) mein paisa post
 * hota hi nahi -- wo ek hi qadam mein rehta hai.
 */
export default async function WorkClaimsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [canVerify, canApprove] = await Promise.all([
    canDo("machinery-rental.work-claims", "verify"),
    canDo("machinery-rental.work-claims", "approve"),
  ]);
  if (!canVerify && !canApprove) {
    return (
      <Card>
        <p className="text-sm">Aapko is safhe ki ijazat nahi hai.</p>
      </Card>
    );
  }

  const service = createServiceClient();

  // Vendor ke teenon dawe ek hi safhe par. Alag safha banane se wo
  // qatar kabhi nahi dekhi jati jo teesre safhe par ho -- aur jo dawa
  // dekha na jaye wo hamesha "abhi tasdeeq baqi" hi rehta hai.
  const [{ data: claims }, { data: fuelClaims }, { data: cashClaims }, { data: fuelPendingRows }, { data: cashPendingRows }, { data: accounts }] =
    await Promise.all([
      canVerify ? supabase.from("v_machinery_work_claims").select("*").order("work_date") : Promise.resolve({ data: [] }),
      canVerify ? supabase.from("v_machinery_fuel_claims").select("*").order("log_date") : Promise.resolve({ data: [] }),
      canVerify ? supabase.from("v_machinery_vendor_collection_claims").select("*").order("payment_date") : Promise.resolve({ data: [] }),
      canApprove
        ? service
            .from("machinery_fuel_logs")
            .select(
              "id, booking_id, litres, amount, paid_by, notes, manager_confirmed_at, machinery_bookings(booking_number, farmer_id, vendor_id, farmers(full_name), machinery_vendors(vendor_name))"
            )
            .eq("verification_status", "manager_confirmed")
            .order("manager_confirmed_at")
        : Promise.resolve({ data: [] }),
      canApprove
        ? service
            .from("machinery_payments")
            .select(
              "id, booking_id, amount, reference, vendor_settlement, manager_confirmed_at, collected_by_vendor_id, machinery_bookings(booking_number, vendor_id, farmers(full_name), machinery_bills(balance_payable)), machinery_vendors!machinery_payments_collected_by_vendor_id_fkey(vendor_name)"
            )
            .eq("method", "vendor_collected")
            .eq("verification_status", "manager_confirmed")
            .order("manager_confirmed_at")
        : Promise.resolve({ data: [] }),
      supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
    ]);

  const fuelPendingApproval = (fuelPendingRows ?? []).map((r) => {
    const booking = Array.isArray(r.machinery_bookings) ? r.machinery_bookings[0] : r.machinery_bookings;
    const farmer = booking ? (Array.isArray(booking.farmers) ? booking.farmers[0] : booking.farmers) : null;
    const vendor = booking ? (Array.isArray(booking.machinery_vendors) ? booking.machinery_vendors[0] : booking.machinery_vendors) : null;
    return {
      fuelId: r.id as string,
      bookingId: r.booking_id as string,
      bookingNumber: (booking?.booking_number as string) ?? "—",
      farmerName: (farmer?.full_name as string | null) ?? "—",
      vendorName: (vendor?.vendor_name as string | null) ?? "—",
      logDate: (r.manager_confirmed_at as string) ?? "",
      litres: r.litres === null ? null : Number(r.litres),
      amount: Number(r.amount),
      paidBy: r.paid_by as string,
      notes: r.notes as string | null,
      daysOld: null,
    };
  });

  const cashPendingApproval = (cashPendingRows ?? []).map((r) => {
    const booking = Array.isArray(r.machinery_bookings) ? r.machinery_bookings[0] : r.machinery_bookings;
    const farmer = booking ? (Array.isArray(booking.farmers) ? booking.farmers[0] : booking.farmers) : null;
    const bill = booking ? (Array.isArray(booking.machinery_bills) ? booking.machinery_bills[0] : booking.machinery_bills) : null;
    const vendor = Array.isArray(r.machinery_vendors) ? r.machinery_vendors[0] : r.machinery_vendors;
    return {
      paymentId: r.id as string,
      bookingId: r.booking_id as string,
      bookingNumber: (booking?.booking_number as string) ?? "—",
      farmerName: (farmer?.full_name as string | null) ?? "—",
      vendorName: (vendor?.vendor_name as string | null) ?? "—",
      amount: Number(r.amount ?? 0),
      paymentDate: (r.manager_confirmed_at as string) ?? "",
      settlement: (r.vendor_settlement as string | null) ?? null,
      reference: (r.reference as string | null) ?? null,
      billBalance: Number(bill?.balance_payable ?? 0),
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("fm_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("wcl_title", lang)}
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
          harvestType: (c.harvest_type as string | null) ?? null,
          sabit: c.sabit_area === null ? null : Number(c.sabit_area),
          kutra: c.kutra_area === null ? null : Number(c.kutra_area),
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
        fuelPendingApproval={fuelPendingApproval}
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
        cashPendingApproval={cashPendingApproval}
        accounts={accounts ?? []}
        canApprove={canApprove}
      />
    </div>
  );
}
