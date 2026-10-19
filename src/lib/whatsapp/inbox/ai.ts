import { GoogleGenAI } from "@google/genai";
import { geminiApiKey } from "@/lib/ai/gemini-key";

/** AI ka MASHWARA (draft). Staff dekh kar badalta hai, phir khud "Bhejo" dabata hai. Ye kuch bhejta nahi. */
export async function draftReplyAi(text: string): Promise<string | null> {
  const key = geminiApiKey();
  if (!key) return null;
  const ai = new GoogleGenAI({ apiKey: key });
  const res = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: `Aap AgriBridge (zarai dukaan) ke staff ki madad kar rahe hain. Customer / kisan ka WhatsApp paigham: "${text.slice(0, 600)}". Ek chhota, adab wala jawab Roman Urdu mein likhein (2-3 jumle). Koi raqam, rate ya wada khud se na banayein; agar maloomat chahiye to "check kar ke batate hain" likhein.` }] }],
  });
  const t = (res.text ?? "").trim();
  return t ? t.slice(0, 800) : null;
}
