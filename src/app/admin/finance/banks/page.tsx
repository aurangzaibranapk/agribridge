import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BanksClient } from "./banks-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { trialBalance } from "@/lib/ledger/statements";
import { aajKaKhana } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function BanksPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: rawBanks } = await supabase
    .from("finance_accounts")
    .select("id, name, account_number, logo_url, gl_code, opening_balance, current_balance")
    .eq("account_type", "bank")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  // Balance ledger se -- Finance/Kharche ke safhon jaisa hi (18 September).
  const tb = await trialBalance("1900-01-01", aajKaKhana());
  const ledgerBalance = new Map(tb.rows.map((r) => [r.code, r.balance]));

  const banks = (rawBanks ?? []).map((b) => ({
    ...b,
    opening_balance: Number(b.opening_balance),
    current_balance: tb.error || !b.gl_code ? Number(b.current_balance) : ledgerBalance.get(b.gl_code) ?? 0,
  }));

  return (
    <div>
      <PageHeader title={t("fb_management", lang)} description="Add, edit, and manage bank accounts" />
      <BanksClient banks={banks} />
    </div>
  );
}