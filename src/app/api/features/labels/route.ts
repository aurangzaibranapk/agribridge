import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadRegistry } from "@/lib/access/registry";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

/**
 * Raasta -> safhe ka naam, chuni hui zaban mein.
 *
 * Chat ke jawab mein AI raasta likhta hai (/admin/inventory/receiving),
 * kyunke wohi ek cheez hai jo wo yaqeen se jaanta hai. Magar banday ko
 * URL dikhana developer ki zaban hai. Is fehrist se chat us raaste ki
 * jagah safhe ka asal naam wala button dikhati hai: "Maal Aana".
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });

  const lang = getLanguageFromCookies("rm");
  const registry = await loadRegistry(lang);
  const out: Record<string, string> = {};
  for (const f of registry.features.values()) out[f.route] = f.label;
  return NextResponse.json({ labels: out });
}
