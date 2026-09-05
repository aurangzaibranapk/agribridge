import { createServiceClient } from "@/lib/supabase/service";
import { notifyRoles } from "@/lib/notifications";

/**
 * Kisan ka rate confirmation ka jawab -- WhatsApp par.
 *
 * Sunehri usool ye hai ke booking ko "Final Rate Confirmed" tab tak na
 * mile jab tak kisan khud haan na kar de. Ye usool tab tak adhoora hai
 * jab tak jawab lene ka koi raasta na ho: staff ko har jawab haath se
 * darj karna paRe to aadhe jawab kabhi darj nahi hote, aur phir log
 * override ka raasta lene lagte hain -- yani wahi rok jo lagayi thi, wo
 * rozana toRi jane lagti hai.
 *
 * Wapsi: koi string matlab ye machinery ka jawab tha aur wahi kisan ko
 * bheja jaye; `null` matlab ye jawab machinery ka nahi -- purana farmer
 * wala raasta chalta rahe.
 *
 * Dhyan: jab tak jawab CONFIRM ya ISSUE jaisa na ho, hum ise chhoote
 * hain. Kisan ka koi bhi paigham sirf is liye pakaR lena ke us ki ek
 * booking tasdeeq ki muntazir hai -- is ka matlab hota ke wo mausam ka
 * sawal bhi "rate confirm" gina jaye.
 */

const CONFIRM = /\b(confirm(ed)?|haan|han|jee|ji|ok(ay)?|theek|thik|sahi|manzoor|yes)\b/i;
const ISSUE = /\b(issue|masla|maslaa|nahi|nahin|no|ghalat|zyada|ziyada|mehnga|aitraaz|problem)\b/i;

export async function handleMachineryConfirmation(args: {
  fromPhone: string;
  text: string | null;
}): Promise<string | null> {
  const text = args.text?.trim();
  if (!text) return null;

  const saysConfirm = CONFIRM.test(text);
  const saysIssue = ISSUE.test(text);
  if (!saysConfirm && !saysIssue) return null;

  const service = createServiceClient();

  const { data: farmer } = await service
    .from("farmers")
    .select("id, full_name")
    .or(`whatsapp_number.eq.${args.fromPhone},phone_number.eq.${args.fromPhone}`)
    .maybeSingle();
  if (!farmer) return null;

  // Sirf wohi booking jo is waqt jawab ki muntazir hai. Ek se zyada hon
  // to sab se nayi -- kyunki message usi ke jawab mein aaya hoga jo abhi
  // bheja gaya.
  const { data: booking } = await service
    .from("machinery_bookings")
    .select("id, booking_number, final_rate, harvest_area")
    .eq("farmer_id", farmer.id)
    .not("rate_confirmation_sent_at", "is", null)
    .is("farmer_confirmed_at", null)
    .not("status", "in", "(cancelled,closed)")
    .order("rate_confirmation_sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!booking) return null;

  // Dono nishan ek sath ho sakte hain ("theek hai magar rate zyada
  // hai"). Aise mein aitraaz jeetta hai: shak ki soorat mein aage barhne
  // se rukna behtar hai, kyunki aage barhne ka natija ye hota hai ke
  // machine khet par pahunch jati hai aur bahes baad mein hoti hai.
  if (saysIssue) {
    await service.from("machinery_booking_events").insert({
      booking_id: booking.id,
      event_type: "farmer_raised_issue",
      note: text,
      actor_id: null,
    });

    await notifyRoles(
      ["manager", "super_admin", "admin", "owner"],
      `Machinery ${booking.booking_number}: kisan ko rate par aitraaz`,
      `${farmer.full_name ?? "Kisan"}: ${text}`,
      `/admin/machinery-rental/booking/${booking.id}`
    );

    return `Aap ki baat darj kar li gayi hai. Hamari team aap se raabta karegi.\n\nBooking: ${booking.booking_number}`;
  }

  const { error } = await service
    .from("machinery_bookings")
    .update({
      farmer_confirmed_at: new Date().toISOString(),
      farmer_confirmation_channel: "whatsapp",
      farmer_confirmation_response: text,
      rate_status: "final",
      status: "ready_for_harvest",
    })
    .eq("id", booking.id);

  if (error) {
    // Jawab aaya magar darj na ho saka -- ye chhupana sab se bura hoga:
    // kisan samajhta rahega ke tasdeeq ho gayi aur system samajhta rahega
    // ke nahi hui.
    await notifyRoles(
      ["manager", "super_admin", "admin", "owner"],
      `Machinery ${booking.booking_number}: kisan ka CONFIRM darj nahi ho saka`,
      error.message,
      `/admin/machinery-rental/booking/${booking.id}`
    );
    return `Aap ka jawab mil gaya hai. Team tasdeeq kar ke aap se raabta karegi.\n\nBooking: ${booking.booking_number}`;
  }

  await service.from("machinery_booking_events").insert({
    booking_id: booking.id,
    event_type: "farmer_confirmed",
    to_status: "ready_for_harvest",
    note: text,
    actor_id: null,
  });

  await notifyRoles(
    ["manager", "super_admin", "admin", "owner"],
    `Machinery ${booking.booking_number}: kisan ne rate confirm kar diya`,
    `Rs ${Number(booking.final_rate ?? 0).toLocaleString()}/acre`,
    `/admin/machinery-rental/booking/${booking.id}`
  );

  return [
    `Shukriya. Aap ki tasdeeq darj ho gayi hai.`,
    ``,
    `Booking: ${booking.booking_number}`,
    `Rate: Rs ${Number(booking.final_rate ?? 0).toLocaleString()} per acre`,
    `Raqba (andaza): ${Number(booking.harvest_area ?? 0)} acre`,
    ``,
    `Bill kattai ke baad ASAL raqbe par banega, andaze par nahi.`,
  ].join("\n");
}
