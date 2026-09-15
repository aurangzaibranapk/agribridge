import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ShopSummaryClient } from "./shop-summary-client";

export const dynamic = "force-dynamic";

/**
 * Shop ka hisaab — shaam ko band karte waqt.
 *
 * Malik ka sawal (15 September): "load bill her shop k ana chaye sham
 * close krin pata chaly load sy kitni ammount bill sy kitni ammoun
 * udhar kitna dia naqad cash kitna shop ki sale kitni kis khata sy kis
 * card sy khan sy howi hy."
 *
 * Ek BRANCH mein kai SHOPS hoti hain (jaise Main Branch mein Agri
 * Inputs, Karyana, Grain, Vet Services alag shops hain) -- is liye
 * branch ka hisaab kaafi nahi tha, shop chahiye. Load/Bill (425 se) aur
 * POS sale dono `shop_id` se, ek hi jagah, `fn_shop_day_summary` se.
 */
export default async function ShopSummaryPage({
  searchParams,
}: {
  searchParams: { shop?: string; tareekh?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id, shop_id, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) redirect("/login");

  const service = createServiceClient();
  const unrestricted = UNRESTRICTED_ROLES.includes(me.role);

  const { data: shops } = unrestricted
    ? await service.from("shops").select("id, name, branch_id").eq("is_active", true).order("name")
    : me.branch_id
      ? await service.from("shops").select("id, name, branch_id").eq("is_active", true).eq("branch_id", me.branch_id).order("name")
      : { data: [] as { id: string; name: string; branch_id: string }[] };

  if (!shops || shops.length === 0) {
    return (
      <div>
        <PageHeader title="Shop ka hisaab" />
        <Card>
          <p className="text-sm text-surface-500 dark:text-surface-400">Abhi koi shop nahi bani.</p>
        </Card>
      </div>
    );
  }

  const aaj = aajKaKhana();
  const tareekh = searchParams.tareekh ?? aaj;
  const shopId = searchParams.shop ?? me.shop_id ?? shops[0].id;

  const { data: sumRows, error: sumErr } = await supabase.rpc("fn_shop_day_summary", {
    p_shop: shopId,
    p_date: tareekh,
  });
  const sum = Array.isArray(sumRows) ? sumRows[0] : sumRows;

  return (
    <div>
      <PageHeader
        title="Shop ka hisaab"
        description="Shaam ko band karte waqt — is shop se load, bill aur sale, tareeqe ke hisaab se"
        actions={
          <Link
            href="/admin/load-bill"
            className="inline-flex items-center rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            Load & Bill
          </Link>
        }
      />

      {sumErr ? (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">Hisaab nahi mila: {sumErr.message}</p>
        </Card>
      ) : (
        <ShopSummaryClient
          shopId={shopId}
          tareekh={tareekh}
          aaj={aaj}
          shops={shops.map((s) => ({ id: s.id as string, name: s.name as string }))}
          hisaab={{
            shopName: sum?.shop_name ?? "—",
            loadPrincipal: Number(sum?.load_principal ?? 0),
            loadCount: Number(sum?.load_count ?? 0),
            billPrincipal: Number(sum?.bill_principal ?? 0),
            billCount: Number(sum?.bill_count ?? 0),
            lbCash: Number(sum?.lb_cash ?? 0),
            lbKhata: Number(sum?.lb_khata ?? 0),
            lbBank: Number(sum?.lb_bank ?? 0),
            lbWallet: Number(sum?.lb_wallet ?? 0),
            posSaleTotal: Number(sum?.pos_sale_total ?? 0),
            posKhataTotal: Number(sum?.pos_khata_total ?? 0),
            posSaleCount: Number(sum?.pos_sale_count ?? 0),
            posCash: Number(sum?.pos_cash ?? 0),
            posBankTransfer: Number(sum?.pos_bank_transfer ?? 0),
            posCard: Number(sum?.pos_card ?? 0),
            posJazzcash: Number(sum?.pos_jazzcash ?? 0),
            posEasypaisa: Number(sum?.pos_easypaisa ?? 0),
            posQr: Number(sum?.pos_qr ?? 0),
            posWaseelaCard: Number(sum?.pos_waseela_card ?? 0),
          }}
        />
      )}
    </div>
  );
}
