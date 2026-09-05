import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateGeminiText } from "@/lib/ai/gemini-text-client";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];

/**
 * Product ke naam ki tajweez.
 *
 * Sheet aur scan se naam aksar toota hua aata hai: "sabat maser",
 * "kashmr ghee 1kg", "knorr noodls". Banda Rate Baqi ke safhe par usi
 * waqt khara hota hai, aur wahi jagah hai jahan naam theek karna
 * chahiye.
 *
 * TEEN ROKEIN, TEENON JAAN BOOJH KAR:
 *
 * 1. AI naam BADALTA nahi -- sirf TAJWEEZ deta hai. Nishan lagana
 *    banday ka kaam hai. Product ka naam har raseed, har report aur
 *    counter par jata hai; usay AI ke haath mein dena us jagah
 *    khatarnak hai.
 *
 * 2. Tajweez wo cheez nahi badal sakti jo maani badal de. Pack size,
 *    wazan aur brand jaise the waise rehte hain -- "1kg" ko "1 litre"
 *    kar dena naam theek karna nahi, cheez badal dena hai.
 *
 * 3. Chabi na ho to safha jhoot nahi bolta: "AI abhi maujood nahi"
 *    kehta hai. Khali jawab ko "koi tajweez nahi" samajh lena is
 *    project mein pehle bhi ghalat adad de chuka hai.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return NextResponse.json({ error: "ijazat nahi" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { names?: unknown };
  const names = Array.isArray(body.names)
    ? body.names.map((n) => String(n ?? "").trim()).filter((n) => n.length > 0).slice(0, 30)
    : [];
  if (names.length === 0) return NextResponse.json({ suggestions: {} });

  const prompt = [
    "Ye Pakistan ki ek karyana/agri dukan ke products ke naam hain. Ye sheet ya scan se aaye hain,",
    "is liye in mein hijje (spelling) ki ghaltiyan hain.",
    "",
    "Har naam ka DURUST naam likhein -- wahi cheez, sirf hijje aur likhai theek. Usool:",
    "- Roman Urdu/English mein wohi likhein jo dukandar pehchanta hai (misal: 'sabat maser' -> 'Sabut Masoor').",
    "- Pack size, wazan, miqdar aur brand ko HAATH NA LAGAYEIN. 1kg 1kg hi rahe, 500g 500g hi rahe.",
    "- Cheez na badlein. Agar samajh na aaye ke kya cheez hai, to wohi naam wapas kar dein.",
    "- Sirf pehla harf bara karein, poora naam BARE HARFON mein na likhein.",
    "",
    "Jawab SIRF JSON mein dein, is shakl mein (koi aur lafz nahi):",
    '{"asal naam": "durust naam", ...}',
    "",
    "Naam:",
    ...names.map((n) => `- ${n}`),
  ].join("\n");

  const raw = await generateGeminiText(prompt);
  if (raw === null) {
    // Chabi nahi lagi ya AI ne jawab nahi diya -- ye "koi tajweez nahi"
    // ke barabar NAHI hai, aur safhe ko yahi farq batana chahiye.
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  // AI aksar jawab ko ```json ... ``` mein lapet deta hai.
  const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
  } catch {
    return NextResponse.json({ error: "ai_unreadable" }, { status: 502 });
  }

  // Sirf wo tajweez jo waqai kuch badalti hai. "Wahi naam wapas" bhejna
  // banday ko bekar ka faisla karwata hai.
  const suggestions: Record<string, string> = {};
  for (const n of names) {
    const s = String(parsed[n] ?? "").trim();
    if (s && s.toLowerCase() !== n.toLowerCase()) suggestions[n] = s;
  }

  return NextResponse.json({ suggestions });
}
