import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processFarmerAiMessage } from "@/lib/farmer-ai-processor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message: string | undefined = body.message;
    const audioBase64: string | undefined = body.audio;
    const audioMimeType: string = body.audioMimeType ?? "audio/webm";

    if (!message && !audioBase64) {
      return NextResponse.json({ error: "Message ya audio zaroori hai" }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });

    const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
    if (!farmer) return NextResponse.json({ error: "Farmer profile nahi mila" }, { status: 404 });

    const result = await processFarmerAiMessage(supabase, farmer.id, { text: message, audioBase64, audioMimeType });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Farmer AI error:", error);
    return NextResponse.json({ error: "Kuch masla ho gaya, dobara koshish karein." }, { status: 500 });
  }
}