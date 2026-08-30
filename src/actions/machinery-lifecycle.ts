"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { alreadyRegisteredMessage, findFarmerByPhone } from "@/lib/farmers/identity";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyRoles } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { sendWhatsAppMessage } from "@/lib/whatsapp-client";
import {
  postMachineryAdvance,
  postMachineryBill,
  postMachineryPayment,
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
async function nextNumber(
  supabase: Client,
  table: "machinery_booking_counters" | "machinery_bill_counters",
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const { data: existing } = await supabase.from(table).select("last_number").eq("year", year).maybeSingle();
  const next = (existing?.last_number ?? 0) + 1;
  if (existing) {
    await supabase.from(table).update({ last_number: next }).eq("year", year);
  } else {
    await supabase.from(table).insert({ year, last_number: next });
  }
  return `${prefix}-${year}-${String(next).padStart(5, "0")}`;
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

  const bookingNumber = await nextNumber(supabase, "machinery_booking_counters", "MB");

  const { data: booking, error } = await supabase
    .from("machinery_bookings")
    .insert({
      booking_number: bookingNumber,
      farmer_id: farmerId,
      booking_date: str(formData, "booking_date") ?? new Date().toISOString().slice(0, 10),
      status: "new",

      crop_type: str(formData, "crop_type"),
      village: str(formData, "village"),
      location_address: str(formData, "location_address"),
      location_lat: num(formData, "location_lat"),
      location_lng: num(formData, "location_lng"),
      field_access: str(formData, "field_access"),
      expected_harvest_date: str(formData, "expected_harvest_date"),
      preferred_date: str(formData, "preferred_date"),
      preferred_time: str(formData, "preferred_time"),
      special_instructions: str(formData, "special_instructions"),

      // Do sawal jin ka jawab na hone se machine khali jati hai
      // (migration 125). "unknown" bhi ek sahi jawab hai -- booking
      // aksar hafta pehle hoti hai.
      field_ready: str(formData, "field_ready"),
      harvest_ready: str(formData, "harvest_ready"),

      total_area_acres: num(formData, "total_area_acres"),
      total_area_kanal: num(formData, "total_area_kanal"),
      harvest_area_acres: harvestAcres,
      harvest_area_kanal: harvestKanal,

      machine_type_requested: machineType,
      machine_id: str(formData, "machine_id"),
      required_units: num(formData, "required_units") ?? 1,
      trolley_required: formData.get("trolley_required") === "on",
      other_service: str(formData, "other_service"),

      estimated_rate: num(formData, "estimated_rate"),
      rate_status: "estimated",

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
        payment_date: new Date().toISOString().slice(0, 10),
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
  if (!args.accountId) return "Advance kis khate mein aaya, wo select karein.";

  const { data: payment, error } = await args.supabase
    .from("machinery_payments")
    .insert({
      booking_id: args.bookingId,
      kind: "advance",
      amount: args.amount,
      method,
      finance_account_id: args.accountId,
      payment_date: args.paymentDate ?? new Date().toISOString().slice(0, 10),
      reference: args.reference,
      evidence_url: args.evidenceUrl,
      received_by: args.actorId,
    })
    .select("id")
    .single();

  if (error || !payment) return error?.message ?? "Advance darj nahi hua.";

  const posted = await postMachineryAdvance({
    bookingId: args.bookingId,
    farmerId: args.farmerId,
    amount: args.amount,
    accountId: args.accountId,
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
export async function verifyAdvanceClaim(_prev: ActionState, formData: FormData): Promise<ActionState> {
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
      note: `Rs ${Number(payment.amount).toLocaleString()} ka dawa rad: ${reason}`,
      actorId,
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
    description: `Machinery booking ${booking.booking_number} — advance (kisan ka dawa, tasdeeq shuda)`,
    ctx: {
      createdBy: actorId,
      entryDate: payment.payment_date ?? undefined,
      claims: [{ table: "machinery_payments", rowId: paymentId }],
    },
  });

  // Ledger mein na ja sake to tasdeeq bhi wapas -- dawa phir se dawa.
  // Verified likha rehna aur ledger khali hona sab se buri shakal hai:
  // bill us paise ko kaat leta jo kabhi kisi khate mein aaya hi nahi.
  if (failed(posted)) {
    await createServiceClient()
      .from("machinery_payments")
      .update({ verification_status: "claimed", finance_account_id: null, verified_by: null, verified_at: null })
      .eq("id", paymentId);
    return { error: `Ledger mein nahi gaya, is liye tasdeeq nahi ki: ${posted.error}` };
  }

  await logEvent({
    bookingId: payment.booking_id,
    eventType: "advance_claim_verified",
    note: `Rs ${Number(payment.amount).toLocaleString()} ka dawa tasdeeq shuda`,
    actorId,
  });

  revalidateAll(payment.booking_id);
  return { success: true };
}

export async function sendRateConfirmation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  const finalRate = num(formData, "final_rate");
  if (!bookingId) return { error: "Booking nahi mili." };
  if (!finalRate || finalRate <= 0) return { error: "Final rate sahi likhein." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select(
      "id, booking_number, status, farmer_id, crop_type, harvest_area, expected_harvest_date, farmer_confirmed_at, machine_id, farmers(full_name, phone_number), machinery_vendor_machines(machine_type, model)"
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  const farmer = Array.isArray(booking.farmers) ? booking.farmers[0] : booking.farmers;
  const machine = Array.isArray(booking.machinery_vendor_machines)
    ? booking.machinery_vendor_machines[0]
    : booking.machinery_vendor_machines;

  // Naya rate bhejna matlab purani tasdeeq khatam. Warna kisan ne
  // Rs 7,500 par haan ki thi aur record Rs 9,000 par "tasdeeq shuda"
  // dikhata rehta.
  const { data: advanceRows } = await supabase
    .from("machinery_payments")
    .select("amount")
    .eq("booking_id", bookingId)
    .eq("kind", "advance");
  const advanceTotal = (advanceRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  const { error } = await supabase
    .from("machinery_bookings")
    .update({
      final_rate: finalRate,
      rate_status: "agreed",
      rate_confirmation_rate: finalRate,
      rate_confirmation_sent_at: new Date().toISOString(),
      rate_confirmation_sent_by: actorId,
      farmer_confirmed_at: null,
      farmer_confirmation_response: null,
      farmer_confirmation_channel: null,
    })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  const area = Number(booking.harvest_area ?? 0);
  const message = [
    `Assalam-o-Alaikum ${farmer?.full_name ?? ""} Sahib,`,
    ``,
    `aapki Machinery Booking ${booking.booking_number} ke liye kattai ka final rate Rs ${finalRate.toLocaleString()} per acre hai.`,
    machine ? `Machine: ${machine.machine_type}${machine.model ? ` (${machine.model})` : ""}` : null,
    `Estimated Area: ${area} Acres`,
    advanceTotal > 0 ? `Advance Received: Rs ${advanceTotal.toLocaleString()}` : null,
    booking.expected_harvest_date ? `Harvest Date: ${booking.expected_harvest_date}` : null,
    ``,
    `Barah-e-karam rate aur booking details confirm karein.`,
    `CONFIRM / ISSUE`,
  ]
    .filter(Boolean)
    .join("\n");

  let delivery = "WhatsApp par bheja gaya";
  if (farmer?.phone_number) {
    try {
      await sendWhatsAppMessage(farmer.phone_number, message);
    } catch {
      // Message na jaye to bhi rate darj rehta hai -- staff phone kar ke
      // jawab khud darj kar sakta hai. Rok yahan nahi, tasdeeq par hai.
      delivery = "WhatsApp par nahi ja saka — kisan se raabta kar ke jawab khud darj karein";
    }
  } else {
    delivery = "Kisan ka phone number nahi hai — jawab khud darj karna hoga";
  }

  await logEvent({
    bookingId,
    eventType: "rate_confirmation_sent",
    note: `Rs ${finalRate.toLocaleString()}/acre — ${delivery}`,
    actorId,
  });

  revalidateAll(bookingId);
  return { success: true };
}

/**
 * Kisan ka jawab darj karo -- jaisa aaya waisa.
 *
 * Jawab ka matn poora mehfooz hota hai. "Confirmed" ka tick laga dena
 * kaafi nahi: kal agar kisan kahe ke maine haan nahi ki thi, to us ke
 * apne alfaz hi jawab hain.
 */
export async function recordFarmerConfirmation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  const response = str(formData, "response");
  const channel = str(formData, "channel") ?? "manual";
  if (!bookingId) return { error: "Booking nahi mili." };
  if (!response) return { error: "Kisan ne jo kaha wo likhein." };

  // Faisla ab SAAF poochha jata hai, matn se andaza nahi lagaya jata.
  //
  // Pehle yahan likhe hue jumle mein "haan / ok / confirm" dhoonda jata
  // tha. Wo do tarah se toota: staff ne "call" likh diya (matlab jawab
  // phone par aaya) aur system ne usay AITRAAZ samajh liya -- qadam
  // khula reh gaya aur kisi ko wajah nazar nahi aayi. Doosri taraf
  // "haan magar itne mein nahi kar sakta" mein bhi "haan" mil jata aur
  // rate final ho jata.
  //
  // Kisan ne haan ki ya nahi -- ye us bande ko maloom hai jo phone par
  // tha. Usi se poochh lena andaze se hamesha behtar hai.
  const decision = str(formData, "decision");
  if (decision !== "accept" && decision !== "issue") {
    return { error: "Batayein ke kisan ne HAAN ki ya aitraaz kiya." };
  }
  const accepted = decision === "accept";

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, status, rate_confirmation_sent_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };
  if (!booking.rate_confirmation_sent_at) {
    return { error: "Pehle kisan ko rate bhejein, phir jawab darj karein." };
  }

  if (!accepted) {
    // Aitraaz bhi record hai. Ise chhupa dena matlab wo bahes kal
    // dobara honi hai, aur us waqt koi kaghaz nahi hoga.
    await logEvent({
      bookingId,
      eventType: "farmer_raised_issue",
      note: response,
      actorId,
    });
    revalidateAll(bookingId);
    return {
      success: true,
      notice: `Kisan ka aitraaz darj ho gaya: "${response}". Rate abhi final nahi hua — naya rate bhej kar dobara poochhein.`,
    };
  }

  const { error } = await supabase
    .from("machinery_bookings")
    .update({
      farmer_confirmed_at: new Date().toISOString(),
      farmer_confirmation_channel: channel,
      farmer_confirmation_response: response,
      rate_status: "final",
      status: "ready_for_harvest",
    })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId,
    eventType: "farmer_confirmed",
    fromStatus: booking.status,
    toStatus: "ready_for_harvest",
    note: response,
    actorId,
  });

  revalidateAll(bookingId);
  return { success: true, notice: "Kisan ki tasdeeq darj ho gayi — ab machine bheji ja sakti hai." };
}

/**
 * Manager ka override -- kisan ke jawab ke baghair aage barhna.
 *
 * Kabhi kabhi waqai zaroorat parti hai (kisan ka phone band, machine
 * khet par khari hai). Magar ye khamoshi se nahi hota: kaun, kyun, aur
 * saboot -- teenon lazmi hain, aur DB khud ye shart lagati hai.
 */
export async function overrideConfirmation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  const reason = str(formData, "reason");
  const evidenceUrl = str(formData, "evidence_url");
  if (!bookingId) return { error: "Booking nahi mili." };
  if (!reason || reason.length < 10) return { error: "Wajah tafseel se likhein (kam az kam 10 harf)." };
  if (!evidenceUrl) return { error: "Saboot lagayein (tasveer ya recording ka link)." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", actorId ?? "")
    .maybeSingle();
  const allowed = ["owner", "super_admin", "admin", "manager"];
  if (!profile || !allowed.includes(profile.role)) {
    return { error: "Ye kaam sirf manager ya us se upar kar sakta hai." };
  }

  const { error } = await supabase
    .from("machinery_bookings")
    .update({
      confirmation_override_by: actorId,
      confirmation_override_reason: reason,
      confirmation_override_evidence_url: evidenceUrl,
      rate_status: "final",
      status: "ready_for_harvest",
    })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId,
    eventType: "confirmation_overridden",
    toStatus: "ready_for_harvest",
    note: reason,
    evidenceUrl,
    actorId,
  });

  await notifyRoles(
    ["super_admin", "admin", "owner"],
    "Machinery: kisan ki tasdeeq ke baghair aage barha gaya",
    reason,
    `/admin/machinery-rental/booking/${bookingId}`
  );

  revalidateAll(bookingId);
  return { success: true };
}

