/** Paigham ke variables, SMS hisse, aur number ki shakal. Pure -- client par bhi chalta hai. */
export const BROADCAST_VARS = ["naam", "baqi_raqam", "gaon", "season"] as const;
export type BroadcastVar = (typeof BROADCAST_VARS)[number];

/** {naam} -> value; na mile to "—". Anjaan {x} waisa hi rehta hai. */
export function renderText(tpl: string, vars: Record<string, string | number | null | undefined>): string {
  return String(tpl ?? "").replace(/\{([a-z_]+)\}/g, (m, k: string) =>
    (BROADCAST_VARS as readonly string[]).includes(k) ? (vars[k] == null || vars[k] === "" ? "—" : String(vars[k])) : m);
}

export function missingVars(tpl: string, vars: Record<string, unknown>): string[] {
  const used = [...String(tpl ?? "").matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).filter((k) => (BROADCAST_VARS as readonly string[]).includes(k));
  return [...new Set(used)].filter((k) => vars[k] == null || vars[k] === "");
}

const GSM7 = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";

export interface SmsCount { encoding: "GSM-7" | "UCS-2"; chars: number; segments: number; perSegment: number }

/** GSM-7: 160 (multi 153); Urdu/Unicode (UCS-2): 70 (multi 67). Extension chars 2 gine jate hain. */
export function smsSegments(text: string): SmsCount {
  const s = String(text ?? "");
  const gsm = [...s].every((c) => GSM7.includes(c) || GSM7_EXT.includes(c));
  if (gsm) {
    const chars = [...s].reduce((n, c) => n + (GSM7_EXT.includes(c) ? 2 : 1), 0);
    const segments = chars === 0 ? 0 : chars <= 160 ? 1 : Math.ceil(chars / 153);
    return { encoding: "GSM-7", chars, segments, perSegment: segments > 1 ? 153 : 160 };
  }
  const chars = [...s].reduce((n, c) => n + (c.codePointAt(0)! > 0xffff ? 2 : 1), 0);
  const segments = chars === 0 ? 0 : chars <= 70 ? 1 : Math.ceil(chars / 67);
  return { encoding: "UCS-2", chars, segments, perSegment: segments > 1 ? 67 : 70 };
}

/** 0300-1234567 / +92 300 1234567 / 3001234567 -> 923001234567; warna null (sirf Pakistani mobile). */
export function normalizePkMobile(raw: unknown): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.startsWith("92") && d.length === 12) return /^923\d{9}$/.test(d) ? d : null;
  if (d.startsWith("03") && d.length === 11) return "92" + d.slice(1);
  if (d.startsWith("3") && d.length === 10) return "92" + d;
  return null;
}

/** STOP / START lafz (DB ka fn_messaging_keyword bhi yahi list). */
export function optKeyword(text: string): "stop" | "start" | null {
  const w = String(text ?? "").toLowerCase().replace(/[\p{P}]/gu, "").trim();
  if (["stop", "unsubscribe", "band", "band karo", "band karen", "band karein", "بند", "بند کرو", "بند کریں"].includes(w)) return "stop";
  if (["start", "subscribe", "shuru", "شروع"].includes(w)) return "start";
  return null;
}
