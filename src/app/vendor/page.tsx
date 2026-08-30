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

  // "Khet pahunch gaya" aur "kaam shuru" -- ye sirf khabar hain, paise
  // se koi taalluq nahi. Is liye ye khaate wali qatar mein nahi, seedha
  // booking se aate hain.
  const { data: progressRows } = bookingIds.length
    ? await supabase
        .from("machinery_bookings")
        .select("id, reached_farm_at, work_started_at")
        .in("id", bookingIds)
    : { data: [] };

  const progressBy = new Map<string, { reached: string | null; started: string | null }>();
  (progressRows ?? []).forEach((p) =>
    progressBy.set(p.id as string, {
      reached: (p.reached_farm_at as string | null) ?? null,
      started: (p.work_started_at as string | null) ?? null,
    })
  );

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
      reachedAt: (progressBy.get(r.booking_id as string)?.reached ?? null) as string | null,
      startedAt: (progressBy.get(r.booking_id as string)?.started ?? null) as string | null,

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

  const awaitingCheck = bookings.reduce((s, b) => s + b.claimed, 0);

  // Teen alag hisaab, ek hi jagah se -- wohi jo staff bhi dekhte hain.
  //
  // Vendor ke liye "baqi" ek adad nahi, teen alag baatein hain: jo
  // hamare paas jama hai, jo abhi kisan ke paas hai, aur jo mil chuka.
  // In ko jor kar ek adad dikhana wohi ghalti hai jis se jhagRa shuru
  // hota hai (172).
  const [{ data: settlement }, { data: work }, { data: diesel }, { data: week }] = await Promise.all([
    supabase.from("v_machinery_vendor_settlement").select("*").eq("vendor_id", vendor.id).maybeSingle(),
    supabase.from("v_machinery_vendor_work").select("*").eq("vendor_id", vendor.id).maybeSingle(),
    supabase.from("v_machinery_vendor_diesel").select("*").eq("vendor_id", vendor.id).maybeSingle(),
    supabase
      .from("v_machinery_vendor_week")
      .select("*")
      .eq("vendor_id", vendor.id)
      .order("preferred_date"),
  ]);

  const n = (v: unknown) => Number(v ?? 0);

  return (
    <VendorDashboardClient
      vendorName={vendor.vendor_name}
      awaitingCheck={awaitingCheck}
      money={{
        earned: n(settlement?.kul_hissa),
        received: n(settlement?.kul_mila),
        withArt: n(settlement?.art_ke_paas_jama),
        withFarmer: n(settlement?.kisan_ke_paas),
        dieselAdvance: n(settlement?.art_diesel_advance),
        netNow: n(settlement?.net_abhi_dena),
        commission: n(settlement?.kul_commission),
        farmerDiesel: n(settlement?.kul_kisan_diesel),
      }}
      work={{
        bookings: n(work?.kitni_bookings),
        booked: n(work?.book_hue_acre),
        done: n(work?.mukammal_acre),
        running: n(work?.chal_rahe_acre),
        pending: n(work?.baqi_acre),
        next7: n(work?.agle_7_din_acre),
      }}
      diesel={{
        litres: n(diesel?.kul_litre),
        amount: n(diesel?.kul_raqam),
        byVendor: n(diesel?.vendor_ne_diya),
        byFarmer: n(diesel?.kisan_ne_diya),
        byArt: n(diesel?.art_ne_diya),
      }}
      week={(week ?? []).map((w) => ({
        bookingId: w.booking_id as string,
        bookingNumber: (w.booking_number as string) ?? "-",
        date: (w.preferred_date as string | null) ?? null,
        time: (w.preferred_time as string | null) ?? null,
        farmerName: (w.farmer_name as string | null) ?? "-",
        farmerPhone: (w.farmer_phone as string | null) ?? null,
        area: n(w.harvest_area),
        done: n(w.ho_chuka),
        cropType: (w.crop_type as string | null) ?? null,
        village: (w.village as string | null) ?? null,
        address: (w.location_address as string | null) ?? null,
        lat: w.location_lat === null ? null : Number(w.location_lat),
        lng: w.location_lng === null ? null : Number(w.location_lng),
        machineLabel: w.machine_type
          ? `${w.machine_type}${w.machine_model ? ` (${w.machine_model})` : ""}`
          : null,
      }))}
      bookings={bookings}
    />
  );
}