// =====================================================================
// 4. Machine ki rawangi
// =====================================================================
/**
 * Diesel ka kharcha: ek hi jagah likha jata hai.
 *
 * Raqam finance_transactions ki qatar hai (wahan ka trigger khata ka
 * balance khud hilata hai, 127), aur dispatch us qatar ki taraf ishara
 * karta hai. Dispatch par raqam dobara "yaad" nahi rakhi jati jise koi
 * haath se badal sake.
 */
async function saveDieselExpense(args: {
  supabase: Client;
  dispatchId: string;
  bookingNumber: string;
  amount: number;
  accountId: string;
  litres: number | null;
  actorId: string | null;
}): Promise<string | null> {
  const litrePart = args.litres && args.litres > 0 ? ` — ${args.litres} litre` : "";

  const { data: expense, error } = await args.supabase
    .from("finance_transactions")
    .insert({
      account_id: args.accountId,
      transaction_type: "expense",
      category: "Machinery - Diesel",
      amount: args.amount,
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: `Diesel — machinery booking ${args.bookingNumber}${litrePart}`,
      created_by: args.actorId,
    })
    .select("id")
    .single();
  if (error || !expense) return error?.message ?? "Diesel ka kharcha darj nahi hua.";

  const posted = await postCashOut({
    accountId: args.accountId,
    amount: args.amount,
    description: `Diesel — machinery booking ${args.bookingNumber}`,
    againstAccount: ACC.fuel,
    ctx: {
      createdBy: args.actorId,
      claims: [{ table: "finance_transactions", rowId: expense.id }],
    },
  });
  if (failed(posted)) {
    await createServiceClient().from("finance_transactions").delete().eq("id", expense.id);
    return `Ledger mein nahi gaya, is liye diesel darj nahi kiya: ${posted.error}`;
  }

  await args.supabase
    .from("machinery_dispatches")
    .update({ fuel_expense_id: expense.id })
    .eq("id", args.dispatchId);

  return null;
}

