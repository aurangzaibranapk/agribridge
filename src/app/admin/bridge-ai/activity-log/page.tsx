import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

interface LogRow {
  id: string;
  created_at: string;
  question: string;
  tools_called: string[];
  answer: string | null;
  agent_type: string | null;
}

const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  crop: { label: "Crop/Grain Agent", color: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  livestock: { label: "Livestock/Dairy Agent", color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  finance: { label: "Finance Agent", color: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  general: { label: "General Agent", color: "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400" },
};

export default async function BridgeAiActivityLogPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: logs } = await supabase
    .from("bridge_ai_activity_log")
    .select("id, created_at, question, tools_called, answer, agent_type")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (logs ?? []) as LogRow[];

  const totalQueries = rows.length;
  const now = new Date();
  const today = now.toDateString();
  const queriesToday = rows.filter((r) => new Date(r.created_at).toDateString() === today).length;

  const byAgent: Record<string, number> = { crop: 0, livestock: 0, finance: 0, general: 0 };
  rows.forEach((r) => {
    const agent = r.agent_type ?? "general";
    if (byAgent[agent] !== undefined) byAgent[agent] += 1;
  });

  const toolUsageCount = new Map<string, number>();
  rows.forEach((r) => {
    (r.tools_called ?? []).forEach((tool) => {
      toolUsageCount.set(tool, (toolUsageCount.get(tool) ?? 0) + 1);
    });
  });
  const topTools = Array.from(toolUsageCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const noToolAnswersCount = rows.filter((r) => (r.tools_called ?? []).length === 0).length;

  return (
    <div>
      <PageHeader
        title={t("ba_activity_log", lang)}
        description="Bridge AI se ab tak jitne sawal poochay gaye hain, unki list aur analytics - sirf dekhne ke liye. AI abhi database mein kuch change nahi karta, sirf jawab deta hai."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("ba_total_questions", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{totalQueries}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("ba_today_questions", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{queriesToday}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("ba_answers_without_data", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-600">{noToolAnswersCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("ba_top_tool", lang)}</p>
          <p className="mt-2 font-display text-sm font-semibold text-surface-900 dark:text-white">{topTools[0]?.[0] ?? "-"}</p>
        </Card>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("ba_by_agent", lang)}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(byAgent).map(([agent, count]) => (
            <div key={agent} className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
              <p className="text-xs text-surface-500">{AGENT_LABELS[agent]?.label ?? agent}</p>
              <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {topTools.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("ba_top_tools", lang)}</h3>
          <div className="flex flex-wrap gap-2">
            {topTools.map(([tool, count]) => (
              <span key={tool} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                {tool} <span className="text-brand-400">&times;{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        {rows.length === 0 ? (
          <p className="text-sm text-surface-400">{t("ba_no_activity", lang)}</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const agentInfo = AGENT_LABELS[row.agent_type ?? "general"] ?? AGENT_LABELS.general;
              return (
                <div key={row.id} className="rounded-lg border border-surface-100 p-4 dark:border-surface-800">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{row.question}</p>
                    <span className="shrink-0 text-xs text-surface-400">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${agentInfo.color}`}>{agentInfo.label}</span>
                    {row.tools_called.map((tool, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                  {row.answer && (
                    <p className="mt-2 whitespace-pre-line text-sm text-surface-600 dark:text-surface-400">
                      {row.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}