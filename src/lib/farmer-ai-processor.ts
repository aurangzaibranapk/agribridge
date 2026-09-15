import { GoogleGenAI, Type } from "@google/genai";
import { geminiApiKey } from "@/lib/ai/gemini-key";
import type { createClient } from "@/lib/supabase/server";
import { getCompanyProducts, getFarmerContext, getMandiRate, escalateToExpert } from "@/lib/kisan-knowledge-tools";

export const FARMER_AI_TOOLS = [
  {
    name: "log_expense",
    description: "Farmer ne apni fasal pe koi kharcha kiya hai (jaise diesel, mazdoori, khaad) - is expense ko draft ki tarah save karein, approval abhi nahi hui.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: "Expense category, jaise 'diesel', 'labor', 'fertilizer', 'other'" },
        description: { type: Type.STRING, description: "Ek line mein kya kharcha hua (Roman Urdu)" },
        amount: { type: Type.NUMBER, description: "Kitne Rupay kharch hue" },
      },
      required: ["description", "amount"],
    },
  },
  {
    name: "request_machinery",
    description: "Farmer ko koi Machine (tractor, thresher, harvester) chahiye - draft request banayein.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        machine_type: { type: Type.STRING, description: "jaise 'tractor', 'thresher', 'harvester', 'rotavator'" },
        acres: { type: Type.NUMBER, description: "Kitne Acres ke liye" },
        crop_type: { type: Type.STRING, description: "Kaunsi Fasal ke liye" },
      },
      required: ["machine_type"],
    },
  },
  {
    name: "request_fertilizer",
    description: "Farmer ko Khaad/Pesticide chahiye - draft request banayein.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: { type: Type.STRING, description: "Kya chahiye (Roman Urdu mein)" },
      },
      required: ["description"],
    },
  },
  {
    name: "sell_produce",
    description: "Farmer apni fasal/produce Website Marketplace pe bechna chahta hai - draft listing banayein.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        crop_name: { type: Type.STRING },
        quantity: { type: Type.NUMBER },
        unit: { type: Type.STRING, description: "jaise 'maund', 'kg'" },
        price: { type: Type.NUMBER, description: "Farmer ki maang ka rate (optional)" },
      },
      required: ["crop_name", "quantity"],
    },
  },
  {
    name: "get_company_products",
    description: "L2: AgriBridge ke apne Products dhoondein (jaise Fertilizer/Pesticide ka naam, rate, availability) - jab Farmer ke sawal mein koi Product/Treatment recommend karna ho.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        search_term: { type: Type.STRING, description: "Product ka naam ya category, jaise 'Urea' ya 'Pesticide'" },
      },
      required: ["search_term"],
    },
  },
  {
    name: "get_farmer_context",
    description: "L3: Is Farmer ke apne Farm/Crop/Expense history dekhein - hamesha PEHLE ye tool use karein jab koi crop/farm-specific sawal aaye, taake asal data (sowing date, pehle kya laga, kitni acre) use kar sakein, andaza na lagayen.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_mandi_rate",
    description: "L4: Kisi Fasal ka current Mandi Rate dekhein.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        crop_name: { type: Type.STRING, description: "jaise 'gandum', 'chawal', 'makai'" },
      },
      required: ["crop_name"],
    },
  },
  {
    name: "escalate_to_expert",
    description: "L5 SAFETY GATE: Jab aap Confident NA HON (jaise exact bimari ki tashkhees, ya exact chemical/dosage recommendation), ya jab andaza lagana khatarnaak ho sakta hai, to khud jawab MAT dein - is tool se Insaan Expert (Agronomist) ko bulayein. Ye hamesha behtar hai galat advice dene se.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING, description: "Farmer ka asal sawal" },
        reason: { type: Type.STRING, description: "Kyun Expert chahiye (jaise 'Confidence kam hai', 'Exact dosage safety-sensitive hai')" },
      },
      required: ["question", "reason"],
    },
  },
];

