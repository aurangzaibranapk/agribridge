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
import { loadFindings, listRules, previewConflicts, loadSodRules, loadSodEvents, SEVERITY_RANK, type Severity, type MatchedDuty } from "@/lib/access/conflicts";
import { DecideForm, type ConflictGate } from "./decide-form";
import { ScanButton, FindingActions } from "./conflict-actions";
import { RuleForm } from "./rule-form";
import { SodRuleControls } from "./sod-rule-row";

export const dynamic = "force-dynamic";

const SEV_TONE: Record<string, "red" | "amber" | "blue" | "gray"> = { critical: "red", high: "red", warning: "amber", info: "blue" };

/** Ijazat ki darkhwastein (270): Pending | Kis ke paas kya | Khatam ho rahi | Takraao (271) | Departments. */
export default async function AccessRequestsPage({ searchParams }: { searchParams: { tab?: string; id?: string; f?: string; show?: string; rules?: string } }) {
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
  const tab = ["pending", "who", "expiring", "conflicts", "departments"].includes(searchParams.tab ?? "") ? (searchParams.tab as string) : "pending";
  const service = createServiceClient();
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 864e5).toISOString();

  const [{ data: requests }, { data: grants }, { data: people }, openFindings] = await Promise.all([
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
    loadFindings({ status: ["open", "acknowledged", "overridden"] }),
  ]);
  const reqs = (requests ?? []) as any[];
  const pending = reqs.filter((r) => r.status === "pending" && (isMaster || r.risk_level !== "high"));
  const decided = reqs.filter((r) => r.status !== "pending").slice(0, 50);
  const selected = searchParams.id ? reqs.find((r) => r.id === searchParams.id) : null;
  const { data: events } = selected ? await service.from("access_request_events").select("event, detail, created_at, profiles(full_name)").eq("request_id", selected.id).order("created_at") : { data: [] };
  const expiring = (grants ?? []).filter((g) => g.expires_at && g.expires_at <= in7 && g.expires_at > now.toISOString());

  // Manzoori se pehle ki jaanch (271): "Is permission se ye existing access conflict create hoga"
  let gate: ConflictGate = { level: "none", messages: [] };
  if (selected && selected.status === "pending" && selected.kind === "feature_access" && selected.feature_key) {
    const forName = (Array.isArray(selected.for) ? selected.for[0] : selected.for)?.full_name ?? null;
    const p = await previewConflicts(selected.requested_for, selected.feature_key, selected.actions ?? ["view"], selected.data_scope ?? "own_branch", forName);
    gate = { level: p.blocked ? "block" : p.needsOverride ? "override" : p.created.length ? "advise" : "none", messages: p.messages };
  } else if (selected && selected.status === "pending" && selected.kind === "department_assign") {
    gate = { level: "advise", messages: [t("cfl_gate_department", lang)] };
  }

  // Takraao (271)
  const critHigh = openFindings.filter((f: any) => SEVERITY_RANK[f.severity as Severity] >= SEVERITY_RANK.high && f.status === "open").length;
  const showStatus = searchParams.show === "all";
  const findings = showStatus ? await loadFindings() : openFindings;
  const selectedFinding = searchParams.f ? (findings as any[]).find((f) => f.id === searchParams.f) ?? null : null;
  const { data: findingEvents } = selectedFinding ? await service.from("access_conflict_events" as never).select("event, detail, created_at, profiles(full_name)").eq("finding_id", selectedFinding.id).order("created_at") : { data: [] };
  const rules = tab === "conflicts" && searchParams.rules === "1" ? await listRules() : [];
  const [sodRules, sodEvents] = tab === "conflicts" ? await Promise.all([loadSodRules(), loadSodEvents(80)]) : [[], []];
  const { data: lastScan } = tab === "conflicts" ? await service.from("access_conflict_scans" as never).select("run_at, trigger, findings, new_findings, resolved, by_severity, profiles(full_name)").order("run_at", { ascending: false }).limit(1).maybeSingle() : { data: null };

  const name = (r: any) => (Array.isArray(r.for) ? r.for[0] : r.for)?.full_name ?? "—";
  const byName = (r: any) => (Array.isArray(r.by) ? r.by[0] : r.by)?.full_name ?? "—";
  const pname = (g: any) => (Array.isArray(g.profiles) ? g.profiles[0] : g.profiles)?.full_name ?? "—";
  const prole = (g: any) => (Array.isArray(g.profiles) ? g.profiles[0] : g.profiles)?.role ?? "";

  const tabs = [
    ["pending", t("ar_t_pending", lang), pending.length],
    ["who", t("ar_t_who", lang), (grants ?? []).length],
    ["expiring", t("ar_t_expiring", lang), expiring.length],
    ["conflicts", t("cfl_t_conflicts", lang), openFindings.length],
    ["departments", t("ar_t_departments", lang), (people ?? []).length],
  ] as const;

  return (
    <div>
      <PageHeader title={t("ar_title", lang)} description={t("ar_desc", lang)} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map(([k, label, n]) => (
          <Link key={k} href={`/admin/access-requests?tab=${k}`} className={`rounded-full px-3 py-1 text-xs ${tab === k ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300"}`}>
            {label} <span className="tabular-nums opacity-80">{n}</span>
            {k === "conflicts" && critHigh > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{critHigh}</span>}
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
                        {r.conflict_check?.highest && <Badge tone={SEV_TONE[r.conflict_check.highest] ?? "gray"}>{t("cfl_conflict", lang)}: {r.conflict_check.highest}</Badge>}
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
                        {r.override_reason && <Badge tone="amber">override</Badge>}
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
                {selected.override_reason && (
                  <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900 dark:bg-orange-950/30 dark:text-orange-200">
                    <strong>{t("cfl_overridden_by", lang)}:</strong> {selected.override_reason} · {selected.override_at ? new Date(selected.override_at).toLocaleString("en-GB") : ""}{selected.override_expires_at ? ` · ${t("cfl_until", lang)} ${new Date(selected.override_expires_at).toLocaleString("en-GB")}` : ""}
                  </div>
                )}
                {selected.ai_interpretation && (
                  <details className="mt-2 text-xs text-surface-500">
                    <summary>{t("ar_ai_read", lang)}</summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-surface-50 p-2 text-[11px] dark:bg-surface-800">{JSON.stringify((selected.ai_interpretation as any).draft ?? selected.ai_interpretation, null, 2)}</pre>
                  </details>
                )}
                {selected.status === "approved" && (
                  <details className="mt-2 text-xs text-surface-500">
                    <summary>{t("ar_old_new", lang)}</summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-surface-50 p-2 text-[11px] dark:bg-surface-800">{JSON.stringify({ old: selected.old_permissions, new: selected.new_permissions, conflicts: selected.conflict_check }, null, 2)}</pre>
                  </details>
                )}
              </Card>
              {selected.status === "pending" && (isMaster || selected.risk_level !== "high") && <DecideForm lang={lang} id={selected.id} isHead={!isMaster} isMaster={isMaster} gate={gate} />}
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

      {tab === "conflicts" && (
        <div className="space-y-3">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{t("cfl_title", lang)}</h3>
                <p className="text-xs text-surface-500">{t("cfl_desc", lang)}</p>
                {lastScan && (
                  <p className="mt-1 text-[11px] text-surface-400">
                    {t("cfl_last_scan", lang)}: {new Date((lastScan as any).run_at).toLocaleString("en-GB")} · {(lastScan as any).trigger} · {(lastScan as any).findings ?? "—"} {t("cfl_found", lang)} · {JSON.stringify((lastScan as any).by_severity ?? {})}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/access-requests?tab=conflicts${showStatus ? "" : "&show=all"}`} className="rounded-full bg-surface-100 px-3 py-1 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300">
                  {showStatus ? t("cfl_show_open", lang) : t("cfl_show_all", lang)}
                </Link>
                <Link href={`/admin/access-requests?tab=conflicts&rules=${searchParams.rules === "1" ? "0" : "1"}`} className="rounded-full bg-surface-100 px-3 py-1 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300">
                  {t("cfl_rules", lang)}
                </Link>
                <ScanButton lang={lang} />
              </div>
            </div>
          </Card>

          {searchParams.rules === "1" && (
            <Card>
              <h3 className="mb-1 text-sm font-semibold">{t("cfl_rules", lang)}</h3>
              <p className="mb-2 text-xs text-surface-500">{t("cfl_rules_note", lang)}</p>
              <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                {rules.map((r: any) => (
                  <li key={r.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-surface-400">{r.code}</span>
                      <Badge tone={SEV_TONE[r.severity] ?? "gray"}>{r.severity}</Badge>
                      <Badge tone={r.enforcement === "block" ? "red" : r.enforcement === "override" ? "amber" : "gray"}>{r.enforcement}</Badge>
                      <Badge tone="gray">{r.kind}</Badge>
                      {!r.is_active && <Badge tone="gray">off</Badge>}
                      <span className="font-medium">{r.label}</span>
                    </div>
                    <p className="text-xs text-surface-500">{r.description}</p>
                    {r.kind === "sod" && (
                      <p className="text-[11px] text-surface-400">
                        {(r.duties as any[]).map((d) => `${d.label}: ${(d.features ?? []).join("|")} [${(d.actions ?? []).join("/")}]`).join("  +  ")} · min_scope {r.min_scope}{r.narrow_scope_severity ? ` (narrow → ${r.narrow_scope_severity})` : ""}
                      </p>
                    )}
                    {r.kind !== "sod" && <p className="text-[11px] text-surface-400">threshold {r.params?.threshold ?? "—"}</p>}
                    {r.recommendation && <p className="text-[11px] text-emerald-700">→ {r.recommendation}</p>}
                    {isMaster && <RuleForm lang={lang} rule={r} />}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid gap-3 lg:grid-cols-5">
            <Card className={`p-0 ${selectedFinding ? "lg:col-span-2" : "lg:col-span-5"}`}>
              {(findings as any[]).length === 0 ? (
                <p className="p-4 text-sm text-surface-500">{t("cfl_none", lang)}</p>
              ) : (
                <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                  {(findings as any[]).map((f) => (
                    <li key={f.id}>
                      <Link href={`/admin/access-requests?tab=conflicts&f=${f.id}${showStatus ? "&show=all" : ""}`} className={`block px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800 ${f.id === selectedFinding?.id ? "bg-brand-50 dark:bg-brand-950/30" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={SEV_TONE[f.severity] ?? "gray"}>{f.severity}</Badge>
                          <Badge tone={f.enforcement === "block" ? "red" : f.enforcement === "override" ? "amber" : "gray"}>{f.enforcement}</Badge>
                          <Badge tone={f.status === "open" ? "amber" : f.status === "overridden" ? "blue" : f.status === "resolved" ? "green" : "gray"}>{f.status}</Badge>
                          <span className="font-mono text-[11px] text-surface-400">{f.rule_code}</span>
                        </div>
                        <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{pname(f)} <span className="text-xs text-surface-400">({prole(f)})</span></p>
                        <p className="text-xs text-surface-600 dark:text-surface-400">{f.label}</p>
                        <p className="text-[11px] text-surface-400">{(f.matched as MatchedDuty[]).map((m) => `${m.feature_key}[${(m.actions ?? []).join("/")}]`).join(" + ")}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {selectedFinding && (
              <div className="space-y-3 lg:col-span-3">
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SEV_TONE[selectedFinding.severity] ?? "gray"}>{selectedFinding.severity}</Badge>
                    <Badge tone={selectedFinding.enforcement === "block" ? "red" : selectedFinding.enforcement === "override" ? "amber" : "gray"}>{selectedFinding.enforcement}</Badge>
                    <Badge tone={selectedFinding.status === "open" ? "amber" : "gray"}>{selectedFinding.status}</Badge>
                    <span className="font-mono text-[11px] text-surface-400">{selectedFinding.rule_code}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold">{pname(selectedFinding)} · {selectedFinding.label}</p>
                  <table className="mt-2 w-full text-xs">
                    <thead><tr className="text-left text-[10px] uppercase text-surface-500"><th className="py-1">{t("cfl_duty", lang)}</th><th className="py-1">Feature</th><th className="py-1">{t("ar_actions", lang)}</th><th className="py-1">{t("ar_scope", lang)}</th><th className="py-1">{t("cfl_source", lang)}</th></tr></thead>
                    <tbody>
                      {(selectedFinding.matched as MatchedDuty[]).map((m, i) => (
                        <tr key={i} className="border-t border-surface-100 dark:border-surface-800"><td className="py-1 pr-2">{m.duty}</td><td className="py-1 pr-2 font-mono">{m.feature_key}</td><td className="py-1 pr-2">{(m.actions ?? []).join(", ")}</td><td className="py-1 pr-2">{m.scope}</td><td className="py-1 text-surface-500">{(m.sources ?? []).join(", ")}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedFinding.recommendation && <p className="mt-2 rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">→ {selectedFinding.recommendation}</p>}
                  <p className="mt-2 text-[11px] text-surface-400">
                    {t("cfl_first_seen", lang)} {new Date(selectedFinding.first_seen_at).toLocaleString("en-GB")} · {t("cfl_last_seen", lang)} {new Date(selectedFinding.last_seen_at).toLocaleString("en-GB")}
                    {selectedFinding.status_note ? ` · ${selectedFinding.status_note}` : ""}{selectedFinding.override_expires_at ? ` · ${t("cfl_until", lang)} ${new Date(selectedFinding.override_expires_at).toLocaleString("en-GB")}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-surface-500">
                    {t("cfl_fix_hint", lang)} <Link href={`/admin/permissions?user=${selectedFinding.profile_id}`} className="text-brand-700 hover:underline">/admin/permissions</Link>
                  </p>
                  {selectedFinding.status !== "resolved" && <FindingActions lang={lang} id={selectedFinding.id} status={selectedFinding.status} enforcement={selectedFinding.enforcement} isMaster={isMaster} />}
                </Card>
                <Card>
                  <h3 className="mb-2 text-sm font-semibold">{t("ar_trail", lang)}</h3>
                  <ul className="space-y-1 text-xs">
                    {((findingEvents ?? []) as any[]).map((e: any, i: number) => (
                      <li key={i} className="rounded bg-surface-50 px-2 py-1 dark:bg-surface-800">
                        <span className="text-surface-400">{new Date(e.created_at).toLocaleString("en-GB")} · {(Array.isArray(e.profiles) ? e.profiles[0] : e.profiles)?.full_name ?? "system"}</span> · <strong>{e.event}</strong>
                        {e.detail && <span className="block truncate text-surface-500">{JSON.stringify(e.detail).slice(0, 240)}</span>}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "conflicts" && (
        <Card className="mt-3">
          <h3 className="text-sm font-semibold">{t("sod_title", lang)}</h3>
          <p className="text-xs text-surface-500">{t("sod_desc", lang)}</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-500">{t("sod_events", lang)}</h4>
              {sodEvents.length === 0 ? (
                <p className="text-sm text-surface-500">{t("sod_none", lang)}</p>
              ) : (
                <ul className="max-h-96 divide-y divide-surface-100 overflow-auto text-xs dark:divide-surface-800">
                  {sodEvents.map((e: any) => (
                    <li key={e.id} className="py-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={e.event === "self_approval_warned" ? "amber" : "blue"}>{e.event === "self_approval_warned" ? "warn" : "exempt"}</Badge>
                        <span className="font-medium">{pname(e)}</span>
                        <span className="text-surface-400">({prole(e)})</span>
                        <span className="ml-auto text-surface-400">{new Date(e.created_at).toLocaleString("en-GB")}</span>
                      </div>
                      <p className="text-surface-600 dark:text-surface-400">{e.detail?.label ?? e.table_name} · <span className="font-mono">{e.table_name}</span>{e.record_id ? ` · ${String(e.record_id).slice(0, 8)}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-[11px] text-surface-400">{t("sod_blocked_note", lang)}</p>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-500">{t("sod_rules", lang)}</h4>
              <ul className="divide-y divide-surface-100 text-xs dark:divide-surface-800">
                {sodRules.map((r: any) => (
                  <li key={r.id} className={`py-1.5 ${r.is_active ? "" : "opacity-50"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={r.enforcement === "block" ? "red" : "amber"}>{r.enforcement}</Badge>
                      <span className="font-medium">{r.label}</span>
                      {!r.is_active && <Badge tone="gray">off</Badge>}
                    </div>
                    <p className="font-mono text-[11px] text-surface-400">{r.table_name}: {r.creator_col} → {r.approver_col}</p>
                    {isMaster && <div className="mt-1"><SodRuleControls lang={lang} rule={r} /></div>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
