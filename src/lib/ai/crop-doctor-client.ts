import { geminiApiKey } from "@/lib/ai/gemini-key";
// Gemini-powered crop disease diagnosis from a photo. Reads a photo of
// a crop, leaf, or plant and identifies likely disease, severity, and
// a treatment plan. This is a free public demo tool - diagnoses are
// AI-generated and should be confirmed by an agronomist before
// large-scale treatment decisions.
export interface CropDiagnosis {
  cropGuess?: string;
  diseaseName: string;
  confidence: "low" | "medium" | "high";
  description: string;
  treatment: string;
  sprayScheduleAdvice: string;
}
export async function diagnoseCropFromImage(
  base64Image: string,
  mimeType: string
): Promise<CropDiagnosis | null> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    // Not configured - normal expected state until the Gemini API key
    // is set, not an error.
    return null;
  }
  try {
    const prompt = `You are an agricultural expert examining a photo of a crop, leaf, or plant for disease diagnosis. Analyze the image and respond with ONLY a JSON object with these exact keys:
- cropGuess: your best guess at the crop type (e.g. "Wheat", "Cotton", "Tomato"), or omit if unclear
- diseaseName: the most likely disease or issue name (e.g. "Leaf Rust", "Bacterial Blight", "Healthy - no issue detected")
- confidence: "low", "medium", or "high" based on how clearly the image shows the symptoms
- description: 2-3 sentences in Roman Urdu describing what you see and why you believe this is the issue
- treatment: 2-3 sentences in Roman Urdu describing recommended treatment (fungicide/pesticide type, general product category - not specific brand names)
- sprayScheduleAdvice: 1-2 sentences in Roman Urdu on timing/frequency for treatment application
Do not include any text outside the JSON object.`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType, data: base64Image } },
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
      console.error("Gemini crop diagnosis error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) return null;
    const parsed = JSON.parse(textOutput);
    return parsed as CropDiagnosis;
  } catch (err) {
    console.error("Crop diagnosis failed:", err);
    return null;
  }
}