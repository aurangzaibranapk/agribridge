"use server";
import { revalidatePath } from "next/cache";
import { sendPaymentReminder } from "@/lib/machinery/payment-reminder";
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
  postMachineryVendorCollected,
  postVendorCashHandover,
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
async function nextNumber(
  supabase: Client,
  table: "machinery_booking_counters" | "machinery_bill_counters" | "machinery_receipt_counters",
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

  const receiptNumber = await nextNumber(args.supabase, "machinery_receipt_counters", "MR");

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
      payment_date: args.paymentDate ?? new Date().toISOString().slice(0, 10),
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
/**
 * Vendor ko ek hi paighaam mein poori khabar.
 *
 * Machine wale ko teen alag messages bhejna wohi galti hai jo phone par
 * hoti hai: teesri baat tak wo pehli bhool chuka hota hai. Us ka sawal
 * ek hi hai -- "kahan jana hai, kab, kitna kaam, aur kis rate par."
 * Chaaron ek sath, ek hi paighaam mein.
 *
 * Rate is mein jaan boojh kar hai: wo us ke apne hisse ki bunyad hai
 * (gross mein se commission kaat kar), aur us ke baghair usay har dafa
 * poochhna parta hai. Commission ka adad yahan NAHI hai -- wo hamare
 * aur us ke darmiyan ka alag maamla hai aur bill par saaf likha aata
 * hai.
 */
async function notifyVendorOfBooking(
  supabase: Client,
  bookingId: string,
  actorId: string | null,
  reason: "rate_confirmed" | "machine_assigned"
) {
  const { data: b } = await supabase
    .from("machinery_bookings")
    .select(
      "id, booking_number, crop_type, harvest_area, final_rate, preferred_date, preferred_time, location_address, village, vendor_id, machine_id, farmers(full_name, phone_number), machinery_vendors(vendor_name, phone), machinery_vendor_machines(machine_type, model)"
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!b || !b.vendor_id) return;

  const vendor = Array.isArray(b.machinery_vendors) ? b.machinery_vendors[0] : b.machinery_vendors;
  const farmer = Array.isArray(b.farmers) ? b.farmers[0] : b.farmers;
  const machine = Array.isArray(b.machinery_vendor_machines)
    ? b.machinery_vendor_machines[0]
    : b.machinery_vendor_machines;

  if (!vendor?.phone) {
    await logEvent({
      bookingId,
      eventType: "vendor_notified",
      note: "Vendor ka phone number nahi hai — khabar nahi ja saki",
      actorId,
    });
    return;
  }

  const message = [
    `Al Rana Traders — Machinery Booking ${b.booking_number}`,
    ``,
    `Kisan: ${farmer?.full_name ?? "-"}${farmer?.phone_number ? ` (${farmer.phone_number})` : ""}`,
    `Kaam: ${b.crop_type ?? "kattai"} — ${Number(b.harvest_area ?? 0)} acre`,
    b.final_rate ? `Rate: Rs ${Number(b.final_rate).toLocaleString()} per acre (final)` : null,
    `Jagah: ${[b.location_address, b.village].filter(Boolean).join(", ") || "-"}`,
    b.preferred_date
      ? `Kab: ${b.preferred_date}${b.preferred_time ? ` — ${b.preferred_time}` : ""}`
      : null,
    machine ? `Machine: ${machine.machine_type}${machine.model ? ` (${machine.model})` : ""}` : null,
    ``,
    reason === "rate_confirmed"
      ? `Kisan ne is rate par haan kar di hai.`
      : `Ye kaam aap ki machine ko diya gaya hai.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendWhatsAppMessage(vendor.phone, message);
    await logEvent({
      bookingId,
      eventType: "vendor_notified",
      note: `${vendor.vendor_name} ko poori tafseel bheji gayi (rate samet)`,
      actorId,
    });
  } catch {
    await logEvent({
      bookingId,
      eventType: "vendor_notified",
      note: `${vendor.vendor_name} ko khabar nahi ja saki — khud ittila dein`,
      actorId,
    });
  }
}

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

  // Machine pehle se tay ho to vendor ko usi waqt khabar. Warna ye
  // khabar rawangi par jati hai -- us se pehle koi vendor hota hi nahi.
  await notifyVendorOfBooking(supabase, bookingId, actorId, "rate_confirmed");

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
  fuelLogId: string;
  bookingNumber: string;
  amount: number;
  accountId: string;
  litres: number | null;
  /** Machine kis vendor ki hai. Ho to ye kharcha nahi, us se wapas aane wali raqam hai. */
  vendorId: string | null;
  actorId: string | null;
}): Promise<string | null> {
  const litrePart = args.litres && args.litres > 0 ? ` — ${args.litres} litre` : "";

  // ART ka diesel kis khane mein jaye.
  //
  // Ab tak wo seedha kharcha (6010 Fuel) ban jata tha. Magar wo
  // kharcha hai hi nahi: wo VENDOR ke liye diya gaya paisa hai, aur
  // us ke hisse se wapas aata hai. Usay permanent kharcha likhna
  // machinery ka munafa jhooti tarah kam kar ke dikhata hai.
  //
  // Vendor maloom ho to ye supplier advance (1120) hai -- us ke naam
  // par khari hui wapas aane wali raqam. Vendor maloom na ho (ART ki
  // apni machine) to wo waqai hamara apna kharcha hai.
  const recoverable = Boolean(args.vendorId);
  const againstAccount = recoverable ? ACC.supplierAdvance : ACC.fuel;

  const { data: expense, error } = await args.supabase
    .from("finance_transactions")
    .insert({
      account_id: args.accountId,
      transaction_type: "expense",
      category: "Machinery - Diesel",
      amount: args.amount,
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: recoverable
        ? `Diesel — machinery booking ${args.bookingNumber}${litrePart} (vendor se wapas aana hai)`
        : `Diesel — machinery booking ${args.bookingNumber}${litrePart}`,
      created_by: args.actorId,
    })
    .select("id")
    .single();
  if (error || !expense) return error?.message ?? "Diesel ka kharcha darj nahi hua.";

  const posted = await postCashOut({
    accountId: args.accountId,
    amount: args.amount,
    description: recoverable
      ? `Diesel — machinery booking ${args.bookingNumber} (vendor se wapas aana hai)`
      : `Diesel — machinery booking ${args.bookingNumber}`,
    againstAccount,
    // Wapas aane wali raqam kis ke naam par khari hai -- ye likhna
    // lazmi hai, warna 1120 mein ek jor para rehta hai aur kisi ko
    // pata nahi hota ke wo kis vendor se lena hai.
    partyType: recoverable ? "machinery_vendor" : null,
    partyId: recoverable ? args.vendorId : null,
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
    .from("machinery_fuel_logs")
    .update({ expense_id: expense.id, vendor_recoverable: recoverable })
    .eq("id", args.fuelLogId);

  return null;
}

/**
 * Diesel ka indraj -- jitni baar dala jaye, utni baar.
 *
 * 20 acre ki kattai teen din chalti hai. Beech mein hum 30 litre
 * daalte hain, agle din kisan khud 100 litre dalwa deta hai. Pehle
 * diesel sirf machine ki rawangi par likha ja sakta tha, is liye agla
 * diesel likhne ka koi raasta hi nahi tha -- aur staff rawangi ka form
 * dobara bhar deta tha.
 *
 * Kisan ya vendor ka diesel bhi likha jata hai (kaam ka record us ke
 * baghair adhoora hai) magar hamare khate se paisa sirf ART wale par
 * nikalta hai.
 */
export async function recordFuelEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking nahi mili." };

  // Raqam ab maangi hi nahi jati -- litre aur us din ka rate maange
  // jate hain, aur raqam DB khud banata hai (170).
  //
  // Haath se likhi hui raqam wo jagah hai jahan ek sifar zyada lag
  // jata hai aur kisi ko pata nahi chalta. Aur us se do adad kabhi
  // nahi milte jo asal mein chahiye hote hain: litre per acre, aur
  // kis din kis rate par liya.
  const paidBy = str(formData, "paid_by");
  const accountId = str(formData, "finance_account_id");
  const litres = num(formData, "litres");
  const ratePerLitre = num(formData, "rate_per_litre");

  if (!litres || litres <= 0) return { error: "Kitne litre diesel dala, wo likhein." };
  if (!ratePerLitre || ratePerLitre <= 0) return { error: "Us din diesel ka rate kya tha, wo likhein." };
  if (!paidBy) return { error: "Diesel kis ne dala — kisan, vendor ya ART — wo select karein." };
  if (paidBy === "company" && !accountId) {
    return { error: "ART ka diesel hai to khata bhi select karein ke kis khate se nikla." };
  }

  const amount = Math.round(litres * ratePerLitre * 100) / 100;

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, vendor_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  const { data: log, error } = await supabase
    .from("machinery_fuel_logs")
    .insert({
      booking_id: bookingId,
      log_date: str(formData, "log_date") ?? new Date().toISOString().slice(0, 10),
      litres,
      rate_per_litre: ratePerLitre,
      amount,
      paid_by: paidBy,
      finance_account_id: paidBy === "company" ? accountId : null,
      notes: str(formData, "notes"),
      // Staff ka indraj seedha tasdeeq shuda: dekhne wala aur likhne
      // wala ek hi hai. Vendor ka raasta alag hai (152).
      source: "staff",
      verification_status: "verified",
      submitted_by: actorId,
      verified_by: actorId,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error || !log) return { error: error?.message ?? "Diesel darj nahi hua." };

  if (paidBy === "company" && accountId) {
    const fuelError = await saveDieselExpense({
      supabase,
      fuelLogId: log.id,
      bookingNumber: booking.booking_number,
      amount,
      accountId,
      litres,
      vendorId: booking.vendor_id,
      actorId,
    });
    // Ledger mein na ja saka to qatar bhi wapas. Diesel likha hua aur
    // paisa kahin darj nahi -- yehi wo shakal hai jis se bachna hai.
    if (fuelError) {
      await createServiceClient().from("machinery_fuel_logs").delete().eq("id", log.id);
      return { error: fuelError };
    }
  }

  await logEvent({
    bookingId,
    eventType: "fuel_added",
    note: `Rs ${amount.toLocaleString()}${litres ? ` — ${litres} litre` : ""} — ${
      paidBy === "company" ? "ART ne" : paidBy === "vendor" ? "vendor ne" : "kisan ne"
    }`,
    actorId,
  });

  revalidateAll(bookingId);
  return {
    success: true,
    notice:
      paidBy === "company"
        ? `Diesel darj ho gaya aur Rs ${amount.toLocaleString()} kharche mein chala gaya.`
        : "Diesel darj ho gaya — ye hamara kharcha nahi, sirf kaam ka record hai.",
  };
}

/**
 * Us machine par us din kitni jagah hai.
 *
 * Wapsi null matlab jagah hai. Warna wajah, aur us ke sath agli khali
 * tareekh ALAG se -- jumle ke andar likhi hui tareekh bande ko phir
 * bhi haath se likhni parti hai. Alag mile to safha khud bhar deta hai.
 */
async function machineDayCapacity(
  supabase: Client,
  machineId: string,
  day: string,
  acres: number,
  exceptBookingId: string
): Promise<{ message: string; nextFree: string | null } | null> {
  const { data: setting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "machinery_daily_acres_per_machine")
    .maybeSingle();
  const cap = setting?.value === undefined || setting?.value === null ? 15 : Number(setting.value);

  const { data: sameDay } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, harvest_area, status, farmers(full_name)")
    .eq("machine_id", machineId)
    .eq("preferred_date", day)
    .not("status", "in", "(closed,cancelled)");

  const others = (sameDay ?? []).filter((b) => b.id !== exceptBookingId);
  const used = others.reduce((sum, b) => sum + Number(b.harvest_area ?? 0), 0);
  if (used + acres <= cap + 0.001) return null;

  const { data: nextFree } = await supabase.rpc("fn_next_free_date", {
    p_machine_id: machineId,
    p_acres: acres,
    p_from: day,
  });

  // Kis ki booking pehle se hai -- naam ke baghair staff ko phone
  // karne ke liye dobara dhoondhna parta hai.
  const who = others
    .map((b) => {
      const f = Array.isArray(b.farmers) ? b.farmers[0] : b.farmers;
      return `${f?.full_name ?? "-"} (${Number(b.harvest_area ?? 0)} acre)`;
    })
    .join(", ");

  return {
    message: [
      `Is machine par ${day} ko pehle se ${used} acre bandhe hain${who ? `: ${who}` : ""}.`,
      `Ek din ki hadd ${cap} acre hai, is liye ${acres} acre aur nahi aa sakte.`,
      nextFree ? `Agli khali tareekh: ${nextFree}.` : `Doosri machine chunein.`,
    ].join(" "),
    nextFree: (nextFree as string | null) ?? null,
  };
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
    .select("id, booking_number, status, harvest_area, preferred_date, location_address, location_lat, location_lng")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  // Ek machine, ek din, hadd bhar kaam.
  //
  // Rok DB par lagi hui hai (159) -- yahan sirf ye hai ke bande ko wo
  // rok samajh mein aane wale lafzon mein mile, aur sath agli khali
  // tareekh bhi. "Jagah nahi hai, khud dhoondho" kehna wo kaam bande
  // par daalna hai jo system pehle se jaanta hai.
  if (booking.preferred_date) {
    const capacity = await machineDayCapacity(
      supabase,
      machineId,
      booking.preferred_date,
      Number(booking.harvest_area ?? 0),
      bookingId
    );
    if (capacity) return { error: capacity.message, nextFreeDate: capacity.nextFree ?? undefined };
  }

  const { data: machine } = await supabase
    .from("machinery_vendor_machines")
    .select("vendor_id")
    .eq("id", machineId)
    .maybeSingle();

  // Machine dobara "bhejna" -- ye aksar ghalti hoti hai, iraada nahi.
  //
  // Pehle rawangi darj hone ke baad bhi form khula rehta tha, aur agla
  // diesel likhne ke liye staff ne wohi form dobara bhar diya. Nateeja:
  // ek hi machine do dafa bheji hui, aur diesel do dafa kharche mein.
  // Ab dobara rawangi jaan boojh kar maangni parti hai.
  const { data: already } = await supabase
    .from("machinery_dispatches")
    .select("id")
    .eq("booking_id", bookingId);
  if ((already ?? []).length > 0 && formData.get("again") !== "on") {
    return {
      error: "Is booking ki rawangi pehle darj ho chuki hai. Machine waqai dobara gayi ho to \"machine dobara bheji gayi\" par nishaan lagayein — aur diesel ke liye neeche Diesel ka indraj istemal karein.",
    };
  }

  const { data: dispatch, error: dispatchError } = await supabase
    .from("machinery_dispatches")
    .insert({
      booking_id: bookingId,
      machine_id: machineId,
      operator_name: str(formData, "operator_name"),
      driver_phone: str(formData, "driver_phone"),
      departure_at: str(formData, "departure_at") ?? new Date().toISOString(),
      // Diesel yahan se nikal gaya (149): us ki apni qatar hai, kyunke
      // diesel ek dafa nahi dala jata. Rawangi sirf rawangi rahi.
      destination_address: str(formData, "destination_address") ?? booking.location_address,
      destination_lat: num(formData, "destination_lat") ?? booking.location_lat,
      destination_lng: num(formData, "destination_lng") ?? booking.location_lng,
      notes: str(formData, "notes"),
      created_by: actorId,
    })
    .select("id")
    .single();
  if (dispatchError || !dispatch) return { error: dispatchError?.message ?? "Rawangi darj nahi hui." };

  const { error } = await supabase
    .from("machinery_bookings")
    .update({
      machine_id: machineId,
      vendor_id: machine?.vendor_id ?? null,
      status: "in_progress",
    })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  await notifyVendorOfBooking(supabase, bookingId, actorId, "machine_assigned");

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
    .select("id, work_date, actual_area, is_final, verification_status")
    .eq("booking_id", bookingId)
    .eq("verification_status", "verified");

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
    // Staff ka likha hua kaam seedha tasdeeq shuda hai: wahan dekhne
    // wala aur likhne wala ek hi hai. Vendor ka raasta alag hai (150).
    source: "staff",
    verification_status: "verified",
    submitted_by: actorId,
    verified_by: actorId,
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
  // Sirf tasdeeq shuda kaam. Vendor ka dawa jab tak dekha na jaye,
  // bill ka hissa nahi banta -- wo apne hi paise ka adad likh raha
  // hota hai (150).
  const { data: workRows } = await supabase
    .from("machinery_work_records")
    .select("actual_area, is_final")
    .eq("booking_id", bookingId)
    .eq("verification_status", "verified");

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
    .select("id, booking_number, status, farmer_id, vendor_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  const { data: bill } = await supabase
    .from("machinery_bills")
    .select("balance_payable")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!bill) return { error: "Pehle bill banayein." };

  const lines: Array<{
    method: string;
    amount: number;
    accountId: string | null;
    reference: string | null;
    settlement: string | null;
  }> = [];
  for (let i = 0; i < 5; i += 1) {
    const amount = num(formData, `line_${i}_amount`);
    const method = str(formData, `line_${i}_method`);
    if (!amount || amount <= 0 || !method) continue;
    lines.push({
      method,
      amount,
      accountId: str(formData, `line_${i}_account_id`),
      reference: str(formData, `line_${i}_reference`),
      settlement: str(formData, `line_${i}_settlement`),
    });
  }
  if (lines.length === 0) return { error: "Kam az kam ek payment likhein." };

  for (const line of lines) {
    // Vendor ke haath gaya hua paisa kisi khate mein nahi aata -- wahan
    // khata maangna hi ghalat hai. Us ke bajaye ye poochha jata hai ke
    // vendor ne rakha ya hamein diya.
    if (line.method === "vendor_collected") {
      if (!booking.vendor_id) {
        return { error: "Is booking par koi vendor darj nahi -- pehle machine ki rawangi darj karein." };
      }
      if (line.settlement !== "kept" && line.settlement !== "handed_over") {
        return { error: "Batayein ke vendor ne wo paisa apne hisse mein rakha ya hamein de diya." };
      }
      continue;
    }
    // Cash ab khata nahi maangta -- wo lene wale ke paas jata hai
    // (171). Bank/wallet ka khata pehle jaisa lazmi hai: un mein
    // paisa waqai kisi khate mein aata hai.
    if (line.method === "cash") continue;
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

  // Cash kahan liya gaya. Dono soorton mein wo lene wale ke naam par
  // khara hota hai -- magar do mahine baad poochho to ye farq kisi ko
  // yaad nahi rehta, aur wahin se "maine to daftar mein diya tha"
  // wali baat shuru hoti hai.
  const receivedLocation = str(formData, "received_location") === "office" ? "office" : "field";

  for (const line of lines) {
    // Cash lene wale ke paas jata hai, kisi khate mein nahi. Ye us
    // waqt ka sach hai: khet par ya counter par liya hua cash abhi us
    // bande ki jeb mein hai.
    const inCustody = line.method === "cash";

    const receiptNumber = await nextNumber(supabase, "machinery_receipt_counters", "MR");

    const { data: payment, error } = await supabase
      .from("machinery_payments")
      .insert({
        booking_id: bookingId,
        kind: "final",
        amount: line.amount,
        method: line.method,
        finance_account_id:
          line.method === "vendor_collected" || inCustody ? null : line.accountId,
        custody_profile_id: inCustody ? actorId : null,
        received_location: inCustody ? receivedLocation : null,
        collected_by_vendor_id: line.method === "vendor_collected" ? booking.vendor_id : null,
        vendor_settlement: line.method === "vendor_collected" ? line.settlement : null,
        payment_date: paymentDate,
        reference: line.reference,
        evidence_url: str(formData, "evidence_url"),
        receipt_number: receiptNumber,
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

    if (line.method === "vendor_collected") {
      const posted = await postMachineryVendorCollected({
        bookingId,
        farmerId: booking.farmer_id,
        vendorId: booking.vendor_id!,
        amount: line.amount,
        settlement: line.settlement as "kept" | "handed_over",
        description:
          line.settlement === "kept"
            ? `Machinery ${booking.booking_number} — kisan ne vendor ko diya, vendor ne apne hisse mein rakha`
            : `Machinery ${booking.booking_number} — kisan ne vendor ko diya, vendor ne hamein dena hai`,
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
        eventType: "payment_via_vendor",
        note:
          line.settlement === "kept"
            ? `Rs ${line.amount.toLocaleString()} kisan ne vendor ko diya — vendor ne apne hisse mein rakh liya`
            : `Rs ${line.amount.toLocaleString()} kisan ne vendor ko diya — vendor ne hamein dena hai`,
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
      custodyProfileId: inCustody ? actorId : null,
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
/**
 * Kisan ka wada: "abhi nahi, fasal bikne par."
 *
 * Ye payment NAHI hai. Na ledger mein kuch jata hai, na baqi raqam kam
 * hoti hai. Ye sirf ye batata hai ke ye paisa kis tareekh par maanga
 * jana hai aur kyun ruka hua hai.
 *
 * Ise banane ki wajah: pehle yahan sirf do raaste the -- payment darj
 * karo ya kuch na karo. Payment darj karna jhoot hota (paisa aaya hi
 * nahi). Kuch na karna us se bura: baqi raqam padi rehti aur kisi ko
 * nazar nahi aata ke kyun. Do hafte baad phone par kisan kehta "maine
 * to bata diya tha" -- aur hamare paas jawab nahi hota.
 *
 * Khata is se alag cheez hai: khata par daalna faisla hai ke udhaar ab
 * booking se nikal kar kisan ke chalte khate mein chala gaya. Wada us
 * se pehle ka qadam hai -- udhaar abhi is booking ka hai.
 */
/**
 * Kattai ki tareekh badalna -- machine us din bhari ho to.
 *
 * Rok ke sath system agli khali tareekh pehle se jaanta hai. Wo
 * tareekh sirf jumle mein likh dena bande par wohi kaam daal deta
 * hai jo system kar chuka hai: wo tareekh parhta hai, yaad rakhta
 * hai, doosre safhe par ja kar haath se likhta hai -- aur ek adad
 * ghalat likh dene ki poori gunjaish rehti hai.
 *
 * Is liye tareekh yahin badal jati hai. Wajah bhi likhi jati hai,
 * kyunke kisan ko phone karne wale ko ye maloom hona chahiye ke
 * tareekh khud se nahi khisak gayi.
 */
/**
 * Adhoori booking mehfooz rakhna.
 *
 * Ye booking nahi banata. Booking tab banti hai jab banda "banayein"
 * kehta hai -- ye sirf wo adhoora kaghaz hai jo mez par para reh gaya,
 * taake phone band ho jane par sab kuch dobara na likhna pare.
 *
 * Khamoshi se chalta hai: nakaam ho to bande ko kuch nahi kehta.
 * Draft ki nakami par surkh paighaam dikhana us kaam mein rukawat
 * daalta hai jo banda kar raha hai, jab ke wo kaam theek chal raha
 * hota hai. Wo booking bana kar bhej sakta hai chahe draft na bacha ho.
 */
export async function saveBookingDraft(payload: unknown): Promise<void> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  if (!actorId) return;

  await supabase
    .from("machinery_booking_drafts")
    .upsert(
      { user_id: actorId, payload: payload as never, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}

/** Adhoora kaghaz phaar dena -- banda naya shuru karna chahta hai. */
export async function discardBookingDraft(): Promise<void> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  if (!actorId) return;
  await supabase.from("machinery_booking_drafts").delete().eq("user_id", actorId);
}

/**
 * Yaad dahani abhi bhejna -- staff ke apne haath se.
 *
 * Cron roz wade wali bookings par khud bhejta hai. Ye us ka muqabla
 * nahi: kabhi kisan se baat ho jati hai aur usi waqt paighaam bhejna
 * hota hai, aur kabhi cron ka din aane mein do din baqi hote hain.
 *
 * Dono ka paighaam aur record ek hi jagah se banta hai, warna kisan ko
 * do mukhtalif zabanon mein do paighaam jate aur qatar mein sirf ek
 * nazar aata.
 */
export async function sendPaymentReminderNow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking nahi mili." };

  const { data: row } = await supabase
    .from("v_machinery_payment_due")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (!row) return { error: "Is booking par kuch baqi nahi -- yaad dahani ki zaroorat nahi." };

  const res = await sendPaymentReminder(
    {
      bookingId,
      bookingNumber: (row.booking_number as string) ?? "-",
      farmerId: (row.farmer_id as string | null) ?? null,
      farmerName: (row.farmer_name as string | null) ?? null,
      phone: (row.farmer_phone as string | null) ?? null,
      amount: Number(row.baqi ?? 0),
      promiseDate: (row.payment_promise_date as string | null) ?? null,
    },
    actorId
  );

  revalidatePath(`/admin/machinery-rental/booking/${bookingId}`);
  revalidatePath("/admin/machinery-rental/reminders");

  // Nakami bhi qatar mein likhi ja chuki hai -- yahan sirf bande ko
  // batana hai, taake wo phone utha kar khud baat kar le.
  if (!res.ok) return { error: `Yaad dahani nahi gayi: ${res.error}` };
  return { success: true, notice: "Yaad dahani bhej di gayi." };
}

export async function rescheduleBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  const newDate = str(formData, "preferred_date");
  if (!bookingId) return { error: "Booking nahi mili." };
  if (!newDate) return { error: "Nayi tareekh chunein." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, status, preferred_date")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };
  if (booking.status === "cancelled" || booking.status === "closed") {
    return { error: "Band booking ki tareekh nahi badalti." };
  }

  const { error } = await supabase
    .from("machinery_bookings")
    .update({ preferred_date: newDate })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId,
    eventType: "date_changed",
    note: `Kattai ki tareekh ${booking.preferred_date ?? "-"} se ${newDate} — machine us din bhari thi`,
    actorId,
  });

  revalidatePath(`/admin/machinery-rental/booking/${bookingId}`);
  return { success: true, notice: `Kattai ki tareekh ab ${newDate} hai. Ab rawangi darj karein.` };
}

export async function recordPaymentPromise(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking nahi mili." };

  const promiseDate = str(formData, "promise_date");
  const note = str(formData, "promise_note");
  if (!promiseDate) return { error: "Kisan ne kab dene ka kaha, wo tareekh likhein." };
  if (!note) return { error: "Kisan ne kya kaha, wo likhein." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  const { data: bill } = await supabase
    .from("machinery_bills")
    .select("balance_payable")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!bill) return { error: "Wada bill banne ke baad hi likha ja sakta hai." };

  const { error } = await supabase
    .from("machinery_bookings")
    .update({
      payment_promise_date: promiseDate,
      payment_promise_note: note,
      payment_promise_at: new Date().toISOString(),
      payment_promise_by: actorId,
    })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId,
    eventType: "payment_promised",
    note: `${promiseDate} — ${note}`,
    actorId,
  });

  revalidateAll(bookingId);
  return {
    success: true,
    notice: `Wada darj ho gaya. Baqi raqam waise hi khari hai — ${promiseDate} par ye booking "paisa lena" ki qatar mein saamne aa jayegi.`,
  };
}

/**
 * Vendor ka bheja hua kaam: dekho, phir maano.
 *
 * Vendor apne portal se kattai ki tafseel bhejta hai. Wo qatar 'claimed'
 * halat mein aati hai -- bill use nahi ginta. Yahan hamari team ya to
 * usay maan leti hai (aur tabhi wo bill ka hissa banta hai) ya wajah ke
 * sath rad kar deti hai.
 *
 * Raqba yahan badla ja sakta hai: aksar farq neeyat ka nahi, naap ka
 * hota hai. Jo adad hamari team ne dekha wohi bill mein jata hai.
 */
export async function verifyWorkClaim(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const workId = str(formData, "work_id");
  const decision = str(formData, "decision");
  if (!workId) return { error: "Indraj nahi mila." };
  if (decision !== "accept" && decision !== "reject") return { error: "Faisla batayein." };

  const { data: work } = await supabase
    .from("machinery_work_records")
    .select("id, booking_id, actual_area, verification_status")
    .eq("id", workId)
    .maybeSingle();
  if (!work) return { error: "Indraj nahi mila." };
  if (work.verification_status !== "claimed") {
    return { error: "Is indraj ka faisla pehle ho chuka hai." };
  }

  if (decision === "reject") {
    const reason = str(formData, "rejection_reason");
    if (!reason) return { error: "Rad karne ki wajah likhein." };
    const { error } = await supabase
      .from("machinery_work_records")
      .update({
        verification_status: "rejected",
        rejection_reason: reason,
        verified_by: actorId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", workId);
    if (error) return { error: error.message };

    await logEvent({
      bookingId: work.booking_id,
      eventType: "work_claim_rejected",
      note: `Vendor ka indraj rad: ${reason}`,
      actorId,
    });
    revalidateAll(work.booking_id);
    return { success: true };
  }

  // Naap ka farq theek karna yahin ka kaam hai.
  const acres = num(formData, "actual_area_acres");
  const kanal = num(formData, "actual_area_kanal");
  const corrected = toAcres(acres, kanal) > 0;

  const { error } = await supabase
    .from("machinery_work_records")
    .update({
      verification_status: "verified",
      verified_by: actorId,
      verified_at: new Date().toISOString(),
      ...(corrected ? { actual_area_acres: acres, actual_area_kanal: kanal } : {}),
    })
    .eq("id", workId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId: work.booking_id,
    eventType: "work_claim_verified",
    note: corrected
      ? `Vendor ka indraj tasdeeq shuda — raqba ${Number(work.actual_area)} se ${toAcres(acres, kanal)} acre kiya gaya`
      : `Vendor ka indraj tasdeeq shuda — ${Number(work.actual_area)} acre`,
    actorId,
  });

  revalidateAll(work.booking_id);
  return { success: true };
}

/**
 * Vendor ka bheja hua diesel: dekho, phir maano.
 *
 * Khata yahan poochha jata hai, dawe ke waqt nahi -- vendor ko ye pata
 * hi nahi hota ke ART ne kis khate se paisa nikala. Ledger bhi yahin
 * banta hai, is tasdeeq ke sath.
 */
/**
 * Vendor ka dawa: "kisan ne mujhe paisa diya."
 *
 * Tasdeeq se pehle wo raqam kahin nahi hoti -- kisan ka baqi kam nahi
 * hota, cash book mein nazar nahi aati, bill par koi asar nahi. Yahan
 * tasdeeq hote hi wo hisaab ban jati hai, aur wohi ledger banta hai
 * jo staff ke apne haath se darj karne par banta -- ek hi jagah se,
 * warna do raaston ka hisaab kisi din alag ho jata hai.
 *
 * Rad karna bhi utna hi zaroori hai. Vendor kabhi ghalat booking par
 * daal deta hai, aur kabhi kisan kehta hai ke us ne diya hi nahi. Us
 * soorat mein wajah likhna lazmi hai -- wo wajah vendor ko us ke
 * apne safhe par nazar aati hai, aur wohi agli dafa ghalti rokti hai.
 */
export async function verifyVendorCollection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const paymentId = str(formData, "payment_id");
  const decision = str(formData, "decision");
  if (!paymentId) return { error: "Indraj nahi mila." };
  if (decision !== "accept" && decision !== "reject") return { error: "Faisla batayein." };

  const { data: payment } = await supabase
    .from("machinery_payments")
    .select("id, booking_id, amount, method, verification_status, payment_date, vendor_settlement, collected_by_vendor_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { error: "Indraj nahi mila." };
  if (payment.method !== "vendor_collected") return { error: "Ye vendor ka indraj nahi hai." };
  if (payment.verification_status !== "claimed") {
    return { error: "Is dawe ka faisla pehle ho chuka hai." };
  }

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, farmer_id, vendor_id")
    .eq("id", payment.booking_id)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  if (decision === "reject") {
    const reason = str(formData, "rejection_reason");
    if (!reason) return { error: "Rad karne ki wajah likhein." };
    const { error } = await supabase
      .from("machinery_payments")
      .update({
        verification_status: "rejected",
        rejection_reason: reason,
        verified_by: actorId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", paymentId);
    if (error) return { error: error.message };

    await logEvent({
      bookingId: payment.booking_id,
      eventType: "vendor_collection_rejected",
      note: `Rs ${Number(payment.amount).toLocaleString()} ka dawa rad: ${reason}`,
      actorId,
    });
    revalidateAll(payment.booking_id);
    return { success: true, notice: "Dawa rad kar diya gaya." };
  }

  const settlement = (payment.vendor_settlement as "kept" | "handed_over" | null) ?? null;
  if (settlement !== "kept" && settlement !== "handed_over") {
    return { error: "Vendor ne us paise ka kya kiya, wo darj nahi hai." };
  }

  const { error } = await supabase
    .from("machinery_payments")
    .update({
      verification_status: "verified",
      verified_by: actorId,
      verified_at: new Date().toISOString(),
      received_by: actorId,
    })
    .eq("id", paymentId);
  if (error) return { error: error.message };

  const posted = await postMachineryVendorCollected({
    bookingId: payment.booking_id,
    farmerId: booking.farmer_id,
    vendorId: payment.collected_by_vendor_id ?? booking.vendor_id!,
    amount: Number(payment.amount),
    settlement,
    description:
      settlement === "kept"
        ? `Machinery ${booking.booking_number} — kisan ne vendor ko diya, vendor ne apne hisse mein rakha (vendor ka dawa, tasdeeq shuda)`
        : `Machinery ${booking.booking_number} — kisan ne vendor ko diya, vendor ne hamein dena hai (vendor ka dawa, tasdeeq shuda)`,
    ctx: {
      createdBy: actorId,
      entryDate: payment.payment_date ?? undefined,
      claims: [{ table: "machinery_payments", rowId: paymentId }],
    },
  });

  // Ledger mein na ja sake to tasdeeq bhi wapas -- dawa phir se dawa.
  // "Verified" likha rehna aur ledger khali hona sab se buri shakal
  // hai: kisan ka baqi kam ho jata hai aur wo paisa kahin hai hi nahi.
  if (failed(posted)) {
    await createServiceClient()
      .from("machinery_payments")
      .update({ verification_status: "claimed", verified_by: null, verified_at: null, received_by: null })
      .eq("id", paymentId);
    return { error: `Ledger mein nahi gaya, is liye tasdeeq wapas le li: ${posted.error}` };
  }

  await logEvent({
    bookingId: payment.booking_id,
    eventType: "payment_via_vendor",
    note:
      settlement === "kept"
        ? `Rs ${Number(payment.amount).toLocaleString()} kisan ne vendor ko diya — vendor ne apne hisse mein rakh liya (vendor ka dawa, tasdeeq shuda)`
        : `Rs ${Number(payment.amount).toLocaleString()} kisan ne vendor ko diya — vendor ne hamein dena hai (vendor ka dawa, tasdeeq shuda)`,
    actorId,
  });

  revalidateAll(payment.booking_id);
  return { success: true, notice: "Tasdeeq ho gayi — ab ye raqam hisaab mein hai." };
}

export async function verifyFuelClaim(_prev: ActionState, formData: FormData): Promise<ActionState> {
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
      note: `Vendor ka diesel rad: ${reason}`,
      actorId,
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
    // Ledger mein na ja saka to tasdeeq bhi wapas -- warna diesel
    // "tasdeeq shuda" likha rehta aur kharcha kahin nahi hota.
    if (fuelError) {
      await createServiceClient()
        .from("machinery_fuel_logs")
        .update({ verification_status: "claimed", finance_account_id: null, verified_by: null, verified_at: null })
        .eq("id", fuelId);
      return { error: fuelError };
    }
  }

  await logEvent({
    bookingId: log.booking_id,
    eventType: "fuel_claim_verified",
    note: `Vendor ka diesel tasdeeq shuda — Rs ${Number(log.amount).toLocaleString()} (${
      log.paid_by === "company" ? "ART" : log.paid_by === "vendor" ? "vendor" : "kisan"
    })`,
    actorId,
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

  if (!vendorId) return { error: "Vendor nahi mila." };
  if (amount <= 0) return { error: "Raqam sahi likhein." };
  if (!accountId) return { error: "Paisa kis khate mein aaya, wo select karein." };

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

  const posted = await postVendorCashHandover({
    vendorId,
    accountId,
    amount,
    description: `${vendor.vendor_name} ne kisan se wasool shuda paisa hamein diya`,
    ctx: { createdBy: actorId, entryDate: str(formData, "received_date") ?? undefined },
  });
  if (failed(posted)) return { error: `Ledger mein nahi gaya: ${posted.error}` };

  // Jo qatarein poori tarah aa gayin un par khata likh diya jata hai --
  // isi se wo "vendor ke paas para hua" ki fehrist se nikalti hain.
  // Aadhi qatar par nishaan nahi lagta: adhoori adaigi ka matlab wo
  // qatar abhi puri nahi hui.
  let left = amount;
  const service = createServiceClient();
  for (const row of pending ?? []) {
    const rowAmount = Number(row.amount);
    if (rowAmount > left + 0.01) break;
    await service.from("machinery_payments").update({ finance_account_id: accountId }).eq("id", row.id);
    left = Math.round((left - rowAmount) * 100) / 100;
  }

  revalidatePath("/admin/machinery-rental/vendor-cash");
  revalidatePath("/admin/finance");
  return {
    success: true,
    notice: `Rs ${amount.toLocaleString()} khate mein aa gaya.${
      left > 0.01 ? ` Rs ${left.toLocaleString()} abhi bhi vendor ke paas darj hai.` : ""
    }`,
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
      "id, booking_number, farmer_id, farm_id, crop_type, machine_type_requested, harvest_area, final_rate, rate_status, farmer_confirmed_at, location_address, village, will_sell_to_us"
    )
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return { error: "Booking nahi mili." };

  const { data: workRows } = await supabase
    .from("machinery_work_records")
    .select("actual_area")
    .eq("booking_id", parentId)
    .eq("verification_status", "verified");

  const done = (workRows ?? []).reduce((sum, w) => sum + Number(w.actual_area), 0);
  const auto = Math.round((Number(parent.harvest_area ?? 0) - done) * 100) / 100;
  const asked = num(formData, "remaining_acres");
  const remaining = asked && asked > 0 ? asked : auto;

  if (remaining <= 0) {
    return { error: "Is booking par koi raqba baqi nahi -- poora kaam ho chuka hai." };
  }

  const bookingNumber = await nextNumber(supabase, "machinery_booking_counters", "MB");

  const { data: booking, error } = await supabase
    .from("machinery_bookings")
    .insert({
      booking_number: bookingNumber,
      farmer_id: parent.farmer_id,
      farm_id: parent.farm_id,
      parent_booking_id: parent.id,
      booking_date: new Date().toISOString().slice(0, 10),
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
        final_rate: parent.final_rate,
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
