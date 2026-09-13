import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ArrowLeft } from "lucide-react";
import { PeriodsClient } from "./periods-client";

export const dynamic = "force-dynamic";

const RUN_ROLES = ["owner", "super_admin", "admin", "finance"];
const VIEW_ROLES = [...RUN_ROLES, "manager"];

/**
 * Hisaab ke arse.
 *
 * Fehrist mein pichhle 24 mahine. Har mahine ke saamne us mein kitni
 * entries hain -- ye is liye ke band karne se pehle ye dekha ja sake ke
 * mahina waqai bhara hua hai (khali mahina band karne ka matlab aksar
 * ye hota hai ke us mahine ka kaam abhi darj hi nahi hua).
 */
export default async function AccountingPeriodsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !VIEW_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("per_only_finance", lang)}</div>;
  }

  const service = createServiceClient();
  const ab = new Date();
  const mahine: string[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(Date.UTC(ab.getUTCFullYear(), ab.getUTCMonth() - i, 1));
    mahine.push(d.toISOString().slice(0, 10));
  }
  const sabSePurana = mahine[mahine.length - 1];

  const [{ data: periods, error: perErr }, { data: entries, error: entErr }] = await Promise.all([
    service.from("accounting_periods").select("period, status, closed_at, reopen_reason, closing_entry_id").gte("period", sabSePurana),
    service.from("journal_entries").select("entry_date").gte("entry_date", sabSePurana),
  ]);

  const halat = new Map((periods ?? []).map((p) => [String(p.period), p]));

  // Ginti na mil sake to NULL -- safhe par "—" jayega, sifar nahi.
  const ginti = entErr ? null : new Map<string, number>();
  if (ginti) {
    for (const e of entries ?? []) {
      const k = String(e.entry_date).slice(0, 7) + "-01";
      ginti.set(k, (ginti.get(k) ?? 0) + 1);
    }
  }

  const aajKaMahina = `${ab.getUTCFullYear()}-${String(ab.getUTCMonth() + 1).padStart(2, "0")}-01`;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("per_title", lang)}
        description={t("per_desc", lang)}
        actions={
          <Link
            href="/admin/finance/center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("per_back", lang)}
          </Link>
        }
      />

      {perErr && (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("per_load_error", lang)}: {perErr.message}
        </Card>
      )}

      <PeriodsClient
        lang={lang}
        canRun={RUN_ROLES.includes(me.role)}
        currentMonth={aajKaMahina}
        rows={mahine.map((m) => {
          const h = halat.get(m);
          return {
            period: m,
            status: (h?.status as string) ?? "open",
            closedAt: (h?.closed_at as string | null) ?? null,
            reopenReason: (h?.reopen_reason as string | null) ?? null,
            hasClosingEntry: Boolean(h?.closing_entry_id),
            entries: ginti ? (ginti.get(m) ?? 0) : null,
          };
        })}
      />
    </div>
  );
}
