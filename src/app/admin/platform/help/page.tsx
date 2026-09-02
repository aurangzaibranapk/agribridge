import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { HelpEditor } from "./help-editor";

export const dynamic = "force-dynamic";

const EDITORS = ["owner", "super_admin", "admin"];

/**
 * Feature ki maloomat ka daftar (266). Baen: sab features, kis par help
 * likhi hai kis par nahi. Daayen: chuna hua feature, teen zaban.
 */
export default async function HelpAdminPage({ searchParams }: { searchParams: { key?: string; lang?: string } }) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !EDITORS.includes(me.role)) {
    return (
      <div>
        <PageHeader title={t("hp_admin_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">{t("pf_intake_gate_short", lang)}</p>
        </Card>
      </div>
    );
  }

  const [{ data: features }, { data: helps }] = await Promise.all([
    supabase.from("features").select("key, label, route").eq("is_active", true).order("route"),
    supabase.from("feature_help").select("feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, video_url, faq, related"),
  ]);

  const byKey = new Map<string, Map<string, (typeof helps extends (infer T)[] | null ? T : never)>>();
  for (const h of helps ?? []) {
    if (!byKey.has(h.feature_key)) byKey.set(h.feature_key, new Map());
    byKey.get(h.feature_key)!.set(h.lang, h);
  }

  const selectedKey = searchParams.key ?? "";
  const selLang = searchParams.lang === "en" || searchParams.lang === "ur" ? searchParams.lang : "rm";
  const selected = (features ?? []).find((f) => f.key === selectedKey) ?? null;
  const existing = selected ? byKey.get(selected.key)?.get(selLang) ?? null : null;
  const written = (features ?? []).filter((f) => byKey.has(f.key)).length;

  return (
    <div>
      <PageHeader title={t("hp_admin_title", lang)} description={t("hp_admin_desc", lang).replace("{n}", String(written)).replace("{total}", String((features ?? []).length))} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="max-h-[75vh] overflow-y-auto lg:col-span-1">
          <ul className="divide-y divide-surface-100 text-sm dark:divide-surface-800">
            {(features ?? []).map((f) => {
              const langs = byKey.get(f.key);
              return (
                <li key={f.key}>
                  <Link
                    href={`/admin/platform/help?key=${encodeURIComponent(f.key)}&lang=${selLang}`}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-800 ${f.key === selectedKey ? "bg-brand-50 dark:bg-brand-950/30" : ""}`}
                  >
                    <span>
                      <span className="font-medium text-surface-800 dark:text-surface-200">{f.label}</span>
                      <span className="block text-[11px] text-surface-400">{f.route}</span>
                    </span>
                    <span className="flex gap-1">
                      {(["rm", "en", "ur"] as const).map((l) => (
                        <Badge key={l} tone={langs?.has(l) ? "green" : "gray"}>{l}</Badge>
                      ))}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="lg:col-span-2">
          {selected ? (
            <HelpEditor
              lang={lang}
              featureKey={selected.key}
              featureLabel={selected.label}
              editLang={selLang}
              existing={
                existing
                  ? {
                      purpose: existing.purpose,
                      who_uses: existing.who_uses ?? "",
                      when_use: existing.when_use ?? "",
                      how_steps: (existing.how_steps ?? []).join("\n"),
                      next_step: existing.next_step ?? "",
                      mistakes: (existing.mistakes ?? []).join("\n"),
                      video_url: existing.video_url ?? "",
                      faq: ((existing.faq as { q: string; a: string }[]) ?? []).flatMap((f) => [`Q: ${f.q}`, `A: ${f.a}`]).join("\n"),
                      related: (existing.related ?? []).join("\n"),
                    }
                  : null
              }
            />
          ) : (
            <Card>
              <p className="text-sm text-surface-600">{t("hp_admin_pick", lang)}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
