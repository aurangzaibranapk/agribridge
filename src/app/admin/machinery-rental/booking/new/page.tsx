import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader } from "@/components/ui/layout-primitives";
import { NewBookingForm } from "./new-booking-form";
import { BackButton } from "@/components/ui/back-button";

export const dynamic = "force-dynamic";

export default async function NewMachineryBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ convert_farmer?: string; convert_request?: string; convert_acres?: string; convert_location?: string; preferred_date?: string }>;
}) {
  const lang = getLanguageFromCookies("rm");
  const params = await searchParams;
  const supabase = createClient();

  const [{ data: farmers }, { data: accounts }, { data: bills }, { data: payments }] =
    await Promise.all([
      supabase
        .from("farmers")
        .select("id, full_name, farmer_code, phone_number, cnic, district, village")
        .eq("is_deleted", false)
        .order("full_name"),
      supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
      supabase.from("machinery_bills").select("booking_id, balance_payable").is("cancelled_at", null),
      supabase.from("machinery_payments").select("booking_id, amount, kind"),
    ]);

  // Fasl ki fehrist ab database se (174) -- code mein teen jagah likhi
  // hui fehrist ek jagah badal kar baqi do jagah purani reh jati thi.
  const { data: crops } = await supabase
    .from("crops")
    .select("key, label, label_en, label_ur")
    .eq("is_active", true)
    .order("sort_order");

  // Default rate ki fehrist (177). Ye sirf khana bharti hai -- rate ka
  // malik booking hai, aur staff wahan jo marzi likhe.
  const { data: rateCards } = await supabase
    .from("machinery_rate_cards")
    .select("id, crop_key, machine_type, harvest_type, rate, effective_from, is_active")
    .eq("is_active", true);

  // Agle 30 din ki gunjaish (180). Yahi wo sawal hai jo booking lete
  // waqt sab se pehle poochha jata hai: "is din jagah hai?" Pehle us ka
  // jawab tab milta tha jab form bhar chuka hota aur guard rok deta.
  //
  // Adad wohi view se aata hai jis par planner khara hai -- yahan
  // dobara nahi gina jata.
  const { data: capacityRows } = await supabase
    .from("v_machinery_capacity_day")
    .select("tareekh, hadd, bandha_hua");

  const capByDate = new Map<string, { capacity: number; booked: number }>();
  (capacityRows ?? []).forEach((r) => {
    const key = r.tareekh as string;
    const cur = capByDate.get(key) ?? { capacity: 0, booked: 0 };
    cur.capacity += Number(r.hadd ?? 0);
    cur.booked += Number(r.bandha_hua ?? 0);
    capByDate.set(key, cur);
  });

  // Kisan ka pichla machinery hisaab. Ye jaan boojh kar "machinery ka
  // baqi" hai, kisan ka poora khata nahi -- yahan staff ko wohi cheez
  // chahiye jo isi kaam se juRi hai, aur mila-jula number dikhana in
  // dono ko aik samajh lene ki wajah ban jata hai.
  const { data: bookingRows } = await supabase.from("machinery_bookings").select("id, farmer_id, status");

  const finalPaidByBooking = new Map<string, number>();
  (payments ?? [])
    .filter((p) => p.kind === "final")
    .forEach((p) => finalPaidByBooking.set(p.booking_id, (finalPaidByBooking.get(p.booking_id) ?? 0) + Number(p.amount)));

  const balanceByBooking = new Map<string, number>();
  (bills ?? []).forEach((b) =>
    balanceByBooking.set(b.booking_id, Number(b.balance_payable) - (finalPaidByBooking.get(b.booking_id) ?? 0))
  );

  const history = new Map<string, { bookings: number; outstanding: number }>();
  (bookingRows ?? []).forEach((b) => {
    const entry = history.get(b.farmer_id) ?? { bookings: 0, outstanding: 0 };
    entry.bookings += 1;
    entry.outstanding += Math.max(0, balanceByBooking.get(b.id) ?? 0);
    history.set(b.farmer_id, entry);
  });

  // Paisa lene wale ka naam form par pehle se dikhta hai. Baad mein
  // record se pata chal jana kaafi nahi -- jo banda cash pakaR raha hai
  // usay usi waqt nazar aana chahiye ke ye us ke naam par likha ja raha
  // hai.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  // Adhoora kaghaz (163). Ye khud nahi bhara jata -- form pehle
  // poochhta hai. Naya banane aaye bande par purani booking chup chaap
  // bhar dena us se ghalat booking banwa deta hai.
  //
  // Kisan ki farmaish se aayi hui booking par draft nahi poochha
  // jata: wo booking pehle se apna kisan aur raqba le kar aati hai,
  // aur us par purana kaghaz rakhna sirf ghalat fehmi hai.
  const { data: draftRow } = user && !params.convert_request
    ? await supabase.from("machinery_booking_drafts").select("payload").eq("user_id", user.id).maybeSingle()
    : { data: null };

  return (
    <div>
      <BackButton fallback="/admin/machinery-rental" label={t("mc_back", lang)} />
      <PageHeader
        title={t("mc_new_booking_title", lang)}
        description={t("mc_new_booking_note", lang)}
      />
      <NewBookingForm
        farmers={(farmers ?? []).map((f) => ({
          id: f.id,
          full_name: f.full_name ?? "",
          farmer_code: f.farmer_code ?? "",
          phone_number: f.phone_number ?? "",
          cnic: f.cnic ?? "",
          district: f.district ?? "",
          village: f.village ?? "",
          previous_bookings: history.get(f.id)?.bookings ?? 0,
          outstanding: history.get(f.id)?.outstanding ?? 0,
        }))}
        accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.name, account_type: a.account_type }))}
        capacity={[...capByDate.entries()]
          .map(([date, v]) => ({
            date,
            capacity: Math.round(v.capacity * 100) / 100,
            booked: Math.round(v.booked * 100) / 100,
            free: Math.round(Math.max(v.capacity - v.booked, 0) * 100) / 100,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))}
        rateCards={(rateCards ?? []).map((c) => ({
          id: c.id,
          crop_key: c.crop_key,
          machine_type: c.machine_type,
          harvest_type: c.harvest_type as "sabit" | "kutra",
          rate: Number(c.rate),
          effective_from: c.effective_from,
          is_active: c.is_active,
        }))}
        crops={(crops ?? []).map((c) => ({
          key: c.key,
          label: lang === "en" ? c.label_en || c.label : lang === "ur" ? c.label_ur || c.label : c.label,
        }))}
        staffName={me?.full_name ?? null}
        defaultFarmerId={params.convert_farmer}
        defaultRequestId={params.convert_request}
        defaultAcres={params.convert_acres}
        defaultLocation={params.convert_location ? decodeURIComponent(params.convert_location) : undefined}
        defaultDate={params.preferred_date}
        draft={(draftRow?.payload as never) ?? null}
      />
    </div>
  );
}
