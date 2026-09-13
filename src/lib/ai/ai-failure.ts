import { geminiApiKey } from "@/lib/ai/gemini-key";

/**
 * AI nakaam ho to bande ko WAJAH milni chahiye, "kuch masla ho gaya" nahi.
 *
 * Malik ne 5 September ko Assistant se poocha "vendor page kahan hai, us
 * ka bill dekhna hai" aur jawab aaya: *"Kuch masla ho gaya, dobara
 * koshish karein."* Us jumle se koi kaam nahi banta. Dobara koshish
 * karne se bhi kuch nahi hota, kyunki masla har dafa wohi rehta hai --
 * aur asal wajah sirf server ke log mein pari rehti hai, jahan malik
 * kabhi nahi jate.
 *
 * Sab se aam wajah do naamon ka farq hai. Is project mein Gemini ki
 * chaabi do naamon se chalti hai -- `GEMINI_API_KEY` aur
 * `BRIDGE_AI_GEMINI_API_KEY` -- aur 4 September ko Live par ek lagi thi,
 * doosri nahi. Us din bill reader chup chaap nakaam ho raha tha. Aaj
 * ulta rukh saamne aaya: bill reader chal raha tha (`geminiApiKey()`
 * dono naam parhta hai) magar Assistant seedha `BRIDGE_AI_...` maang
 * raha tha, jo lagi hui nahi thi.
 *
 * Is liye ab do baatein: chaabi ek hi jagah se, aur nakaami ka jumla wo
 * jis se agla qadam maloom ho.
 */

/** AI ki chaabi -- dono naam qabool. Na mile to `null`. */
export function aiKeyOrNull(): string | null {
  return geminiApiKey() ?? null;
}

/** Chaabi hi nahi lagi -- ye "masla" nahi, ek adhoora setup hai. */
export const AI_KEY_MISSING =
  "AI ki chaabi is server par darj nahi hai. cPanel → Setup Node.js App → Environment variables mein " +
  "GEMINI_API_KEY (ya BRIDGE_AI_GEMINI_API_KEY) daal kar app Restart karein.";

/**
 * Kisi bhi AI nakaami ka aam-fehm jumla.
 *
 * Poora stack bande ke saamne nahi jata (us ka koi faida nahi), magar
 * WAJAH ka ek jumla jata hai -- warna "dobara koshish karein" ke siwa
 * koi raasta nahi bachta.
 */
export function aiErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  if (!aiKeyOrNull()) return AI_KEY_MISSING;

  if (lower.includes("api key") || lower.includes("api_key") || lower.includes("unauthenticated") || lower.includes("401")) {
    return "AI ki chaabi qabool nahi hui — shayad ghalat hai ya khatam ho chuki. cPanel ke Environment variables mein nayi chaabi daal kar app Restart karein.";
  }
  if (lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("429")) {
    return "AI ka aaj ka kota khatam ho gaya. Thori der baad dobara koshish karein.";
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "AI ka model nahi mila — shayad us ka naam badal gaya hai. Ye developer wala masla hai, batayein.";
  }
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("econn") || lower.includes("timeout")) {
    return "AI tak paighaam nahi pahuncha (internet ya Google ki taraf ka masla). Thori der baad dobara.";
  }

  // Koi aur wajah -- phir bhi khali nahi chhorna. Chhota sa tukra kaafi
  // hota hai us ko pehchanne ke liye.
  return raw ? `AI ne jawab nahi diya: ${raw.slice(0, 200)}` : "AI ne jawab nahi diya.";
}
