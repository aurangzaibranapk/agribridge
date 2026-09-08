import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { myCollectionOutstanding, myDepositHistory, bankAccountsForCollectionDeposit } from "@/actions/pos-collection";
import { MyCollectionClient } from "./my-collection-client";

export const dynamic = "force-dynamic";

export default async function MyCollectionPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [shops, history, banks] = await Promise.all([
    myCollectionOutstanding(),
    myDepositHistory(),
    bankAccountsForCollectionDeposit(),
  ]);

  if ("error" in shops) {
    return <div className="p-8 text-center text-surface-400">{shops.error}</div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS Collection Outstanding"
        description={'POS par jo CASH sale hui, us ka hisaab -- jab tak bank mein jama na ho aur Finance tasdeeq na kare, "outstanding" rehta hai.'}
      />

      {shops.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title="Abhi koi POS Shift record nahi"
            description="Kisi POS Counter par Shift open kar ke sale karein -- outstanding yahan khud ban jayega."
          />
        </Card>
      ) : (
        <MyCollectionClient
          shops={shops}
          history={"error" in history ? [] : history}
          banks={"error" in banks ? [] : banks}
        />
      )}
    </div>
  );
}
