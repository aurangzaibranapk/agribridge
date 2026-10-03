Warning: truncated output (original token count: 46039)
Total output lines: 4626

"use server";
import { revalidatePath } from "next/cache";
import { aajKaKhana } from "@/lib/utils/format";
import { sendPaymentReminder } from "@/lib/machinery/payment-reminder";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import { alreadyRegisteredMessage, findFarmerByPhone } from "@/lib/farmers/identity";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyRoles, notifyUser } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { recordError } from "@/lib/errors/record";
import { sendWhatsAppMessage } from "@/lib/whatsapp-client";
import { pickDefaultRate } from "@/lib/machinery/rate-card";
import { reverseJournal } from "@/lib/ledger/post";
import { cashBookLikhein } from "@/lib/ledger/cash-book";
import {
  postMachineryAdvance,
  postMachineryBill,
  postMachineryPayment,
  postMachineryVendorCollected,
  postVendorCashHandover,
  postMachineryVendorPayout,
  postCashOut,
  ACC,
  failed,
} from "@/lib/ledger/rules";

/**
 * Machinery: booking se paisay tak ek zanjeer.
 *
 *   Booking -> Advance -> Kisan ki Tasdeeq -> Machine Rawangi ->
 *   Asal Kaam -> Final Bill -> Advance Adjustment -> Final Payment
 *
 * Har kari apni qatar mein likhi jati hai aur har qadam timeline
 * (machinery_booking_events) mein. Rok DB mein lagi hui hai (migration
 * 116) -- yahan wahi rok dohrayi nahi gayi, kyunki do jagah likhi hui
 * shart aik din alag alag ho jati hai. Yahan sirf ye hai ke kaam kis
 * tarteeb se hota hai aur us ka ledger kaisa banta hai.
 *
 * NOTE: "use server" file sirf async functions export kar sakti hai.
 * Is liye har madadgaar cheez yahan andar hi rehti hai.
 */

export interface ActionState {
  error?: string;
  success?: boolean;
  notice?: string;
  bookingId?: string;
  bookingNumber?: string;
  billNumber?: string;
  farmerId?: string;
  farmerCode?: string;
  farmerName?: string;
  /** Machine us din bhari ho to agli khali tareekh -- taake safha wo
      tareekh khud bhar sake, bande ko haath se likhna na pare. */
  nextFreeDate?: string;
}

type Client = ReturnType<typeof createClient>;

/**
 * Haan / nahi / abhi pata nahi.
 *
 * Teesri soorat waqai hoti hai -- booking aksar hafta pehle hoti hai
 * aur kisan ne abhi socha hi nahi. Usay "nahi" likh dena jhoot hai,
 * aur usi jhoot par aage report banti hai.
 */
