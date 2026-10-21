import { NextRequest, NextResponse } from "next/server";
import { requestUser } from "@/lib/api-auth";
import { processFarmerAiMessage } from "@/lib/farmer-ai-processor";
import { aiKeyOrNull, AI_KEY_MISSING, aiErrorMessage } from "@/lib/ai/ai-failure";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message: string | undefined = body.message;
    const audioBase64: string | undefined = body.audio;
    const audioMimeType: string = body.audioMimeType ?? "audio/webm";

    if (!message && !audioBase64) {
      return NextResponse.json({ error: "Message ya audio zaroori hai" }, { status: 400 });
    }
    if (!aiKeyOrNull()) return NextResponse.json({ error: AI_KEY_MISSING }, { status: 503 });

    const auth = await requestUser(request);
    if (!auth) return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
    const supabase = auth.supabase;

    const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", auth.userId).single();
    if (!farmer) return NextResponse.json({ error: "Farmer profile nahi mila" }, { status: 404 });

    const result = await processFarmerAiMessage(supabase, farmer.id, { text: message, audioBase64, audioMimeType });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Farmer AI error:", error);
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 500 });
  }
}