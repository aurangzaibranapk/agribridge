import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WalletView } from "@/components/wallet/wallet-view";
import { checkFarmerVerification } from "@/lib/utils/verification-gate";
import { VerificationGateMessage } from "@/components/portal/verification-gate-message";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t as translate } from "@/lib/i18n/translations";
export const dynamic = "force-dynamic";
export default async function FarmerWalletPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  const gate = await checkFarmerVerification(farmer.id);
  if (!gate.allowed) {
    return <VerificationGateMessage reason={gate.reason!} />;
  }
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, balance, held_balance")
    .eq("owner_type", "farmer")
    .eq("owner_id", farmer.id)
    .single();
  const { data: transactions } = wallet
    ? await supabase
        .from("wallet_transactions")
        .select("id, type, direction, amount, balance_after, notes, created_at")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        {translate("back_to_dashboard", lang)}
      </Link>
      <h1 className="mb-6 font-display text-2xl font-semibold text-surface-900">{translate("my_wallet_title", lang)}</h1>
      <WalletView
        lang={lang}
        balance={Number(wallet?.balance ?? 0)}
        heldBalance={Number(wallet?.held_balance ?? 0)}
        transactions={(transactions ?? []).map((tx) => ({ ...tx, amount: Number(tx.amount), balance_after: Number(tx.balance_after) }))}
      />
    </div>
  );
}