function tribool(formData: FormData, key: string): boolean | null {
  const v = formData.get(key);
  if (v === "yes" || v === "on" || v === "true") return true;
  if (v === "no" || v === "false") return false;
  return null;
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

/** Acre + kanal -> acre. 1 acre = 8 kanal. */
function toAcres(acres: number | null, kanal: number | null): number {
  return (acres ?? 0) + (kanal ?? 0) / 8;
}

async function currentUserId(supabase: Client): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Timeline par ek qadam likho.
 *
 * Ye kabhi poora kaam nahi rokti: agar timeline likhne mein masla ho to
 * bhi asal kaam (booking, payment) wapas nahi lauta. Wajah ye ke gawahi
 * ka na likha jana bura hai, magar paisa darj hi na hona us se bura.
 */
async function logEvent(args: {
  bookingId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  evidenceUrl?: string | null;
  actorId: string | null;
}): Promise<void> {
  const service = createServiceClient();
  await service.from("machinery_booking_events").insert({
    booking_id: args.bookingId,
    event_type: args.eventType,
    from_status: args.fromStatus ?? null,
    to_status: args.toStatus ?? null,
    note: args.note ?? null,
    evidence_url: args.evidenceUrl ?? null,
    actor_id: args.actorId,
  });
}

/**
 * Agla booking number.
 *
 * Counter usi bande ke apne connection se barhta hai, is liye jise
 * booking banane ki ijazat hai usay counter par likhne ka haq bhi hai
 * (migration 116). Warna number aage na barhta aur agli booking wahi
 * number maangti.
 */
/**
 * Number ab DATABASE ke andar banta hai (311).
 *
 * Pehle ye yahin banta tha: pehle counter parho, phir ek barha kar likho.
 * Us mein do kharabiyan thin, aur dono chup thin --
 *
 *   1. `machinery_receipt_counters` par se authenticated ki ijazat le li
 *      gayi thi (171). Bande ke apne client se us table ko parhne par
 *      KHALI jawab aata tha -- ghalti nahi, khali. Code us khali ko
 *      "abhi koi raseed nahi bani" samajhta tha aur har dafa number 1
 *      banata tha; likhne ki koshish bhi chup chaap nakaam hoti thi.
 *      Nateeja: pehli adaigi ke baad HAR adaigi ruk gayi --
 *      "duplicate key ... uq_machinery_payment_receipt" (malik ne 5
 *      September ko pakRa: Rs 24,000 ki adaigi darj hi nahi ho rahi thi).
 *
 *   2. Parhne aur likhne ke darmiyan ka waqfa. Do bande ek hi lamhe mein
 *      adaigi darj karte to dono ko wohi number milta.
 *
 * Ab dono khatam: function SECURITY DEFINER hai (ijazat ka masla nahi),
 * aur number ek hi hukm mein barhta hai (waqfa nahi). Nakami ab chhupti
 * bhi nahi -- yahan se ghalti bulane wale tak jati hai.
 */
async function nextNumber(supabase: Client, kind: "booking" | "bill" | "receipt"): Promise<string> {
  const { data, error } = await supabase.rpc("fn_next_machinery_number", { p_kind: kind });
  if (error || !data) {
    // Yehi wo jagah hai jahan 5 September ko adaigi ruk gayi thi:
    // counter par ijazat nahi thi, is liye har raseed ka number wohi
    // purana bana aur `uq_machinery_payment_receipt` ne rok diya. Us
    // waqt wajah kisi safhe par nazar nahi aati thi -- ab aati hai (320).
    await recordError({
      module: "machinery",
      severity: "rukawat",
      message: `Machinery ka number nahi ban saka (${kind})`,
      route: "/admin/machinery-rental",
      detail: error?.message ?? "RPC ne khali jawab diya",
    });
    throw new Error(`Number nahi ban saka (${kind}): ${error?.message ?? "maloom nahi"}`);
  }
  return data as string;
}

function revalidateAll(bookingId?: string) {
  revalidatePath("/admin/machinery-rental");
  revalidatePath("/admin/machinery-rental/list");
  revalidatePath("/admin/machinery-rental/dashboard");
  if (bookingId) revalidatePath(`/admin/machinery-rental/booking/${bookingId}`);
}

// =====================================================================
// 1. Booking
// =====================================================================
/**
 * Nayi booking.
 *
 * Booking ke waqt machine aur rate dono TAY KARNA ZAROORI NAHI. Us waqt
 * pata hi nahi hota kaunsi machine faarigh hogi, aur rate aksar kattai
 * ke qareeb tay hota hai. Lazmi khana banane ka natija sirf ye hota hai
 * ke staff koi bhi number bhar deta hai -- aur wo number aage chal kar
 * bill ban jata hai.
 *
 * Is liye yahan jo rate liya jata hai wo `estimated_rate` hai, aur us ka
 * darja `estimated`. Bill kabhi is se nahi banta.
 */

/**
 * Kisan ko booking ki raseed WhatsApp par.
 *
 * Ye khud kuch nahi rokta. Paighaam na jaye to booking bani rehti hai aur
 * paisa darj rehta hai -- timeline mein likh diya jata hai ke nahi gaya,
 * taake staff phone kar sake. Ulta karna (paighaam na jane par booking
 * rok dena) us paise ko gum kar deta jo counter par pehle hi liya ja
 * chuka hai.
 */
async function notifyFarmerBookingCreated(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  bookingNumber: string,
  farmerId: string,
  actorId: string | null
) {
  const [{ data: farmer }, { data: advanceRows }] = await Promise.all([
    supabase.from("farmers").select("full_name, phone_number").eq("id", farmerId).maybeSingle(),
    supabase.from("machinery_payments").select("amount").eq("booking_id", bookingId).eq("kind", "advance"),
  ]);

  const advanceTotal = (advanceRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  const message = [
    `Assalam-o-Alaikum ${farmer?.full_name ?? ""} Sahib,`,
    ``,
    `Aapki Machinery Booking ${bookingNumber} register ho gayi hai.`,
    advanceTotal > 0 ? `Advance Received: Rs ${advanceTotal.toLocaleString()}` : null,
    ``,
    // Rate ka zikr yahan jaan boojh kar nahi hai. Booking ke waqt rate tay
    // nahi hota; koi number likh dena us ko tay shuda bana deta hai aur
    // baad mein asal rate par jhagRa khaRa hota hai.
    `Rate kaam se pehle aap ko alag se bheja jayega, aur aap ke confirm karne ke baad hi bill us par banega.`,
    `Al Rana Traders`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!farmer?.phone_number) {
    await logEvent({ bookingId, eventType: "farmer_notified", note: "Kisan ka phone number nahi hai — raseed nahi ja saki", actorId });
    return;
  }

  try {
    await sendWhatsAppMessage(farmer.phone_number, message);
    await logEvent({ bookingId, eventType: "farmer_notified", note: "Booking ki raseed WhatsApp par bheji gayi", actorId });
  } catch {
    await logEvent({ bookingId, eventType: "farmer_notified", note: "Raseed WhatsApp par nahi ja saki — kisan ko khud ittila dein", actorId });
  }
}

export async function createBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);

  const farmerId = str(formData, "farmer_id");
  if (!farmerId) return { error: "Farmer select karein." };

  const harvestAcres = num(formData, "harvest_area_acres");
  const harvestKanal = num(formData, "harvest_area_kanal");
  if (toAcres(harvestAcres, harvestKanal) <= 0) {
    return { error: "Kattai ka raqba likhein (acre ya kanal)." };
  }

  const machineType = str(formData, "machine_type_requested");
  if (!machineType) return { error: "Machine ki qism likhein." };

  // Kattai ki qism (176). Ek khet mein dono kaam ho sakte hain: kuch
  // acre ki parali sabit chhoRni hai, kuch ka kutra karna hai -- aur
  // dono ka rate alag hota hai.
  //
  // Jor ki jaanch database mein bhi lagi hui hai. Yahan dobara isliye
  // hai ke staff ko wahin, form par, saaf jawab mile -- na ke bhare
  // hue form ke baad ek database ka paigham.
  const harvestType = str(formData, "harvest_type") ?? "sabit";
  if (!["sabit", "kutra", "dono"].includes(harvestType)) {
    return { error: "Kattai ki qism theek chunein." };
  }
  const totalArea = toAcres(harvestAcres, harvestKanal);
  let sabitArea: number | null = null;
  let kutraArea: number | null = null;
  if (harvestType === "dono") {
    sabitArea = num(formData, "sabit_area");
    kutraArea = num(formData, "kutra_area");
    if (!sabitArea || sabitArea <= 0 || !kutraArea || kutraArea <= 0) {
      return { error: "Dono qism chuni hai to Sabit aur Kutra, dono ka raqba likhein." };
    }
    if (Math.round((sabitArea + kutraArea) * 10000) !== Math.round(totalArea * 10000)) {
      return {
        error: `Sabit (${sabitArea}) aur Kutra (${kutraArea}) ka jor ${sabitArea + kutraArea} banta hai, kul raqba ${totalArea} acre hai. Dono barabar hone chahiye.`,
      };
    }
  }

  // Do sawal jo kisan ke apne form par poochhe jate hain: fasal hamein
  // bechega? aur agli fasal par yaad dilayein? Kisan ki farmaish se
  // booking bane to jawab wahin se aata hai -- dobara nahi poochha
  // jata. Staff seedhi booking banaye to form par se.
  const requestIdIn = str(formData, "request_id");
  let willSell = tribool(formData, "will_sell_to_us");
  let wantsReminder = tribool(formData, "wants_next_season_reminder");
  let farmId = str(formData, "farm_id");
  let claim: {
    amount: number;
    method: string | null;
    reference: string | null;
    proofUrl: string | null;
  } | null = null;

  if (requestIdIn) {
    const { data: req } = await supabase
      .from("machinery_requests")
      .select(
        "will_sell_to_us, wants_next_season_reminder, farm_id, advance_claimed_amount, advance_claimed_method, advance_claimed_reference, advance_proof_url"
      )
      .eq("id", requestIdIn)
      .maybeSingle();
    if (req) {
      willSell = willSell ?? req.will_sell_to_us;
      wantsReminder = wantsReminder ?? req.wants_next_season_reminder;
      farmId = farmId ?? req.farm_id;
      if (req.advance_claimed_amount && Number(req.advance_claimed_amount) > 0) {
        claim = {
          amount: Number(req.advance_claimed_amount),
          method: req.advance_claimed_method,
          reference: req.advance_claimed_reference,
          proofUrl: req.advance_proof_url,
        };
      }
    }
  }

  // Rate card se default (177). Ye sirf ANDAZA bharta hai -- rate ka
  // malik abhi bhi booking hai, aur staff rate wale qadam par jo marzi
  // likhe. Card yahan is liye dekha jata hai, bill banate waqt nahi:
  // agar bill card se rate uthata to card badalne par purana bill bhi
  // badal jata -- aur wo bill kisan ko de bhi diya gaya hota.
  const { data: rateCardRows } = await supabase
    .from("machinery_rate_cards")
    .select("id, crop_key, machine_type, harvest_type, rate, effective_from, is_active");
  const cards = (rateCardRows ?? []).map((c) => ({
    id: c.id,
    crop_key: c.crop_key,
    machine_type: c.machine_type,
    harvest_type: c.harvest_type as "sabit" | "kutra",
    rate: Number(c.rate),
    effective_from: c.effective_from,
    is_active: c.is_active,
  }));
  const cropForRate = str(formData, "crop_type");
  const cardFor = (type: "sabit" | "kutra") =>
    pickDefaultRate(cards, { crop: cropForRate, machineType: machineType, harvestType: type })?.rate ?? null;

  // Staff ne form par rate likh diya ho to wohi chalta hai -- card
  // sirf khali khana bharta hai, likhe hue par nahi chaRhta.
  const sabitRate = harvestType === "dono" ? (num(formData, "sabit_rate") ?? cardFor("sabit")) : null;
  const kutraRate = harvestType === "dono" ? (num(formData, "kutra_rate") ?? cardFor("kutra")) : null;

  const estimatedRate =
    num(formData, "estimated_rate") ??
    (harvestType === "dono"
      ? sabitRate != null && kutraRate != null && totalArea > 0
        ? Math.round((((sabitArea ?? 0) * sabitRate + (kutraArea ?? 0) * kutraRate) / totalArea) * 100) / 100
        : null
      : cardFor(harvestType === "kutra" ? "kutra" : "sabit"));

  const bookingNumber = await nextNumber(supabase, "booking");

  const { data: booking, error } = await supabase
    .from("machinery_bookings")
    .insert({
      booking_number: bookingNumber,
      farmer_id: farmerId,
      booking_date: str(formData, "booking_date") ?? aajKaKhana(),
      status: "new",

      crop_type: str(formData, "crop_type"),
      village: str(formData, "village"),
      location_address: str(formData, "location_address"),
      location_lat: num(formData, "location_lat"),
      location_lng: num(formData, "location_lng"),
      expected_harvest_date: str(formData, "expected_harvest_date"),
      preferred_date: str(formData, "preferred_date"),
      preferred_time: str(formData, "preferred_time"),

      // Do sawal jin ka jawab na hone se machine khali jati hai
      // (migration 125). "unknown" bhi ek sahi jawab hai -- booking
      // aksar hafta pehle hoti hai.
      field_ready: str(formData, "field_ready"),
      harvest_ready: str(formData, "harvest_ready"),

      harvest_area_acres: harvestAcres,
      harvest_area_kanal: harvestKanal,

      machine_type_requested: machineType,
      machine_id: str(formData, "machine_id"),

      estimated_rate: estimatedRate,
      rate_status: "estimated",

      // Qism aur us ka raqba. Ek qism ho to database khud sabit/kutra
      // ke khane bhar deta hai -- yahan sirf "dono" ka batwara jata hai.
      harvest_type: harvestType,
      sabit_area: sabitArea,
      kutra_area: kutraArea,
      // Andaze ke rate. Ye final nahi hain -- rate wale qadam par staff
      // apni marzi se badal kar kisan se confirm karwata hai.
      sabit_rate: sabitRate,
      kutra_rate: kutraRate,

      will_sell_to_us: willSell,
      wants_next_season_reminder: wantsReminder,

      // Khet ka rishta. Jagah yahan se khud bhar jati hai (144) -- is
      // liye location ke khane upar khali chhore jate hain jab khet
      // maloom ho.
      farm_id: farmId,

      request_id: requestIdIn,
      notes: str(formData, "notes"),
      created_by: actorId,
    })
    .select("id, booking_number")
    .single();

  if (error || !booking) return { error: error?.message ?? "Booking nahi bani." };

  // Kisan ki apni farmaish se booking bani ho to wo farmaish yahin band
  // ho jati hai. Warna wo "abhi tak nahi hui" ki fehrist mein pari
  // rehti hai aur koi doosra staff us par dobara booking bana deta hai.
  const requestId = str(formData, "request_id");
  if (requestId) {
    await supabase.from("machinery_requests").update({ status: "fulfilled" }).eq("id", requestId);
  }

  // Booking ban gayi -- ab adhoora kaghaz rakhne ki koi wajah nahi.
  // Wo para reh jaye to agli dafa form purane kisan ke naam se khulta
  // hai, aur wohi ek booking do dafa banwa deta hai.
  if (actorId) {
    await supabase.from("machinery_booking_drafts").delete().eq("user_id", actorId);
  }

  await logEvent({
    bookingId: booking.id,
    eventType: "booking_created",
    toStatus: "new",
    note: `${machineType} — ${toAcres(harvestAcres, harvestKanal)} acre`,
    actorId,
  });

  // Advance ussi form par liya ja sakta hai. Nakami chhupti nahi: agar
  // advance darj na ho saka to booking bani rehti hai (wo theek bani
  // thi) magar bulane wale ko wajah milti hai, taake wo dobara koshish
  // kare -- na ke ye samajh le ke paisa darj ho gaya.
  // Kisan ne booking par hi keh diya ke advance nahi de raha -- to wo
  // "nahi" bhi likh lete hain. Ye raqam nahi, jawab hai: ledger mein
  // kuch nahi jata. Is se booking khulne par safha wohi sawal dobara
  // nahi poochhta -- aur dobara poochhna wohi shak paida karta hai jis
  // se ek hi raqam do dafa darj ho jati hai.
  if (formData.get("advance_received") !== "yes" && !claim) {
    await supabase
      .from("machinery_bookings")
      .update({ advance_declined_at: new Date().toISOString(), advance_declined_by: actorId })
      .eq("id", booking.id);
  }

  if (formData.get("advance_received") === "yes") {
    const advanceResult = await saveAdvance({
      supabase,
      bookingId: booking.id,
      farmerId,
      amount: num(formData, "advance_amount"),
      method: str(formData, "advance_method"),
      accountId: str(formData, "advance_account_id"),
      reference: str(formData, "advance_reference"),
      evidenceUrl: str(formData, "advance_evidence_url"),
      paymentDate: str(formData, "advance_date"),
      receivedLocation: str(formData, "received_location"),
      bookingNumber: booking.booking_number,
      actorId,
    });
    if (advanceResult) {
      return {
        bookingId: booking.id,
        bookingNumber: booking.booking_number,
        error: `Booking ${booking.booking_number} ban gayi, magar advance darj nahi hua: ${advanceResult}`,
      };
    }
  }

  // Kisan ne apni farmaish par kaha tha ke advance de diya hai. Wo dawa
  // yahan qatar mein aata hai magar 'claimed' halat mein: ledger mein
  // kuch nahi jata, bill us ko nahi kaatta, cash book mein nazar nahi
  // aata. Sirf staff ki fehrist mein khara ho jata hai ke ise dekho.
  //
  // Isay khud tasdeeq maan lena poore hisaab ko jhoota kar deta:
  // "20,000 diye" keh dene se bill mein 20,000 kam ho jate, chahe paisa
  // aaya hi na ho.
  if (claim) {
    const { data: claimRow, error: claimError } = await supabase
      .from("machinery_payments")
      .insert({
        booking_id: booking.id,
        kind: "advance",
        amount: claim.amount,
        method: claim.method ?? "cash",
        payment_date: aajKaKhana(),
        reference: claim.reference,
        proof_url: claim.proofUrl,
        verification_status: "claimed",
        claimed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (!claimError && claimRow) {
      await logEvent({
        bookingId: booking.id,
        eventType: "advance_claimed",
        note: `Kisan ka dawa: Rs ${claim.amount.toLocaleString()} — tasdeeq baqi`,
        actorId,
      });
      await notifyRoles(
        ["finance", "manager", "super_admin", "admin", "owner"],
        "Advance ka dawa — tasdeeq baqi",
        `Booking ${booking.booking_number}: kisan ka kehna hai Rs ${claim.amount.toLocaleString()} advance diya hai.`,
        `/admin/machinery-rental/advance-claims`
      );
    }
  }

  await notifyRoles(
    ["manager", "super_admin", "admin", "owner"],
    "Nayi Machinery Booking",
    `Booking ${booking.booking_number} ban gayi hai.`,
    `/admin/machinery-rental/booking/${booking.id}`
  );

  // Kisan ko uski apni raseed. Ye advance darj hone ke BAAD bheji jati
  // hai, us se pehle nahi: kisan ke haath se abhi paisa gaya hai aur
  // sab se pehla sawal wohi hota hai ke "wo darj hua ya nahi". Raqam
  // paighaam mein isi liye likhi jati hai.
  await notifyFarmerBookingCreated(supabase, booking.id, booking.booking_number, farmerId, actorId);

  revalidateAll(booking.id);
  return { success: true, bookingId: booking.id, bookingNumber: booking.booking_number };
}

// =====================================================================
// 2. Advance
// =====================================================================
/**
 * Advance qatar mein bhi, ledger mein bhi -- ya kahin bhi nahi.
 *
 * Wapsi: `null` matlab sab theek; koi string matlab wajah.
 *
 * Ledger mein na ja sake to qatar bhi wapas mita di jati hai. Ye jaan
 * boojh kar hai: aisa advance jo qatar mein to hai magar ledger mein
 * nahi, sab se khatarnak shakal hai -- receipt kisan ke paas hai, aur
 * hisaab mein wo paisa hai hi nahi.
 */
async function saveAdvance(args: {
  supabase: Client;
  bookingId: string;
  farmerId: string;
  amount: number | null;
  method: string | null;
  accountId: string | null;
  reference: string | null;
  evidenceUrl: string | null;
  paymentDate: string | null;
  receivedLocation?: string | null;
  bookingNumber: string;
  actorId: string | null;
}): Promise<string | null> {
  if (!args.amount || args.amount <= 0) {
    // Ye ghalti nahi, aksar iraada hi nahi hota. Advance lazmi nahi --
    // is liye jawab bhi rukawat ki tarah nahi, raah dikhane wala.
    return "Advance nahi liya to ye qadam chhor dein — booking bina advance ke bhi chalti hai. Advance liya ho to raqam likhein.";
  }
  const method = args.method ?? "cash";

  // Advance ka matlab hai paisa haath mein aa gaya. Khata udhaar hai --
  // us par advance nahi hota, warna hum khud ko apna hi advance de kar
  // hisaab barabar dikha sakte hain.
  if (method === "khata") return "Advance khata par nahi liya ja sakta -- paisa waqai aana chahiye.";

  // Cash lene wale ke paas jata hai, kisi khate mein nahi (171). Baqi
  // har raaste mein paisa waqai kisi khate mein aata hai, is liye
  // wahan khata abhi bhi lazmi hai.
  const inCustody = method === "cash" && Boolean(args.actorId);
  if (!inCustody && !args.accountId) return "Advance kis khate mein aaya, wo select karein.";

  const receiptNumber = await nextNumber(args.supabase, "receipt");

  const { data: payment, error } = await args.supabase
    .from("machinery_payments")
    .insert({
      booking_id: args.bookingId,
      kind: "advance",
      amount: args.amount,
      method,
      finance_account_id: inCustody ? null : args.accountId,
      custody_profile_id: inCustody ? args.actorId : null,
      received_location: inCustody ? (args.receivedLocation ?? "office") : null,
      payment_date: args.paymentDate ?? aajKaKhana(),
      reference: args.reference,
      evidence_url: args.evidenceUrl,
      receipt_number: receiptNumber,
      received_by: args.actorId,
    })
    .select("id")
    .single();

  if (error || !payment) return error?.message ?? "Advance darj nahi hua.";

  const posted = await postMachineryAdvance({
    bookingId: args.bookingId,
    farmerId: args.farmerId,
    amount: args.amount,
    accountId: inCustody ? null : args.accountId,
    custodyProfileId: inCustody ? args.actorId : null,
    description: `Machinery booking ${args.bookingNumber} — advance`,
    ctx: {
      createdBy: args.actorId,
      entryDate: args.paymentDate ?? undefined,
      claims: [{ table: "machinery_payments", rowId: payment.id }],
    },
  });

  if (failed(posted)) {
    await createServiceClient().from("machinery_payments").delete().eq("id", payment.id);
    return `Ledger mein nahi gaya, is liye advance darj nahi kiya: ${posted.error}`;
  }

  // Cash Book ka rukh (19 September ka finance review): custody mein
  // gaya cash kisi finance khate ka nahi (wo 1030 hai), magar jo paisa
  // Easypaisa/bank/cash khate mein aaya wo Cash Book mein bhi likha
  // jaye -- warna Finance ka safha us khate par peeche reh jata hai.
  if (!inCustody && !failed(posted)) {
    await cashBookLikhein([
      {
        accountId: args.accountId ?? null,
        glCode: args.accountId ? null : "1000",
        amount: args.amount,
        rukh: "aaya",
        category: "machinery_advance",
        notes: `Machinery booking ${args.bookingNumber} — advance`,
        tareekh: args.paymentDate ?? undefined,
        createdBy: args.actorId,
        entryId: posted.id,
      },
    ]);
  }

  // Booking par kisan ne kaha tha "advance nahi de raha", magar de
  // diya. Ab wo purana jawab ghalat ho chuka hai -- use hata dete
  // hain. Nishan aur raqam ek sath khare rahen to safha wo baat
  // kehta rahega jo ab sach nahi.
  await args.supabase
    .from("machinery_bookings")
    .update({ advance_declined_at: null, advance_declined_by: null })
    .eq("id", args.bookingId);

  await logEvent({
    bookingId: args.bookingId,
    eventType: "advance_received",
    note: `Rs ${args.amount.toLocaleString()} — ${method}`,
    evidenceUrl: args.evidenceUrl,
    actorId: args.actorId,
  });

  return null;
}

/** Booking ban jane ke baad advance lena. */
export async function recordAdvance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking nahi mili." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, farmer_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  const problem = await saveAdvance({
    supabase,
    bookingId: booking.id,
    farmerId: booking.farmer_id,
    amount: num(formData, "amount"),
    method: str(formData, "method"),
    accountId: str(formData, "finance_account_id"),
    reference: str(formData, "reference"),
    evidenceUrl: str(formData, "evidence_url"),
    paymentDate: str(formData, "payment_date"),
    receivedLocation: str(formData, "received_location"),
    bookingNumber: booking.booking_number,
    actorId,
  });
  if (problem) return { error: problem };

  revalidateAll(bookingId);
  return { success: true };
}

