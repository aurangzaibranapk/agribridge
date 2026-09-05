import { redirect } from "next/navigation";
import Link from "next/link";
import { KeyRound, Bot } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { departmentForRole, DEPARTMENTS } from "@/lib/departments";
import { CancelButton } from "./cancel-button";

export const dynamic = "force-dynamic";

/** Meri ijazatein (270): kya khulta hai, kya maanga hua, mere department. */
export default async function MyAccessPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: me }, { data: access }, { data: requests }] = await Promise.all([
    supabase.from("profiles").select("full_name, role, extra_roles").eq("id", user.id).maybeSingle(),
    supabase.from("v_user_feature_access").select("feature_key, route, actions, data_scope, is_temporary, expires_at").eq("profile_id", user.id).order("feature_key"),
    supabase.from("access_requests").select("id, number, feature_key, department_key, actions, data_scope, duration, status, created_at, decision_note").eq("requested_for", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (!me) redirect("/login");
  const dept = departmentForRole(me.role);
  const extra = ((me.extra_roles as string[] | null) ?? []).map((r) => DEPARTMENTS.find((d) => d.role === r)?.label ?? r);
  const { data: features } = await supabase.from("features").select("key, label").eq("is_active", true);
  const label = new Map((features ?? []).map((f) => [f.key, f.label]));
  const merged = new Map<string, { route: string | null; actions: Set<string>; scope: string | null; expires: string | null }>();
  for (const a of access ?? []) {
    if (!a.feature_key) continue;
    const m = merged.get(a.feature_key) ?? { route: a.route, actions: new Set<string>(), scope: a.data_scope, expires: a.expires_at };
    for (const x of (a.actions as string[] | null) ?? []) m.actions.add(x);
    if (a.expires_at) m.expires = a.expires_at;
    merged.set(a.feature_key, m);
  }

  return (
    <div>
      <PageHeader
        title={t("ma_title", lang)}
        description={t("ma_desc", lang)}
        actions={
          <Link href={`/admin/bridge-ai?q=${encodeURIComponent(t("ma_ask_prefill", lang))}`} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Bot className="h-4 w-4" /> {t("ma_request", lang)}
          </Link>
        }
      />
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><KeyRound className="h-4 w-4" /> {t("ma_mine", lang)}</h3>
          {merged.size === 0 ? <p className="text-sm text-surface-500">{t("ma_none", lang)}</p> : (
            <ul className="divide-y divide-surface-100 text-sm dark:divide-surface-800">
              {[...merged.entries()].map(([k, v]) => (
                <li key={k} className="flex flex-wrap items-center gap-2 py-1.5">
                  {v.route ? <Link href={v.route} className="font-medium text-brand-700 hover:underline">{label.get(k) ?? k}</Link> : <span className="font-medium">{label.get(k) ?? k}</span>}
                  <span className="text-xs text-surface-500">{[...v.actions].join(", ")}</span>
                  <Badge tone="gray">{v.scope ?? "—"}</Badge>
                  {v.expires && <Badge tone="amber">{t("ar_expires", lang)} {new Date(v.expires).toLocaleDateString("en-GB")}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-3">
          <Card>
            <h3 className="mb-1 text-sm font-semibold">{t("ma_departments", lang)}</h3>
            <p className="text-sm">{dept?.label ?? me.role}</p>
            {extra.length > 0 && <p className="text-xs text-surface-500">+ {extra.join(", ")}</p>}
          </Card>
          <Card>
            <h3 className="mb-1 text-sm font-semibold">{t("ma_requests", lang)}</h3>
            {(requests ?? []).length === 0 ? <p className="text-sm text-surface-500">{t("ma_no_requests", lang)}</p> : (
              <ul className="space-y-1.5 text-sm">
                {(requests ?? []).map((r) => (
                  <li key={r.id} className="rounded bg-surface-50 px-2 py-1.5 dark:bg-surface-800">
                    <div className="flex items-center gap-2"><span className="font-mono text-[11px] text-surface-400">{r.number}</span><Badge tone={r.status === "pending" ? "amber" : r.status === "approved" ? "green" : "gray"}>{r.status}</Badge></div>
                    <p>{r.feature_key ? label.get(r.feature_key) ?? r.feature_key : `${t("ar_department", lang)}: ${r.department_key}`} · {(r.actions ?? []).join(", ")} · {r.duration}</p>
                    {r.decision_note && <p className="text-xs text-surface-500">{r.decision_note}</p>}
                    {r.status === "pending" && <CancelButton id={r.id} label={t("ma_cancel", lang)} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
