import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WalletView } from "@/components/wallet/wallet-view";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function MyWalletPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // This route is shared by dealers, investors, and customers (all of
  // whom log in via the same /admin/* routes) - figure out which one
  // this user is, then load their wallet accordingly.
  const [{ data: dealer }, { data: investor }, { data: customer }] = await Promise.all([
    supabase.from("dealers").select("id, business_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("investors").select("id, full_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("customers").select("id, name").eq("user_id", user.id).maybeSingle(),
  ]);

  let ownerType: string | null = null;
  let ownerId: string | null = null;
  let displayName = "";

  if (dealer) {
    ownerType = "dealer";
    ownerId = dealer.id;
    displayName = dealer.business_name;
  } else if (investor) {
    ownerType = "investor";
    ownerId = investor.id;
    displayName = investor.full_name;
  } else if (customer) {
    ownerType = "customer";
    ownerId = customer.id;
    displayName = customer.name;
  }

  if (!ownerType || !ownerId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">No wallet found for this account.</p>
      </div>
    );
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, balance, held_balance")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
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
      <Link href="/admin/pos" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        Back
      </Link>
      <h1 className="mb-1 font-display text-2xl font-semibold text-surface-900 dark:text-white">My Wallet</h1>
      <p className="mb-6 text-sm text-surface-500">{displayName}</p>

      <WalletView
        lang={getLanguageFromCookies("rm")}
        balance={Number(wallet?.balance ?? 0)}
        heldBalance={Number(wallet?.held_balance ?? 0)}
        transactions={(transactions ?? []).map((t) => ({ ...t, amount: Number(t.amount), balance_after: Number(t.balance_after) }))}
      />
    </div>
  );
}