// =====================================================================
// 3. Kisan ki tasdeeq
// =====================================================================
/**
 * Kattai se pehle final rate kisan ko bhejo.
 *
 * Ye rate abhi `agreed` hai, `final` nahi. Final wo tab banta hai jab
 * kisan ka jawab aa jaye -- aur ye farq DB mein bhi lagta hai
 * (migration 116), sirf yahan nahi.
 */
/**
 * Kisan ke dawe ki tasdeeq.
 *
 * Dawa qatar mein pehle se para hota hai magar "claimed" halat mein --
 * wahan se wo kahin nahi ginta: na cash book mein, na bill ke advance
 * mein. Ledger yahin banta hai, us waqt jab koi insaan keh de ke haan,
 * paisa waqai aaya, aur ye bataye ke kis khate mein aaya.
 *
 * Khata kisan se nahi poochha ja sakta -- usay pata hi nahi hota ke
 * paisa hamare kis khate mein gira. Ye staff ka ilm hai, is liye ye
 * sawal yahan hai.
 */
/**
 * Manager ka qadam: sirf iqrar — "haan, kisan ne ye advance diya hai."
 *
 * Do-marhala split (9 September, malik ka hukm): pehle sirf Manager
 * dawe ki sachai ka iqrar karta hai (koi ledger post nahi, us ke paas
 * khata bhi nahi hota jis mein paisa gaya). Asal ledger post FINANCE/
 * Owner ke `approveAdvanceClaim` par hota hai. `verified`/`verified_by`/
 * `verified_at` ka matlab wohi rehta hai jo pehle tha ("FINAL, ledger
 * mein ja chuka") — sirf ab wahan pahunchne ka raasta ek qadam lamba
 * hai.
 */
