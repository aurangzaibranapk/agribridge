import { geminiApiKey } from "@/lib/ai/gemini-key";
import { recordAiUsage } from "@/lib/ai/usage";

const MODEL = "gemini-3.6-flash";

/**
 * Likhai wala AI -- ek hi jagah se.
 *
 * `feature` sirf khate ke liye hai (317): kis kaam ne AI ko bulaya. Us
 * ke baghair mahine ke aakhir mein ye sawal jawab nahi paata ke istemal
 * kis taraf se aaya.
 */
export async function generateGeminiText(prompt: string, feature = "likhai"): Promise<string | null> {
  const apiKey = geminiApiKey();
  if (!apiKey) return null;
  const shuru = Date.now();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    if (!response.ok) {
      const body = await response.text();
      console.error("Gemini text generation error:", response.status, body);
      await recordAiUsage({
        feature,
        kind: "likhai",
        model: MODEL,
        ok: false,
        error: `${response.status}: ${body}`,
        ms: Date.now() - shuru,
      });
      return null;
    }
    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    await recordAiUsage({
      feature,
      kind: "likhai",
      model: MODEL,
      ok: Boolean(textOutput),
      error: textOutput ? null : "AI ne khali jawab diya",
      usage: data?.usageMetadata ?? null,
      ms: Date.now() - shuru,
    });
    return textOutput ?? null;
  } catch (err) {
    console.error("Gemini text generation failed:", err);
    await recordAiUsage({
      feature,
      kind: "likhai",
      model: MODEL,
      ok: false,
      error: err instanceof Error ? err.message : "maloom nahi",
      ms: Date.now() - shuru,
    });
    return null;
  }
}
