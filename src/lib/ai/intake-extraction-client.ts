/**
 * Dabbe ki tasveer se product ke khane nikalne wala.
 *
 * Purane product-extraction-client se ALAG rakha gaya hai, jaan boojh
 * kar. Wo zarai maal ke liye likha hai -- khaad, zeher, beej -- aur us
 * mein "active ingredient", "dose", "safety" jaise khane maangta hai.
 * Biscuit ke dabbe par un mein se kuch nahi hota, aur ek hi prompt mein
 * dono maangne se dono ka natija kharab hota hai (wohi wajah jis se
 * bill wala reader gaari wale se alag rakha gaya tha).
 *
 * ---------------------------------------------------------------------
 * Barcode YAHAN SE NAHI aata
 * ---------------------------------------------------------------------
 * Is reader se barcode maanga hi nahi jata. Barcode ki lakeerein browser
 * ka apna BarcodeDetector parhta hai -- wo bilkul theek parhta hai, aur
 * EAN-13 ka check digit us ki apni jaanch bhi kar deta hai.
 *
 * AI tasveer mein LIKHE hue adad parhti hai, aur ek adad ghalat parhna
 * bilkul mumkin hai. Us ghalti ka pata dukan par chalta hai, jab scan
 * karne par doosra product nikalta hai ya kuch nahi milta. Ye wo qism
 * ki ghalti hai jo khud nazar nahi aati.
 */

const MODEL_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

export interface IntakeReading {
  name?: string;
  brand?: string;
  company?: string;
  packSize?: string;
  unit?: string;
  /** Dabbe par chhapi hui qeemat (MRP), agar likhi ho. */
  printedPrice?: number | null;
  manufactureDate?: string | null;
  expiryDate?: string | null;
  /** Kis qism ka maal lagta hai -- sirf tajweez, faisla nahi. */
  categoryGuess?: string;
  confidence?: "low" | "medium" | "high";
}

const PROMPT = `You are reading a photo of a retail product package from a Pakistani grocery / karyana shop (biscuits, tea, cooking oil, soap, flour, spices, drinks, snacks, toiletries — or sometimes an agricultural input).

Extract ONLY what is actually printed on the package. Do not infer, do not guess from what the product usually costs, do not fill a field because it "should" have a value.

- name: the product's brand + variant as printed, e.g. "Tapal Danedar", "Sufi Cooking Oil". Keep the script used on the pack (English or Urdu).
- brand: just the brand, e.g. "Tapal", "Sufi", "Lifebuoy".
- company: the manufacturer's company name if printed separately from the brand.
- packSize: the net content exactly as printed, e.g. "250g", "1 Litre", "12 x 24g".
- unit: one word for how it is sold — Packet, Bottle, Piece, Box, Bag, Tin, Sachet, Kg, Litre.
- printedPrice: the printed retail price / MRP as a plain number in PKR, e.g. 650. Only if a price is actually printed on the pack. If no price is printed, use null. NEVER estimate a price.
- manufactureDate: YYYY-MM-DD if printed. If only month and year are printed, use the first day of that month.
- expiryDate: YYYY-MM-DD if printed. If only month and year are printed, use the LAST day of that month. Note that packs often print "Best before 12 months from manufacturing" — in that case leave this null, do not calculate it.
- categoryGuess: a short category in Roman Urdu that a karyana shop would use, e.g. "Chai", "Ghee aur Tel", "Sabun", "Biscuit", "Masala", "Atta aur Chawal", "Drinks". This is only a suggestion.
- confidence: "high" if the label is sharp and you read the fields directly; "medium" if some were hard to read; "low" if the photo is blurry, cut off, or you are mostly inferring.

Do NOT return a barcode number even if you can see one — the barcode is read separately by a scanner.

Respond with ONLY a JSON object using exactly these keys: name, brand, company, packSize, unit, printedPrice, manufactureDate, expiryDate, categoryGuess, confidence. Omit any key you genuinely cannot determine from the photo. No text outside the JSON.`;

function cleanNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cleanDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function cleanText(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length > 0 && s.toLowerCase() !== "null" ? s : undefined;
}

export async function readProductPhoto(imageUrl: string): Promise<IntakeReading | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) return null;

    const contentType = imageRes.headers.get("content-type") || "image/jpeg";
    const base64Image = Buffer.from(await imageRes.arrayBuffer()).toString("base64");

    const response = await fetch(`${MODEL_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: contentType, data: base64Image } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });

    if (!response.ok) {
      console.error("Gemini intake error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) return null;

    const raw = JSON.parse(textOutput) as Record<string, unknown>;

    // Har khana saaf kiya jata hai. AI kabhi "N/A" ya "unknown" likh
    // deti hai -- wo agar seedha khane mein chala jaye to safhe par
    // asal jawab jaisa dikhta hai.
    return {
      name: cleanText(raw.name),
      brand: cleanText(raw.brand),
      company: cleanText(raw.company),
      packSize: cleanText(raw.packSize),
      unit: cleanText(raw.unit),
      printedPrice: cleanNumber(raw.printedPrice),
      manufactureDate: cleanDate(raw.manufactureDate),
      expiryDate: cleanDate(raw.expiryDate),
      categoryGuess: cleanText(raw.categoryGuess),
      confidence:
        raw.confidence === "high" || raw.confidence === "medium" || raw.confidence === "low"
          ? raw.confidence
          : "low",
    };
  } catch (err) {
    console.error("Gemini intake failed:", err);
    return null;
  }
}
