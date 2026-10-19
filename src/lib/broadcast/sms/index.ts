/**
 * Pluggable SMS provider. Abhi sirf "console" (log-only): koi SMS nahi jata.
 * Naya provider (Jazz / Telenor / branded aggregator) yahan adapter ki shakal mein
 * judega aur SMS_PROVIDER se chuna jayega.
 */
export interface SmsSendResult { id: string; status: "sent" | "failed"; error?: string }
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

export function getSmsProvider(name = process.env.SMS_PROVIDER ?? "console"): SmsProvider {
  const p = PROVIDERS[(name || "console").trim()];
  if (!p) throw new Error(`SMS provider "${name}" abhi mojood nahi (sirf: ${Object.keys(PROVIDERS).join(", ")})`);
  return p;
}
