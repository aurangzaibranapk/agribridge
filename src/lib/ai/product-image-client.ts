import { geminiApiKey } from "@/lib/ai/gemini-key";
import { resolveImageModel } from "@/lib/ai/gemini-models";
import { recordAiUsage } from "@/lib/ai/usage";

/**
 * Cheez ki tasveer AI se.
 *
 * DO SOORTEIN, aur in ka farq is poore feature ki bunyad hai:
 *
 *   AAM CHEEZ -- "Basmati Chawal 1kg", "Cheeni", "Laal Mirch". In ki
 *   koi khaas dabbi nahi hoti; ek saaf tasveer counter par kaam ki hai.
 *
 *   NAAM WALI CHEEZ -- "Surf Excel", "Coca-Cola", "Cadbury Perk". In ka
 *   dabba asal duniya mein ek khaas shakl ka hai. AI se wo shakl
 *   banwa kar "asal tasveer" ki jagah laga dena JHOOT hai: logo, likhai,
 *   rang -- sab banaya hua hota hai. Counter par banda wo dekh kar
 *   ghalat dabba uthhata hai aur gahak ko ghalat cheez chali jati hai.
 *
 * Is liye naam wali cheez par AI se dabba nahi maanga jata. Us se ek
 * saada NISHAAN maanga jata hai -- bina kisi logo, bina kisi likhai ke
 * -- aur safha us par saaf likh deta hai ke ye asal tasveer nahi.
 *
 * Ye faisla yahan (banane ki jagah) hota hai, safhe par nahi. Safhe par
 * likha hua sirf batata hai; yahan likha hua rokta hai.
 */

export interface ProductImageInput {
  name: string;
  category?: string | null;
  brand?: string | null;
  packSize?: string | null;
  unit?: string | null;
  description?: string | null;
  /** Naam wali cheez? Is se maanga hua kaam badal jata hai. */
  isBranded: boolean;
}

export interface ProductImageResult {
  /** PNG bytes -- base64. */
  base64?: string;
  mimeType?: string;
  prompt?: string;
  model?: string;
  error?: string;
}

/** Har tasveer ek hi tarah ki: chaukor, saaf, cheez beech mein. */
const FRAMING =
  "Square 1:1 composition. Single item centred, occupying about 80% of the frame. " +
  "Plain white studio background, soft even lighting, subtle contact shadow. " +
  "No text, no price, no numbers, no banners, no watermark, no packaging copy, " +
  "no hands, no extra props, nothing else in the frame. Catalogue photography style.";

export function buildPrompt(input: ProductImageInput): string {
  const pack = [input.packSize, input.unit].filter(Boolean).join(" ");

  if (input.isBranded) {
    // Naam wali cheez: dabba NAHI. Sirf ye ke cheez khud kaisi dikhti
    // hai, us ki qism ke hisaab se -- aur koi brand ka nishaan nahi.
    return [
      `A plain, unbranded, generic representation of this product category: ${input.category || input.name}.`,
      pack ? `Typical pack format: ${pack}.` : "",
      "IMPORTANT: do NOT draw any brand name, logo, trademark, label text, or the distinctive packaging design of any real company.",
      "This is a neutral placeholder icon-style photo, NOT a photograph of a real branded pack.",
      FRAMING,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `A clean catalogue photograph of ${input.name}${pack ? ` (${pack})` : ""}.`,
    input.category ? `Category: ${input.category}.` : "",
    input.description ? `${input.description}.` : "",
    "Generic, unbranded presentation. Do NOT add any brand name, logo or label text.",
    FRAMING,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateProductImage(input: ProductImageInput): Promise<ProductImageResult> {
  const apiKey = geminiApiKey();
  // Chabi na ho to saaf batana. Khali tasveer laut ana bande ko ye
  // samajhata hai ke AI ne "kuch nahi banaya", jab ke asal baat ye hai
  // ke AI se poocha hi nahi gaya.
  if (!apiKey) {
    return { error: "AI ki chabi (GEMINI_API_KEY) lagi hui nahi hai -- tasveer nahi ban sakti." };
  }

  const prompt = buildPrompt(input);

  // Model ka naam ab yahan HAATH SE nahi likha. Pehle "gemini-3.6-flash-image"
  // likha hua tha aur Google ne 404 diya -- kyunki wo naam is chaabi par
  // maujood hi nahi tha. Ab Google se poochh kar tay hota hai
  // (`gemini-models.ts`), aur malik `GEMINI_IMAGE_MODEL` daal dein to
  // wohi chalta hai.
  const shuru = Date.now();

  const chuna = await resolveImageModel();
  if ("error" in chuna) {
    await recordAiUsage({ feature: "tasveer", kind: "tasveer", ok: false, error: chuna.error, ms: Date.now() - shuru });
    return {
      error: chuna.maujood?.length
        ? `${chuna.error} Is chaabi par ye model maujood hain: ${chuna.maujood.join(", ")}`
        : chuna.error,
      prompt,
    };
  }
  const model = chuna.model;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      await recordAiUsage({
        feature: "tasveer", kind: "tasveer", model, ok: false,
        error: `${res.status}: ${body}`, ms: Date.now() - shuru,
      });
      // Asal ghalti aage bheji jati hai. "Tasveer nahi bani" likh kar
      // wajah chhupa dena bande ko us masle par bithha deta hai jo wo
      // dekh hi nahi sakta.
      return { error: `AI ne tasveer nahi banayi (${res.status}): ${body.slice(0, 300)}`, prompt, model };
    }

    const json = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p: any) => p?.inlineData?.data);

    if (!img) {
      const said = parts.find((p: any) => p?.text)?.text;
      await recordAiUsage({
        feature: "tasveer", kind: "tasveer", model, ok: false,
        error: said ? String(said) : "AI ne koi tasveer nahi bheji",
        usage: json?.usageMetadata ?? null, ms: Date.now() - shuru,
      });
      return {
        error: said
          ? `AI ne tasveer ke bajaye ye kaha: ${String(said).slice(0, 200)}`
          : "AI ne koi tasveer nahi bheji.",
        prompt,
        model,
      };
    }

    await recordAiUsage({
      feature: "tasveer", kind: "tasveer", model, ok: true,
      usage: json?.usageMetadata ?? null, images: 1, ms: Date.now() - shuru,
      note: input.name.slice(0, 80),
    });

    return {
      base64: img.inlineData.data as string,
      mimeType: (img.inlineData.mimeType as string) || "image/png",
      prompt,
      model,
    };
  } catch (err) {
    await recordAiUsage({
      feature: "tasveer", kind: "tasveer", model, ok: false,
      error: err instanceof Error ? err.message : "maloom nahi", ms: Date.now() - shuru,
    });
    return { error: `AI tak baat nahi pahunchi: ${err instanceof Error ? err.message : "maloom nahi"}`, prompt, model };
  }
}
