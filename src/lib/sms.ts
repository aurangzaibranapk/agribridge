// SMS. OTP, doodh receipt, aur baqi `sendMilkSms()` isi darwaze se jaate hain.
// Veevo tab chalta hai jab SMS_PROVIDER=veevo aur VEEVO_API_KEY set hon.
// Khali env: sent jhoot nahi, number mask, paighaam (OTP) log mein nahi.

import { maskPhone } from "@/lib/call-center/rules";
import { sendVeevoSms, veevoEnv, type VeevoEnv } from "@/lib/sms/veevo";

interface SmsResult {
  sent: boolean;
  reason?: string;
}

export async function sendMilkSms(
  toPhone: string,
  message: string,
  deps?: { env?: VeevoEnv; fetchImpl?: typeof fetch },
): Promise<SmsResult> {
  const env = deps?.env ?? veevoEnv();
  const provider = env.SMS_PROVIDER?.trim().toLowerCase();

  if (!provider) {
    console.info(`[SMS placeholder] To: ${maskPhone(toPhone)} chars=${message.length}`);
    return { sent: false, reason: "SMS provider not configured yet." };
  }

  if (provider === "veevo") {
    const result = await sendVeevoSms({ to: toPhone, text: message, env, fetchImpl: deps?.fetchImpl });
    if (result.sent) return { sent: true, reason: "sent" };
    return { sent: false, reason: result.reason };
  }

  return { sent: false, reason: "SMS provider configured but not implemented yet." };
}

export function buildMilkReceiptMessage(farmerName: string, quantity: number, fat: number | null, rate: number, totalAmount: number): string {
  return `Assalam-o-Alaikum ${farmerName}, aaj aap ka doodh: ${quantity}L${fat ? `, Fat: ${fat}%` : ""}, Rate: Rs${rate}/L, Total: Rs${totalAmount.toLocaleString()}. - Al Rana Traders`;
}