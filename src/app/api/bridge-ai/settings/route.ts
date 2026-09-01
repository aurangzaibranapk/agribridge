import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

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
  // AI ke actions on/off karna sirf admin ka kaam hai — pehle koi bhi
  // login wala ye switch daba sakta tha.
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createClient();
  const { actionsEnabled } = await request.json();
  const { error } = await supabase
    .from("bridge_ai_settings")
    .update({ actions_enabled: !!actionsEnabled, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actionsEnabled: !!actionsEnabled });
}