import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VendorDashboardClient } from "./vendor-dashboard-client";

export const dynamic = "force-dynamic";

/**
 * Vendor ka apna safha.
 *
 * Do cheezein yahan hain aur teesri jaan boojh kar nahi.
 *
 * Hain: apna khata (kis booking par kitna bana, commission kitna kata,
 * kitna mil chuka, kitna baqi), aur kaam bhejne ka raasta.
 *
 * Nahi hai: kisan ka bill, kisan ki payment, doosre vendors ka kaam.
 * Vendor hamara mulazim nahi -- wo doosri taraf ka bandobast hai. Us ko
 * kisan ke paise ka hisaab dikhana us maamle mein daakhil kar dena hai
 * jo us ka hai hi nahi.
 */
export default async function VendorPortalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vendor } = await supabase
    .from("machinery_vendors")
    .select("id, vendor_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vendor) redirect("/login");

  // Khata view se -- wahan commission aur baqi ka hisaab ek hi jagah
  // hota hai, aur wohi hisaab staff bhi dekhta hai. Do jagah do hisaab
  // banane ka matlab hota kisi din do mukhtalif adad.
  const { data: ledger } = await supabase
    .from("v_machinery_vendor_ledger")
    .select("*")
    .eq("vendor_id", vendor.id)
    .order("booking_date", { ascending: false })
    .limit(60);

  const rows = ledger ?? [];
  const bookingIds = rows.map((r) => r.booking_id as string);

  // Jo kaam is vendor ne bheja aur abhi tasdeeq ke intezar mein hai --
  // vendor ko ye saaf dikhna chahiye, warna wo samajhta hai ke us ka
  // indraj gaya hi nahi aur dobara bhejta hai.
  const { data: myWork } = bookingIds.length
    ? await supabase
        .from("machinery_work_records")
        .select("id, booking_id, work_date, actual_area, verification_status, rejection_reason, is_final")
        .in("booking_id", bookingIds)
        .order("work_date", { ascending: false })
    : { data: [] };

  // Diesel aur kisan se li hui raqam bhi wahi haal: vendor ko apna
  // bheja hua indraj dikhna chahiye. Warna wo samajhta hai ke gaya
  // hi nahi aur dobara bhejta hai -- aur ek hi cheez do dafa qatar
  // mein aa jati hai.
  const [{ data: myFuel }, { data: myCollections }] = bookingIds.length
    ? await Promise.all([
        supabase
          .from("machinery_fuel_logs")
          .select("id, booking_id, log_date, litres, amount, paid_by, verification_status, rejection_reason")
          .in("booking_id", bookingIds)
          .order("log_date", { ascending: false }),
        supabase
          .from("machinery_payments")
          .select("id, booking_id, amount, payment_date, vendor_settlement, verification_status, rejection_reason")
          .eq("method", "vendor_collected")
          .in("booking_id", bookingIds)
          .order("payment_date", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const bookings = rows.map((r) => {
    const work = (myWork ?? []).filter((w) => w.booking_id === r.booking_id);
    const fuel = (myFuel ?? []).filter((x) => x.booking_id === r.booking_id);
    const collections = (myCollections ?? []).filter((x) => x.booking_id === r.booking_id);
    return {
      id: r.booking_id as string,
      bookingNumber: r.booking_number as string,
      status: r.status as string,
      bookingDate: r.booking_date as string,
      farmerName: (r.farmer_name as string | null) ?? "-",
      farmerPhone: (r.farmer_phone as string | null) ?? null,

      // Kaam se pehle ki tafseel -- yahi wo cheez hai jis ke liye
      // vendor subah safha kholta hai.
      harvestDate: (r.preferred_date as string | null) ?? null,
      harvestTime: (r.preferred_time as string | null) ?? null,
      cropType: (r.crop_type as string | null) ?? null,
      bookedArea: r.harvest_area === null ? null : Number(r.harvest_area),
      finalRate: r.final_rate === null ? null : Number(r.final_rate),
      rateFinal: (r.rate_status as string) === "final",
      locationAddress: (r.location_address as string | null) ?? null,
      village: (r.village as string | null) ?? null,
      lat: r.location_lat === null ? null : Number(r.location_lat),
      lng: r.location_lng === null ? null : Number(r.location_lng),
      machineLabel: r.machine_type
        ? `${r.machine_type}${r.machine_model ? ` (${r.machine_model})` : ""}`
        : null,

      fuelClaimed: fuel.filter((x) => x.verification_status === "claimed").length,
      fuelRejected: fuel
        .filter((x) => x.verification_status === "rejected")
        .map((x) => ({ id: x.id as string, rejection_reason: (x.rejection_reason as string | null) ?? null })),
      collections: collections.map((x) => ({
        id: x.id as string,
        amount: Number(x.amount ?? 0),
        date: x.payment_date as string,
        settlement: (x.vendor_settlement as string | null) ?? null,
        status: x.verification_status as string,
        reason: (x.rejection_reason as string | null) ?? null,
      })),
      billNumber: (r.bill_number as string | null) ?? null,
      area: r.actual_area === null ? null : Number(r.actual_area),
      rate: r.rate_amount === null ? null : Number(r.rate_amount),
      gross: r.gross_amount === null ? null : Number(r.gross_amount),
      commissionPct: r.commission_percentage === null ? null : Number(r.commission_percentage),
      commission: r.commission_amount === null ? null : Number(r.commission_amount),
      payable: r.vendor_payable === null ? null : Number(r.vendor_payable),
      paid: Number(r.vendor_ko_mila ?? 0),
      outstanding: Number(r.vendor_ka_baqi ?? 0),
      claimed: work.filter((w) => w.verification_status === "claimed").length,
      rejected: work.filter((w) => w.verification_status === "rejected"),
      verifiedArea: work
        .filter((w) => w.verification_status === "verified")
        .reduce((s, w) => s + Number(w.actual_area), 0),
      workDone: work.some((w) => w.verification_status === "verified" && w.is_final),
    };
  });

  const totalOutstanding = bookings.reduce((s, b) => s + b.outstanding, 0);
  const totalEarned = bookings.reduce((s, b) => s + (b.payable ?? 0), 0);
  const awaitingCheck = bookings.reduce((s, b) => s + b.claimed, 0);

  return (
    <VendorDashboardClient
      vendorName={vendor.vendor_name}
      totalOutstanding={totalOutstanding}
      totalEarned={totalEarned}
      awaitingCheck={awaitingCheck}
      bookings={bookings}
    />
  );
}
