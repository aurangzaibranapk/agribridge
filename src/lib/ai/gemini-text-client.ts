// Shared Gemini text-generation helper — used by the chatbot fallback
// and (future) content-generation features. Returns null when the
// Gemini API key isn't configured, so callers can fall back gracefully.
export async function generateGeminiText(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    if (!response.ok) {
      console.error("Gemini text generation error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return textOutput ?? null;
  } catch (err) {
    console.error("Gemini text generation failed:", err);
    return null;
  }
}