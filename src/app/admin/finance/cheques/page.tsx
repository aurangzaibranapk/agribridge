import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ArrowLeft } from "lucide-react";
import { ChequesClient } from "./cheques-client";

export const dynamic = "force-dynamic";

const RUN_ROLES = ["owner", "super_admin", "admin", "finance"];
const VIEW_ROLES = [...RUN_ROLES, "manager"];

/**
 * Cheque -- diye hue aur mile hue.
 *
 * Sab se upar wo cheque jin ki tareekh aa chuki hai aur jo abhi bank se
 * guzre nahi. Yehi rozana ka kaam hai: aaj kaunsa cheque bank le jana
 * hai, aur kis ka intezar hai.
 */
export default async function ChequesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !VIEW_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("chq_only_finance", lang)}</div>;
  }

  const service = createServiceClient();
  const [{ data: cheques, error }, { data: accounts }, { data: books }, { data: glAccounts }] = await Promise.all([
    service.from("cheques").select("*").order("due_date", { ascending: true }).limit(300),
    service.from("finance_accounts").select("id, name").eq("is_active", true).order("name"),
    service.from("cheque_books").select("id, book_name, first_number, last_number, finance_account_id").eq("status", "active"),
    service.from("gl_accounts").select("code, name, account_type").eq("is_active", true).in("account_type", ["asset", "liability"]).order("sort_order"),
  ]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("chq_title", lang)} />
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("chq_load_error", lang)}: {error.message}
        </Card>
      </div>
    );
  }

  const bankName = new Map((accounts ?? []).map((a) => [a.id as string, a.name as string]));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("chq_title", lang)}
        description={t("chq_desc", lang)}
        actions={
          <Link
            href="/admin/finance/center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("chq_back", lang)}
          </Link>
        }
      />

      <ChequesClient
        lang={lang}
        canRun={RUN_ROLES.includes(me.role)}
        today={new Date().toISOString().slice(0, 10)}
        accounts={(accounts ?? []).map((a) => ({ id: a.id as string, name: a.name as string }))}
        books={(books ?? []).map((b) => ({
          id: b.id as string,
          name: `${b.book_name} (${b.first_number}–${b.last_number})`,
          accountId: b.finance_account_id as string,
        }))}
        glAccounts={(glAccounts ?? []).map((a) => ({
          code: a.code as string,
          name: a.name as string,
          type: a.account_type as string,
        }))}
        rows={(cheques ?? []).map((c) => ({
          id: c.id as string,
          direction: c.direction as string,
          number: c.cheque_number as string,
          bank: bankName.get(c.finance_account_id as string) ?? "—",
          party: (c.party_name as string | null) ?? "—",
          amount: Number(c.amount),
          issueDate: String(c.issue_date),
          dueDate: String(c.due_date),
          status: c.status as string,
          clearedOn: (c.cleared_on as string | null) ?? null,
          bounceReason: (c.bounce_reason as string | null) ?? null,
        }))}
      />
    </div>
  );
}
