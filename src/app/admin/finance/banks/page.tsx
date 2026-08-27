import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BanksClient } from "./banks-client";

export const dynamic = "force-dynamic";

export default async function BanksPage() {
  const supabase = createClient();
  const { data: rawBanks } = await supabase
    .from("finance_accounts")
    .select("id, name, account_number, logo_url, opening_balance, current_balance")
    .eq("account_type", "bank")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const banks = (rawBanks ?? []).map((b) => ({
    ...b,
    opening_balance: Number(b.opening_balance),
    current_balance: Number(b.current_balance),
  }));

  return (
    <div>
      <PageHeader title="Bank Management" description="Add, edit, and manage bank accounts" />
      <BanksClient banks={banks} />
    </div>
  );
}