export async function dispatchMachine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  const machineId = str(formData, "machine_id");
  if (!bookingId) return { error: "Booking nahi mili." };
  if (!machineId) return { error: "Machine select karein." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, status, location_address, location_lat, location_lng")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  const { data: machine } = await supabase
    .from("machinery_vendor_machines")
    .select("vendor_id")
    .eq("id", machineId)
    .maybeSingle();

  // Diesel jo company ne khud dala.
  //
  // Ye paisa waqai jata hai, is liye ise ledger mein jana hai -- warna
  // machine chalti rehti hai aur kharcha kahin nazar nahi aata. Raqam
  // aur khata dono chahiye: raqam bina khate ke ye nahi batati ke paisa
  // kahan se gaya (migration 142 mein yehi rok DB par bhi lagi hai).
  const fuelAmount = num(formData, "fuel_amount") ?? 0;
  const fuelPaidBy = str(formData, "fuel_paid_by");
  const fuelAccountId = str(formData, "fuel_account_id");
  if (fuelAmount < 0) return { error: "Diesel ki raqam manfi nahi ho sakti." };
  if (fuelAmount > 0 && !fuelPaidBy) {
    return { error: "Diesel kis ne dala — kisan, vendor ya ART — wo select karein." };
  }
  if (fuelAmount > 0 && fuelPaidBy === "company" && !fuelAccountId) {
    return { error: "ART ka diesel hai to khata bhi select karein ke kis khate se nikla." };
  }
  const companyFuel = fuelAmount > 0 && fuelPaidBy === "company";

  const { data: dispatch, error: dispatchError } = await supabase
    .from("machinery_dispatches")
    .insert({
      booking_id: bookingId,
      machine_id: machineId,
      operator_name: str(formData, "operator_name"),
      driver_phone: str(formData, "driver_phone"),
      departure_at: str(formData, "departure_at") ?? new Date().toISOString(),
      opening_meter: num(formData, "opening_meter"),
      fuel_litres: num(formData, "fuel_litres"),
      fuel_amount: fuelAmount > 0 ? fuelAmount : null,
      fuel_paid_by: fuelAmount > 0 ? fuelPaidBy : null,
      // Khata sirf ART ke diesel par. Kisan ya vendor ka diesel darj to
      // hota hai magar hamare paise se us ka koi taalluq nahi.
      fuel_account_id: companyFuel ? fuelAccountId : null,
      destination_address: str(formData, "destination_address") ?? booking.location_address,
      destination_lat: num(formData, "destination_lat") ?? booking.location_lat,
      destination_lng: num(formData, "destination_lng") ?? booking.location_lng,
      notes: str(formData, "notes"),
      created_by: actorId,
    })
    .select("id")
    .single();
  if (dispatchError || !dispatch) return { error: dispatchError?.message ?? "Rawangi darj nahi hui." };

  if (companyFuel && fuelAccountId) {
    const fuelError = await saveDieselExpense({
      supabase,
      dispatchId: dispatch.id,
      bookingNumber: booking.booking_number,
      amount: fuelAmount,
      accountId: fuelAccountId,
      litres: num(formData, "fuel_litres"),
      actorId,
    });
    // Diesel ka kharcha ledger mein na ja saka to rawangi bhi wapas.
    // Aadhi qatar -- rawangi likhi hui aur paisa kahin darj nahi --
    // sab se buri shakal hai: machine chali gayi aur hisaab khali.
    if (fuelError) {
      await createServiceClient().from("machinery_dispatches").delete().eq("id", dispatch.id);
      return { error: fuelError };
    }
  }

  const { error } = await supabase
    .from("machinery_bookings")
    .update({
      machine_id: machineId,
      vendor_id: machine?.vendor_id ?? null,
      status: "in_progress",
    })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId,
    eventType: "machine_dispatched",
    fromStatus: booking.status,
    toStatus: "in_progress",
    note: str(formData, "operator_name"),
    actorId,
  });

  revalidateAll(bookingId);
  return { success: true };
}

