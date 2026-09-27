import { geminiApiKey } from "@/lib/ai/gemini-key";

const MODEL_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Image se AI instructions nikaalta hai (e.g. handwritten notes, screenshots).
 * Returns array of instruction strings (one per meaningful line).
 */
export async function extractInstructionsFromImage(
  base64Data: string,
  mimeType: string
): Promise<string[]> {
  const key = geminiApiKey();

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: { mimeType, data: base64Data },
          },
          {
            text: `Is image mein jo bhi instructions, hidayaat, ya notes likhi hain unhe dhyaan se parho.
Har instruction ya note ko ek alag line mein likho.
Sirf instructions likho — koi explanation, heading, ya numbering mat lagao.
Agar image mein koi business instruction nahi hai to ek line likho: "Koi instruction nahi mili."

Image:`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
  };

  const res = await fetch(`${MODEL_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);

  const json = await res.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return text
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0 && l !== "Koi instruction nahi mili.");
}
