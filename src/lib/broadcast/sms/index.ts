/**
 * Pluggable SMS provider. "console" sirf log (sandbox). "veevo" asal bhejta hai.
 * Chaabi na ho to status queued — sandbox wala jhoot "sent" nahi.
 */
import { sendVeevoSms, veevoEnv } from "@/lib/sms/veevo";

export interface SmsSendResult { id: string; status: "sent" | "failed" | "queued"; error?: string }
export interface SmsProvider {
  readonly name: string;
  readonly sandbox: boolean;
  send(to: string, text: string): Promise<SmsSendResult>;
}

export const consoleSmsProvider: SmsProvider = {
  name: "console",
  sandbox: true,
  async send(to, text) {
    const id = `console-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    console.info(`[sms:console] (sandbox, not sent) to=${to.slice(0, 4)}****${to.slice(-3)} chars=${text.length} id=${id}`);
    return { id, status: "sent" };
  },
};

const PROVIDERS: Record<string, SmsProvider> = { console: consoleSmsProvider };

function veevoBroadcastProvider(): SmsProvider {
  return {
    name: "veevo",
    sandbox: false,
    async send(to, text) {
      const result = await sendVeevoSms({ to, text, env: veevoEnv() });
      if (result.sent) return { id: result.messageId || "", status: "sent" };
      if (result.queued || result.retryable) return { id: "", status: "queued", error: result.reason };
      return { id: "", status: "failed", error: result.reason };
    },
  };
}

export function getSmsProvider(name = process.env.SMS_PROVIDER ?? "console"): SmsProvider {
  const key = (name || "console").trim().toLowerCase();
  if (key === "veevo") return veevoBroadcastProvider();
  const p = PROVIDERS[key];
  if (!p) throw new Error(`SMS provider "${name}" abhi mojood nahi (sirf: ${Object.keys(PROVIDERS).join(", ")}, veevo)`);
  return p;
}