// =====================================================================
// 5. Asal kaam
// =====================================================================
/**
 * Kattai ke baad asal raqba darj karo.
 *
 * Yehi wo qadam hai jis ki wajah se poora module bana: bill ab is qatar
 * se banega, booking ke andaze se nahi. Booking par 10 acre likhe hon
 * aur nikle 9.5, to kisan se 9.5 ka hi bill banega.
 */
export async function recordWorkCompletion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking nahi mili." };

  const acres = num(formData, "actual_area_acres");
  const kanal = num(formData, "actual_area_kanal");
  if (toAcres(acres, kanal) <= 0) return { error: "Asal raqba likhein (acre ya kanal)." };

  const workDate = str(formData, "work_date") ?? new Date().toISOString().slice(0, 10);
  const isFinal = formData.get("is_final") === "on";

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, status, harvest_area, rate_status, final_rate")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  // Kaam poora ho chuka ho to us ke baad ka koi indraj nahi. Warna
  // bill ban jane ke baad bhi raqba barhta rehta aur bill us se alag
  // ho jata.
  const { data: existing } = await supabase
    .from("machinery_work_records")
    .select("id, work_date, actual_area, is_final")
    .eq("booking_id", bookingId);

  if ((existing ?? []).some((w) => w.is_final)) {
    return { error: "Is booking ka kaam mukammal ho chuka hai -- ab naya indraj nahi ho sakta." };
  }

  const sameDay = (existing ?? []).find((w) => w.work_date === workDate);

  // Ek din ki ek hi qatar (migration 143). Usi din ka dobara indraj
  // ghalti ki durusti hai, nayi qatar nahi -- warna 3 acre do dafa
  // chaRh kar 6 ho jate.
  const payload = {
    booking_id: bookingId,
    work_date: workDate,
    is_final: isFinal,
    actual_area_acres: acres,
    actual_area_kanal: kanal,
    started_at: str(formData, "started_at"),
    finished_at: str(formData, "finished_at"),
    meter_reading: num(formData, "meter_reading"),
    completion_photo_url: str(formData, "completion_photo_url"),
    location_lat: num(formData, "location_lat"),
    location_lng: num(formData, "location_lng"),
    farmer_confirmed: formData.get("farmer_confirmed") === "on",
    farmer_confirmation_note: str(formData, "farmer_confirmation_note"),
    notes: str(formData, "notes"),
    created_by: actorId,
  };

  const { error: workError } = sameDay
    ? await supabase.from("machinery_work_records").update(payload).eq("id", sameDay.id)
    : await supabase.from("machinery_work_records").insert(payload);
  if (workError) return { error: workError.message };

  // Ab tak ka jor -- yehi adad bill banate waqt bhi istemal hoga.
  const doneSoFar =
    (existing ?? [])
      .filter((w) => w.work_date !== workDate)
      .reduce((sum, w) => sum + Number(w.actual_area), 0) + toAcres(acres, kanal);
  const remaining = Math.max(Number(booking.harvest_area ?? 0) - doneSoFar, 0);

  // Booking sirf tab bill ki halat mein jati hai jab kaam poora ho.
  // Warna wo "kaam darj karna" ki qatar mein khari rehti hai -- aur
  // yehi wo qatar hai jo agle din yaad dilati hai ke wahan jana hai.
  const nextStatus = isFinal ? "bill_pending" : "in_progress";

  const { error } = await supabase
    .from("machinery_bookings")
    .update(
      isFinal
        ? { status: nextStatus, completed_at: new Date().toISOString() }
        : { status: nextStatus }
    )
    .eq("id", bookingId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId,
    eventType: isFinal ? "work_completed" : "work_progress",
    fromStatus: booking.status,
    toStatus: nextStatus,
    note: isFinal
      ? `${toAcres(acres, kanal)} acre (${workDate}) — kaam mukammal, kul ${doneSoFar} acre`
      : `${toAcres(acres, kanal)} acre (${workDate}) — ab tak ${doneSoFar} acre, baqi ${remaining} acre`,
    evidenceUrl: str(formData, "completion_photo_url"),
    actorId,
  });

  if (!isFinal) {
    revalidateAll(bookingId);
    return { success: true, notice: `Ab tak ${doneSoFar} acre — baqi ${remaining} acre.` };
  }

  // Agli fasal ki yaad dahani ka sawal YAHAN poochha jata hai, booking
  // par nahi. Booking ke waqt kisan ko abhi tajurba hi nahi hua ke kaam
  // kaisa raha -- us waqt ka "haan" sirf adab hai. Kaam khatam hone par
  // diya gaya jawab wo hai jis par agle saal phone kiya ja sakta hai.
  const reminder = tribool(formData, "wants_next_season_reminder");
  if (reminder !== null) {
    await supabase
      .from("machinery_bookings")
      .update({ wants_next_season_reminder: reminder })
      .eq("id", bookingId);
  }

  // Kaam poora hote hi bill khud ban jata hai -- staff ko dobara kuch
  // dabana nahi parta. Hisaab wahi: kul raqba x tay shuda rate, us mein
  // se advance, baqi kisan ke zimme. Rate abhi tak confirm na hua ho to
  // bill nahi banta -- us soorat mein rate confirm karne ke baad "Bill
  // banayein" wala button apna kaam karta hai.
  if (booking.rate_status !== "final" || !booking.final_rate) {
    revalidateAll(bookingId);
    return {
      success: true,
      notice: `Kaam mukammal — kul ${doneSoFar} acre. Bill abhi nahi bana: pehle kisan se final rate confirm karwayein.`,
    };
  }

  const billed = await buildFinalBill(supabase, bookingId, actorId);
  revalidateAll(bookingId);
  if (billed.error) {
    return { success: true, notice: `Kaam mukammal — kul ${doneSoFar} acre. Bill nahi bana: ${billed.error}` };
  }
  return {
    success: true,
    billNumber: billed.billNumber,
    notice: `Kaam mukammal — kul ${doneSoFar} acre. Bill ${billed.billNumber ?? ""} khud ban gaya hai.`,
  };
}

