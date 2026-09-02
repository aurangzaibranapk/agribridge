import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PosClient } from "@/components/pos/pos-client";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
export const dynamic = "force-dynamic";
export default async function PosPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: dealer } = await supabase
    .from("dealers")
    .select("id, business_name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  let branch: { id: string; name: string } | null = null;
  let shopName: string | null = null;
  let warehouseId: string | null = null;
  if (!dealer) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id, shop_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.branch_id) {
      const { data: branchRow } = await supabase.from("branches").select("name").eq("id", profile.branch_id).maybeSingle();
      branch = { id: profile.branch_id, name: branchRow?.name ?? "Branch" };

      if (profile.shop_id) {
        const { data: shopRow } = await supabase.from("shops").select("name").eq("id", profile.shop_id).maybeSingle();
        shopName = shopRow?.name ?? null;
      }

      // Shop-specific warehouse if the staff member is assigned to one -
      // otherwise fall back to the branch's MAIN warehouse (same logic
      // as the fn_current_user_warehouse_id() SQL helper used inside
      // create_pos_sale, kept in sync so what the cashier SEES matches
      // what actually gets deducted on checkout).
      if (profile.shop_id) {
        const { data: shopWarehouse } = await supabase.from("warehouses").select("id").eq("shop_id", profile.shop_id).maybeSingle();
        warehouseId = shopWarehouse?.id ?? null;
      }
      if (!warehouseId) {
        const { data: mainWarehouse } = await supabase.from("warehouses").select("id").eq("branch_id", profile.branch_id).eq("code", "MAIN").maybeSingle();
        warehouseId = mainWarehouse?.id ?? null;
      }
    }
  }
  if (!dealer && !branch) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">{t("at_no_pos_access", lang)}</p>
      </div>
    );
  }
  let rawInventory: any[] | null = null;
  // Kitni cheezein sirf is liye nahi dikhayi ja rahin ke un ka rate
  // abhi darj nahi hua. Ye adad chhupaya nahi jata -- warna banda
  // apna maal dhoondta reh jata hai.
  let rateBaqiCount = 0;
  let rawCustomers:
    | { id: string; name: string; phone: string | null; isWholesaleShop: boolean }[]
    | null = null;
  if (dealer) {
    const [{ data: inv }, { data: cust }] = await Promise.all([
      supabase
        .from("dealer_inventory")
        .select("id, product_id, stock_quantity, selling_price, products(name, pack_size, barcode)")
        .eq("dealer_id", dealer.id)
        .gt("stock_quantity", 0),
      supabase
        .from("dealer_customers")
        .select("id, name, phone")
        .eq("dealer_id", dealer.id)
        .order("name"),
    ]);
    rawInventory = inv;
    // Dealer ke apne gahakon par thok ka nizam abhi nahi -- wo alag
    // table hai. Sab retail.
    rawCustomers = (cust ?? []).map((c) => ({ ...c, isWholesaleShop: false }));
  } else {
    const { data: invRows } = warehouseId
      ? await supabase
          .from("inventory")
          .select("product_id, quantity_on_hand, products(name, pack_size, barcode, selling_price, wholesale_price, sale_rate_pending)")
          .eq("warehouse_id", warehouseId)
          .gt("quantity_on_hand", 0)
      : { data: [] };
    const aggMap = new Map<string, any>();
    // Jis cheez ka sale rate abhi darj nahi hua, wo counter par aati hi
    // nahi. Wajah: us ka selling_price 0 hota hai, aur 0 ko qeemat
    // samajh kar cheez muft chali jati -- aur ye wo ghalti hai jo
    // counter par pakRi nahi jati (252). Rok database par bhi lagi hui
    // hai; ye us ka doosra taala hai, taake banda cheez dekh kar
    // dabaye hi na.
    (invRows ?? []).forEach((row: any) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      if (product?.sale_rate_pending) {
        rateBaqiCount += 1;
        return;
      }
      const cur = aggMap.get(row.product_id) ?? {
        id: row.product_id,
        product_id: row.product_id,
        stock_quantity: 0,
        selling_price: Number(product?.selling_price ?? 0),
        // NULL rehta hai jab thok ka rate darj hi nahi -- sifar nahi.
        // Sifar ka matlab "thok par muft" hota (245).
        wholesale_price: product?.wholesale_price == null ? null : Number(product.wholesale_price),
        products: product,
      };
      cur.stock_quantity += Number(row.quantity_on_hand);
      aggMap.set(row.product_id, cur);
    });
    rawInventory = [...aggMap.values()];
    const { data: cust } = await supabase
      .from("customers")
      .select("id, name, phone_number, customer_type")
      .order("name");
    rawCustomers = (cust ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone_number,
      isWholesaleShop: c.customer_type === "wholesale_shop",
    }));
  }
  const inventory = (rawInventory ?? []).map((item: any) => ({
    id: item.id,
    product_id: item.product_id,
    stock_quantity: item.stock_quantity,
    selling_price: item.selling_price,
    wholesale_price: item.wholesale_price ?? null,
    products: Array.isArray(item.products) ? item.products[0] ?? null : item.products ?? null,
  }));
  const sellerName = dealer ? dealer.business_name : shopName ? `${branch!.name} - ${shopName}` : branch!.name;
  return (
    <PosClient
      lang={getLanguageFromCookies("rm")}
      sellerName={sellerName}
      inventory={inventory}
      customers={rawCustomers ?? []}
      rateBaqiCount={rateBaqiCount}
    />
  );
}