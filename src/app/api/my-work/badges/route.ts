import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadNav } from "@/lib/access/nav";
import { loadNeedsAttention, filterAttention } from "@/lib/access/needs-attention";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Sidebar ke chhote adad -- raaste ke hisaab se.
 *
 * Ye ginti "aaj kya baqi hai" wali hi hai, koi doosra hisaab nahi. Alag
 * raaste se is liye aati hai ke sidebar har safhe par hai: har safhe par
 * bees ginti ki query chalana server ko be-wajah thaka deta hai. Yahan
 * se sirf ek dafa aati hai aur browser mein padi rehti hai.
 *
 * Jo ginti na mile wo NULL rehti hai -- safhe par "—", sifar nahi.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });

  const service = createServiceClient();
  const { data: me } = await service.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return NextResponse.json({ error: "inactive" }, { status: 403 });

  const lang = getLanguageFromCookies("rm");
  const nav = await loadNav(user.id, me.role, lang);
  const items = filterAttention(await loadNeedsAttention(), nav.unrestricted ? null : nav.allowedRoutes);

  const byRoute: Record<string, { count: number | null; tone: string; label: string }> = {};
  for (const it of items) {
    const path = it.href.split("?")[0];
    const prev = byRoute[path];
    byRoute[path] = {
      count: prev == null ? it.count : prev.count === null || it.count === null ? null : prev.count + it.count,
      tone: prev?.tone === "red" ? "red" : it.tone,
      label: prev?.label ?? t(it.label, lang),
    };
  }
  return NextResponse.json({ byRoute });
}
