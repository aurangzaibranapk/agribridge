import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VendorDashboardClient } from "./vendor-dashboard-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

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
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vendor } = await supabase
    .from("machinery_vendors")
    .select("id, vendor_name, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vendor) redirect("/login");

  // Band vendor ko KHALI portal nahi milna chahiye (181).
  //
  // Pehle band vendor ko wohi dashboard milta tha, bas har adad sifar --
  // aur wo samajhta tha ke us ka kaam aur paisa system se gayab ho gaya.
  // Us ka record poora khara hai; bas us ka darwaza band hai, aur yehi
  // baat usay saaf batani chahiye.
  if (vendor.is_active === false) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-xl font-bold text-surface-900">{vendor.vendor_name}</h1>
        <p className="mt-1 text-sm text-surface-500">{t("v_portal", lang)}</p>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-800">{t("v_account_closed", lang)}</p>
          <p className="mt-2 text-xs text-amber-700">
            Aap ka poora record mehfooz hai — purana kaam, hisaab aur adaigiyan sab apni jagah hain. Dobara chalu
            karwane ke liye AgriBridge ke daftar se raabta karein.
          </p>
        </div>
      </div>
    );
  }

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
        .select("id, reached_farm_at, work_started_at, harvest_type, vendor_closing_at")
        .in("id", bookingIds)
    : { data: [] };

  const progressBy = new Map<
    string,
    { reached: string | null; started: string | null; harvestType: string | null; closingAt: string | null }
  >();
  (progressRows ?? []).forEach((p) =>
    progressBy.set(p.id as string, {
      reached: (p.reached_farm_at as string | null) ?? null,
      started: (p.work_started_at as string | null) ?? null,
      // Do qism ki booking par vendor bhi batwara likhta hai (176).
      harvestType: (p.harvest_type as string | null) ?? null,
      // Kaam ke baad ke do sawalon ka jawab de diya ya nahi (182).
      closingAt: (p.vendor_closing_at as string | null) ?? null,
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
      harvestType: (progressBy.get(r.booking_id as string)?.harvestType ?? null) as string | null,
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
      // Commission ka FISAD yahan se aage nahi jata (malik ka faisla).
      // Raqam upar "ART Commission" ke card mein alag dikhti hai; booking
      // ke card par commission ki koi lakeer nahi.
      commission: r.commission_amount === null ? null : Number(r.commission_amount),
      payable: r.vendor_payable === null ? null : Number(r.vendor_payable),
      // Kisan ka diesel pehle hi hisse se kat chuka hai; ART ka diesel
      // adaigi ke waqt kat-ta hai. Dono alag alag dikhte hain (170).
      farmerDiesel: Number(r.kisan_ka_diesel ?? 0),
      artDiesel: Number(r.art_ka_diesel ?? 0),
      paid: Number(r.vendor_ko_mila ?? 0),
      outstanding: Number(r.vendor_ka_baqi ?? 0),
      claimed: work.filter((w) => w.verification_status === "claimed").length,
      rejected: work.filter((w) => w.verification_status === "rejected"),
      verifiedArea: work
        .filter((w) => w.verification_status === "verified")
        .reduce((s, w) => s + Number(w.actual_area), 0),
      // Kaam KHATAM ho chuka -- chahe vendor ne darj kiya ho ya daftar
      // ne. Dobara final indraj nahi khulta: do final indraj verified ho
      // jayen to raqba do dafa gina jata aur bill do guna ban jata hai.
      workDone: work.some(
        (w) => w.is_final && (w.verification_status === "verified" || w.verification_status === "claimed")
      ),
      // Magar kaam band hone se wo do sawal khatam nahi hote jo sirf
      // vendor jaanta hai. Wo alag darwaze se poochhe jate hain (182).
      closingDone: (progressBy.get(r.booking_id as string)?.closingAt ?? null) !== null,
    };
  });

  const awaitingCheck = bookings.reduce((s, b) => s + b.claimed, 0);

  // Teen alag hisaab, ek hi jagah se -- wohi jo staff bhi dekhte hain.
  //
  // Vendor ke liye "baqi" ek adad nahi, teen alag baatein hain: jo
  // hamare paas jama hai, jo abhi kisan ke paas hai, aur jo mil chuka.
  // In ko jor kar ek adad dikhana wohi ghalti hai jis se jhagRa shuru
  // hota hai (172).
  const [
    { data: settlement },
    { data: work },
    { data: diesel },
    { data: week },
    { data: machines },
    { data: locations },
    { data: payments },
    { data: commissionRows },
  ] = await Promise.all([
    supabase.from("v_machinery_vendor_settlement").select("*").eq("vendor_id", vendor.id).maybeSingle(),
    supabase.from("v_machinery_vendor_work").select("*").eq("vendor_id", vendor.id).maybeSingle(),
    supabase.from("v_machinery_vendor_diesel").select("*").eq("vendor_id", vendor.id).maybeSingle(),
    supabase
      .from("v_machinery_vendor_week")
      .select("*")
      .eq("vendor_id", vendor.id)
      .order("preferred_date"),
    // Vendor ka apna view (191). Pehle yahan v_machinery_machines tha,
    // magar us ka aakhri lafz `where fn_is_any_staff()` hai -- vendor ke
    // haath mein wo sifar qatarein laata tha aur safha us "kuch nahi
    // mila" ko "koi machine nahi" samajh leta tha. Naye view mein ART ki
    // billing aur commission hai hi nahi.
    supabase.from("v_machinery_vendor_machines").select("*").eq("vendor_id", vendor.id).order("machine_code"),
    supabase.from("v_machinery_vendor_location").select("*").eq("vendor_id", vendor.id).order("pehli_tareekh", { nullsFirst: false }),
    supabase.from("v_machinery_vendor_payments").select("*").eq("vendor_id", vendor.id).order("tareekh", { ascending: false }),
    // Commission ki tafseel -- is view mein fisad ka khana hai hi nahi (179).
    supabase.from("v_machinery_vendor_commission").select("*").eq("vendor_id", vendor.id).order("tareekh", { ascending: false }),
  ]);

  const n = (v: unknown) => Number(v ?? 0);

  // Vendor ki apni khabrein (183). Machine rawana hoti hai to khabar
  // yahin aati hai -- WhatsApp ki chaabi lagi ho ya na lagi ho.
  const { data: alerts } = await supabase
    .from("notifications")
    .select("id, title, message, created_at, is_read")
    .eq("recipient_user_id", user.id)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <VendorDashboardClient
      alerts={(alerts ?? []).map((a) => ({
        id: a.id as string,
        title: (a.title as string) ?? "",
        message: (a.message as string | null) ?? "",
        at: (a.created_at as string) ?? "",
      }))}
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
      machines={(machines ?? []).map((m) => ({
        id: m.machine_id as string,
        code: (m.machine_code as string | null) ?? "-",
        type: (m.machine_type as string | null) ?? "-",
        model: (m.model as string | null) ?? null,
        status: (m.status as string | null) ?? "available",
        driverName: (m.driver_name as string | null) ?? null,
        seasonAcres: n(m.season_ke_acre),
        dieselLitres: n(m.diesel_litre),
        dieselAmount: n(m.diesel_raqam),
        runningBooking: (m.chal_rahi_booking as string | null) ?? null,
        runningFarmer: (m.chal_raha_kisan as string | null) ?? null,
        lastLat: m.last_location_lat === null ? null : Number(m.last_location_lat),
        lastLng: m.last_location_lng === null ? null : Number(m.last_location_lng),
      }))}
      locations={(locations ?? []).map((l) => ({
        jagah: (l.jagah as string) ?? "-",
        farmers: n(l.kitne_kisan),
        bookings: n(l.kitni_bookings),
        acres: n(l.kul_acre),
        firstDate: (l.pehli_tareekh as string | null) ?? null,
        lat: l.lat === null ? null : Number(l.lat),
        lng: l.lng === null ? null : Number(l.lng),
      }))}
      payments={(payments ?? []).map((p) => ({
        id: p.entry_id as string,
        settlementId: (p.settlement_id as string) ?? "-",
        date: (p.tareekh as string) ?? "-",
        bookingNumber: (p.booking_number as string | null) ?? null,
        farmerName: (p.farmer_name as string | null) ?? null,
        amount: n(p.raqam),
        dieselBack: n(p.diesel_wapas),
        cash: n(p.cash_mila),
        isReversal: Boolean(p.is_reversal),
      }))}
      commissionRows={(commissionRows ?? []).map((c) => ({
        bookingId: c.booking_id as string,
        bookingNumber: (c.booking_number as string) ?? "-",
        date: (c.tareekh as string | null) ?? (c.booking_date as string | null) ?? null,
        farmerName: (c.farmer_name as string | null) ?? "-",
        verifiedWork: n(c.tasdeeq_shuda_kaam),
        commission: n(c.art_commission),
      }))}
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
