"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyRoles } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { sendWhatsAppMessage } from "@/lib/whatsapp-client";
import {
  postMachineryAdvance,
  postMachineryBill,
  postMachineryPayment,
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

      request_id: str(formData, "request_id"),
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

  await notifyRoles(
    ["manager", "super_admin", "admin", "owner"],
    "Nayi Machinery Booking",
    `Booking ${booking.booking_number} ban gayi hai.`,
    `/admin/machinery-rental/booking/${booking.id}`
  );

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
  if (!args.amount || args.amount <= 0) return "Advance ki raqam sahi likhein.";
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
  if (!response) return { error: "Kisan ka jawab likhein." };

  const accepted = /confirm|haan|ok|theek|manzoor/i.test(response);

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
    return { success: true };
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
  return { success: true };
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
export async function dispatchMachine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  const machineId = str(formData, "machine_id");
  if (!bookingId) return { error: "Booking nahi mili." };
  if (!machineId) return { error: "Machine select karein." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, status, location_address, location_lat, location_lng")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  const { data: machine } = await supabase
    .from("machinery_vendor_machines")
    .select("vendor_id")
    .eq("id", machineId)
    .maybeSingle();

  const { error: dispatchError } = await supabase.from("machinery_dispatches").insert({
    booking_id: bookingId,
    machine_id: machineId,
    operator_name: str(formData, "operator_name"),
    driver_phone: str(formData, "driver_phone"),
    departure_at: str(formData, "departure_at") ?? new Date().toISOString(),
    opening_meter: num(formData, "opening_meter"),
    fuel_litres: num(formData, "fuel_litres"),
    fuel_amount: num(formData, "fuel_amount"),
    destination_address: str(formData, "destination_address") ?? booking.location_address,
    destination_lat: num(formData, "destination_lat") ?? booking.location_lat,
    destination_lng: num(formData, "destination_lng") ?? booking.location_lng,
    notes: str(formData, "notes"),
    created_by: actorId,
  });
  if (dispatchError) return { error: dispatchError.message };

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

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };

  const { error: workError } = await supabase.from("machinery_work_records").insert({
    booking_id: bookingId,
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
  });
  if (workError) return { error: workError.message };

  const { error } = await supabase
    .from("machinery_bookings")
    .update({ status: "bill_pending", completed_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  await logEvent({
    bookingId,
    eventType: "work_completed",
    fromStatus: booking.status,
    toStatus: "bill_pending",
    note: `${toAcres(acres, kanal)} acre`,
    evidenceUrl: str(formData, "completion_photo_url"),
    actorId,
  });

  revalidateAll(bookingId);
  return { success: true };
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
export async function generateFinalBill(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const actorId = await currentUserId(supabase);
  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking nahi mili." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, status, farmer_id, vendor_id, final_rate, rate_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "Booking nahi mili." };
  if (booking.rate_status !== "final" || !booking.final_rate) {
    return { error: "Bill se pehle final rate kisan se confirm karwana zaroori hai." };
  }

  const { data: work } = await supabase
    .from("machinery_work_records")
    .select("actual_area")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!work) return { error: "Pehle asal kaam darj karein (kitne acre waqai kaate gaye)." };

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

  const area = Number(work.actual_area);
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
 * Is liye yahan sirf teen cheezein li jati hain: naam, mobile, gaon.
 * Baqi tafseel (CNIC, zameen, kaghazat) baad mein Farmers wale safhe se.
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
  const village = str(formData, "village");

  if (phone) {
    const { data: already } = await supabase
      .from("farmers")
      .select("id, farmer_code, full_name")
      .eq("phone_number", phone)
      .eq("is_deleted", false)
      .maybeSingle();
    if (already) {
      return {
        success: true,
        farmerId: already.id,
        farmerCode: already.farmer_code,
        farmerName: already.full_name ?? fullName,
        notice: `Ye number pehle se ${already.farmer_code} — ${already.full_name} ka hai. Wohi kisan chun liya gaya.`,
      };
    }
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
      village,
      is_verified: true,
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
