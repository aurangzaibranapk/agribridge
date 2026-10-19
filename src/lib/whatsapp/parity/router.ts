import { identifySender, type WaIdentity } from "./identity";
import { parseIntent, isRead, isAction, type Intent } from "./intents";
import { canRead, withinReplyWindow } from "./policy";
import { answerRead, type AnswerDeps } from "./answers";

/**
 * WhatsApp = App, Phase 1 router. Sirf PARHTA hai aur jawab ka TEXT
 * banata hai -- bhejna webhook ka kaam (aur sirf signed + 24h window).
 *
 * handled=false => webhook purana raasta chalaye (staff hazri / doodh /
 * cash entries, kisan ka AI draft, anjaan list). Is tarah Phase 1 koi
 * purani cheez nahi torta.
 */
export interface ParityInput {
  phoneKey: string | null;
  messageType: string;           // text | audio | voice | ...
  text: string | null;
  audio?: { base64: string; mimeType: string } | null;
  timestamp: number | string | null; // Meta message.timestamp (seconds)
}
export interface ParityDeps extends AnswerDeps {
  transcribe: (base64: string, mime: string) => Promise<string | null>;
  aiIntent?: (text: string) => Promise<unknown>;
  now?: () => number;
}
export interface ParityResult {
  handled: boolean;
  identity: WaIdentity;
  intent: Intent | null;
  heard: string | null;   // voice ki likhawat
  reply: string | null;   // null = koi jawab nahi
  canSend: boolean;       // 24h window ke andar?
  reason: string;
}

export const NEXT_PHASE =
  "Ye kaam (nayi entry / order / transfer / approval) WhatsApp par agle marhale mein aa raha hai. Abhi app mein karein — wahan wohi qaide hain.";
export const NOT_ALLOWED = "Ye maloomat aap ke account ki ijazat mein nahi. App mein jo aap ko dikhta hai wohi yahan milta hai.";
export const VOICE_FAILED = "Maazrat, awaaz samajh nahi aayi. Dobara bolein ya likh kar bhejein.";

const out = (r: Omit<ParityResult, "canSend">, input: ParityInput, deps: ParityDeps): ParityResult => ({
  ...r,
  canSend: r.reply != null && withinReplyWindow(input.timestamp, (deps.now ?? Date.now)()),
});

export async function handleParityMessage(input: ParityInput, deps: ParityDeps): Promise<ParityResult> {
  const identity = await identifySender(deps.rpc, input.phoneKey);
  const base = { identity, intent: null, heard: null } as const;

  // Anjaan / do accounts / 610 nahi laga: purana raasta (anjaan list waghera).
  if (!["owner", "admin", "staff", "farmer", "customer"].includes(identity.kind) || !identity.userId) {
    return out({ ...base, handled: false, reply: null, reason: identity.kind }, input, deps);
  }

  const isVoice = input.messageType === "audio" || input.messageType === "voice";
  let text = input.text ?? "";
  let heard: string | null = null;
  if (isVoice) {
    if (!input.audio) return out({ ...base, handled: false, reply: null, reason: "voice_no_media" }, input, deps);
    try {
      heard = await deps.transcribe(input.audio.base64, input.audio.mimeType);
    } catch {
      heard = null;
    }
    if (!heard) {
      // Staff / kisan ki voice purane raaste ko bhi ja sakti hai; owner / admin / customer ko saaf jawab.
      if (identity.kind === "staff" || identity.kind === "farmer") return out({ ...base, handled: false, reply: null, reason: "voice_failed_fallthrough" }, input, deps);
      return out({ ...base, handled: true, reply: VOICE_FAILED, reason: "voice_failed" }, input, deps);
    }
    text = heard;
  } else if (input.messageType !== "text") {
    return out({ ...base, handled: false, reply: null, reason: "not_text" }, input, deps);
  }

  const intent = await parseIntent(text, deps.aiIntent);
  const said = heard ? `🎙 Aap ne kaha: “${heard}”\n\n` : "";

  if (isRead(intent)) {
    if (!canRead(identity.kind, identity.role, intent)) {
      // Staff / kisan: shayad purane raaste ka kaam hai (hazri, doodh, cash entry, kisan ka sawal).
      if (identity.kind === "staff" || identity.kind === "farmer") {
        return out({ ...base, intent, heard, handled: false, reply: null, reason: "read_not_allowed_fallthrough" }, input, deps);
      }
      return out({ ...base, intent, heard, handled: true, reply: said + NOT_ALLOWED, reason: "read_not_allowed" }, input, deps);
    }
    const body = await answerRead(deps, identity, intent);
    return out({ ...base, intent, heard, handled: true, reply: said + body, reason: "read" }, input, deps);
  }

  if (isAction(intent)) {
    // Staff (cash / bill entries) aur kisan (AI draft) ke purane drafts chalte rahen.
    if (identity.kind === "staff" || identity.kind === "farmer") {
      return out({ ...base, intent, heard, handled: false, reply: null, reason: "action_fallthrough" }, input, deps);
    }
    return out({ ...base, intent, heard, handled: true, reply: said + NEXT_PHASE, reason: "action_next_phase" }, input, deps);
  }

  // Samajh nahi aaya: owner / admin / customer ko menu; staff / kisan purane raaste.
  if (identity.kind === "staff" || identity.kind === "farmer") {
    return out({ ...base, intent, heard, handled: false, reply: null, reason: "unknown_fallthrough" }, input, deps);
  }
  const help = await answerRead(deps, identity, "help");
  return out({ ...base, intent, heard, handled: true, reply: said + help, reason: "unknown_help" }, input, deps);
}