export async function verifyAdvanceClaim(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireAction("machinery-rental.advance-claims", "verify");
  if ("error" in guard) return { error: guard.error };

  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const paymentId = str(formData, "payment_id");
  const decision = str(formData, "decision");
  if (!paymentId) return { error: "Payment nahi mili." };
  if (decision !== "accept" && decision !== "reject") return { error: "Faisla batayein." };

  const { data: payment } = await supabase
    .from("machinery_payments")
    .select("id, booking_id, amount, method, verification_status, payment_date")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { error: "Payment nahi mili." };
  if (payment.verification_status !== "claimed") {
    return { error: "Is dawe ka faisla pehle ho chuka hai." };
  }

  if (decision === "reject") {
    const reason = str(formData, "rejection_reason");
    if (!reason) return { error: "Rad karne ki wajah likhein." };
    const { error } = await supabase
      .from("machinery_payments")
      .update({ verification_status: "rejected", rejection_reason: reason, verified_by: actorId, verified_at: new Date().toISOString() })
      .eq("id", paymentId);
    if (error) return { error: error.message };

    await logEvent({
      bookingId: payment.booking_id,
      eventType: "advance_claim_rejected",
      note: `Rs ${Number(payment.amount).toLocaleString()} ka dawa rad: ${reason}`,
      actorId,
    });
    await logAudit({
      actionType: "reject",
      module: "machinery-rental.advance-claims",
      recordId: paymentId,
      description: `Advance dawa rad — Rs ${Number(payment.amount).toLocaleString()}, wajah: ${reason}`,
    });
    revalidateAll(payment.booking_id);
    return { success: true };
  }

  const { error } = await supabase
    .from("machinery_payments")
    .update({
      verification_status: "manager_confirmed",
      manager_confirmed_by: actorId,
      manager_confirmed_at: new Date().toISOString(),
    })
    .eq("id", paymentId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId: payment.booking_id,
    eventType: "advance_claim_manager_confirmed",
    note: `Rs ${Number(payment.amount).toLocaleString()} ka dawa Manager ne tasdeeq kiya — Finance/Owner ki final manzoori baqi.`,
    actorId,
  });
  await logAudit({
    actionType: "verify",
    module: "machinery-rental.advance-claims",
    recordId: paymentId,
    description: `Advance dawa Manager tasdeeq — Rs ${Number(payment.amount).toLocaleString()}, final manzoori baqi.`,
  });

  revalidateAll(payment.booking_id);
  return { success: true, notice: "Manager tasdeeq ho gayi — ab Finance/Owner ki final manzoori ka intezar hai." };
}

/**
 * Finance/Owner ka qadam: FINAL manzoori — yahin ledger banta hai.
 *
 * Sirf `manager_confirmed` dawe yahan aate hain. Khata (kis account mein
 * paisa aaya) yahan poocha jata hai, Manager ke qadam par nahi — ye
 * ilm asal mein Finance ke paas hota hai.
 */
export async function approveAdvanceClaim(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireAction("machinery-rental.advance-claims", "approve");
  if ("error" in guard) return { error: guard.error };

  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const paymentId = str(formData, "payment_id");
  const decision = str(formData, "decision");
  if (!paymentId) return { error: "Payment nahi mili." };
  if (decision !== "accept" && decision !== "reject") return { error: "Faisla batayein." };

  const { data: payment } = await supabase
    .from("machinery_payments")
    .select("id, booking_id, amount, method, verification_status, payment_date")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { error: "Payment nahi mili." };
  if (payment.verification_status !== "manager_confirmed") {
    return { error: "Ye dawa abhi Manager ki tasdeeq ka intezar kar raha hai, ya faisla pehle ho chuka hai." };
  }

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, farmer_id")
    .eq("id", payment.booking_id)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  if (decision === "reject") {
    const reason = str(formData, "rejection_reason");
    if (!reason) return { error: "Rad karne ki wajah likhein." };
    const { error } = await supabase
      .from("machinery_payments")
      .update({ verification_status: "rejected", rejection_reason: reason, verified_by: actorId, verified_at: new Date().toISOString() })
      .eq("id", paymentId);
    if (error) return { error: error.message };

    await logEvent({
      bookingId: payment.booking_id,
      eventType: "advance_claim_rejected",
      note: `Rs ${Number(payment.amount).toLocaleString()} ka dawa (Manager-tasdeeq shuda) Finance/Owner ne rad kiya: ${reason}`,
      actorId,
    });
    await logAudit({
      actionType: "reject",
      module: "machinery-rental.advance-claims",
      recordId: paymentId,
      description: `Advance dawa (Manager-tasdeeq shuda) Finance/Owner ne rad kiya — Rs ${Number(payment.amount).toLocaleString()}, wajah: ${reason}`,
    });
    revalidateAll(payment.booking_id);
    return { success: true };
  }

  const accountId = str(formData, "finance_account_id");
  if (!accountId) return { error: "Paisa kis khate mein aaya, wo select karein." };

  const { error } = await supabase
    .from("machinery_payments")
    .update({
      verification_status: "verified",
      finance_account_id: accountId,
      verified_by: actorId,
      verified_at: new Date().toISOString(),
      received_by: actorId,
    })
    .eq("id", paymentId);
  if (error) return { error: error.message };

  const posted = await postMachineryAdvance({
    bookingId: payment.booking_id,
    farmerId: booking.farmer_id,
    amount: Number(payment.amount),
    accountId,
    description: `Machinery booking ${booking.booking_number} — advance (kisan ka dawa, Manager + Finance tasdeeq shuda)`,
    ctx: {
      createdBy: actorId,
      entryDate: payment.payment_date ?? undefined,
      claims: [{ table: "machinery_payments", rowId: paymentId }],
    },
  });

  // Ledger mein na ja sake to manzoori wapas -- Manager ki tasdeeq
  // (manager_confirmed) qayam rehti hai, dawa dobara "claimed" nahi
  // banta. Verified likha rehna aur ledger khali hona sab se buri
  // shakal hai: bill us paise ko kaat leta jo kabhi kisi khate mein
  // aaya hi nahi.
  if (failed(posted)) {
    await createServiceClient()
      .from("machinery_payments")
      .update({ verification_status: "manager_confirmed", finance_account_id: null, verified_by: null, verified_at: null, received_by: null })
      .eq("id", paymentId);
    return { error: `Ledger mein nahi gaya, is liye final manzoori nahi ki: ${posted.error}` };
  }

  // Cash Book ka rukh bhi (19 September ka finance review).
  await cashBookLikhein([
    {
      accountId,
      amount: Number(payment.amount),
      rukh: "aaya",
      category: "machinery_advance",
      notes: `Machinery booking ${booking.booking_number} — advance (kisan ka dawa, tasdeeq shuda)`,
      tareekh: payment.payment_date ?? undefined,
      createdBy: actorId,
      entryId: posted.id,
    },
  ]);

  await logEvent({
    bookingId: payment.booking_id,
    eventType: "advance_claim_verified",
    note: `Rs ${Number(payment.amount).toLocaleString()} ka dawa FINAL manzoor — ledger mein chala gaya.`,
    actorId,
  });
  await logAudit({
    actionType: "approve",
    module: "machinery-rental.advance-claims",
    recordId: paymentId,
    description: `Advance dawa FINAL manzoor — Rs ${Number(payment.amount).toLocaleString()}, ledger mein gaya.`,
  });

  revalidateAll(payment.booking_id);
  return { success: true };
}

export async function sendRateConfirmation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking nahi mili." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select(
      "id, booking_number, status, farmer_id, crop_type, harvest_area, expected_harvest_date, farmer_confirmed_at, machine_id, harvest_type, sabit_area, kutra_area, sabit_rate, kutra_rate, farmers(full_name, phone_number), machinery_vendor_machines(machine_type, model)"
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  // Bill ban chuka ho to rate yahan se nahi badalta. Wo rate us bill
  // ka, us ke ledger ka aur vendor ke hisse ka bunyadi adad hai -- usay
  // chupke se badal dena teenon ko jhoota kar deta. Pehle bill mansookh
  // hota hai (jis se ledger ulta jata hai), phir rate badalta hai (192).
  const { data: liveBill } = await supabase
    .from("machinery_bills")
    .select("bill_number")
    .eq("booking_id", bookingId)
    .is("cancelled_at", null)
    .maybeSingle();
  if (liveBill) {
    return {
      error: `Is booking ka bill (${liveBill.bill_number}) ban chuka hai — rate ab yahan se nahi badal sakta. Pehle bill mansookh karein, phir naya rate bhejein.`,
    };
  }

  // Do qism ki booking par rate bhi do hote hain (176). Wahan final_rate
  // KHUD banta hai (dono ka aausat) -- staff wo likhta hi nahi, warna
  // wohi purani kharabi wapas aa jati: ek adad do jagah likha hua.
  const isDono = booking.harvest_type === "dono";

  // Rate aksar booking BANATE WAQT hi tay ho chuka hota hai. Us soorat
  // mein ye qadam use dobara nahi poochhta -- form khali aaye to wahi
  // rate uthaya jata hai jo booking par pehle se likha hai.
  //
  // Ye rok us baat par hai ke rate MAUJOOD hai ya nahi, is par nahi ke
  // wo kis khane se aaya. Purani screen se aaya form bhi isi liye
  // chalta rehta hai.
  const sabitRate = num(formData, "sabit_rate") ?? (booking.sabit_rate === null ? null : Number(booking.sabit_rate));
  const kutraRate = num(formData, "kutra_rate") ?? (booking.kutra_rate === null ? null : Number(booking.kutra_rate));
  const finalRate = isDono ? null : num(formData, "final_rate");

  if (isDono) {
    if (!sabitRate || sabitRate <= 0) return { error: "Sabit Parali ka rate sahi likhein." };
    if (!kutraRate || kutraRate <= 0) return { error: "Kutra ka rate sahi likhein." };
  } else if (!finalRate || finalRate <= 0) {
    return { error: "Final rate sahi likhein." };
  }

  const sabitBook = Number(booking.sabit_area ?? 0);
  const kutraBook = Number(booking.kutra_area ?? 0);
  const totalArea = Number(booking.harvest_area ?? 0);

  // Kisan ko jo raqam bhejni hai wo booking ke raqbe par andaza hai.
  // Asal bill baad mein tasdeeq shuda kaam par banta hai -- ye farq
  // paighaam mein bhi saaf likha jata hai.
  const sabitRaqam = Math.round(sabitBook * (sabitRate ?? 0));
  const kutraRaqam = Math.round(kutraBook * (kutraRate ?? 0));
  const kulRaqam = isDono ? sabitRaqam + kutraRaqam : Math.round(totalArea * (finalRate ?? 0));

  const shownRate = isDono
    ? Math.r…26039 tokens truncated…ik ka kehna (5 September): *"maine diesel ek dafa hi add kiya hai"*
 * -- MB-2026-00008 par 23 sekind ke faasle se do dafa 30 litre darj ho
 * gaya tha. Ledger wali ghalti to reverse ho gayi, magar diesel ki qatar
 * "verified" pari rahi, aur vendor ka safha Rs 33,930 kaatta raha jabke
 * ledger Rs 22,650 kehta tha. Do kitabein alag ho gayin.
 *
 * Us waqt is ka koi raasta hi nahi tha: `fn_guard_fuel_log` (theek hi)
 * tasdeeq shuda diesel ko wapas nahi jane deta, aur qatar mitane se
 * saboot chala jata hai. Ab teesra darja hai -- `cancelled` (313):
 * qatar apni jagah rehti hai, wajah ke sath, magar kisi hisaab mein
 * nahi ginni jati.
 *
 * DONO kitabein ek sath ulti hoti hain. Ledger pehle: agar wo na
 * ulta ja sake to diesel bhi mansookh nahi hota, warna wohi shakal
 * dobara ban jati jis se bachna hai.
 */
