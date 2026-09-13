import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/api-auth";
import { loadRegistry, featureForPath } from "@/lib/access/registry";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

/**
 * "? Is Page Ko Samjhein" (266).
 *
 * Raaste se feature pehchan kar us ki likhi hui maloomat deta hai --
 * feature_help se, jo insaan ne likhi aur jaanchi. Zaban na mile to
 * Roman. Kuch na likha ho to bhi feature ka naam aur "abhi likha nahi"
 * -- khamoshi se khali panel nahi.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaff();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const path = (request.nextUrl.searchParams.get("path") ?? "").split("?")[0];
  const lang = getLanguageFromCookies("rm");
  const registry = await loadRegistry(lang);
  const key = featureForPath(registry, path);
  if (!key) return NextResponse.json({ found: false, path });

  const feature = registry.features.get(key);
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("feature_help")
    .select("lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, video_url, faq, related")
    .eq("feature_key", key)
    .in("lang", [lang, "rm"]);

  const help = (rows ?? []).find((r) => r.lang === lang) ?? (rows ?? []).find((r) => r.lang === "rm") ?? null;

  const related = (help?.related ?? [])
    .map((k: string) => registry.features.get(k))
    .filter(Boolean)
    .map((f) => ({ key: f!.key, label: f!.label, route: f!.route }));

  return NextResponse.json({
    found: true,
    key,
    label: feature?.label ?? key,
    route: feature?.route ?? path,
    lang: help?.lang ?? null,
    help: help
      ? {
          purpose: help.purpose,
          who: help.who_uses,
          when: help.when_use,
          how: help.how_steps ?? [],
          next: help.next_step,
          mistakes: help.mistakes ?? [],
          video: help.video_url,
          faq: (help.faq as { q: string; a: string }[]) ?? [],
          related,
        }
      : null,
    canEdit: ["owner", "super_admin", "admin"].includes(auth.caller.role),
  });
}
