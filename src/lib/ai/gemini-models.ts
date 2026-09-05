import { geminiApiKey } from "@/lib/ai/gemini-key";

/**
 * Kaunsa model waqai maujood hai -- Google se poochh kar, andaze se nahi.
 *
 * 5 September ko tasveer wala safha ye kehta raha:
 *
 *   models/gemini-3.6-flash-image is not found for API version v1beta,
 *   or is not supported for generateContent. Call ModelService.ListModels
 *   to see the list of available models.
 *
 * Wajah ye thi ke model ka naam code mein HAATH SE likha hua tha. Google
 * apne model ke naam badalta rehta hai aur har chaabi ke saamne alag
 * fehrist khulti hai -- to ek jagah likha hua naam kisi din yun hi mar
 * jata hai, aur bande ko sirf "404" nazar aata hai.
 *
 * Google ke apne paighaam mein hi hal likha tha: ListModels se poochho.
 * Ab wohi hota hai. Naam sirf ek soorat mein haath se lagta hai -- jab
 * malik khud `GEMINI_IMAGE_MODEL` daal dein; us par koi andaza nahi
 * lagta.
 *
 * Fehrist ek dafa laa kar yaad rakh li jati hai (process ke andar). Har
 * tasveer par dobara poochna waqt bhi zaya karta hai aur Google ki hadd
 * bhi.
 */

export interface ModelInfo {
  /** "models/..." ke baghair saaf naam. */
  name: string;
  displayName: string | null;
  description: string | null;
  methods: string[];
}

let cache: { at: number; models: ModelInfo[] } | null = null;
const CACHE_MS = 10 * 60 * 1000;

/** Google ke paas is chaabi par kaunse model hain. */
export async function listGeminiModels(force = false): Promise<ModelInfo[] | { error: string }> {
  const apiKey = geminiApiKey();
  if (!apiKey) return { error: "AI ki chaabi lagi hui nahi hai." };

  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.models;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`
    );
    if (!res.ok) {
      return { error: `Model ki fehrist nahi mili (${res.status}): ${(await res.text()).slice(0, 200)}` };
    }
    const json = await res.json();
    const models: ModelInfo[] = (json?.models ?? []).map((m: any) => ({
      name: String(m.name ?? "").replace(/^models\//, ""),
      displayName: m.displayName ?? null,
      description: m.description ?? null,
      methods: Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [],
    }));
    cache = { at: Date.now(), models };
    return models;
  } catch (err) {
    return { error: `Google tak baat nahi pahunchi: ${err instanceof Error ? err.message : "maloom nahi"}` };
  }
}

/** Jo model tasveer bana sakte hain. */
export function imageCapable(models: ModelInfo[]): ModelInfo[] {
  return models.filter((m) => {
    if (!m.methods.includes("generateContent")) return false;
    const hay = `${m.name} ${m.displayName ?? ""} ${m.description ?? ""}`.toLowerCase();
    // "image" naam mein ho, ya tafseel mein saaf likha ho ke tasveer
    // banata hai. Sirf "image" parhna kaafi nahi -- bohot se model
    // tasveer DEKH sakte hain, bana nahi sakte.
    return (
      m.name.toLowerCase().includes("image") ||
      hay.includes("image generation") ||
      hay.includes("generate images")
    );
  });
}

/**
 * Tasveer ke liye kaunsa model chalayein.
 *
 * Tarteeb:
 *   1. Malik ne `GEMINI_IMAGE_MODEL` daal diya ho -> wohi, bina sawal.
 *   2. Warna Google ki fehrist mein se tasveer banane wala, naya pehle.
 *   3. Koi bhi na ho -> saaf batao ke kya kya maujood hai.
 */
export async function resolveImageModel(): Promise<{ model: string } | { error: string; maujood?: string[] }> {
  const chosen = (process.env.GEMINI_IMAGE_MODEL ?? "").trim();
  if (chosen) return { model: chosen };

  const models = await listGeminiModels();
  if ("error" in models) return { error: models.error };

  const banane_wale = imageCapable(models);
  if (banane_wale.length === 0) {
    return {
      error:
        "Is chaabi par tasveer banane wala koi model maujood nahi. " +
        "Google AI Studio par image generation walay model ki ijazat lein, ya GEMINI_IMAGE_MODEL mein us ka naam daalein.",
      maujood: models.filter((m) => m.methods.includes("generateContent")).map((m) => m.name).slice(0, 40),
    };
  }

  // Naya pehle. Google ke naam mein version aage hota hai
  // (gemini-2.5-... , gemini-3-...), is liye ulti tarteeb mein sort
  // karna kaam kar jata hai -- aur "preview" wale peeche.
  banane_wale.sort((a, b) => {
    const pa = a.name.includes("preview") ? 1 : 0;
    const pb = b.name.includes("preview") ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return b.name.localeCompare(a.name);
  });

  return { model: banane_wale[0].name };
}
