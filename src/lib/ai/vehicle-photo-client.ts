/**
 * Gaari se juri tasveerein parhne wala AI.
 *
 * Do kaam karta hai: meter ki photo se KM nikalna, aur petrol ke bill se
 * litre/rate/raqam nikalna. Sath hi ye bhi batata hai ke tasveer mein
 * hai kya — kyunke staff sirf photo bhej deta hai, ye nahi likhta ke
 * "ye meter hai" ya "ye bill hai".
 *
 * AI ka natija kabhi seedha accounts mein nahi jata — wo sirf draft
 * banata hai jise manager comment ke sath verify karta hai. Is liye
 * yahan ghalti ka nuqsan mehdood hai, magar confidence hamesha sath
 * bhejte hain taake manager ko pata rahe kitna bharosa karna hai.
 */

const MODEL_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

export type PhotoKind = "meter" | "fuel_receipt" | "other_bill" | "unclear";

export interface VehiclePhotoReading {
  kind: PhotoKind;
  /** Meter par likhe hue kul kilometre. */
  odometerKm: number | null;
  /** Bill se: kitne litre. */
  liters: number | null;
  /** Bill se: fi litre rate. */
  ratePerLiter: number | null;
  /** Bill par likhi hui kul raqam. */
  amount: number | null;
  /** Bill par likhi hui tareekh (YYYY-MM-DD), agar saaf nazar aaye. */
  billDate: string | null;
  confidence: "low" | "medium" | "high";
  /** Roman Urdu mein ek do jumle — manager ko dikhane ke liye. */
  summary: string;
}

function cleanNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function readVehiclePhoto(base64Image: string, mimeType: string): Promise<VehiclePhotoReading | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  // Key set na ho to ye ghalti nahi — bas AI band hai. Submission phir
  // bhi banti hai, manager khud parh kar bhar dega.
  if (!apiKey) return null;

  const prompt = `You are reading a photo sent by a delivery rider in Pakistan. It is either a MOTORCYCLE ODOMETER (meter) or a FUEL/PETROL RECEIPT, or possibly another kind of bill.

Respond with ONLY a JSON object with these exact keys:
- kind: "meter" if it shows a vehicle odometer/speedometer reading, "fuel_receipt" if it is a petrol/diesel pump receipt, "other_bill" if it is some other bill/receipt, "unclear" if you cannot tell
- odometerKm: the total kilometres shown on the odometer as a plain number (no commas), or null. Read the MAIN total odometer, not the trip meter. If both are visible, use the larger one.
- liters: litres of fuel from the receipt as a number, or null
- ratePerLiter: price per litre from the receipt as a number, or null
- amount: total amount in PKR from the receipt as a number, or null
- billDate: the date printed on the receipt in YYYY-MM-DD format, or null
- confidence: "low", "medium" or "high" — how clearly you can read the numbers
- summary: one or two short sentences in Roman Urdu describing exactly what you can see, e.g. "Meter par 24,580 km saaf nazar aa raha hai." Do not guess in the summary; say if something is blurry.

Only report numbers you can actually SEE. Never estimate or invent a value — use null instead. Do not include any text outside the JSON object.`;

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
      console.error("Gemini vehicle photo error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    const kind: PhotoKind = ["meter", "fuel_receipt", "other_bill", "unclear"].includes(parsed.kind)
      ? parsed.kind
      : "unclear";

    return {
      kind,
      odometerKm: cleanNumber(parsed.odometerKm),
      liters: cleanNumber(parsed.liters),
      ratePerLiter: cleanNumber(parsed.ratePerLiter),
      amount: cleanNumber(parsed.amount),
      billDate: typeof parsed.billDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.billDate) ? parsed.billDate : null,
      confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "",
    };
  } catch (error) {
    console.error("Gemini vehicle photo failed:", error);
    return null;
  }
}
