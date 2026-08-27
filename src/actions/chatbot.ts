"use server";
import { createClient } from "@/lib/supabase/server";
import { generateGeminiText } from "@/lib/ai/gemini-text-client";
export interface ChatbotAnswer {
  answer: string;
  source: "faq" | "product" | "service" | "contact" | "fallback" | "ai";
  link?: string;
}
const SERVICE_KEYWORDS: Record<string, string> = {
  "farm advisory": "We offer soil and water test guidance, crop planning support, and field visits from our agronomy team. See the Services page for more.",
  advisory: "We offer soil and water test guidance, crop planning support, and field visits from our agronomy team. See the Services page for more.",
  "crop doctor": "AI Crop Doctor lets you upload a crop photo and get instant disease detection with a treatment and spray schedule. Try it on the AI Crop Doctor page.",
  khata: "Our Khata account is a running credit account - buy now, settle later - tailored to how farmers and dealers actually pay.",
  credit: "Our Khata account is a running credit account - buy now, settle later - tailored to how farmers and dealers actually pay.",
  supply: "We keep a consistent stock of seed, fertilizer, and crop protection products across the season. Check the Products page for what's available now.",
  contact: "You can reach us via the Contact page - phone, email, and business hours are all listed there.",
  hours: "We're open Monday to Saturday, 7AM to 7PM.",
  dealer: "Interested in becoming a dealer? Visit our Invest / Business page or reach out via the Contact page to discuss partnership models.",
  invest: "We offer four partnership models: Product Investment, Corporation Deal, Dairy & Livestock, and Franchise. See the Invest page for details.",
  farmer: "You can register as a farmer from the homepage or the Farmer Registration page - our team reviews and approves new accounts.",
};
export async function askChatbot(question: string): Promise<ChatbotAnswer> {
  const supabase = createClient();
  const q = question.toLowerCase().trim();
  if (!q) return { answer: "Please type a question and I'll do my best to help.", source: "fallback" };
  // 1. Search published FAQs first - most likely to have a precise, staff-written answer.
  const { data: faqs } = await supabase
    .from("faqs")
    .select("question, answer")
    .eq("is_published", true)
    .or(`question.ilike.%${q}%,answer.ilike.%${q}%`)
    .limit(1);
  if (faqs && faqs.length > 0) {
    return { answer: faqs[0].answer, source: "faq" };
  }
  // 2. Search products by name/category.
  const { data: products } = await supabase
    .from("products")
    .select("name, pack_size, selling_price")
    .eq("is_deleted", false)
    .eq("is_available", true)
    .ilike("name", `%${q}%`)
    .limit(3);
  if (products && products.length > 0) {
    const list = products.map((p) => `${p.name}${p.pack_size ? ` (${p.pack_size})` : ""}`).join(", ");
    return { answer: `We currently have: ${list}. Check the Products page for full details and pricing.`, source: "product", link: "/products" };
  }
  // 3. Simple keyword match against known service/business topics.
  for (const [keyword, answer] of Object.entries(SERVICE_KEYWORDS)) {
    if (q.includes(keyword)) return { answer, source: "service" };
  }
  // 4. No local match - try Gemini for a general helpful answer, scoped
  // to agriculture so it stays on-topic and doesn't wander off into
  // unrelated territory.
  const aiPrompt = `You are a helpful assistant for AgriBridge, an agriculture platform in Pakistan run by Al Rana Traders. A visitor asked: "${question}"

If this is a general agriculture question (crops, farming practices, pests, fertilizers, weather, livestock, etc.), answer it helpfully in 2-3 sentences in simple English.

If this is NOT related to agriculture, farming, or AgriBridge's services at all, respond with exactly: "OFF_TOPIC"

Keep the answer concise and practical.`;

  const aiAnswer = await generateGeminiText(aiPrompt);

  if (aiAnswer && !aiAnswer.includes("OFF_TOPIC")) {
    return { answer: aiAnswer.trim(), source: "ai" };
  }

  // 5. No match anywhere - suggest the contact form rather than guessing.
  return {
    answer: "I couldn't find a specific answer to that. Please use the Contact form and our team will get back to you directly.",
    source: "fallback",
    link: "/contact",
  };
}