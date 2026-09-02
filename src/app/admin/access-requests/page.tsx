import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { MASTER } from "@/lib/access/access-requests";
import { loadHeadPower } from "@/lib/access/delegation";
import { DecideForm } from "./decide-form";

export const dynamic = "force-dynamic";

/** Ijazat ki darkhwastein (270): Pending | Kis ke paas kya | Khatam ho rahi | Departments. */
export default async function AccessRequestsPage({ searchParams }: { searchParams: { tab?: string; id?: string } }) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!me) redirect("/login");
  const isMaster = MASTER.includes(me.role);
  const head = isMaster ? null : await loadHeadPower(user.id);
  if (!isMaster && !head && me.role !== "manager") {
    return (
      <div>
        <PageHeader title={t("ar_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">{t("pf_intake_gate_short", lang)}</p>
        </Card>
      </div>
    );
  }
  const tab = ["pending", "who", "expiring", "departments"].includes(searchParams.tab ?? "") ? (searchParams.tab as string) : "pending";
  const service = createServiceClient();
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 864e5).toISOString();

  const [{ data: requests }, { data: grants }, { data: people }] = await Promise.all([
    service
      .from("access_requests")
      .select("*, for:profiles!access_requests_requested_for_fkey(full_name, role), by:profiles!access_requests_requested_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(300),
    service
      .from("user_feature_permissions")
      .select("id, profile_id, feature_key, actions, data_scope, expires_at, reason, granted_by, profiles!user_feature_permissions_profile_id_fkey(full_name, role)")
      .order("expires_at", { ascending: true, nullsFirst: false })
      .limit(500),
    service.from("profiles").select("id, full_name, role, extra_roles, is_active").eq("is_active", true).order("full_name"),
  ]);
  const reqs = (requests ?? []) as any[];
  const pending = reqs.filter((r) => r.status === "pending" && (isMaster || r.risk_level !== "high"));
  const decided = reqs.filter((r) => r.status !== "pending").slice(0, 50);
  const selected = searchParams.id ? reqs.find((r) => r.id === searchParams.id) : null;
  const { data: events } = selected ? await service.from("access_request_events").select("event, detail, created_at, profiles(full_name)").eq("request_id", selected.id).order("created_at") : { data: [] };
  const expiring = (grants ?? []).filter((g) => g.expires_at && g.expires_at <= in7 && g.expires_at > now.toISOString());

  const name = (r: any) => (Array.isArray(r.for) ? r.for[0] : r.for)?.full_name ?? "—";
  const byName = (r: any) => (Array.isArray(r.by) ? r.by[0] : r.by)?.full_name ?? "—";
  const pname = (g: any) => (Array.isArray(g.profiles) ? g.profiles[0] : g.profiles)?.full_name ?? "—";

  const tabs = [
    ["pending", t("ar_t_pending", lang), pending.length],
    ["who", t("ar_t_who", lang), (grants ?? []).length],
    ["expiring", t("ar_t_expiring", lang), expiring.length],
    ["departments", t("ar_t_departments", lang), (people ?? []).length],
  ] as const;

  return (
    <div>
      <PageHeader title={t("ar_title", lang)} description={t("ar_desc", lang)} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map(([k, label, n]) => (
          <Link key={k} href={`/admin/access-requests?tab=${k}`} className={`rounded-full px-3 py-1 text-xs ${tab === k ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300"}`}>
            {label} <span className="tabular-nums opacity-80">{n}</span>
          </Link>
        ))}
      </div>

      {tab === "pending" && (
        <div className="grid gap-3 lg:grid-cols-5">
          <Card className={`p-0 ${selected ? "lg:col-span-2" : "lg:col-span-5"}`}>
            {pending.length === 0 ? (
              <p className="p-4 text-sm text-surface-500">{t("ar_none", lang)}</p>
            ) : (
              <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                {pending.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/access-requests?tab=pending&id=${r.id}`} className={`block px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800 ${r.id === selected?.id ? "bg-brand-50 dark:bg-brand-950/30" : ""}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-surface-400">{r.number}</span>
                        {r.risk_level === "high" && <Badge tone="red">{t("ar_high_risk", lang)}</Badge>}
                        <Badge tone="gray">{r.duration}</Badge>
                      </div>
                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                        {name(r)} → {r.kind === "department_assign" ? `${t("ar_department", lang)}: ${r.department_key}` : r.feature_key}
                      </p>
                      <p className="text-[11px] text-surface-400">{(r.actions ?? []).join(", ")} · {r.data_scope} · {byName(r)} · {new Date(r.created_at).toLocaleString("en-GB")}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {decided.length > 0 && (
              <details className="border-t border-surface-200 px-4 py-2 text-xs text-surface-500 dark:border-surface-800">
                <summary>{t("ar_decided", lang)} ({decided.length})</summary>
                <ul className="mt-1 space-y-1">
                  {decided.map((r) => (
                    <li key={r.id}>
                      <Link href={`/admin/access-requests?tab=pending&id=${r.id}`} className="hover:underline">
                        <span className="font-mono">{r.number}</span> · {name(r)} → {r.feature_key ?? r.department_key} · <Badge tone={r.status === "approved" ? "green" : "gray"}>{r.status}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
          {selected && (
            <div className="space-y-3 lg:col-span-3">
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-surface-400">{selected.number}</span>
                  <Badge tone={selected.status === "pending" ? "amber" : selected.status === "approved" ? "green" : "gray"}>{selected.status}</Badge>
                  {selected.risk_level === "high" && <Badge tone="red">{t("ar_high_risk", lang)}</Badge>}
                </div>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <dt className="text-surface-500">{t("ar_for", lang)}</dt><dd className="font-medium">{name(selected)} <span className="text-xs text-surface-400">({(Array.isArray(selected.for) ? selected.for[0] : selected.for)?.role})</span></dd>
                  <dt className="text-surface-500">{t("ar_by", lang)}</dt><dd>{byName(selected)}</dd>
                  <dt className="text-surface-500">{t("ar_what", lang)}</dt><dd className="font-medium">{selected.kind === "department_assign" ? `${t("ar_department", lang)}: ${selected.department_key}` : selected.feature_key}</dd>
                  <dt className="text-surface-500">{t("ar_actions", lang)}</dt><dd>{(selected.actions ?? []).join(", ")}</dd>
                  <dt className="text-surface-500">{t("ar_scope", lang)}</dt><dd>{selected.data_scope}</dd>
                  <dt className="text-surface-500">{t("ar_duration", lang)}</dt><dd>{selected.duration}{selected.expires_at ? ` · ${new Date(selected.expires_at).toLocaleString("en-GB")}` : ""}</dd>
                  <dt className="text-surface-500">{t("ar_reason", lang)}</dt><dd className="sm:col-span-1">{selected.reason ?? "—"}</dd>
                </dl>
                {selected.ai_interpretation && (
                  <details className="mt-2 text-xs text-surface-500">
                    <summary>{t("ar_ai_read", lang)}</summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-surface-50 p-2 text-[11px] dark:bg-surface-800">{JSON.stringify((selected.ai_interpretation as any).draft ?? selected.ai_interpretation, null, 2)}</pre>
                  </details>
                )}
                {selected.status === "approved" && (
                  <details className="mt-2 text-xs text-surface-500">
                    <summary>{t("ar_old_new", lang)}</summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-surface-50 p-2 text-[11px] dark:bg-surface-800">{JSON.stringify({ old: selected.old_permissions, new: selected.new_permissions }, null, 2)}</pre>
                  </details>
                )}
              </Card>
              {selected.status === "pending" && (isMaster || selected.risk_level !== "high") && <DecideForm lang={lang} id={selected.id} isHead={!isMaster} />}
              <Card>
                <h3 className="mb-2 text-sm font-semibold">{t("ar_trail", lang)}</h3>
                <ul className="space-y-1 text-xs">
                  {(events ?? []).map((e: any, i: number) => (
                    <li key={i} className="rounded bg-surface-50 px-2 py-1 dark:bg-surface-800">
                      <span className="text-surface-400">{new Date(e.created_at).toLocaleString("en-GB")} · {(Array.isArray(e.profiles) ? e.profiles[0] : e.profiles)?.full_name ?? "—"}</span> · <strong>{e.event}</strong>
                      {e.detail && <span className="block truncate text-surface-500">{JSON.stringify(e.detail).slice(0, 240)}</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      )}

      {tab === "who" && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead><tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500"><th className="py-2">{t("ar_staff", lang)}</th><th className="py-2">Feature</th><th className="py-2">{t("ar_actions", lang)}</th><th className="py-2">{t("ar_scope", lang)}</th><th className="py-2">{t("ar_expires", lang)}</th><th className="py-2">{t("ar_reason", lang)}</th></tr></thead>
            <tbody>
              {(grants ?? []).map((g: any) => (
                <tr key={g.id} className="border-b border-surface-100"><td className="py-1.5 pr-2 font-medium">{pname(g)}</td><td className="py-1.5 pr-2 font-mono text-xs">{g.feature_key}</td><td className="py-1.5 pr-2">{(g.actions ?? []).join(", ")}</td><td className="py-1.5 pr-2">{g.data_scope}</td><td className="py-1.5 pr-2 text-xs">{g.expires_at ? new Date(g.expires_at).toLocaleDateString("en-GB") : t("ar_permanent", lang)}</td><td className="py-1.5 text-xs text-surface-500">{g.reason ?? ""}</td></tr>
              ))}
              {(grants ?? []).length === 0 && <tr><td colSpan={6} className="py-4 text-center text-sm text-surface-400">{t("ar_none_grants", lang)}</td></tr>}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-surface-400">{t("ar_who_note", lang)}</p>
        </Card>
      )}

      {tab === "expiring" && (
        <Card>
          {expiring.length === 0 ? <p className="text-sm text-surface-500">{t("ar_none_expiring", lang)}</p> : (
            <ul className="divide-y divide-surface-100 text-sm dark:divide-surface-800">
              {expiring.map((g: any) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2 py-1.5"><span className="font-medium">{pname(g)}</span><span className="font-mono text-xs">{g.feature_key}</span><span className="text-xs">{(g.actions ?? []).join(", ")}</span><span className="ml-auto text-xs text-amber-700">{new Date(g.expires_at).toLocaleString("en-GB")}</span></li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-surface-400">{t("ar_expiring_note", lang)}</p>
        </Card>
      )}

      {tab === "departments" && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead><tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500"><th className="py-2">{t("ar_staff", lang)}</th><th className="py-2">Role</th><th className="py-2">{t("ar_extra", lang)}</th></tr></thead>
            <tbody>
              {(people ?? []).map((p: any) => (
                <tr key={p.id} className="border-b border-surface-100"><td className="py-1.5 pr-2 font-medium">{p.full_name}</td><td className="py-1.5 pr-2">{p.role}</td><td className="py-1.5 text-xs">{((p.extra_roles as string[] | null) ?? []).join(", ") || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