export async function cancelFuelLog(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const fuelId = str(formData, "fuel_id");
  const reason = (str(formData, "reason") ?? "").trim();
  if (!fuelId) return { error: "Indraj nahi mila." };
  if (reason.length < 10) return { error: "Mansookhi ki wajah likhein (kam az kam das harf)." };

  const { data: log } = await supabase
    .from("machinery_fuel_logs")
    .select("id, booking_id, amount, litres, paid_by, verification_status, expense_id")
    .eq("id", fuelId)
    .maybeSingle();
  if (!log) return { error: "Indraj nahi mila." };
  if (log.verification_status === "cancelled") {
    return { error: "Ye indraj pehle hi mansookh ho chuka hai." };
  }

  const service = createServiceClient();

  // Ledger pehle. Diesel ka kharcha `finance_transactions` ki qatar par
  // khara hai, aur usi qatar par journal entry ne apna daawa likha tha
  // (`journal_entry_sources`) -- andaze se dhoondhne ki zaroorat nahi.
  let reversalNumber: string | null = null;
  if (log.expense_id) {
    const { data: claim } = await service
      .from("journal_entry_sources")
      .select("entry_id")
      .eq("source_table", "finance_transactions")
      .eq("source_row_id", log.expense_id)
      .maybeSingle();

    if (claim?.entry_id) {
      // Pehle se ulti ja chuki ho to dobara ulatne ki koshish nahi --
      // `reverseJournal` khud rok deta hai, magar us ki rok yahan
      // "kaam ruk gaya" ban jati. Diesel ki qatar ko phir bhi nishan
      // lagna chahiye.
      const { data: pehleSe } = await service
        .from("journal_entries")
        .select("entry_number")
        .eq("reversal_of", claim.entry_id)
        .maybeSingle();

      if (pehleSe) {
        reversalNumber = pehleSe.entry_number as string;
      } else {
        const reversed = await reverseJournal(claim.entry_id, `Diesel mansookh: ${reason}`, actorId);
        if ("error" in reversed) {
          return { error: `Ledger nahi ulta ja saka, is liye diesel bhi mansookh nahi kiya: ${reversed.error}` };
        }
        reversalNumber = reversed.entryNumber;
      }
    }
  }

  const { error } = await service
    .from("machinery_fuel_logs")
    .update({
      verification_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: actorId,
      cancelled_reason: reason,
    })
    .eq("id", fuelId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId: log.booking_id,
    eventType: "fuel_cancelled",
    note: `Diesel Rs ${Number(log.amount).toLocaleString()} (${log.litres} litre) mansookh: ${reason}${
      reversalNumber ? ` — ledger ${reversalNumber}` : ""
    }`,
    actorId,
  });

  await logAudit({
    actionType: "update",
    module: "machinery",
    recordId: fuelId,
    recordLabel: `Diesel Rs ${Number(log.amount).toLocaleString()}`,
    description: `Diesel ka indraj mansookh: ${reason}`,
    changes: { verification_status: { pehle: log.verification_status, ab: "cancelled" } },
  });

  revalidateAll(log.booking_id);
  return {
    success: true,
    notice: reversalNumber
      ? `Diesel mansookh ho gaya. Ledger bhi ulta diya gaya (${reversalNumber}).`
      : "Diesel mansookh ho gaya.",
  };
}

