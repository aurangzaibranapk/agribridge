/**
 * Bill aur cash parchi parhne wala AI.
 *
 * Gaari wale reader se alag rakha gaya hai, jaan boojh kar. Meter ki
 * photo aur bijli ke bill mein koi qadar mushtarak nahi — ek hi prompt
 * mein dono maangne se dono ka natija kharab hota hai.
 *
 * Ye reader sirf DRAFT banata hai. Jo sab se ahem faisla hai — ke ye cash
 * kharcha hai ya supplier ki adaigi — wo ye kabhi nahi karta. Parchi par
 * "5000 Ahmad ko diye" likha ho to AI ko sirf raqam aur naam nazar aata
 * hai; ye ke Ahmad supplier hai ya mistri, ye sirf manager jaanta hai.
 */

const MODEL_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

export type BillCashKind = "utility_bill" | "rent_receipt" | "purchase_bill" | "cash_slip" | "other" | "unclear";

export interface BillCashReading {
  kind: BillCashKind;
  /** Kul raqam (PKR). */
  amount: number | null;
  /** Bill ya parchi par likhi tareekh (YYYY-MM-DD). */
  documentDate: string | null;
  /** Dukan / company / shakhs ka naam jo parchi par likha hai. */
  partyName: string | null;
  /** Bill number ya reference, agar likha ho. */
  referenceNumber: string | null;
  /** Bijli/gas ke bill ka maheena, agar saaf likha ho (1-12). */
  billMonth: number | null;
  billYear: number | null;
  confidence: "low" | "medium" | "high";
  /** Roman Urdu mein ek do jumle — manager ko dikhane ke liye. */
  summary: string;
}

function cleanNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function readBillOrCashPhoto(base64Image: string, mimeType: string): Promise<BillCashReading | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  // Key set na ho to ye ghalti nahi — bas AI band hai. Submission phir
  // bhi banti hai, manager khud parh kar bhar dega.
  if (!apiKey) return null;

  const prompt = `You are reading a photo of a bill, receipt or handwritten cash slip sent by a shop worker in Pakistan. Amounts are in Pakistani Rupees (PKR). Text may be in English, Urdu or Roman Urdu, and may be handwritten.

Respond with ONLY a JSON object with these exact keys:
- kind: "utility_bill" for an electricity/gas/water bill, "rent_receipt" for a rent receipt, "purchase_bill" for a shop/supplier purchase invoice, "cash_slip" for a handwritten cash given/received note, "other" for any other bill, "unclear" if you cannot tell
- amount: the total payable amount as a plain number (no commas or "Rs"), or null. For a utility bill use the amount payable within due date, not the late-payment amount.
- documentDate: the date printed or written on it in YYYY-MM-DD format, or null
- partyName: the shop, company or person named on it, or null. Copy it exactly as written; do not translate or expand it.
- referenceNumber: bill number, reference number or consumer number, or null
- billMonth: for a utility bill, the billing month as a number 1-12, or null
- billYear: for a utility bill, the billing year as a 4-digit number, or null
- confidence: "low", "medium" or "high" — how clearly you can read the amount
- summary: one or two short sentences in Roman Urdu describing exactly what you can see, e.g. "IESCO ka bijli bill, Rs 14,320, due date 12 August." If something is blurry, say so.

Only report what you can actually SEE. Never estimate or invent a value — use null instead.

Do NOT decide whether this money is a business expense, a supplier payment, or a loan. That is not your job and you cannot know it from the photo. Do not mention it in the summary. Do not include any text outside the JSON object.`;

  try {
    const response = await fetch(`${MODEL_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64Image } }, { text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });

    if (!response.ok) {
      console.error("Gemini bill/cash photo error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    const kinds: BillCashKind[] = ["utility_bill", "rent_receipt", "purchase_bill", "cash_slip", "other", "unclear"];
    const month = cleanNumber(parsed.billMonth);
    const year = cleanNumber(parsed.billYear);

    return {
      kind: kinds.includes(parsed.kind) ? parsed.kind : "unclear",
      amount: cleanNumber(parsed.amount),
      documentDate:
        typeof parsed.documentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.documentDate)
          ? parsed.documentDate
          : null,
      partyName: cleanText(parsed.partyName, 120),
      referenceNumber: cleanText(parsed.referenceNumber, 60),
      billMonth: month != null && month >= 1 && month <= 12 ? Math.round(month) : null,
      billYear: year != null && year >= 2000 && year <= 2100 ? Math.round(year) : null,
      confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
      summary: cleanText(parsed.summary, 500) ?? "",
    };
  } catch (error) {
    console.error("Gemini bill/cash photo failed:", error);
    return null;
  }
}
