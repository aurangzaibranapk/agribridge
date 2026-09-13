import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MachineryPageClient } from "./machinery-page-client";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

/**
 * Kisan ka machinery wala safha.
 *
 * Is file mein pehle ek TARJUME KI FEHRIST parhi hui thi -- wohi jo
 * src/lib/i18n/translations.ts mein hai. Safha yahan tha hi nahi, is
 * liye poora project build hi nahi hota tha: Next us folder mein page.tsx
 * dekhta hai aur us se `default` maangta hai, jo is fehrist mein tha
 * nahi. Repo ke pehle commit se yahi haal tha.
 *
 * Safha wapas banaya gaya hai, banaya nahi gaya se aage barh kar: doosre
 * hisse (machinery-page-client, machinery-form, MachineryChart) pehle se
 * poore mojood the aur theek the -- unhein bulane wala koi nahi tha.
 *
 * Kaam ka tareeqa: kisan apna khet chunta hai, us khet par jo fasal
 * likhi hai us ke saamne "ye machine chahiye" ka button aata hai, aur
 * dabane par neeche wala form khud bhar jata hai. Ye is liye ke kisan se
 * ye poochhna ke "kitne acre?" aksar andaze ka jawab laata hai, jabke
 * raqba pehle se us ke khet ke record mein maujood hai.
 */

// Kaun si fasal par kaun si machine. Ye fehrist jaan boojh kar chhoti
// hai: ye sirf pehla mashwara hai, form mein kisan ise badal sakta hai.
const MACHINE_FOR_CROP: Record<string, { value: string; label: string }> = {
  wheat: { value: "harvester", label: "Harvester" },
  gandum: { value: "harvester", label: "Harvester" },
  rice: { value: "harvester", label: "Harvester" },
  chawal: { value: "harvester", label: "Harvester" },
  maize: { value: "thresher", label: "Thresher" },
  makai: { value: "thresher", label: "Thresher" },
  cotton: { value: "rotavator", label: "Rotavator" },
  sugarcane: { value: "tractor", label: "Tractor" },
};

function machineFor(cropName: string) {
  return MACHINE_FOR_CROP[cropName.trim().toLowerCase()] ?? { value: "rotavator", label: "Rotavator" };
}

