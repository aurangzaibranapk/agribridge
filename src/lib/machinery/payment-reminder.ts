import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppMessage } from "@/lib/whatsapp-client";

/**
 * Kisan ko payment ki yaad dahani.
 *
 * Ek hi jagah, kyunke ye do raaston se chalti hai: roz ka cron (jab
 * wade ki tareekh aa jati hai) aur staff ka apna button. Dono ka
 * paighaam aur dono ka record ek jaisa hona chahiye -- warna kisan ko
 * do mukhtalif zabanon mein do paighaam jate hain aur qatar mein sirf
 * ek nazar aata hai.
 *
 * Nakami chhupti nahi. Number galat ho ya WhatsApp ki chaabi na ho, wo
 * bhi likha jata hai -- "bhej diya" aur "bhejne ki koshish ki" ek cheez
 * nahi hai, aur jab kisan kehta hai "mujhe kuch nahi aaya" to record ko
 * sach bolna chahiye.
 */
export interface ReminderTarget {
  bookingId: string;
  bookingNumber: string;
  farmerId: string | null;
  farmerName: string | null;
  phone: string | null;
  amount: number;
  promiseDate: string | null;
}

export function reminderText(target: ReminderTarget): string {
  const wada = target.promiseDate
    ? ` Aap ne ${new Date(target.promiseDate).toLocaleDateString("en-GB")} ka waada kiya tha.`
    : "";
  return [
    `Assalam-o-Alaikum ${target.farmerName ?? ""}`.trim(),
    ``,
    `Al Rana Traders — machinery booking ${target.bookingNumber}`,
    `Aap ke zimme Rs ${target.amount.toLocaleString()} baqi hain.${wada}`,
    ``,
    `Meharbani farma kar adaigi kar dein. Koi masla ho to hamein bata dein.`,
  ].join("\n");
}

/**
 * Bhejo aur likho. Wapsi batati hai ke gaya ya nahi.
 *
 * `sentBy` null ho to matlab system ne bheja (cron), warna jis bande
 * ne button dabaya.
 */
export async function sendPaymentReminder(
  target: ReminderTarget,
  sentBy: string | null
): Promise<{ ok: boolean; error?: string }> {
  const service = createServiceClient();
  const message = reminderText(target);

  let ok = true;
  let error: string | null = null;

  if (!target.phone) {
    ok = false;
    error = "Kisan ka phone number darj nahi hai.";
  } else {
    try {
      await sendWhatsAppMessage(target.phone, message);
    } catch (e) {
      ok = false;
      error = e instanceof Error ? e.message : "WhatsApp par nahi gaya.";
    }
  }

  await service.from("machinery_payment_reminders").insert({
    booking_id: target.bookingId,
    farmer_id: target.farmerId,
    channel: "whatsapp",
    phone: target.phone,
    amount: target.amount,
    promise_date: target.promiseDate,
    message,
    status: ok ? "sent" : "failed",
    error,
    sent_by: sentBy,
  });

  return ok ? { ok: true } : { ok: false, error: error ?? undefined };
}