// =====================================================================
// 6. Final bill
// =====================================================================
/**
 * Bill system khud banata hai -- staff sirf "bana do" kehta hai.
 *
 * Raqam kahin haath se nahi bhari jati: asal raqba x wo rate jis par
 * kisan raazi hua, aur us mein se poora advance. Ye jaan boojh kar hai:
 * jis din bill ka number haath se bhara jane laga, usi din wo hisaab
 * nahi raha, ek raye ban gaya.
 */

/**
 * Kisan ko final bill ki raseed.
 *
 * Is paighaam mein COMMISSION aur VENDOR ka hissa jaan boojh kar nahi
 * hai. Kisan ka hisaab teen adad ka hai: kaam kitna hua, rate kya tha,
 * aur ab kitna dena hai. Commission hamara aur vendor ka maamla hai;
 * usay kisan ke bill par likh dena us ke saamne ek naya sawal khaRa kar
 * deta hai jis ka us ke apne hisaab se koi taalluq nahi.
 *
 * Adad yahan dobara ginay NAHI jaate -- wo wohi hain jo database ne bill
 * banate waqt khud nikale (migration 119). Agar ye paighaam apna hisaab
 * karta to ek din wo bill se alag ho jata, aur kisan ke haath mein do
 * mukhtalif adad hote.
 */
