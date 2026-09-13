import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StaffKhataClient } from "./staff-khata-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function StaffKhataPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("is_active", true)
    .in("role", ["manager", "sales_staff"])
    .order("full_name");

  const { data: rawLedger } = await supabase
    .from("staff_credit_ledger")
    .select("id, profile_id, ledger_type, source_type, amount, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const ledger = (rawLedger ?? []).map((l) => ({ ...l, amount: Number(l.amount) }));

  const balanceMap = new Map<string, number>();
  ledger.forEach((l) => {
    const cur = balanceMap.get(l.profile_id) ?? 0;
    balanceMap.set(l.profile_id, cur + (l.ledger_type === "credit" ? l.amount : -l.amount));
  });

  const balances = (profiles ?? []).map((p) => ({
    profile_id: p.id,
    full_name: p.full_name,
    balance: balanceMap.get(p.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader title={t("at_staff_khata", lang)} description="Daily wage credits from attendance, spending, and month-end salary processing" />
      <StaffKhataClient balances={balances} ledger={ledger} />
    </div>
  );
}