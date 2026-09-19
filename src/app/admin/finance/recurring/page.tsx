import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ArrowLeft } from "lucide-react";
import { RecurringClient } from "./recurring-client";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "finance"];

/**
 * Har mahine wali entry.
 *
 * Khaka ek dafa likha jata hai; entry har mahine EK DABAO par banti
 * hai. Ye jaan boojh kar hai -- tafseel actions/recurring.ts mein.
 */
export default async function RecurringPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("rec_only_finance", lang)}</div>;
  }

  const service = createServiceClient();
  const ab = new Date();
  const isMahina = `${ab.getFullYear()}-${String(ab.getMonth() + 1).padStart(2, "0")}`;

  const [{ data: khake, error }, { data: lines }, { data: runs }, { data: accounts }] = await Promise.all([
    service.from("recurring_journals").select("*").order("name"),
    service.from("recurring_journal_lines").select("recurring_id, account_code, debit, credit, memo, line_order").order("line_order"),
    service.from("recurring_journal_runs").select("recurring_id, period").eq("period", `${isMahina}-01`),
    service.from("gl_accounts").select("code, name").eq("is_active", true).order("sort_order"),
  ]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("rec_title", lang)} />
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("rec_load_error", lang)}: {error.message}
        </Card>
      </div>
    );
  }

  const banChuke = new Set((runs ?? []).map((r) => r.recurring_id as string));
  const linesBy = new Map<string, { account: string; debit: number; credit: number; memo: string | null }[]>();
  for (const l of lines ?? []) {
    const list = linesBy.get(l.recurring_id as string) ?? [];
    list.push({
      account: l.account_code as string,
      debit: Number(l.debit),
      credit: Number(l.credit),
      memo: (l.memo as string | null) ?? null,
    });
    linesBy.set(l.recurring_id as string, list);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("rec_title", lang)}
        description={t("rec_desc", lang)}
        actions={
          <Link
            href="/admin/finance/center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("rec_back", lang)}
          </Link>
        }
      />

      <RecurringClient
        lang={lang}
        month={isMahina}
        accounts={(accounts ?? []).map((a) => ({ code: a.code as string, name: a.name as string }))}
        rows={(khake ?? []).map((k) => ({
          id: k.id as string,
          name: k.name as string,
          description: k.description as string,
          day: Number(k.day_of_month),
          active: k.is_active as boolean,
          lastPeriod: (k.last_posted_period as string | null) ?? null,
          doneThisMonth: banChuke.has(k.id as string),
          lines: linesBy.get(k.id as string) ?? [],
        }))}
      />
    </div>
  );
}
