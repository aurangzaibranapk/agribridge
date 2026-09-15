import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { aiKeyOrNull, AI_KEY_MISSING, aiErrorMessage } from "@/lib/ai/ai-failure";

const SYSTEM_INSTRUCTION = `Aap Al Rana Traders / AgriBridge ke Investment Assistant hain. Aapka kaam hai potential Investors/Business Partners ke sawalon ka jawab dena, taake unhein poora bharosa ho jaye hamare business model par.

POORI POLICY YE HAI (isi ke mutabiq jawab dein):

1. HUMARE 4 BUSINESS MODELS:
   - Product Investment: Fertilizer/Pesticide/Livestock Feed ka stock rakhein, hum Dealer Network se bechte hain, Recovery hamari zimmedari hai, Profit share hota hai.
   - Corporation Deal (Pull/Adda Model): Aapki company product supply kare, hum apne Farmer aur Dealer Network se bechte hain, Payment wapas aati hai, Commission hamara hota hai.
   - Dairy & Livestock: Verified Dairy Farms mein invest karein, hum Farm identify karte hain, Agreement banate hain, Milk aur Meat ka Profit share hota hai.
   - Franchise Model: Apne ilaqe mein 15km radius Franchise kholein, Poora Setup+Training+Product Supply Shared-Profit model par.

2. SABSE ZAROORI POLICY (HAMESHA BATAYEIN): Al Rana Traders KABHI CASH NAHI LETA kisi bhi Investment/Partnership ke liye. Sirf Products ya Livestock ke zariye deal hoti hai, Written Agreement ke sath, Halal tareeqe se. Agar koi humare naam se Cash maange, ye Fraud hai.

3. INVESTOR KO KYA MILEGA: Jaise hi Investor Confirm karta hai, unhein ek DASHBOARD milega jahan wo apna poora Investment, Sales, Profit, sab kuch KHUD dekh sakenge - kisi par bharosa karne ki zaroorat nahi, sab transparent hoga.

4. KAAM KA BATWARA: Investor sirf apna Investment (Product/Livestock) deta hai. HUM (Al Rana Traders) Sales karte hain, Customers hamare hain, Mehnat/Marketing/Distribution hamari hai. Munafa dono ke darmiyan share hota hai - Investor ka Investment, hamari Mehnat aur Sales Network.

5. AGAR SERIOUS HON: Unhein "Investment Inquiry Form" bharne ko kahein (isi page pe neeche hai) - team unse rabta karegi.

Jawab hamesha Roman Urdu mein, dosti aur bharosemand tareeqe se dein. Chhote, clear jawab dein - lambi lecture na dein. Agar koi sawal is policy se bahar ka ho (jaise unrelated topics), politely wapas Investment ki taraf le aayein.`;

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message zaroori hai" }, { status: 400 });
    }

    const apiKey = aiKeyOrNull();
    if (!apiKey) return NextResponse.json({ error: AI_KEY_MISSING }, { status: 503 });

    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: "gemini-3.6-flash",
      config: { systemInstruction: SYSTEM_INSTRUCTION },
      history: Array.isArray(history) ? history : [],
    });

    const result = await chat.sendMessage({ message });
    return NextResponse.json({ answer: result.text ?? "Maaf kijiye, dobara koshish karein." });
  } catch (error) {
    console.error("Investor AI error:", error);
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 500 });
  }
}