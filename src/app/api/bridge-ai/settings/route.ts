import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data } = await supabase
    .from("bridge_ai_settings")
    .select("actions_enabled")
    .eq("id", true)
    .single();
  return NextResponse.json({ actionsEnabled: data?.actions_enabled ?? false });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { actionsEnabled } = await request.json();
  const { error } = await supabase
    .from("bridge_ai_settings")
    .update({ actions_enabled: !!actionsEnabled, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actionsEnabled: !!actionsEnabled });
}