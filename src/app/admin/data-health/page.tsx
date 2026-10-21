import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import Link from "next/link";
import { ScanButton, ResolveForm, BulkAssistantButton } from "./data-health-client";
import { assistantPill } from "@/lib/data-health/assistant-ticket";
import { CheckCircle2, ShieldAlert, Bot } from "lucide-react";

export const dynamic = "force-dynamic";

const DEPARTMENT_LABEL: Record<string, string> = {
  finance: "Finance",
  inventory: "Inventory / Purchases",
  machinery: "Machinery",
  hr: "HR",
  farmers: "Farmers / CRM",
  milk: "Milk",
  admin: "Admin",
};

const SEVERITY_ORDER = ["high", "medium", "low"];
const SEVERITY_LABEL: Record<string, string> = {
  high: "Bara masla",
  medium: "Dhyan dene wala",
  low: "Chhota sa",
};

export default async function DataHealthPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [viewGuard, editGuard] = await Promise.all([
    requireAction("system.data_health", "view"),
    requireAction("system.data_health", "edit"),
  ]);
  if ("error" in viewGuard) {
    return <div className="p-8 text-center text-surface-400">{viewGuard.error}</div>;
  }
  const canEdit = !("error" in editGuard);

  const service = createServiceClient();
  const [{ data: open }, { data: closed }] = await Promise.all([
    service
      .from("data_health_findings")
      .select(
        "id, finding_type, department, severity, title, description, related_label, amount, detected_at, status, support_ticket_id, ticket:support_tickets!data_health_findings_support_ticket_id_fkey(ticket_no, status, assignment_status, created_at)",
      )
      .in("status", ["open", "sent_to_assistant"])
      .order("detected_at", { ascending: false })
      .limit(60),
    service
      .from("data_health_findings")
      .select("id, title, department, status, resolution_note, resolved_at")
      .not("status", "in", "(open,sent_to_assistant)")
      .order("resolved_at", { ascending: false })
      .limit(20),
  ]);

  const rows = (open ?? []) as any[];
  const grouped = SEVERITY_ORDER.map((s) => ({
    severity: s,
    label: SEVERITY_LABEL[s],
    rows: rows.filter((r) => r.severity === s),
  })).filter((g) => g.rows.length > 0);

  const byDept = new Map<string, number>();
  for (const r of rows) byDept.set(r.department, (byDept.get(r.department) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Health"
        description="Poore business ka khud-kaar jaanch -- khud dhoondh kar batata hai, khud kuch theek nahi karta."
        actions={<ScanButton />}
      />

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-surface-500" />
          <div className="space-y-1 text-xs text-surface-600 dark:text-surface-400">
            <p>
              Ye safha roz khud check karta hai: dobara payment, gum shuda purchase qatar, stock ka farq,
              manfi cash/bank balance waghera. <strong>Koi bhi cheez khud theek nahi hoti</strong> -- har masle
              par faisla (AgriBridge Assistant ya Claude ko bhejna, chhoड़ dena, ya theek ho gaya mark karna) ek insaan karta hai.
            </p>
            {byDept.size > 0 && (
              <p className="flex flex-wrap gap-2 pt-1">
                {Array.from(byDept.entries()).map(([dept, count]) => (
                  <span key={dept} className="rounded-md border border-surface-200 px-2 py-0.5 dark:border-surface-800">
                    {DEPARTMENT_LABEL[dept] ?? dept}: <strong>{count}</strong>
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="border-l-4 border-l-green-500 p-4">
          <p className="flex items-start gap-2 text-sm text-green-800 dark:text-green-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Koi khula masla nahi mila. Sab theek lag raha hai.
          </p>
        </Card>
      ) : (
        grouped.map((group) => (
          <div key={group.severity}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-surface-400">
                {group.label} ({group.rows.length})
              </h2>
              {canEdit && <BulkAssistantButton findingIds={group.rows.filter((r) => r.status === "open").map((r) => r.id)} />}
            </div>
            <div className="space-y-2">
              {group.rows.map((f) => (
                <Card
                  key={f.id}
                  className={`p-4 ${
                    f.status === "sent_to_assistant"
                      ? "border-l-4 border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20"
                      : f.severity === "high"
                      ? "border-l-4 border-l-red-500"
                      : f.severity === "medium"
                        ? "border-l-4 border-l-amber-500"
                        : "border-l-4 border-l-surface-300 dark:border-l-surface-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-xs font-medium text-surface-400">
                        <span className="rounded-md bg-surface-100 px-1.5 py-0.5 dark:bg-surface-800">
                          {DEPARTMENT_LABEL[f.department] ?? f.department}
                        </span>
                        {f.related_label && <span>{f.related_label}</span>}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-surface-900 dark:text-white">{f.title}</p>
                      <p className="mt-1 text-xs text-surface-600 dark:text-surface-400">{f.description}</p>
                      {f.amount != null && (
                        <p className="mt-1 text-xs font-medium text-surface-700 dark:text-surface-300">
                          Rs {Number(f.amount).toLocaleString()}
                        </p>
                      )}
                      {f.status === "sent_to_assistant" ? (
                        <AssistantRowState f={f} canEdit={canEdit} />
                      ) : (
                        canEdit && <ResolveForm findingId={f.id} />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {closed && closed.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white">Jo dekhe ja chuke</h2>
          </div>
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {closed.map((f) => (
              <li key={f.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-surface-800 dark:text-surface-200">{f.title}</p>
                    {f.resolution_note && <p className="mt-0.5 text-xs text-surface-500">{f.resolution_note}</p>}
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                      f.status === "resolved"
                        ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400"
                        : f.status === "sent_to_claude"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                          : "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400"
                    }`}
                  >
                    {f.status === "resolved" ? "theek ho gaya" : f.status === "sent_to_claude" ? "Claude ko gaya" : f.status === "sent_to_assistant" ? "Assistant ko gaya" : "chhoड़ diya"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function AssistantRowState({ f, canEdit }: { f: any; canEdit: boolean }) {
  const t = Array.isArray(f.ticket) ? f.ticket[0] : f.ticket;
  const pill = assistantPill(t?.status, t?.assignment_status);
  const time = t?.created_at
    ? new Date(t.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" })
    : null;
  const tone =
    pill.kind === "working"
      ? "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
      : pill.kind === "done"
        ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
        : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span data-testid="assistant-pill" className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
        <Bot className="h-3.5 w-3.5" />
        {pill.text}
        {t?.ticket_no != null && ` · Ticket #${t.ticket_no}`}
        {pill.kind === "sent" && time && ` · ${time}`}
      </span>
      <Link
        href="/admin/my-work/support-dashboard"
        className="rounded-lg border border-surface-300 px-3 py-1.5 text-xs text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300"
      >
        Ticket dekhein
      </Link>
      {canEdit && pill.kind !== "working" && <ResolveForm findingId={f.id} showResolveOnly />}
    </div>
  );
}
