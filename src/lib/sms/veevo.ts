/**
 * Veevo Tech SMS API v3.0 (doc 1.09, 1 Mar 2024).
 * POST https://api.veevotech.com/v3/sendsms
 * JSON: apikey (hash = wahi purani v2 chaabi), receivernum (+923…),
 * textmessage, optional sendernum, optional header.
 *
 * Chaabi sirf env se. GET nahi — chaabi URL mein nahi girti, aur Urdu
 * POST JSON mein safa rehta hai. Kamyabi sirf STATUS SUCCESSFUL aur
 * khali ERROR_FILTER. Faisla ERROR_FILTER pe, ERROR_CODE pe nahi
 * (code badal sakta hai; doc ka typo AUTHETICATION_FAILED jaisa hi hai).
 * GSM-7: 160 / 153. Unicode (Urdu): 70 / 67. Hadd 800. Hum text nahi
 * kaatte — Veevo khud segment karta hai.
 * Dobara: TECHNICAL_ISSUE, INSERTION_FAILED, SENDERID_ROUTING_FAILED,
 * TRAFFIC_NOT_ALLOWED, AUTHETICATION_FAILED, network, HTTP 429/5xx.
 * Voice OTP (sendernum VT-vOTP) aur /v3/sendcall is daire se bahar.
 */

import { maskPhone } from "@/lib/call-center/rules";

export const VEEVO_SEND_URL = "https://api.veevotech.com/v3/sendsms";
export const SMS_MAX_ATTEMPTS = 3;
const BACKOFF_MINUTES = [1, 5, 15];
/** Doc jin filters par "try again" kehta hai. ERROR_CODE yahan nahi. */
const RETRYABLE_FILTERS = new Set([
  "TECHNICAL_ISSUE",
  "INSERTION_FAILED",
  "SENDERID_ROUTING_FAILED",
  "TRAFFIC_NOT_ALLOWED",
  "AUTHETICATION_FAILED",
  "AUTHENTICATION_FAILED",
]);
const GSM_BASIC = new Set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà");
const GSM_EXT = new Set("^{}\\[~]|€");

export interface VeevoEnv {
  SMS_PROVIDER?: string;
  VEEVO_API_KEY?: string;
  VEEVO_SENDER?: string;
  VEEVO_API_URL?: string;
  VEEVO_HEADER?: string;
}

export interface VeevoSendResult {
  sent: boolean;
  /** Provider ya chaabi khali — HTTP nahi, queue waise hi rehti hai. */
  queued: boolean;
  retryable: boolean;
  reason: string;
  messageId: string | null;
  provider: "veevo";
}

export function veevoEnv(source: NodeJS.ProcessEnv = process.env): VeevoEnv {
  return {
    SMS_PROVIDER: source.SMS_PROVIDER,
    VEEVO_API_KEY: source.VEEVO_API_KEY,
    VEEVO_SENDER: source.VEEVO_SENDER,
    VEEVO_API_URL: source.VEEVO_API_URL,
    VEEVO_HEADER: source.VEEVO_HEADER,
  };
}

export function veevoReady(env: VeevoEnv): boolean {
  return env.SMS_PROVIDER?.trim().toLowerCase() === "veevo" && Boolean(env.VEEVO_API_KEY?.trim());
}

/** Doc: pehla SMS 160 (GSM) ya 70 (Unicode); us se lambi 153 ya 67. */
export function veevoCharset(text: string): { unicode: boolean; firstSegment: number; nextSegment: number } {
  const unicode = [...text].some((ch) => !GSM_BASIC.has(ch) && !GSM_EXT.has(ch));
  return unicode
    ? { unicode: true, firstSegment: 70, nextSegment: 67 }
    : { unicode: false, firstSegment: 160, nextSegment: 153 };
}