export default async function PortalMachineryPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");

  // Profile ka darwaza yahan jaan boojh kar NAHI hai. Machinery booking
  // wo pehla kaam hai jo naya kisan karna chahta hai; usay "pehle apni
  // profile mukammal karein" keh kar rok dena ka matlab hai ke wo phone
  // rakh de aur kisi aur se machine le le.
  const { data: farms } = await supabase
    .from("farms")
    .select("id, name, area_acres, latitude, longitude")
    .eq("farmer_id", farmer.id)
    .order("name");

  const farmIds = (farms ?? []).map((f) => f.id);
  const { data: crops } = farmIds.length
    ? await supabase
        .from("crop_history")
        .select("farm_id, crop_name, area_sown_acres")
        .in("farm_id", farmIds)
        .is("harvest_booked_at", null)
    : { data: [] };

  const farmData = (farms ?? []).map((f) => {
    const mine = (crops ?? []).filter((c) => c.farm_id === f.id);
    const sown = mine.reduce((sum, c) => sum + Number(c.area_sown_acres ?? 0), 0);
    const totalArea = Number(f.area_acres ?? 0);
    return {
      id: f.id,
      name: f.name,
      totalArea,
      crops: mine.map((c) => {
        const m = machineFor(c.crop_name ?? "");
        return {
          cropName: c.crop_name ?? "-",
          area: Number(c.area_sown_acres ?? 0),
          suggestedMachine: m.value,
          suggestedMachineLabel: m.label,
        };
      }),
      // Khali zameen kabhi manfi nahi dikhti: agar record mein fasal ka
      // raqba khet se zyada likha ho (aisa hota hai) to "-2 acre khali"
      // likhna sirf uljhan paida karta hai.
      khaliZameen: Math.max(0, totalArea - sown),
      // Khet ki jagah pehle se maujood ho to booking par dobara nahi
      // maangi jati -- yehi is poore rishte ka faida hai.
      hasLocation: f.latitude !== null && f.longitude !== null,
    };
  });

  // Kisan ki apni bookings ki live haalat.
  //
  // Ye jaan boojh kar us ke apne safhe par hai: farmaish bhejne ke baad
  // kisan ka agla sawal hamesha "ab kya ho raha hai?" hota hai, aur us
  // ka jawab abhi tak sirf phone kar ke milta tha. Adad wohi hain jo
  // hisaab mein hain -- yahan dobara ginti nahi ki gayi.
  const { data: bookings } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, status, booking_date, crop_type, harvest_area, final_rate")
    .eq("farmer_id", farmer.id)
    .order("booking_date", { ascending: false })
    .limit(10);

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const [{ data: bills }, { data: pays }] = bookingIds.length
    ? await Promise.all([
        supabase
          .from("machinery_bills")
          .select("booking_id, bill_number, gross_amount, discount_amount, advance_adjusted, balance_payable")
          .in("booking_id", bookingIds)
          .is("cancelled_at", null),
        supabase
          .from("machinery_payments")
          .select("booking_id, kind, amount, verification_status")
          .in("booking_id", bookingIds),
      ])
    : [{ data: [] }, { data: [] }];

  const bookingRows = (bookings ?? []).map((b) => {
    const bill = (bills ?? []).find((x) => x.booking_id === b.id) ?? null;
    const mine = (pays ?? []).filter((p) => p.booking_id === b.id);
    const paid = mine
      .filter((p) => p.kind === "final" && p.verification_status === "verified")
      .reduce((s, p) => s + Number(p.amount), 0);
    const advanceVerified = mine
      .filter((p) => p.kind === "advance" && p.verification_status === "verified")
      .reduce((s, p) => s + Number(p.amount), 0);
    // Dawa alag rakha jata hai. Kisan ko ye dikhana zaroori hai --
    // warna wo samajhta hai ke us ka paisa gum ho gaya -- magar use
    // baqi mein se ghataya NAHI jata, kyunke tasdeeq abhi baqi hai.
    const advanceClaimed = mine
      .filter((p) => p.kind === "advance" && p.verification_status === "claimed")
      .reduce((s, p) => s + Number(p.amount), 0);
    return {
      id: b.id,
      bookingNumber: b.booking_number,
      status: b.status,
      bookingDate: b.booking_date,
      cropType: b.crop_type,
      area: Number(b.harvest_area ?? 0),
      rate: b.final_rate === null ? null : Number(b.final_rate),
      billNumber: bill?.bill_number ?? null,
      gross: bill ? Number(bill.gross_amount) : null,
      balance: bill ? Math.max(Number(bill.balance_payable) - paid, 0) : null,
      paid,
      advanceVerified,
      advanceClaimed,
    };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        ← {t("back_to_dashboard", lang)}
      </Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">{t("machinery_title", lang)}</h1>
      <p className="mt-1 text-sm text-surface-500">{t("machinery_subtitle", lang)}</p>
      {bookingRows.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 font-display text-sm font-semibold text-surface-900">
            {t("my_bookings_heading", lang)}
          </h2>
          <div className="space-y-2">
            {bookingRows.map((b) => (
              <BookingStatusCard key={b.id} booking={b} lang={lang} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <MachineryPageClient farms={farmData} />
      </div>
    </div>
  );
}

// Kisan ki zabaan mein halat. Andar ke naam (bill_pending waghera)
// system ke liye hain, kisan ke liye nahi.
const FARMER_STATUS: Record<string, Parameters<typeof t>[0]> = {
  new: "farmer_status_new",
  ready_for_harvest: "farmer_status_scheduled",
  in_progress: "farmer_status_working",
  bill_pending: "farmer_status_bill_making",
  payment_pending: "farmer_status_payment_due",
  closed: "farmer_status_closed",
  cancelled: "farmer_status_cancelled",
};

function BookingStatusCard({
  booking,
  lang,
}: {
  booking: {
    bookingNumber: string;
    status: string;
    bookingDate: string;
    cropType: string | null;
    area: number;
    rate: number | null;
    billNumber: string | null;
    gross: number | null;
    balance: number | null;
    paid: number;
    advanceVerified: number;
    advanceClaimed: number;
  };
  lang: ReturnType<typeof getLanguageFromCookies>;
}) {
  const statusKey = FARMER_STATUS[booking.status] ?? "farmer_status_new";
  return (
    <div className="rounded-card border border-surface-200 bg-white p-3 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-surface-400">{booking.bookingNumber}</p>
          <p className="text-sm font-medium text-surface-900">
            {booking.cropType ?? "-"} · {booking.area} {t("acres_unit", lang)}
          </p>
          <p className="text-xs text-surface-500">{booking.bookingDate}</p>
        </div>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          {t(statusKey, lang)}
        </span>
      </div>

      {booking.rate !== null && (
        <p className="mt-2 text-xs text-surface-600">
          {t("rate_label_portal", lang)}: Rs {booking.rate.toLocaleString()} / {t("acres_unit", lang)}
        </p>
      )}

      {booking.gross !== null && (
        <div className="mt-2 space-y-0.5 border-t border-surface-100 pt-2 text-sm">
          <Row label={t("bill_label_portal", lang)} value={booking.gross} />
          {booking.advanceVerified > 0 && (
            <Row label={t("advance_label_portal", lang)} value={-booking.advanceVerified} />
          )}
          {booking.paid > 0 && <Row label={t("paid_label_portal", lang)} value={-booking.paid} />}
          <div className="flex justify-between border-t border-surface-100 pt-1 font-semibold">
            <span>{t("outstanding_label_portal", lang)}</span>
            <span className={(booking.balance ?? 0) > 0 ? "text-red-600" : "text-brand-700"}>
              Rs {(booking.balance ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {booking.advanceClaimed > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
          {t("advance_claim_waiting", lang)}: Rs {booking.advanceClaimed.toLocaleString()}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  // Manfi sifar ko sifar likha jaye: kharche wali lakeerein `value={-x}`
  // bhejti hain, aur x sifar ho to JavaScript mein `-0` banta hai. `-0 < 0`
  // GHALAT hai, is liye neeche wali shart usay manfi nahi samajhti aur
  // seedha "-0" chhaap deti hai. Paise ke safhe par "Rs -0" parh kar banda
  // rukta hai aur sochta hai kya cheez manfi hai. Kuch bhi nahi.
  const v = value === 0 ? 0 : value;
  return (
    <div className="flex justify-between text-surface-600">
      <span>{label}</span>
      <span>{v < 0 ? `- Rs ${Math.abs(v).toLocaleString()}` : `Rs ${v.toLocaleString()}`}</span>
    </div>
  );
}
