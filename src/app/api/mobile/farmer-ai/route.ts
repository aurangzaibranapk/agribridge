import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { processFarmerAiMessage } from "@/lib/farmer-ai-processor";
import { aiKeyOrNull, AI_KEY_MISSING, aiErrorMessage } from "@/lib/ai/ai-failure";
import { parseBearer, validateFarmerAiBody } from "@/lib/mobile/bearer";
import type { Database } from "@/lib/types/database.types";

export const dynamic = "force-dynamic";

/**
 * Mobile (Flutter) ke liye Kisan AI. Website wala /api/farmer-ai cookie
 * session leta hai; app Bearer token bhejti hai. Supabase client usi token
 * se banta hai, is liye har query par kisan ki apni RLS lagti hai. Gemini aur
 * service key sirf server par rehti hain.
 */
export async function POST(request: NextRequest) {
  try {
    const token = parseBearer(request.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return NextResponse.json({ error: "Server configuration missing" }, { status: 503 });

    const supabase = createSupabaseClient<Database>(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Session durust nahi; dobara login karein" }, { status: 401 });

    let raw: unknown;
    try { raw = await request.json(); } catch { return NextResponse.json({ error: "Message ya audio zaroori hai" }, { status: 400 }); }
    const parsed = validateFarmerAiBody(raw);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (!aiKeyOrNull()) return NextResponse.json({ error: AI_KEY_MISSING }, { status: 503 });

    const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).maybeSingle();
    if (!farmer) return NextResponse.json({ error: "Farmer profile nahi mila" }, { status: 404 });

    const result = await processFarmerAiMessage(
      supabase as unknown as Parameters<typeof processFarmerAiMessage>[0],
      farmer.id,
      parsed.value,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Mobile farmer AI error:", error);
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 500 });
  }
}