/** 03xxxxxxxxx, 923…, +923…, 3xxxxxxxxx → +923xxxxxxxxx. Galat number null. */
export function toVeevoReceiver(raw: string | null | undefined): string | null {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^03\d{9}$/.test(digits)) return `+92${digits.slice(1)}`;
  if (/^3\d{9}$/.test(digits)) return `+92${digits}`;
  if (/^923\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{8,15}$/.test(digits)) return `+${digits}`;
  return null;
}

export function nextSmsAttempt(attemptsSoFar: number, now = new Date()): {
  attempts: number;
  status: "queued" | "failed";
  nextAttemptAt: string | null;
} {
  const attempts = attemptsSoFar + 1;
  if (attempts >= SMS_MAX_ATTEMPTS) return { attempts, status: "failed", nextAttemptAt: null };
  const minutes = BACKOFF_MINUTES[Math.min(Math.max(attempts - 1, 0), BACKOFF_MINUTES.length - 1)];
  return {
    attempts,
    status: "queued",
    nextAttemptAt: new Date(now.getTime() + minutes * 60_000).toISOString(),
  };
}

function filterOf(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

function payloadOf(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return payloadOf(value[0]);
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function logLine(phone: string, detail: string): void {
  console.info(`[sms:veevo] ${detail} to=${maskPhone(phone)}`);
}

export async function sendVeevoSms(input: {
  to: string;
  text: string;
  env: VeevoEnv;
  fetchImpl?: typeof fetch;
}): Promise<VeevoSendResult> {
  const hold: VeevoSendResult = {
    sent: false, queued: true, retryable: false, reason: "SMS provider not configured yet.", messageId: null, provider: "veevo",
  };
  if (!veevoReady(input.env)) return hold;
  const receiver = toVeevoReceiver(input.to);
  if (!receiver) {
    logLine(input.to, "INVALID_NUMBER");
    return { ...hold, queued: false, reason: "INVALID_NUMBER" };
  }
  const text = input.text ?? "";
  if (text.length < 1) return { ...hold, queued: false, reason: "SMS_TEXT_MISSING" };
  if ([...text].length > 800) return { ...hold, queued: false, reason: "CONTENT_TOO_LONG" };
  const sender = input.env.VEEVO_SENDER?.trim();
  if (sender && /^vt-votp$/i.test(sender)) {
    logLine(input.to, "VOICE_OUT_OF_SCOPE");
    return { ...hold, queued: false, reason: "VOICE_OUT_OF_SCOPE" };
  }

  const key = input.env.VEEVO_API_KEY!.trim();
  const body: Record<string, string> = {
    apikey: key,
    hash: key,
    receivernum: receiver,
    textmessage: text,
  };
  if (sender) body.sendernum = sender;
  const header = input.env.VEEVO_HEADER?.trim();
  if (header) body.header = header;
  const url = input.env.VEEVO_API_URL?.trim() || VEEVO_SEND_URL;
  const fetchImpl = input.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    logLine(input.to, "network");
    return { ...hold, queued: false, retryable: true, reason: "network" };
  }

  let json: Record<string, unknown> = {};
  try { json = payloadOf(await response.json()); } catch { json = {}; }
  const status = filterOf(json.STATUS);
  const filter = filterOf(json.ERROR_FILTER);
  const messageId = json.MESSAGE_ID == null || json.MESSAGE_ID === "" ? null : String(json.MESSAGE_ID);
  const httpRetry = response.status === 408 || response.status === 429 || response.status >= 500;
  const accepted = response.ok && status === "SUCCESSFUL" && !filter;
  if (accepted) {
    logLine(input.to, `sent id=${messageId ?? ""} chars=${text.length}`);
    return { sent: true, queued: false, retryable: false, reason: "sent", messageId, provider: "veevo" };
  }
  const reason = (filter || status || `HTTP_${response.status}`).slice(0, 180);
  const retryable = httpRetry || RETRYABLE_FILTERS.has(filter);
  logLine(input.to, `fail ${reason} http=${response.status}`);
  return { sent: false, queued: false, retryable, reason, messageId, provider: "veevo" };
}