export async function verifyFuelClaim(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireAction("machinery-rental.work-claims", "verify");
  if ("error" in guard) return { error: guard.error };

  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const fuelId = str(formData, "fuel_id");
  const decision = str(formData, "decision");
  if (!fuelId) return { error: "Indraj nahi mila." };
  if (decision !== "accept" && decision !== "reject") return { error: "Faisla batayein." };

  const { data: log } = await supabase
    .from("machinery_fuel_logs")
    .select("id, booking_id, amount, litres, paid_by, verification_status")
    .eq("id", fuelId)
    .maybeSingle();
  if (!log) return { error: "Indraj nahi mila." };
  if (log.verification_status !== "claimed") {
    return { error: "Is indraj ka faisla pehle ho chuka hai." };
  }

  if (decision === "reject") {
    const reason = str(formData, "rejection_reason");
    if (!reason) return { error: "Rad karne ki wajah likhein." };
    const { error } = await supabase
      .from("machinery_fuel_logs")
      .update({
        verification_status: "rejected",
        rejection_reason: reason,
        verified_by: actorId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", fuelId);
    if (error) return { error: error.message };

    await logEvent({
      bookingId: log.booking_id,
      eventType: "fuel_claim_rejected",
      note: `Vendor ka diesel rad: ${reason}`,
      actorId,
    });
    await logAudit({
      actionType: "reject",
      module: "machinery-rental.work-claims",
      recordId: fuelId,
      description: `Fuel dawa rad — Rs ${Number(log.amount).toLocaleString()}, wajah: ${reason}`,
    });
    revalidateAll(log.booking_id);
    return { success: true };
  }

  const { error } = await supabase
    .from("machinery_fuel_logs")
    .update({
      verification_status: "manager_confirmed",
      manager_confirmed_by: actorId,
      manager_confirmed_at: new Date().toISOString(),
    })
    .eq("id", fuelId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId: log.booking_id,
    eventType: "fuel_claim_manager_confirmed",
    note: `Vendor ka diesel Manager ne tasdeeq kiya — Rs ${Number(log.amount).toLocaleString()}. Finance/Owner ki final manzoori baqi.`,
    actorId,
  });
  await logAudit({
    actionType: "verify",
    module: "machinery-rental.work-claims",
    recordId: fuelId,
    description: `Fuel dawa Manager tasdeeq — Rs ${Number(log.amount).toLocaleString()}, final manzoori baqi.`,
  });

  revalidateAll(log.booking_id);
  return { success: true, notice: "Manager tasdeeq ho gayi — ab Finance/Owner ki final manzoori ka intezar hai." };
}

/** Finance/Owner ka qadam: FINAL manzoori — sirf ab ART ka diesel ledger mein jata hai. */
export async function approveFuelClaim(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireAction("machinery-rental.work-claims", "approve");
  if ("error" in guard) return { error: guard.error };

  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const fuelId = str(formData, "fuel_id");
  const decision = str(formData, "decision");
  if (!fuelId) return { error: "Indraj nahi mila." };
  if (decision !== "accept" && decision !== "reject") return { error: "Faisla batayein." };

  const { data: log } = await supabase
    .from("machinery_fuel_logs")
    .select("id, booking_id, amount, litres, paid_by, verification_status")
    .eq("id", fuelId)
    .maybeSingle();
  if (!log) return { error: "Indraj nahi mila." };
  if (log.verification_status !== "manager_confirmed") {
    return { error: "Ye indraj abhi Manager ki tasdeeq ka intezar kar raha hai, ya faisla pehle ho chuka hai." };
  }

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, vendor_id")
    .eq("id", log.booking_id)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  if (decision === "reject") {
    const reason = str(formData, "rejection_reason");
    if (!reason) return { error: "Rad karne ki wajah likhein." };
    const { error } = await supabase
      .from("machinery_fuel_logs")
      .update({
        verification_status: "rejected",
        rejection_reason: reason,
        verified_by: actorId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", fuelId);
    if (error) return { error: error.message };

    await logEvent({
      bookingId: log.booking_id,
      eventType: "fuel_claim_rejected",
      note: `Vendor ka diesel (Manager-tasdeeq shuda) Finance/Owner ne rad kiya: ${reason}`,
      actorId,
    });
    await logAudit({
      actionType: "reject",
      module: "machinery-rental.work-claims",
      recordId: fuelId,
      description: `Fuel dawa (Manager-tasdeeq shuda) Finance/Owner ne rad kiya — Rs ${Number(log.amount).toLocaleString()}, wajah: ${reason}`,
    });
    revalidateAll(log.booking_id);
    return { success: true };
  }

  const accountId = str(formData, "finance_account_id");
  if (log.paid_by === "company" && !accountId) {
    return { error: "ART ka diesel hai to khata select karein ke kis khate se nikla." };
  }

  const { error } = await supabase
    .from("machinery_fuel_logs")
    .update({
      verification_status: "verified",
      finance_account_id: log.paid_by === "company" ? accountId : null,
      verified_by: actorId,
      verified_at: new Date().toISOString(),
    })
    .eq("id", fuelId);
  if (error) return { error: error.message };

  if (log.paid_by === "company" && accountId) {
    const fuelError = await saveDieselExpense({
      supabase,
      fuelLogId: fuelId,
      bookingNumber: booking.booking_number,
      amount: Number(log.amount),
      accountId,
      litres: log.litres === null ? null : Number(log.litres),
      vendorId: booking.vendor_id,
      actorId,
    });
    // Ledger mein na ja saka to manzoori wapas -- Manager ki tasdeeq
    // (manager_confirmed) qayam rehti hai. Warna diesel "tasdeeq shuda"
    // likha rehta aur kharcha kahin nahi hota.
    if (fuelError) {
      await createServiceClient()
        .from("machinery_fuel_logs")
        .update({ verification_status: "manager_confirmed", finance_account_id: null, verified_by: null, verified_at: null })
        .eq("id", fuelId);
      return { error: fuelError };
    }
  }

  await logEvent({
    bookingId: log.booking_id,
    eventType: "fuel_claim_verified",
    note: `Vendor ka diesel FINAL manzoor — Rs ${Number(log.amount).toLocaleString()} (${
      log.paid_by === "company" ? "ART" : log.paid_by === "vendor" ? "vendor" : "kisan"
    })`,
    actorId,
  });
  await logAudit({
    actionType: "approve",
    module: "machinery-rental.work-claims",
    recordId: fuelId,
    description: `Fuel dawa FINAL manzoor — Rs ${Number(log.amount).toLocaleString()} (${
      log.paid_by === "company" ? "ART" : log.paid_by === "vendor" ? "vendor" : "kisan"
    })`,
  });

  revalidateAll(log.booking_id);
  return { success: true };
}

/**
 * Vendor ne wasool shuda paisa hamein de diya.
 *
 * Ye us payment ka doosra qadam hai jo kisan ne vendor ke haath mein
 * di thi aur vendor ne "hamein de dunga" kaha tha. Pehle qadam par
 * kisan ka hisaab barabar ho chuka tha; ab wo paisa ek bande ke haath
 * se nikal kar hamare khate mein aata hai.
 *
 * Kisan ka is se koi taalluq nahi -- is liye ye kisi ek booking ka
 * safha nahi, vendor ka safha hai. Ek vendor teen bookings ka paisa
 * ek sath laata hai.
 */
export async function recordVendorCashHandover(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const vendorId = str(formData, "vendor_id");
  const accountId = str(formData, "finance_account_id");
  const amount = num(formData, "amount") ?? 0;
  const clientActionId = str(formData, "client_action_id");

  if (!vendorId) return { error: "Vendor nahi mila." };
  if (amount <= 0) return { error: "Raqam sahi likhein." };
  if (!accountId) return { error: "Paisa kis khate mein aaya, wo select karein." };

  if (clientActionId) {
    const { data: alreadyPosted } = await supabase
      .from("machinery_payments")
      .select("id")
      .eq("client_action_id", clientActionId)
      .maybeSingle();
    if (alreadyPosted) return { success: true, notice: "Vendor handover pehle hi sync ho chuka hai." };
  }

  const { data: vendor } = await supabase
    .from("machinery_vendors")
    .select("id, vendor_name")
    .eq("id", vendorId)
    .maybeSingle();
  if (!vendor) return { error: "Vendor nahi mila." };

  // Vendor ke paas hamara kitna paisa hai -- wohi hadd hai. Is se
  // zyada lena us ka apna paisa lena hai, aur wo alag maamla hai.
  const { data: pending } = await supabase
    .from("machinery_payments")
    .select("id, amount")
    .eq("collected_by_vendor_id", vendorId)
    .eq("method", "vendor_collected")
    .eq("vendor_settlement", "handed_over")
    .is("finance_account_id", null);

  const holding = (pending ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  if (holding <= 0) return { error: "Is vendor ke paas hamara koi paisa darj nahi hai." };
  if (amount > holding + 0.01) {
    return { error: `Vendor ke paas hamara Rs ${holding.toLocaleString()} hai, us se zyada nahi liya ja sakta.` };
  }

  // Pehle un poori qataaron par nishan lagate hain jo is handover mein
  // aa rahi hain. Ye nishan device key bhi rakhta hai. Agar network jawab
  // se pehle toot jaye to agla retry isi key se pehchan lega; agar ledger
  // nakaam ho to nishan wapas hata diya jata hai.
  let left = amount;
  const service = createServiceClient();
  const rowsToMark: Array<{ id: string; amount: number }> = [];
  for (const row of pending ?? []) {
    const rowAmount = Number(row.amount);
    if (rowAmount > left + 0.01) break;
    rowsToMark.push({ id: row.id, amount: rowAmount });
    left = Math.round((left - rowAmount) * 100) / 100;
  }
  if (rowsToMark.length === 0) return { error: "Is handover ke liye payment ki poori qatar available nahi." };

  const marked: string[] = [];
  for (const row of rowsToMark) {
    const { error } = await service
      .from("machinery_payments")
      .update({ finance_account_id: accountId, ...(marked.length === 0 && clientActionId ? { client_action_id: clientActionId } : {}) })
      .eq("id", row.id)
      .is("finance_account_id", null);
    if (error) {
      if (marked.length) await service.from("machinery_payments").update({ finance_account_id: null, ...(clientActionId ? { client_action_id: null } : {}) }).in("id", marked);
      return { error: `Vendor handover lock nahi ho saka: ${error.message}` };
    }
    marked.push(row.id);
  }

  const posted = await postVendorCashHandover({
    vendorId,
    accountId,
    amount,
    description: `${vendor.vendor_name} ne kisan se wasool shuda paisa hamein diya`,
    ctx: { createdBy: actorId, entryDate: str(formData, "received_date") ?? undefined },
  });
  if (failed(posted)) {
    await service.from("machinery_payments").update({ finance_account_id: null, ...(clientActionId ? { client_action_id: null } : {}) }).in("id", marked);
    return { error: `Ledger mein nahi gaya: ${posted.error}` };
  }

  // Cash Book ka rukh bhi (19 September ka finance review): vendor se
  // aaya paisa jis khate mein utra, wahan Cash Book mein bhi likha jaye.
  await cashBookLikhein([
    {
      accountId,
      amount,
      rukh: "aaya",
      category: "machinery_vendor_handover",
      notes: `${vendor.vendor_name} ne kisan se wasool shuda paisa hamein diya`,
      createdBy: actorId,
      entryId: posted.id,
    },
  ]);

  // Jo qatarein poori tarah aa gayin un par khata likh diya jata hai --
  // isi se wo "vendor ke paas para hua" ki fehrist se nikalti hain.
  // Aadhi qatar par nishaan nahi lagta: adhoori adaigi ka matlab wo
  // qatar abhi puri nahi hui.
  revalidatePath("/admin/machinery-rental/vendor-cash");
  revalidatePath("/admin/finance");
  return {
    success: true,
    notice: `Rs ${amount.toLocaleString()} khate mein aa gaya.${
      left > 0.01 ? ` Rs ${left.toLocaleString()} abhi bhi vendor ke paas darj hai.` : ""
    }`,
  };
}

// recordVendorPayout (Hissa A.5, 14 September) -- pehle machinery-rental.ts
// mein tha, jab ke baaqi sab paisa wale actions yahan hain. Sirf jagah
// badli hai, koi tabdeeli nahi.

export async function recordVendorPayout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const bookingId = String(formData.get("booking_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const accountId = (formData.get("account_id") as string) || null;
  if (!bookingId) return { error: "Missing booking id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Account select karein." };

  const { data: booking } = await supabase.from("machinery_bookings").select("vendor_payable, amount_paid_to_vendor, booking_number, vendor_id").eq("id", bookingId).single();
  if (!booking) return { error: "Booking nahi mili." };

  // Vendor ka hissa kisan ne SEEDHA vendor ko de diya ho (163, "vendor
  // collected") to wo hissa bhi ada ho chuka hai -- bhale is screen ne
  // khud kabhi cash nahi diya. Ye check na ho to yehi hua (13 September,
  // MB-2026-00008): vendor ne farmer se seedha le liya, aur do din baad
  // isi purani screen se WOHI hissa dobara cash mein ada ho gaya, kyunke
  // `amount_paid_to_vendor` (jo sirf ye screen khud badalti hai) ko us
  // seedhi wasooli ka pata hi nahi tha.
  const { data: collectedRows } = await supabase
    .from("machinery_payments")
    .select("amount")
    .eq("booking_id", bookingId)
    .eq("method", "vendor_collected");
  const vendorCollectedTotal = (collectedRows ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const vendorOwnShareCollected = Math.min(vendorCollectedTotal, Number(booking.vendor_payable ?? 0));

  const remaining = Math.max(0, Number(booking.vendor_payable ?? 0) - Number(booking.amount_paid_to_vendor) - vendorOwnShareCollected);

  if (remaining <= 0 && vendorOwnShareCollected > 0) {
    return {
      error: `Is booking ${booking.booking_number} ka vendor hissa (Rs ${vendorOwnShareCollected.toLocaleString()}) kisan ne pehle hi seedha vendor ko de diya hai (vendor collected) — is se cash mein dobara adaigi nahi honi chahiye. Sirf advance dena ho to wo vendor ke apne khate se dein.`,
    };
  }

  // Is booking par jitna dena tha us se ZYADA bhi diya ja sakta hai.
  //
  // Malik ka aitraaz (5 September): "vendor ko 30 hazar pay kiya hai to
  // hona chahiye, bhaley us ka 24,750 banta hai -- baqi raqam bhi to
  // mere paas hai na us ki." Baat theek hai: paisa waqai haath se nikal
  // chuka, aur jo cheez waqai ho chuki ho usay darj hone se rokna cash
  // book ko jhoota kar deta hai (kaghaz par to wo raqam nikli hui hai
  // hi).
  //
  // Magar us zyada raqam ko IS BOOKING ka kharcha likh dena bhi ghalat
  // hai -- is booking par vendor ka hissa utna hi hai jitna bana. Is
  // liye zyada raqam vendor ke khate mein ADVANCE ban jati hai (1120):
  // wo us se agli booking par kat jayegi, aur tab tak nazar mein rehti
  // hai ke us ke paas hamara itna paisa para hai.
  // Jis booking par kuch dena hi nahi bacha, us par dobara adaigi NAHI.
  //
  // Malik (6 September): *"jab record ho gayi to doubling nahi honi
  // chahiye -- ek hi farmer par bar bar."*
  //
  // Ye rok us din likhi ja rahi hai jis din MB-2026-00004 par Rs 30,000
  // TEEN dafa nikal chuke the. Zyada raqam ka advance banna theek hai
  // (5 September ka faisla) -- magar wo ek ASAL adaigi ka bacha hua
  // hissa hota hai, apne aap mein ek nayi adaigi nahi. Sirf advance
  // dena ho to wo vendor ke apne khate se hota hai, kisi booking par
  // nahi.
  if (remaining <= 0) {
    return {
      error: `Is booking par ${booking.booking_number} vendor ko poora paisa ja chuka hai — dobara adaigi darj nahi hoti. Vendor ko sirf advance dena ho to wo us ke apne khate se dein.`,
    };
  }

  const payableSettled = Math.min(amount, remaining);
  const advance = Math.round((amount - payableSettled) * 100) / 100;

  // ART ne is booking par vendor ke liye jo diesel diya, wo isi
  // adaigi mein wapas aata hai (170).
  //
  // Vendor ke naam par jo raqam khari hai wo poori kam hoti hai,
  // magar cash sirf farq nikalta hai -- baqi wo pehle hi diesel ki
  // shakal mein ja chuka hai. Alag se "recovery" darj karwana wo
  // qadam hai jo koi kabhi nahi karta, aur phir 1120 mein ek jor
  // hamesha ke liye para reh jata hai.
  const { data: dieselRows } = await supabase
    .from("machinery_fuel_logs")
    .select("amount")
    .eq("booking_id", bookingId)
    .eq("vendor_recoverable", true)
    .eq("verification_status", "verified");

  const dieselTotal = (dieselRows ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const alreadyPaid = Number(booking.amount_paid_to_vendor);
  // Diesel sirf utna hi wapas aata hai jitna abhi tak wapas nahi aaya.
  const dieselLeft = Math.max(0, Math.round((dieselTotal - alreadyPaid) * 100) / 100);
  const dieselRecovered = Math.min(dieselLeft, amount);
  const cashOut = Math.round((amount - dieselRecovered) * 100) / 100;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // BOOKING PAR PEHLE, PAISA BAAD MEIN.
  //
  // Ye tarteeb 6 September ki kharabi ke baad badli gayi. Pehle ulta
  // tha: cash nikalta, ledger mein entry banti, aur SAB SE AAKHIR mein
  // booking par "itna diya" charhta -- aur us aakhri qadam ki NAKAMI
  // KOI PARHTA HI NAHI THA.
  //
  // MB-2026-00004 par wahi hua. Us booking par kisan ke wade ki tareekh
  // guzar chuki thi, aur `fn_guard_payment_promise` har update ko rok
  // raha tha (340 mein theek hua). Update chup chaap nakaam hoti rahi,
  // safha "Rs 24,750 baqi" dikhata raha, aur Rs 30,000 TEEN dafa nikal
  // gaye -- Cash in Hand manfi Rs 88,000 par chala gaya.
  //
  // Ab agar ye qadam nakaam hota hai to WAHIN ruk jate hain: ek rupya
  // bhi bahar nahi gaya hota, aur bulane wale ko wajah nazar aati hai.
  const { error: bookingError } = await supabase
    .from("machinery_bookings")
    .update({ amount_paid_to_vendor: Number(booking.amount_paid_to_vendor) + payableSettled })
    .eq("id", bookingId);

  if (bookingError) {
    return {
      error: `Booking par adaigi darj nahi ho saki, is liye paisa bhi nahi nikala gaya: ${bookingError.message}`,
    };
  }

  /** Booking wapas wahin, jahan se chali thi. */
  const bookingWapas = async () => {
    await createServiceClient()
      .from("machinery_bookings")
      .update({ amount_paid_to_vendor: Number(booking.amount_paid_to_vendor) })
      .eq("id", bookingId);
  };

  // Kharche ki qatar sirf us paise ki banti hai jo waqai bahar gaya.
  // Diesel ka kharcha us din darj ho chuka tha.
  let txn: { id: string } | null = null;
  if (cashOut > 0) {
    const { data: row, error: txnError } = await supabase
      .from("finance_transactions")
      .insert({
        account_id: accountId,
        transaction_type: "expense",
        category: "Machinery Rental - Vendor Payout",
        amount: cashOut,
        transaction_date: aajKaKhana(),
        notes:
          dieselRecovered > 0
            ? `Booking ${booking.booking_number} - Vendor payout (Rs ${dieselRecovered.toLocaleString()} diesel wapas kata)`
            : `Booking ${booking.booking_number} - Vendor payout`,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (txnError || !row) {
      await bookingWapas();
      return { error: txnError?.message ?? "Payout darj nahi hua." };
    }
    txn = row;
  }

  // Account ka balance yahan haath se KAM NAHI kiya jata.
  //
  // finance_transactions par trigger (trg_finance_transaction_apply) khud
  // ye kaam karta hai. Pehle yahan dobara bhi kata jata tha, yani Rs 1,000
  // ke payout par balance Rs 2,000 kam hota tha. Jaanch kar ke dekha:
  // 0 -> trigger ke baad -1000 -> code ke apne update ke baad -2000.

  const posted = await postMachineryVendorPayout({
    bookingId,
    vendorId: booking.vendor_id,
    amount,
    advance,
    dieselRecovered,
    accountId,
    description:
      dieselRecovered > 0
        ? `Machinery ${booking.booking_number} — vendor ko us ka hissa (ART ka diesel Rs ${dieselRecovered.toLocaleString()} wapas)`
        : `Machinery ${booking.booking_number} — vendor ko us ka hissa`,
    ctx: {
      createdBy: user?.id ?? null,
      claims: txn ? [{ table: "finance_transactions", rowId: txn.id }] : [],
    },
  });
  if (failed(posted)) {
    if (txn) await createServiceClient().from("finance_transactions").delete().eq("id", txn.id);
    await bookingWapas();
    return { error: `Ledger mein nahi gaya, is liye payout darj nahi kiya: ${posted.error}` };
  }

  revalidatePath("/admin/machinery-rental");
  revalidatePath(`/admin/machinery-rental/booking/${bookingId}`);
  revalidatePath("/admin/finance");
  return {
    success: true,
    notice:
      advance > 0
        ? `Rs ${payableSettled.toLocaleString()} is booking ka hissa, aur Rs ${advance.toLocaleString()} vendor ke khate mein ADVANCE — wo us ki agli booking par kat jayega.`
        : undefined,
  };
}

/**
 * Baqi kaam ki agli booking.
 *
 * 15 acre ki booking thi, 7 kat gaye, 8 rah gaye. Bill 7 ka ban chuka
 * hai -- wo kaam ho chuka aur us ka paisa banta hai. Baqi 8 ek NAYA
 * kaam hai: nayi tareekh, nayi machine, naya bill.
 *
 * Kisan wohi, khet wohi, rate wohi. Ye "duplicate" nahi -- duplicate wo
 * hota jab ek hi kaam do jagah likha jaye. Yahan do alag kaam hain.
 *
 * Rate aur kisan ki tasdeeq pichli booking se aage le jayi jati hai:
 * kisan usi rate par raazi ho chuka hai aur ye usi kaam ka baqi hissa
 * hai. Magar ye baat chhupayi nahi jati -- nayi booking ke timeline
 * par saaf likha jata hai ke tasdeeq kahan se aayi.
 */
export async function createFollowUpBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const parentId = str(formData, "booking_id");
  if (!parentId) return { error: "Booking nahi mili." };

  const preferredDate = str(formData, "preferred_date");
  if (!preferredDate) return { error: "Baqi kaam kab karwana hai, wo tareekh likhein." };

  const { data: parent } = await supabase
    .from("machinery_bookings")
    .select(
      "id, booking_number, farmer_id, farm_id, crop_type, machine_type_requested, harvest_area, final_rate, rate_status, farmer_confirmed_at, location_address, village, will_sell_to_us, harvest_type, sabit_area, kutra_area, sabit_rate, kutra_rate"
    )
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return { error: "Booking nahi mili." };

  const { data: workRows } = await supabase
    .from("machinery_work_records")
    .select("actual_area, sabit_area, kutra_area")
    .eq("booking_id", parentId)
    .eq("verification_status", "verified");

  const done = (workRows ?? []).reduce((sum, w) => sum + Number(w.actual_area), 0);
  const auto = Math.round((Number(parent.harvest_area ?? 0) - done) * 100) / 100;
  const asked = num(formData, "remaining_acres");
  const remaining = asked && asked > 0 ? asked : auto;

  if (remaining <= 0) {
    return { error: "Is booking par koi raqba baqi nahi -- poora kaam ho chuka hai." };
  }

  // Qism bhi aage jati hai (176). Do qism ki booking par baqi kaam ka
  // batwara bhi baqi rehta hai: jo sabit reh gaya wo sabit, jo kutra
  // reh gaya wo kutra.
  //
  // Agar ek qism poori ho chuki ho to agli booking ek hi qism ki banti
  // hai -- "dono" likh dena wahan jhoot hota jahan doosra hissa hai hi
  // nahi, aur DB ka guard bhi usay theek hi rok deta.
  const doneSabit = (workRows ?? []).reduce((sum, w) => sum + Number(w.sabit_area ?? 0), 0);
  const doneKutra = (workRows ?? []).reduce((sum, w) => sum + Number(w.kutra_area ?? 0), 0);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  let childType = parent.harvest_type ?? null;
  let childSabit: number | null = null;
  let childKutra: number | null = null;
  let childSabitRate: number | null = null;
  let childKutraRate: number | null = null;

  if (parent.harvest_type === "dono") {
    const leftSabit = Math.max(round2(Number(parent.sabit_area ?? 0) - doneSabit), 0);
    const leftKutra = Math.max(round2(Number(parent.kutra_area ?? 0) - doneKutra), 0);
    // Staff ne apna raqba likha ho to batwara usi tanasub par -- warna
    // do hisson ka jor kul raqbe se mel nahi khata aur booking banti hi
    // nahi.
    const leftTotal = round2(leftSabit + leftKutra);
    if (leftSabit > 0 && leftKutra > 0 && leftTotal > 0) {
      childSabit = round2((leftSabit / leftTotal) * remaining);
      childKutra = round2(remaining - childSabit);
      childSabitRate = parent.sabit_rate == null ? null : Number(parent.sabit_rate);
      childKutraRate = parent.kutra_rate == null ? null : Number(parent.kutra_rate);
      if (childSabit <= 0 || childKutra <= 0) {
        childType = childSabit > 0 ? "sabit" : "kutra";
        childSabit = null;
        childKutra = null;
        childSabitRate = null;
        childKutraRate = null;
      }
    } else {
      childType = leftSabit > 0 ? "sabit" : "kutra";
    }
  }

  const bookingNumber = await nextNumber(supabase, "booking");

  const { data: booking, error } = await supabase
    .from("machinery_bookings")
    .insert({
      booking_number: bookingNumber,
      farmer_id: parent.farmer_id,
      farm_id: parent.farm_id,
      parent_booking_id: parent.id,
      booking_date: aajKaKhana(),
      status: "new",
      crop_type: parent.crop_type,
      machine_type_requested: parent.machine_type_requested,
      harvest_area_acres: remaining,
      preferred_date: preferredDate,
      location_address: parent.location_address,
      village: parent.village,
      will_sell_to_us: parent.will_sell_to_us,
      estimated_rate: parent.final_rate,
      rate_status: "estimated",
      harvest_type: childType,
      sabit_area: childSabit,
      kutra_area: childKutra,
      sabit_rate: childSabitRate,
      kutra_rate: childKutraRate,
      created_by: actorId,
    })
    .select("id, booking_number")
    .single();
  if (error || !booking) return { error: error?.message ?? "Agli booking nahi bani." };

  // Rate aur tasdeeq aage le jate hain -- magar alag qadam mein, taake
  // DB ka apna guard (jo tasdeeq ke baghair rate final nahi hone deta)
  // apni jagah lagta rahe.
  if (parent.rate_status === "final" && parent.final_rate && parent.farmer_confirmed_at) {
    await supabase
      .from("machinery_bookings")
      .update({
        // "dono" par final_rate database khud banata hai (176) -- yahan
        // sirf dono rate aage jate hain.
        ...(childType === "dono"
          ? { sabit_rate: childSabitRate, kutra_rate: childKutraRate }
          : { final_rate: parent.final_rate }),
        rate_status: "final",
        farmer_confirmed_at: parent.farmer_confirmed_at,
        farmer_confirmation_channel: "carried_forward",
        farmer_confirmation_response: `Rate Rs ${Number(parent.final_rate).toLocaleString()}/acre — tasdeeq booking ${parent.booking_number} se aayi`,
        status: "ready_for_harvest",
      })
      .eq("id", booking.id);
  }

  await logEvent({
    bookingId: booking.id,
    eventType: "booking_created",
    toStatus: "new",
    note: `Booking ${parent.booking_number} ka baqi kaam — ${remaining} acre${
      parent.final_rate ? `, rate Rs ${Number(parent.final_rate).toLocaleString()}/acre (pichli booking se)` : ""
    }`,
    actorId,
  });

  await logEvent({
    bookingId: parent.id,
    eventType: "follow_up_created",
    note: `Baqi ${remaining} acre ke liye nayi booking ${booking.booking_number} bani (${preferredDate})`,
    actorId,
  });

  revalidateAll(parentId);
  revalidateAll(booking.id);
  return {
    success: true,
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    notice: `Baqi ${remaining} acre ke liye booking ${booking.booking_number} ban gayi — ${preferredDate}. Kisan aur khet wohi hain.`,
  };
}

export async function cancelBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  const reason = str(formData, "reason");
  if (!bookingId) return { error: "Booking nahi mili." };
  if (!reason || reason.length < 5) return { error: "Cancel ki wajah likhein." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  const { data: advanceRows } = await supabase
    .from("machinery_payments")
    .select("amount")
    .eq("booking_id", bookingId)
    .eq("kind", "advance");
  const advanceTotal = (advanceRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  if (advanceTotal > 0 && formData.get("advance_handled") !== "on") {
    return {
      error: `Is booking par Rs ${advanceTotal.toLocaleString()} advance mila hua hai. Pehle tay karein ke wo kisan ko wapas hua ya agli booking par raha, phir cancel karein.`,
    };
  }

  const { error } = await supabase
    .from("machinery_bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: actorId,
      cancellation_reason: reason,
    })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId,
    eventType: "booking_cancelled",
    fromStatus: booking.status,
    toStatus: "cancelled",
    note: reason,
    actorId,
  });

  revalidateAll(bookingId);
  return { success: true };
}

// =====================================================================
// 9. Commission ka rate
// =====================================================================
/**
 * Company ka machinery commission rate badalna.
 *
 * Rate poori company ke liye ek hi hai aur ek hi jagah rehta hai
 * (platform_settings). Pehle wo har machine par bhi para tha; 120 mein wo
 * khana gira diya gaya, kyunki do jagah rate rakhne ka matlab hota ke ek
 * din screen kuch dikhaye aur bill kuch aur bane.
 *
 * Purane bill NAHI badalte. Har bill us waqt ka rate apne andar likh leta
 * hai (migration 119), is liye aaj rate badalne se pichla hisaab jyun ka
 * tyun rehta hai. Ye zaroori hai: warna rate badalte hi mahinon purana
 * munafa apne aap badal jata aur kisi ko pata na chalta.
 *
 * Kaun badal sakta hai: sirf malik / admin darja. Ye faisla kisi ek
 * booking ka nahi, poore kaarobar ka hai -- aur ye audit trail mein bhi
 * likha jata hai, kyunki commission badalna wo cheez hai jis ka asar har
 * agli booking par parta hai.
 */
export async function setMachineryCommissionRate(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", actorId ?? "")
    .maybeSingle();
  if (!profile || !["owner", "super_admin", "admin"].includes(profile.role)) {
    return { error: "Commission ka rate sirf malik ya admin badal sakta hai." };
  }

  const rate = num(formData, "rate");
  if (rate === null) return { error: "Rate likhein." };
  if (rate < 0 || rate > 100) return { error: "Rate 0 se 100 ke darmiyan hona chahiye." };

  const { data: current } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "machinery_commission_rate")
    .maybeSingle();
  const previous = current?.value === undefined || current?.value === null ? 12 : Number(current.value);

  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key: "machinery_commission_rate", value: rate }, { onConflict: "key" });
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "machinery",
    recordLabel: "Machinery commission rate",
    description: `Commission ${previous}% se ${rate}% kiya gaya. Purane bill nahi badle — har bill apna rate khud yaad rakhta hai.`,
  });

  revalidateAll();
  return { success: true };
}

// =====================================================================
// 10. Quick Farmer Registration
// =====================================================================
/**
 * Booking ke beech mein hi naya kisan bana lena.
 *
 * Kisan counter par khara hai. Usay ye keh kar rokna ke "pehle aap ka
 * ijra karna paRega, wo doosre safhe par hota hai" -- iska anjaam ye
 * hota hai ke staff kisi purane kisan ke naam par booking laga deta hai,
 * ya kaghaz par likh kar baad mein bhoolne ke liye chhoR deta hai.
 *
 * Is liye yahan sirf teen cheezein li jati hain: naam, mobile, zila.
 * Baqi tafseel (walid ka naam, CNIC, gaon, zameen, bank, kaghazat) baad
 * mein 360 profile se -- ek hi baar, aur phir har service usi ko parhti
 * hai.
 *
 * Gaon ki jagah ZILA jaan boojh kar hai. Gaon ka naam poochhne par
 * counter par khara banda "Chak 45" likh deta hai, aur Pakistan mein Chak
 * 45 darjanon hain -- us se na wo dhoonda ja sakta hai na koi hisaab
 * banta. Zila kam likhna hai aur us se kaam ban jata hai.
 *
 * Mobile pehle se kisi ke paas ho to naya kisan NAHI banta -- wohi purana
 * kisan chun liya jata hai. Ye jaan boojh kar hai: ek hi banda do khaton
 * mein bat jaye to us ka udhaar do jagah bat jata hai, aur phir kisi ek
 * jagah dekh kar ye keh dena mumkin ho jata hai ke "is par to kuch baqi
 * nahi".
 */
export async function quickRegisterFarmer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const fullName = str(formData, "full_name");
  if (!fullName) return { error: "Kisan ka naam likhein." };
  const phone = str(formData, "phone_number");
  const district = str(formData, "district");

  // Mobile ke baghair kisan banana mana hai. Wajah pehchan hai: farmer
  // code hum dete hain, magar dobara aane wale bande ko usi khate se
  // milane ke liye sirf mobile hai. Bina mobile ke banaya gaya kisan agli
  // baar dhoonda nahi ja sakta -- aur staff naya bana deta hai.
  if ((phone ?? "").replace(/\D/g, "").length < 10) return { error: "Mobile number sahi likhein — kisan ki pehchan yahi hai." };

  const already = await findFarmerByPhone(supabase, phone);
  if (already) {
    return {
      success: true,
      farmerId: already.id,
      farmerCode: already.farmerCode,
      farmerName: already.fullName ?? fullName,
      notice: `${alreadyRegisteredMessage(already)} Wohi kisan chun liya gaya.`,
    };
  }

  // Farmer code yahan NAHI banta -- database ka apna silsila hai
  // (migration 121). Pehle ye teen jagah teen alag tareeqon se banta tha,
  // aur do log ek hi lamhe mein kisan banayen to dono ko ek hi number mil
  // jata tha.
  const { data: created, error } = await supabase
    .from("farmers")
    .insert({
      full_name: fullName,
      phone_number: phone,
      district,
      registration_source: "STAFF",
    })
    .select("id, farmer_code, full_name")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      return { error: "Ye number pehle se kisi aur kisan ka hai. Us ka Farmer ID likh kar chunein." };
    }
    return { error: error?.message ?? "Kisan nahi bana." };
  }

  revalidatePath("/admin/farmers");
  revalidatePath("/admin/machinery-rental/booking/new");
  return {
    success: true,
    farmerId: created.id,
    farmerCode: created.farmer_code,
    farmerName: created.full_name ?? fullName,
  };
}
