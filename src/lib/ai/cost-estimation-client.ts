import { geminiApiKey } from "@/lib/ai/gemini-key";
// AI-powered cost estimation for services that don't have a fixed price
// (machinery rental, fertilizer/input purchases). Uses Gemini with
// Google Search grounding so the estimate reflects current Pakistani
// market rates rather than the model's static training data. This
// feeds into the farmer's Profit/Loss view - it's a helpful estimate,
// not a quote, so we always label it "AI Estimated" in the UI.
export interface CostEstimate {
  estimatedCostPkr: number;
  reasoning: string;
}

async function callGeminiWithSearch(prompt: string): Promise<string | null> {
  const apiKey = geminiApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini cost estimation error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || "")
      .join("");
    return textOutput || null;
  } catch (err) {
    console.error("Gemini cost estimation failed:", err);
    return null;
  }
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Grounded responses sometimes wrap the JSON with extra commentary -
    // fall back to pulling out the first {...} block.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// Estimates machinery rental cost for a given machine type and land size.
export async function estimateMachineryCost(machineType: string, acres: number | null): Promise<CostEstimate | null> {
  const prompt = `You are estimating agricultural machinery rental costs in Pakistan (Punjab region) for a farmer. Use Google Search to find current, realistic market rental rates.

Machine: ${machineType}
Land size: ${acres ? `${acres} acres` : "not specified, assume a typical 5-10 acre job"}

Respond with ONLY a JSON object with these exact keys:
- estimatedCostPkr: a single number (whole rupees, no commas or symbols) - your best current estimate of the total rental cost for this job in Pakistani Rupees
- reasoning: 1-2 short sentences in Roman Urdu explaining how you arrived at this estimate (e.g. per-acre rate used)

Do not include any text outside the JSON object.`;

  const raw = await callGeminiWithSearch(prompt);
  if (!raw) return null;
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed.estimatedCostPkr !== "number") return null;

  return {
    estimatedCostPkr: Math.round(parsed.estimatedCostPkr as number),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
  };
}

// Estimates total fertilizer/input cost for a list of products + quantities.
export async function estimateFertilizerCost(
  items: { product_name: string; quantity: number; unit: string }[]
): Promise<CostEstimate | null> {
  const itemsList = items.map((i) => `- ${i.product_name}: ${i.quantity} ${i.unit}`).join("\n");

  const prompt = `You are estimating the total cost of agricultural inputs (fertilizer/seed/pesticide) for a farmer in Pakistan. Use Google Search to find current market prices in Pakistan for these products.

Items requested:
${itemsList}

Respond with ONLY a JSON object with these exact keys:
- estimatedCostPkr: a single number (whole rupees, no commas or symbols) - your best current estimate of the TOTAL cost for all items combined, in Pakistani Rupees
- reasoning: 1-2 short sentences in Roman Urdu briefly explaining the per-item rates used

Do not include any text outside the JSON object.`;

  const raw = await callGeminiWithSearch(prompt);
  if (!raw) return null;
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed.estimatedCostPkr !== "number") return null;

  return {
    estimatedCostPkr: Math.round(parsed.estimatedCostPkr as number),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
  };
}