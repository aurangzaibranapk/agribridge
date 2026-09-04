import { geminiApiKey } from "@/lib/ai/gemini-key";
/**
 * Supplier ke bill ki ek ek qatar parhne wala AI.
 *
 * Ye bill-cash-photo-client se ALAG hai, jaan boojh kar. Wo bill ke
 * neeche wali KUL RAQAM parhta hai -- "IESCO ka bill, Rs 14,320". Ye
 * kaam us se ulta hai: yahan kul raqam ki koi ahmiyat nahi, yahan har
 * qatar ka apna rate chahiye. Ek hi prompt mein dono maangne se dono
 * ka natija kharab hota hai (wohi wajah jis se dabbe wala reader gaari
 * wale se alag rakha gaya tha).
 *
 * ---------------------------------------------------------------------
 * Rate aata sirf bill se hai
 * ---------------------------------------------------------------------
 * Dabbe par trade rate LIKHA HI NAHI hota -- dabbe par MRP hoti hai.
 * Jis rate par maal hamein mila, wo sirf supplier ke bill par likha
 * hota hai. Is liye ye reader hi wo ek jagah hai jahan se lagat aati
 * hai.
 *
 * ---------------------------------------------------------------------
 * Ye reader product NAHI chunta
 * ---------------------------------------------------------------------
 * Bill par "SUFI 5LTR" likha hota hai; hamare paas "Sufi Cooking Oil
 * 5 Litre" hai. Ye dono ek hi cheez hain -- magar ye faisla bande ka
 * hai, AI ka nahi. Is liye yahan se sirf wo aata hai jo bill par LIKHA
 * hai; milaan alag qadam hai.
 *
 * ---------------------------------------------------------------------
 * Adad nikala nahi jata, parha jata hai
 * ---------------------------------------------------------------------
 * Bill par aksar "10 x 412 = 4120" likha hota hai. Agar rate mit gaya
 * ho aur sirf 10 aur 4120 nazar aayein, to 412 hisaab se nikal aata
 * hai -- aur wahin ghalti shuru hoti hai, kyunke bill par discount,
 * scheme aur bonus qatarein bhi hoti hain. Is liye jo LIKHA nahi, wo
 * khali rehta hai; sifar nahi, andaza nahi.
 */

const MODEL_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

export interface BillLineReading {
  /** Qatar jaisi bill par likhi thi -- jyun ki tyun. */
  rawText: string;
  itemName: string | null;
  packSize: string | null;
  qty: number | null;
  /** Ek adad ka trade rate. NULL = bill par saaf nahi tha. */
  rate: number | null;
  lineTotal: number | null;
  /** AI ka is qatar par bharosa (263). */
  confidence: "low" | "medium" | "high";
}

export interface BillLinesReading {
  supplierName: string | null;
  billNumber: string | null;
  billDate: string | null;
  billTotal: number | null;
  lines: BillLineReading[];
  confidence: "low" | "medium" | "high";
  /** Roman Urdu mein ek do jumle -- bande ko dikhane ke liye. */
  summary: string;
}

const PROMPT = `You are reading a SUPPLIER'S PURCHASE INVOICE (bill) received by a shop in Pakistan. It may be a photo of a paper bill, or a PDF. If it is a PDF with more than one page, read the item lines from every page, in order. Amounts are in Pakistani Rupees (PKR). Text may be printed or handwritten, in English, Urdu or Roman Urdu.

Your job is to read the ITEM LINES of the bill — what was bought, how many, and at what rate per unit.

Respond with ONLY a JSON object with these exact keys:
- supplierName: the supplier / distributor / company name printed on the bill, exactly as written, or null
- billNumber: the invoice or bill number, or null
- billDate: the bill date in YYYY-MM-DD format, or null
- billTotal: the grand total printed at the bottom as a plain number, or null
- lines: an array, one entry per item line on the bill, in the order they appear. Each entry has:
    - rawText: the whole line copied exactly as it appears on the bill, including any codes
    - itemName: just the item description, or null
    - packSize: the pack size if written separately, e.g. "5 Ltr", "250g", "24 pcs", or null
    - qty: the quantity as a plain number, or null
    - rate: the RATE PER UNIT as a plain number, or null
    - lineTotal: that line's amount as a plain number, or null
    - confidence: "low", "medium" or "high" — how sure you are about THIS line's numbers (blurry, handwritten, cut off = low)
- confidence: "low", "medium" or "high" — how clearly you can read the rate column
- summary: one or two short sentences in Roman Urdu describing what you see, e.g. "Al-Fajar Traders ka bill, 8 qatarein, kul Rs 84,300." If the rate column is blurry or cut off, say so.

CRITICAL RULES:
1. Only report numbers you can actually SEE printed or written on the bill. Never calculate a missing value. If the rate is not written but qty and amount are, leave rate as null — do NOT divide. If qty is not written, leave it null — do NOT divide the amount by the rate.
2. Never estimate a rate from what the product usually costs. Use null.
3. Include every item line, even ones where you could read almost nothing — put whatever you can see in rawText and leave the rest null. A line you skip disappears silently; a line with nulls can be fixed by hand.
4. Do NOT include discount rows, tax rows, freight rows, "previous balance" rows or the total row as item lines. Those are not products.
5. Do NOT try to match items to any product catalogue, and do not rename or expand item descriptions. Copy what is written.
6. Do NOT return a barcode.

No text outside the JSON object.`;

function cleanNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "n/a") return null;
  return s.slice(0, max);
}

/**
 * Ek qatar par bharosa ho sakta hai ya nahi.
 *
 * Bina kisi likhai ke qatar ka koi matlab nahi -- wo aksar bill ki
 * lakeer ya khali jagah hoti hai jise AI ne qatar samajh liya.
 */
function usableLine(line: BillLineReading): boolean {
  return Boolean(line.rawText || line.itemName);
}

/**
 * Kaun si file bheji ja sakti hai.
 *
 * PDF jaan boojh kar shamil hai: supplier ka bill aksar PDF hi hota
 * hai, aur us ka screenshot lene mein safha kat jane ya dhundla hone
 * ka khatra rehta hai. Reader ko PDF waisi ki waisi jati hai.
 *
 * Fehrist band hai (jo likha hai sirf wohi) -- warna kisi din koi
 * .docx ya .zip charh jati hai, aur reader ke paas us ka jawab "kuch
 * nahi mila" hota, jo bilkul aisa lagta hai jaise bill khali tha.
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

export async function readSupplierBillLines(fileUrl: string): Promise<BillLinesReading | null> {
  const apiKey = geminiApiKey();
  // Key na ho to ye ghalti nahi -- bas AI band hai. Bill phir bhi
  // charhta hai, banda qatarein khud likh sakta hai.
  if (!apiKey) return null;

  try {
    const imageRes = await fetch(fileUrl);
    if (!imageRes.ok) return null;

    const rawType = (imageRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim().toLowerCase();
    const contentType = ALLOWED_TYPES.includes(rawType) ? rawType : null;
    if (!contentType) {
      console.error("Bill lines: is qism ki file nahi parhi jati:", rawType);
      return null;
    }

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
      console.error("Gemini bill lines error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) return null;

    const raw = JSON.parse(textOutput) as Record<string, unknown>;
    const rawLines = Array.isArray(raw.lines) ? raw.lines : [];

    const lines: BillLineReading[] = rawLines
      .slice(0, 200)
      .map((entry) => {
        const e = (entry ?? {}) as Record<string, unknown>;
        return {
          rawText: cleanText(e.rawText, 400) ?? "",
          itemName: cleanText(e.itemName, 200),
          packSize: cleanText(e.packSize, 60),
          qty: cleanNumber(e.qty),
          rate: cleanNumber(e.rate),
          lineTotal: cleanNumber(e.lineTotal),
          confidence: (["high", "medium", "low"].includes(String(e.confidence)) ? String(e.confidence) : "medium") as "low" | "medium" | "high",
        };
      })
      .filter(usableLine);

    const billDate = cleanText(raw.billDate, 10);

    return {
      supplierName: cleanText(raw.supplierName, 160),
      billNumber: cleanText(raw.billNumber, 60),
      billDate: billDate && /^\d{4}-\d{2}-\d{2}$/.test(billDate) ? billDate : null,
      billTotal: cleanNumber(raw.billTotal),
      lines,
      confidence:
        raw.confidence === "high" || raw.confidence === "medium" || raw.confidence === "low"
          ? raw.confidence
          : "low",
      summary: cleanText(raw.summary, 500) ?? "",
    };
  } catch (err) {
    console.error("Gemini bill lines failed:", err);
    return null;
  }
}