async function sendFarmerBillReceipt(
  supabase: ReturnType<typeof createClient>,
  p: {
    bookingId: string;
    bookingNumber: string;
    farmerId: string;
    billNumber: string;
    area: number;
    rate: number;
    gross: number;
    advance: number;
    balance: number;
    actorId: string | null;
  }
) {
  const { data: farmer } = await supabase
    .from("farmers")
    .select("full_name, phone_number")
    .eq("id", p.farmerId)
    .maybeSingle();

  const message = [
    `Assalam-o-Alaikum ${farmer?.full_name ?? ""} Sahib,`,
    ``,
    `Machinery Booking ${p.bookingNumber} ka final bill ${p.billNumber} ban gaya hai.`,
    ``,
    `Kaam: ${p.area} Acre x Rs ${p.rate.toLocaleString()} per acre`,
    `Kul: Rs ${p.gross.toLocaleString()}`,
    p.advance > 0 ? `Advance mujra: Rs ${p.advance.toLocaleString()}` : null,
    p.balance > 0 ? `Baqi dena: Rs ${p.balance.toLocaleString()}` : `Hisaab poora ho gaya — kuch baqi nahi.`,
    ``,
    `Shukriya. Al Rana Traders`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!farmer?.phone_number) {
    await logEvent({ bookingId: p.bookingId, eventType: "farmer_notified", note: "Kisan ka phone number nahi hai — bill ki raseed nahi ja saki", actorId: p.actorId });
    return;
  }

  try {
    await sendWhatsAppMessage(farmer.phone_number, message);
    await logEvent({ bookingId: p.bookingId, eventType: "farmer_notified", note: `Bill ${p.billNumber} ki raseed WhatsApp par bheji gayi`, actorId: p.actorId });
  } catch {
    await logEvent({ bookingId: p.bookingId, eventType: "farmer_notified", note: `Bill ${p.billNumber} ki raseed nahi ja saki — kisan ko khud ittila dein`, actorId: p.actorId });
  }
}

export async function generateFinalBill(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking nahi mili." };
  return buildFinalBill(supabase, bookingId, actorId);
}

/**
 * Bill banane ka asal kaam -- ek hi jagah.
 *
 * Do jagah se bulaya jata hai: kaam mukammal hote hi khud-ba-khud, aur
 * "Bill banayein" ke button se (jab rate us waqt tak confirm na hua ho).
 * Dono raaste ek hi hisaab par jate hain -- warna kisi din wo alag ho
 * jate aur kisan ke haath do mukhtalif bill hote.
 */
