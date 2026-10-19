// Mobile app (Flutter) cookie nahi bhejti; Supabase access token
// "Authorization: Bearer <jwt>" mein aata hai. Ye pure helpers route aur
// test dono istemal karte hain. Service-role key kabhi app ko nahi jati.

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export const MAX_AI_MESSAGE = 2000;
// ~5 MB audio (base64 ~ 4/3 guna)
export const MAX_AI_AUDIO_B64 = 7_000_000;
export const ALLOWED_AUDIO_MIME = ["audio/webm", "audio/ogg", "audio/mp4", "audio/aac", "audio/mpeg", "audio/wav", "audio/x-m4a", "audio/m4a"] as const;

/** "Bearer xxx.yyy.zzz" se token, warna null. */
export function parseBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!m) return null;
  const token = m[1];
  if (token.length > 8192 || !JWT_SHAPE.test(token)) return null;
  return token;
}

export type FarmerAiInput = { text?: string; audioBase64?: string; audioMimeType: string };

export function validateFarmerAiBody(body: unknown): { ok: true; value: FarmerAiInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Message ya audio zaroori hai" };
  const b = body as Record<string, unknown>;
  const text = typeof b.message === "string" ? b.message.trim() : "";
  const audio = typeof b.audio === "string" ? b.audio : "";
  if (!text && !audio) return { ok: false, error: "Message ya audio zaroori hai" };
  if (text.length > MAX_AI_MESSAGE) return { ok: false, error: `Message ${MAX_AI_MESSAGE} haroof se lamba nahi` };
  if (audio.length > MAX_AI_AUDIO_B64) return { ok: false, error: "Audio bohat lambi hai" };
  if (audio && !/^[A-Za-z0-9+/=\s]+$/.test(audio)) return { ok: false, error: "Audio durust nahi" };
  const mime = typeof b.audioMimeType === "string" ? b.audioMimeType.toLowerCase() : "audio/webm";
  if (audio && !(ALLOWED_AUDIO_MIME as readonly string[]).includes(mime)) return { ok: false, error: "Audio ki qism durust nahi" };
  return { ok: true, value: { text: text || undefined, audioBase64: audio || undefined, audioMimeType: mime } };
}
