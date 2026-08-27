// Gemini-powered product-detail extraction from a photo. Reads the
// product label/packaging and returns structured fields to pre-fill
// the manual entry form - AI assists the form, it doesn't replace it.
export interface ExtractedProductInfo {
  name?: string;
  activeIngredient?: string;
  composition?: string;
  packSize?: string;
  manufactureDate?: string;
  expiryDate?: string;
  dose?: string;
  usageInstructions?: string;
  safetyInformation?: string;
}
export async function extractProductInfoFromImage(imageUrl: string): Promise<ExtractedProductInfo | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  try {
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) return null;
    const contentType = imageRes.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const prompt = `You are reading a photo of an agricultural product's packaging/label (fertilizer, pesticide, seed, or similar). Extract these fields:
- name: the product's brand/trade name, read from the label
- activeIngredient: the active chemical ingredient(s), read from the label
- composition: the full composition/formula text, read from the label
- packSize: the pack size (e.g. "500ml", "1kg", "25kg bag"), read from the label
- manufactureDate: manufacture date if shown, in YYYY-MM-DD format, read from the label
- expiryDate: expiry date if shown, in YYYY-MM-DD format, read from the label
- dose: recommended dose/dosage rate. If printed on the label, use that exact figure in the same language/script the label uses (English or Urdu). If not printed on the label but you can identify the product/active ingredient with reasonable confidence, fill in the commonly recommended dose for that product type based on standard agricultural practice in Pakistan - write it plainly, matching the language of the rest of the label (English if the label is in English, Urdu if the label is in Urdu). If you cannot identify the product with reasonable confidence, omit this field rather than guessing.
- usageInstructions: how/when to apply the product, in 2-3 sentences, in the same language the label itself uses (English or Urdu) - use the label's own wording if printed, otherwise general standard-practice guidance for that product type, or omit if you cannot identify the product.
- safetyInformation: safety warnings/precautions, in 2-3 sentences, in the same language the label itself uses (English or Urdu) - use the label's own wording if printed, otherwise general standard safety precautions for that type of product (e.g. gloves/mask for chemical pesticides), or omit if you cannot identify the product.
Respond with ONLY a JSON object with these exact keys (name, activeIngredient, composition, packSize, manufactureDate, expiryDate, dose, usageInstructions, safetyInformation). Omit any field you genuinely cannot determine. Do not include any text outside the JSON object.`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: contentType, data: base64Image } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );
    if (!response.ok) {
      console.error("Gemini API error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) return null;
    const parsed = JSON.parse(textOutput);
    return parsed as ExtractedProductInfo;
  } catch (err) {
    console.error("Gemini extraction failed:", err);
    return null;
  }
}