async function buildFinalBill(
  supabase: Client,
  bookingId: string,
  actorId: string | null
): Promise<ActionState> {

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, status, farmer_id, vendor_id, final_rate, rate_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };
  if (booking.rate_status !== "final" || !booking.final_rate) {
    return { error: "Bill se pehle final rate kisan se confirm karwana zaroori hai." };
  }

  // Bill kai din ke kaam ke JOR se banta hai, kisi ek din se nahi
  // (migration 143). Kattai aksar ek din mein poori nahi hoti.
  const { data: workRows } = await supabase
    .from("machinery_work_records")
    .select("actual_area, is_final")
    .eq("booking_id", bookingId);

  if (!workRows || workRows.length === 0) {
    return { error: "Pehle asal kaam darj karein (kitne acre waqai kaate gaye)." };
  }
  if (!workRows.some((w) => w.is_final)) {
    return {
      error: "Kaam abhi mukammal nishaan zada nahi hua. Aakhri indraj par \"kaam poora ho gaya\" par nishaan lagayein, phir bill banega.",
    };
  }

  const { data: existingBill } = await supabase
    .from("machinery_bills")
    .select("bill_number")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (existingBill) return { error: `Is booking ka bill pehle hi ban chuka hai (${existingBill.bill_number}).` };

  const { data: payments } = await supabase
    .from("machinery_payments")
    .select("amount, kind")
    .eq("booking_id", bookingId);

  const advanceTotal = (payments ?? [])
    .filter((p) => p.kind === "advance")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const previousPayment = (payments ?? [])
    .filter((p) => p.kind === "final")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const area =
    Math.round(workRows.reduce((sum, w) => sum + Number(w.actual_area), 0) * 10000) / 10000;
  const rate = Number(booking.final_rate);
  const gross = Math.round(area * rate * 100) / 100;
  const advanceAdjusted = Math.min(advanceTotal, gross);
  const balance = Math.round((gross - advanceAdjusted - previousPayment) * 100) / 100;

  // Commission yahan hisaab NAHI hota.
  //
  // Gross, commission (12%) aur vendor ka hissa -- teenon database khud
  // bharta hai (migration 119), asal tasdeeq shuda raqbe aur us rate par
  // jis par kisan raazi hua. Yahan dobara hisaab karne ka matlab hota do
  // jagah do qaide, aur kisi din wo alag ho jate.
  //
  // Is liye neeche insert ke baad wahi number wapas parhe jate hain jo
  // database ne likhe, aur ledger unhi se banta hai -- taake bill aur
  // ledger kabhi alag na keh saken.

  const billNumber = await nextNumber(supabase, "machinery_bill_counters", "MBL");

  const { data: bill, error } = await supabase
    .from("machinery_bills")
    .insert({
      booking_id: bookingId,
      bill_number: billNumber,
      actual_area: area,
      rate_amount: rate,
      gross_amount: gross,
      advance_adjusted: advanceAdjusted,
      previous_payment: previousPayment,
      balance_payable: balance,
      created_by: actorId,
    })
    .select("id, gross_amount, commission_percentage, commission_amount, vendor_payable, advance_adjusted, balance_payable")
    .single();
  if (error || !bill) return { error: error?.message ?? "Bill nahi bana." };

  const commissionPct = Number(bill.commission_percentage);
  const commissionAmount = Number(bill.commission_amount);
  const vendorPayable = Number(bill.vendor_payable);
  const finalGross = Number(bill.gross_amount);
  const finalAdvance = Number(bill.advance_adjusted);
  const finalBalance = Number(bill.balance_payable);

  const posted = await postMachineryBill({
    bookingId,
    farmerId: booking.farmer_id,
    vendorId: booking.vendor_id,
    grossAmount: finalGross,
    commissionAmount,
    vendorPayable,
    advanceAdjusted: finalAdvance,
    description: `Machinery ${booking.booking_number} — bill ${billNumber} (${area} acre x Rs ${rate})`,
    ctx: {
      createdBy: actorId,
      claims: [{ table: "machinery_bills", rowId: bill.id }],
    },
  });

  if (failed(posted)) {
    await createServiceClient().from("machinery_bills").delete().eq("id", bill.id);
    return { error: `Ledger mein nahi gaya, is liye bill nahi banaya: ${posted.error}` };
  }

  await supabase
    .from("machinery_bookings")
    .update({
      status: finalBalance > 0 ? "payment_pending" : "closed",
      total_amount: finalGross,
      commission_percentage: commissionPct,
      commission_amount: commissionAmount,
      vendor_payable: vendorPayable,
    })
    .eq("id", bookingId);

  await logEvent({
    bookingId,
    eventType: "bill_generated",
    fromStatus: booking.status,
    toStatus: finalBalance > 0 ? "payment_pending" : "closed",
    note: `${billNumber}: ${area} acre x Rs ${rate} = Rs ${finalGross.toLocaleString()} (commission ${commissionPct}% = Rs ${commissionAmount.toLocaleString()}, vendor ka Rs ${vendorPayable.toLocaleString()}), advance Rs ${finalAdvance.toLocaleString()}, baqi Rs ${finalBalance.toLocaleString()}`,
    actorId,
  });

  await sendFarmerBillReceipt(supabase, {
    bookingId,
    bookingNumber: booking.booking_number,
    farmerId: booking.farmer_id,
    billNumber,
    area,
    rate,
    gross: finalGross,
    advance: finalAdvance,
    balance: finalBalance,
    actorId,
  });

  revalidateAll(bookingId);
  return { success: true, billNumber };
}

