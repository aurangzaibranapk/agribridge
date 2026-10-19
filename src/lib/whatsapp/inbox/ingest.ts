/**
 * Webhook -> Inbox (614 fn_wa_inbox_ingest). Sirf DARJ karta hai: voice ki
 * likhawat aur AI ka mashwara (draft) saath rakhta hai. KUCH BHEJTA NAHI.
 * Har nakami chup -- purana webhook raasta waisa hi chalta rahe.
 */
type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
export interface IngestDeps {
  rpc: Rpc;
  download: (mediaId: string) => Promise<{ base64: string; mimeType: string } | null>;
  upload: (path: string, base64: string, mime: string) => Promise<boolean>;
  setMediaPath: (messageId: string, path: string) => Promise<void>;
  conversationOf: (messageId: string) => Promise<string | null>;
  transcribe: (base64: string, mime: string) => Promise<string | null>;
  draftReply?: (text: string) => Promise<string | null>;
}
export interface InboundMsg {
  id?: string; type: string; timestamp?: string | number;
  text?: { body?: string }; image?: { id?: string; caption?: string }; audio?: { id?: string }; voice?: { id?: string };
}

export async function mirrorInbound(deps: IngestDeps, m: InboundMsg, phoneKey: string | null, phoneDisplay: string, profileName: string | null) {
  if (!phoneKey || !/^\d{10}$/.test(phoneKey)) return { stored: false, reason: "bad_phone" as const };
  const isVoice = m.type === "audio" || m.type === "voice";
  const type = m.type === "text" ? "text" : m.type === "image" ? "image" : isVoice ? "audio" : "other";
  const mediaId = m.image?.id ?? m.audio?.id ?? m.voice?.id ?? null;
  let media: { base64: string; mimeType: string } | null = null;
  if (mediaId && (type === "image" || type === "audio")) media = await deps.download(mediaId).catch(() => null);
  let transcript: string | null = null;
  if (type === "audio" && media) transcript = await deps.transcribe(media.base64, media.mimeType).catch(() => null);
  const body = type === "text" ? m.text?.body ?? null : type === "image" ? m.image?.caption ?? null : null;
  const said = transcript ?? body;
  const draft = said && deps.draftReply ? await deps.draftReply(said).catch(() => null) : null;
  const ts = Number(m.timestamp);
  const { data, error } = await deps.rpc("fn_wa_inbox_ingest", {
    p_phone_key: phoneKey, p_phone_display: phoneDisplay, p_profile_name: profileName,
    p_msg_type: type, p_body: body, p_media_path: null, p_media_mime: media?.mimeType ?? null,
    p_transcript: transcript, p_ai_intent: null, p_ai_draft: draft,
    p_wa_message_id: m.id ?? null, p_wa_ts: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000).toISOString() : null,
  });
  if (error) return { stored: false, reason: "rpc" as const };
  if (!data) return { stored: false, reason: "duplicate" as const };
  const messageId = String(data);
  if (media) {
    const conv = await deps.conversationOf(messageId);
    const ext = (media.mimeType.split("/")[1] ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
    const path = `${conv}/${messageId}.${ext}`;
    if (conv && (await deps.upload(path, media.base64, media.mimeType))) await deps.setMediaPath(messageId, path);
  }
  return { stored: true, messageId, transcript, draft };
}
