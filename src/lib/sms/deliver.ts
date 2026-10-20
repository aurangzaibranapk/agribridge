/**
 * Jab Veevo set ho, paighaam SMS se jata hai. Warna purana WhatsApp raasta.
 * Dono ek sath nahi — do paighaam nahi jaate.
 */
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp-client";
import { sendVeevoSms, veevoEnv, veevoReady, type VeevoEnv } from "@/lib/sms/veevo";

export async function deliverFreeText(input: {
  phone: string;
  message: string;
  env?: VeevoEnv;
  fetchImpl?: typeof fetch;
  sendWhatsapp?: (phone: string, message: string) => Promise<void>;
}): Promise<{ channel: "sms" | "whatsapp"; ok: boolean; error: string | null }> {
  const env = input.env ?? veevoEnv();
  if (veevoReady(env)) {
    const result = await sendVeevoSms({ to: input.phone, text: input.message, env, fetchImpl: input.fetchImpl });
    return { channel: "sms", ok: result.sent, error: result.sent ? null : result.reason };
  }
  try {
    await (input.sendWhatsapp ?? sendWhatsAppMessage)(input.phone, input.message);
    return { channel: "whatsapp", ok: true, error: null };
  } catch (error) {
    return { channel: "whatsapp", ok: false, error: error instanceof Error ? error.message : "Send failed" };
  }
}

export function recoveryChannelReady(env: VeevoEnv & {
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_RECOVERY_TEMPLATE?: string;
}): "sms" | "whatsapp" | "none" {
  if (veevoReady(env)) return "sms";
  if (env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_RECOVERY_TEMPLATE) return "whatsapp";
  return "none";
}

export async function deliverRecoveryNotice(input: {
  phone: string;
  message: string;
  template: string;
  lang: string;
  params: string[];
  env?: VeevoEnv;
  fetchImpl?: typeof fetch;
  sendTemplate?: (phone: string, template: string, lang: string, params: string[]) => Promise<unknown>;
}): Promise<{ ok: boolean; channel: "sms" | "whatsapp"; error?: string }> {
  const env = input.env ?? veevoEnv();
  if (veevoReady(env)) {
    const result = await sendVeevoSms({ to: input.phone, text: input.message, env, fetchImpl: input.fetchImpl });
    return result.sent
      ? { ok: true, channel: "sms" }
      : { ok: false, channel: "sms", error: result.reason };
  }
  await (input.sendTemplate ?? sendWhatsAppTemplate)(input.phone, input.template, input.lang, input.params);
  return { ok: true, channel: "whatsapp" };
}

export function khataReminderText(amount: number, dueDate: string | null): string {
  const due = dueDate ? ` Due: ${dueDate}.` : "";
  const rs = Math.round(Number(amount) || 0).toLocaleString("en-PK");
  return `Al Rana Traders: Aap ke khate par Rs ${rs} baqi hain.${due} Meharbani farma kar adaigi kar dein.`;
}
