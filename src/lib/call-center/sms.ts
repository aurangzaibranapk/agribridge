/**
 * Complaint number sirf SMS se jaata hai.
 *
 * Veevo: SMS_PROVIDER=veevo + VEEVO_API_KEY (URL zaroori nahi).
 * Koi aur provider: SMS_API_URL + SMS_API_KEY (purana generic POST).
 * Dono khali hon to queued rehta hai. WhatsApp ka koi raasta nahi.
 */
import { assertSmsChannel } from "@/lib/call-center/rules";
import { sendVeevoSms, type VeevoEnv } from "@/lib/sms/veevo";

export interface ComplaintSmsInput {
  complaintNumber: string;
  categoryLabel: string;
  departmentLabel: string;
  slaHours: number;
  toPhone: string;
}

export interface SmsJob {
  to: string;
  body: string;
  channel: "sms";
  complaintNumber: string;
}

export interface SmsSendResult {
  sent: boolean;
  reason: string;
}

export interface SmsEnv extends VeevoEnv {
  SMS_API_URL?: string;
  SMS_API_KEY?: string;
}

export function buildComplaintSms(input: ComplaintSmsInput): SmsJob {
  const body =
    `Al Rana Traders: Aap ki shikayat ${input.complaintNumber} darj ho gayi hai` +
    ` (${input.categoryLabel}). Department: ${input.departmentLabel}.` +
    ` Hum ${input.slaHours} ghante mein rabta karenge.`;
  return { to: input.toPhone, body, channel: "sms", complaintNumber: input.complaintNumber };
}

/**
 * Bhejne wala. Provider na ho to queued rehne deta hai — jhoot mein
 * "sent" nahi kehta, aur WhatsApp par kabhi nahi jaata.
 */
export function createSmsDispatch(env: SmsEnv, fetchImpl: typeof fetch = fetch) {
  return {
    async send(job: SmsJob): Promise<SmsSendResult> {
      assertSmsChannel(job.channel);
      const provider = env.SMS_PROVIDER?.trim().toLowerCase();
      if (provider === "veevo") {
        const result = await sendVeevoSms({ to: job.to, text: job.body, env, fetchImpl });
        return { sent: result.sent, reason: result.reason };
      }
      const url = env.SMS_API_URL?.trim();
      if (!provider || !url) {
        return { sent: false, reason: "SMS provider not configured yet." };
      }
      const key = env.SMS_API_KEY?.trim();
      if (!key) return { sent: false, reason: "SMS API key missing." };
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: job.to, message: job.body, provider }),
      });
      if (!response.ok) return { sent: false, reason: `SMS gateway ${response.status}` };
      return { sent: true, reason: "sent" };
    },
  };
}
