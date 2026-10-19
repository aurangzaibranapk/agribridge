import type { ParityDeps, ParityResult } from "./router";
import { handleParityMessage } from "./router";

/** Feature flag: default BAND. Live par kuch nahi badalta jab tak malik on na kare (aur 610/613 na lagein). */
export function parityEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.WHATSAPP_APP_PARITY === "1";
}

type Msg = {
  id?: string;
  type: string;
  timestamp?: string | number;
  text?: { body?: string };
  audio?: { id?: string };
  voice?: { id?: string };
};

/**
 * Webhook ka chhota sa hissa. Jawab SIRF tab bhejta hai jab
 * (1) signature sahih ho, (2) paigham 24 ghante ke andar ka ho.
 * Warna handled=true ho kar bhi kuch nahi bhejta (aur purana raasta bhi nahi chalta,
 * taa ke do jawab na banein).
 */
export async function runParity(
  message: Msg,
  phoneKey: string | null,
  signed: boolean,
  deps: ParityDeps & {
    download: (mediaId: string) => Promise<{ base64: string; mimeType: string } | null>;
    send: (text: string) => Promise<unknown>;
  },
): Promise<{ handled: boolean; sent: boolean; duplicate: boolean; result: ParityResult }> {
  const isVoice = message.type === "audio" || message.type === "voice";
  let audio: { base64: string; mimeType: string } | null = null;
  if (isVoice) {
    const id = message.audio?.id ?? message.voice?.id;
    if (id) audio = await deps.download(id);
  }
  const result = await handleParityMessage(
    { phoneKey, messageType: message.type, text: message.type === "text" ? (message.text?.body ?? null) : null, audio, timestamp: message.timestamp ?? null },
    deps,
  );
  let sent = false;
  let duplicate = false;
  if (result.handled && result.reply && result.canSend && signed) {
    // Idempotency (610 fn_wa_claim_message): Meta ki retry par dobara jawab nahi.
    // Bina wamid, ya claim na ho sake (error), to bhi NAHI bhejte -- shak mein chup.
    const claimed = await claimMessage(deps.rpc, message.id, phoneKey);
    if (claimed) {
      await deps.send(result.reply);
      sent = true;
    } else {
      duplicate = true;
    }
  }
  return { handled: result.handled, sent, duplicate, result };
}

export async function claimMessage(rpc: ParityDeps["rpc"], wamid: string | undefined, phoneKey: string | null): Promise<boolean> {
  if (!wamid) return false;
  try {
    const { data, error } = await rpc("fn_wa_claim_message", { p_wa_message_id: wamid, p_phone_key: phoneKey });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
