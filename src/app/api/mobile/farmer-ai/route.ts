import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { processFarmerAiMessage } from "@/lib/farmer-ai-processor";
import { aiKeyOrNull, AI_KEY_MISSING, aiErrorMessage } from "@/lib/ai/ai-failure";
import type { Database } from "@/lib/types/database.types";

/** Mobile bearer-token bridge. Gemini and service credentials always remain server-side. */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
    if (!aiKeyOrNull()) return NextResponse.json({ error: AI_KEY_MISSING }, { status: 503 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return NextResponse.json({ error: "Server configuration missing" }, { status: 503 });
    const supabase = createSupabaseClient<Database>(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Session durust nahi" }, { status: 401 });
    const body = await request.json() as { message?: string; audio?: string; audioMimeType?: string };
    if (!body.message && !body.audio) return NextResponse.json({ error: "Message ya audio zaroori hai" }, { status: 400 });
    const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).maybeSingle();
    if (!farmer) return NextResponse.json({ error: "Farmer profile nahi mila" }, { status: 404 });
    const result = await processFarmerAiMessage(supabase as never, farmer.id, { text: body.message, audioBase64: body.audio, audioMimeType: body.audioMimeType ?? "audio/webm" });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 500 });
  }
}