// =====================================================================
// 7. Final payment
// =====================================================================
/**
 * Baqi paisa -- ek raaste se ya kai raaston se.
 *
 * Split payment ka matlab hai ek hi bill teen jagah se bhara: kuch cash,
 * kuch bank, kuch khata par. Har hissa apni qatar mein jata hai taake
 * Money Trail ko teenon manzilein alag alag nazar aayein -- magar hisaab
 * ek hi bill ka.
 *
 * Khata par koi ledger entry nahi banti: wo paisa aaya hi nahi, sirf
 * kisan ke khate mein pada reh gaya (bill bante waqt wo pehle hi us ke
 * naam likha ja chuka hai).
 */
export async function recordFinalPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking nahi mili." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, status, farmer_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  const { data: bill } = await supabase
    .from("machinery_bills")
    .select("balance_payable")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!bill) return { error: "Pehle bill banayein." };

  const lines: Array<{ method: string; amount: number; accountId: string | null; reference: string | null }> = [];
  for (let i = 0; i < 5; i += 1) {
    const amount = num(formData, `line_${i}_amount`);
    const method = str(formData, `line_${i}_method`);
    if (!amount || amount <= 0 || !method) continue;
    lines.push({
      method,
      amount,
      accountId: str(formData, `line_${i}_account_id`),
      reference: str(formData, `line_${i}_reference`),
    });
  }
  if (lines.length === 0) return { error: "Kam az kam ek payment likhein." };

  for (const line of lines) {
    if (line.method !== "khata" && !line.accountId) {
      return { error: `"${line.method}" ke liye khata select karein — warna paisa aaya to hai magar pahuncha kahin nahi.` };
    }
  }

  const { data: paidRows } = await supabase
    .from("machinery_payments")
    .select("amount")
    .eq("booking_id", bookingId)
    .eq("kind", "final");
  const alreadyPaid = (paidRows ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const newTotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const remaining = Math.round((Number(bill.balance_payable) - alreadyPaid) * 100) / 100;

  if (newTotal > remaining + 0.01) {
    return { error: `Baqi sirf Rs ${remaining.toLocaleString()} hai, magar Rs ${newTotal.toLocaleString()} likha gaya hai.` };
  }

  const paymentDate = str(formData, "payment_date") ?? new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    const { data: payment, error } = await supabase
      .from("machinery_payments")
      .insert({
        booking_id: bookingId,
        kind: "final",
        amount: line.amount,
        method: line.method,
        finance_account_id: line.accountId,
        payment_date: paymentDate,
        reference: line.reference,
        evidence_url: str(formData, "evidence_url"),
        received_by: actorId,
      })
      .select("id")
      .single();
    if (error || !payment) return { error: error?.message ?? "Payment darj nahi hui." };

    if (line.method === "khata") {
      await logEvent({
        bookingId,
        eventType: "payment_to_khata",
        note: `Rs ${line.amount.toLocaleString()} kisan ke khate par chhora gaya`,
        actorId,
      });
      continue;
    }

    const posted = await postMachineryPayment({
      bookingId,
      farmerId: booking.farmer_id,
      amount: line.amount,
      method: line.method,
      accountId: line.accountId,
      description: `Machinery ${booking.booking_number} — payment (${line.method})`,
      ctx: {
        createdBy: actorId,
        entryDate: paymentDate,
        claims: [{ table: "machinery_payments", rowId: payment.id }],
      },
    });

    if (failed(posted)) {
      await createServiceClient().from("machinery_payments").delete().eq("id", payment.id);
      return { error: `Ledger mein nahi gaya, is liye payment darj nahi ki: ${posted.error}` };
    }

    await logEvent({
      bookingId,
      eventType: "payment_received",
      note: `Rs ${line.amount.toLocaleString()} — ${line.method}`,
      actorId,
    });
  }

  const stillRemaining = Math.round((remaining - newTotal) * 100) / 100;
  if (stillRemaining <= 0) {
    await supabase
      .from("machinery_bookings")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", bookingId);
    await logEvent({
      bookingId,
      eventType: "booking_closed",
      fromStatus: booking.status,
      toStatus: "closed",
      note: "Poora hisaab barabar",
      actorId,
    });
  }

  revalidateAll(bookingId);
  return { success: true };
}

// =====================================================================
// 8. Cancel
// =====================================================================
/**
 * Booking cancel -- ghayab nahi, likha hua faisla.
 *
 * Advance aa chuka ho to booking chup chaap cancel nahi hoti: wo paisa
 * kisan ka hai aur us ka faisla alag se hona chahiye (wapas dena hai ya
 * agli booking par rakhna).
 */
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
