import { GoogleGenAI } from "@google/genai";
import { geminiApiKey } from "@/lib/ai/gemini-key";
import { READ_INTENTS, ACTION_INTENTS } from "./intents";

/**
 * Voice note -> sirf likhawat (Gemini, wohi jo kisan ke liye lagta hai).
 * Koi jawab / faisla nahi -- sirf alfaaz. Phir wahi intent raasta jo
 * typing ke liye hai (malik: "voice aur typing bilkul ek jaise").
 */
const MODEL = "gemini-3.6-flash";

export async function transcribeVoice(audioBase64: string, mimeType: string): Promise<string | null> {
  const key = geminiApiKey();
  if (!key) return null;
  const ai = new GoogleGenAI({ apiKey: key });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{
      role: "user",
      parts: [
        { text: "Is WhatsApp voice note ko bilkul waisa hi likh do jaisa bola gaya (Urdu / Roman Urdu / Punjabi / English). Sirf alfaaz, koi tabsira ya jawab nahi." },
        { inlineData: { mimeType: mimeType || "audio/ogg", data: audioBase64 } },
      ],
    }],
  });
  const t = (res.text ?? "").trim();
  return t ? t.slice(0, 500) : null;
}

/** AI se sirf intent ka naam (band fehrist). Kuch likhta nahi. */
export async function classifyIntentAi(text: string): Promise<string | null> {
  const key = geminiApiKey();
  if (!key) return null;
  const ai = new GoogleGenAI({ apiKey: key });
  const list = [...READ_INTENTS, ...ACTION_INTENTS, "unknown"].join(", ");
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: `Ek business WhatsApp paigham: "${text.slice(0, 300)}". Sirf ek lafz wapas do in mein se: ${list}.` }] }],
  });
  return (res.text ?? "").trim().split(/\s+/)[0] ?? null;
}