const SYSTEM_INSTRUCTION = `Aap Kisan AI Assistant hain - AgriBridge ka Farmer-facing AI. Aap ek LAYERED REASONING system follow karte hain:

L1 (General Agri Knowledge): Aapka apna trained knowledge - crop stages, bimariyon ki aam wajah, fertilizer principles.
L2 (Company Data): get_company_products tool - jab koi Product/Treatment recommend karna ho.
L3 (Farmer's Own Data): get_farmer_context tool - HAMESHA PEHLE ye check karein jab crop/farm-specific sawal aaye, taake asal data (sowing date, pehle ke inputs) use karein, andaza na lagayen.
L4 (Live/Market Data): get_mandi_rate tool - Mandi rates ke liye.
L5 (Safety Escalation): escalate_to_expert tool.

SAFETY RULE (SABSE ZAROORI - HAR JAWAB SE PEHLE CHECK KAREIN): Agar aapko exact bimari ki tashkhees, ya exact chemical/pesticide dosage recommend karna ho, aur aap 100% Confident nahi hain, to KHUD JAWAB MAT DEIN - escalate_to_expert tool call karein. Galat advice dena, Insaan ko bulane se zyada khatarnaak hai. Kabhi bhi guess karke exact dosage ya treatment na batayein.

Farmer ko hamesha Roman Urdu mein jawab dein, seedha aur clear. Voice/Text kisi bhi Pakistani zaban mein aa sakti hai (Urdu, Punjabi, Pashto, Sindhi, Balochi, wagera) - use samjhein, jawab Roman Urdu mein dein. Record-creation intents (Expense, Machinery, Fertilizer, Produce Sell) ke liye humesha Draft banayein (log_expense/request_machinery/request_fertilizer/sell_produce), kabhi seedha record nahi banate - Farmer khud Approve karega.`;

export interface ProcessResult {
  answer: string;
  draftCreated: boolean;
  draftId?: string;
}

export async function processFarmerAiMessage(
  supabase: ReturnType<typeof createClient>,
  farmerId: string,
  input: { text?: string; audioBase64?: string; audioMimeType?: string }
): Promise<ProcessResult> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey()! });
  const chat = ai.chats.create({
    model: "gemini-3.6-flash",
    config: {
      tools: [{ functionDeclarations: FARMER_AI_TOOLS }],
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  const messageInput = input.audioBase64
    ? [
        { inlineData: { mimeType: input.audioMimeType ?? "audio/ogg", data: input.audioBase64 } },
        { text: "Upar wali voice note sunein aur samjhein. Farmer ne kya kaha hai." },
      ]
    : input.text!;

  let result = await chat.sendMessage({ message: messageInput as any });
  let functionCalls = result.functionCalls;
  let loopCount = 0;

  while (functionCalls && functionCalls.length > 0 && loopCount < 4) {
    loopCount++;
    const call = functionCalls[0];
    const args = call.args as any;

    if (["log_expense", "request_machinery", "request_fertilizer", "sell_produce"].includes(call.name!)) {
      let humanDescription = "";
      if (call.name === "log_expense") humanDescription = `Expense: ${args.description} - Rs ${args.amount}`;
      else if (call.name === "request_machinery") humanDescription = `Machinery chahiye: ${args.machine_type}${args.acres ? ` (${args.acres} acres)` : ""}`;
      else if (call.name === "request_fertilizer") humanDescription = `Fertilizer/Pesticide: ${args.description}`;
      else if (call.name === "sell_produce") humanDescription = `Produce bechna: ${args.crop_name} - ${args.quantity} ${args.unit ?? "maund"}`;

      const { data: draft, error } = await supabase
        .from("farmer_ai_requests")
        .insert({ farmer_id: farmerId, intent_type: call.name, description: humanDescription, details: args, status: "pending" })
        .select("id")
        .single();

      if (error) return { answer: "Draft banane mein masla hua, dobara koshish karein.", draftCreated: false };

      return {
        answer: `Samajh gaya: ${humanDescription}. Ye Farmer Portal ke "Pending Approvals" mein save ho gaya hai.`,
        draftCreated: true,
        draftId: draft.id,
      };
    }

    if (call.name === "escalate_to_expert") {
      const escalationResult = await escalateToExpert(supabase, farmerId, args.question, args.reason);
      return { answer: escalationResult.message, draftCreated: false };
    }

    let toolResult: any = {};
    if (call.name === "get_company_products") toolResult = await getCompanyProducts(supabase, args.search_term);
    else if (call.name === "get_farmer_context") toolResult = await getFarmerContext(supabase, farmerId);
    else if (call.name === "get_mandi_rate") toolResult = await getMandiRate(supabase, args.crop_name);

    result = await chat.sendMessage({
      message: [{ functionResponse: { name: call.name!, response: toolResult } }] as any,
    });
    functionCalls = result.functionCalls;
  }

  return { answer: result.text ?? "Maaf kijiye, samajh nahi paya. Dobara koshish karein.", draftCreated: false };
}