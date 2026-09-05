import { createClient } from "@/lib/supabase/server";
import { BINA_QISM } from "@/lib/pos/constants";
import { redirect } from "next/navigation";
import { PosClient } from "@/components/pos/pos-client";
import { CounterTabs } from "@/components/pos/counter-tabs";
import { loadUserAccess, can } from "@/lib/access/permissions";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { loadPosPermissions } from "@/lib/pos/permissions";
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

  // Kaun kya dekh sakta hai aur kya badal sakta hai. Yehi fehrist
  // checkout ke andar bhi parhi jati hai -- safha aur server ek hi
  // jagah se poochte hain.
  const perms = await loadPosPermissions(user.id);
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
    | {
        id: string;
        name: string;
        phone: string | null;
        balance?: number | null;
        creditLimit?: number | null;
        isWholesaleShop: boolean;
      }[]
    | null = null;
  if (dealer) {
    const [{ data: inv }, { data: cust }] = await Promise.all([
      supabase
        .from("dealer_inventory")
        .select("id, product_id, stock_quantity, selling_price, products(name, pack_size, barcode, internal_barcode, image_url, unit_code, category_id, mrp_price, purchase_price, expiry_date)")
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
          .select("product_id, quantity_on_hand, batch_id, products(name, pack_size, barcode, internal_barcode, image_url, unit_code, category_id, selling_price, wholesale_price, sale_rate_pending, mrp_price, purchase_price, expiry_date)")
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
        batch_ids: [] as string[],
        products: product,
      };
      cur.stock_quantity += Number(row.quantity_on_hand);
      if (row.batch_id) cur.batch_ids.push(row.batch_id);
      aggMap.set(row.product_id, cur);
    });
    rawInventory = [...aggMap.values()];
    const { data: cust } = await supabase
      .from("customers")
      .select("id, name, phone_number, customer_type, current_balance, credit_limit")
      .order("name");
    rawCustomers = (cust ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone_number,
      // Hadd darj hi na ho to NULL. Sifar likh dena "is ko udhaar bilkul
      // nahi" kehna hai -- aur wo faisla kisi ne kiya hi nahi.
      creditLimit: c.credit_limit == null ? null : Number(c.credit_limit),
      // Gahak chunte hi us ka baqi saamne. Khata wale gahak par yehi
      // wo adad hai jo counter par faisla badalta hai -- aur us ke
      // baghair banda naya udhaar de deta hai.
      balance: c.current_balance == null ? null : Number(c.current_balance),
      isWholesaleShop: c.customer_type === "wholesale_shop",
    }));
  }
  const inventory = (rawInventory ?? []).map((item: any) => ({
    id: item.id,
    product_id: item.product_id,
    stock_quantity: item.stock_quantity,
    selling_price: item.selling_price,
    wholesale_price: item.wholesale_price ?? null,
    batch_ids: item.batch_ids ?? [],
    products: Array.isArray(item.products) ? item.products[0] ?? null : item.products ?? null,
  }));

  // Qism ka naam alag sawal se, nested embed se nahi. Embed nakaam ho
  // to wo KHALI lauta deta hai -- aur us soorat mein poori products ki
  // fehrist gayab ho jati, yani counter band. Counter par ye khatra
  // mol nahi liya ja sakta.
  //
  // Qismein SIRF ISI DUKAN KI. Malik ka faisla (5 September, POS par
  // dekhne ke baad): "karyana men sirf karyana item he ana chiay,
  // category sirf karyana ki ani chiay."
  //
  // Pehle saari qismein aa rahi thin -- khaad, beej, zehr bhi -- aur
  // karyana ki dukan par un ka koi kaam nahi. Wo fehrist itni lambi ho
  // gayi thi ke us mein se apni qism dhoondna khud ek kaam ban gaya tha.
  //
  // "Isi dukan ki qism" ka matlab yahan wo qism hai jis ka maal is
  // dukan ke godam mein para hai. Ye tay karne ka koi aur khana nizam
  // mein maujood nahi (qismon par dukan ka nishaan nahi lagta), aur
  // maujood cheez se jawab lena us se behtar hai ke naya khana bana kar
  // usay bharne ka intezar kiya jaye.
  const catIds = Array.from(
    new Set(inventory.map((i: any) => i.products?.category_id).filter(Boolean) as string[])
  );
  const { data: cats } = catIds.length
    ? await supabase.from("categories").select("id, name").in("id", catIds)
    : { data: [] as { id: string; name: string }[] };
  const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));
  for (const it of inventory as any[]) {
    if (it.products) it.products.category_name = catName.get(it.products.category_id) ?? null;
  }

  const ginti = new Map<string, number>();
  let beghair = 0;
  for (const it of inventory as any[]) {
    const n = it.products?.category_name;
    if (n) ginti.set(n, (ginti.get(n) ?? 0) + 1);
    else beghair++;
  }
  const groups = Array.from(ginti.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, count: ginti.get(name) ?? 0 }));

  // Jin cheezon par qism lagi hi nahi, un ka apna khana.
  //
  // Malik ne 5 September ko poocha ke karyana ki saari qismein kyun
  // nahi aa rahin. Fehrist theek thi -- 54 mein se sirf 2 cheezon par
  // qism lagi hui thi, baqi 52 par koi qism nahi. Wo 52 cheezein is
  // fehrist se chup chaap bahar reh rahi thin, aur us se ye lagta tha
  // ke qismein "gum" hain.
  //
  // Ab wo apne naam ke sath nazar aati hain. Yehi is project ka usool
  // hai: jo cheez darj nahi, us ka na hona DIKHNA chahiye -- chhupna
  // nahi. Chhup jane par koi usay theek bhi nahi karta.
  if (beghair > 0) groups.push({ name: BINA_QISM, count: beghair });

  // ---- Batch aur miyaad ----
  // Miyaad counter ka asal sawal hai: "ye cheez kab tak theek hai".
  // Jahan maal batch ke sath aaya, wahin se aati hai; warna cheez ke
  // apne khane se. Dono na hon to KHALI rehti hai -- aaj ki tareekh
  // likh dena us se bura hota.
  const batchIds = Array.from(new Set((inventory as any[]).flatMap((i) => i.batch_ids as string[])));
  if (batchIds.length) {
    const { data: batches } = await supabase
      .from("stock_batches")
      .select("id, batch_number, expiry_date")
      .in("id", batchIds);
    const byId = new Map((batches ?? []).map((b) => [b.id, b]));
    for (const it of inventory as any[]) {
      const rows = (it.batch_ids as string[]).map((id) => byId.get(id)).filter(Boolean) as any[];
      if (rows.length === 0) continue;
      // Ek hi batch ho to us ka number; kai hon to number likhna ghalat
      // hoga -- gahak ke haath mein kaunsa jayega, ye counter par tay
      // hi nahi hota.
      it.batch_number = rows.length === 1 ? rows[0].batch_number ?? null : null;
      it.batch_count = rows.length;
      const dates = rows.map((r) => r.expiry_date).filter(Boolean).sort();
      // Sab se pehle khatam hone wali miyaad -- counter par wohi maayne
      // rakhti hai.
      if (dates.length) it.expiry_date = dates[0];
    }
  }
  for (const it of inventory as any[]) {
    if (!it.expiry_date && it.products?.expiry_date) it.expiry_date = it.products.expiry_date;
  }

  // ---- Godam mein aur kitna para hai ----
  // Dukan par khatam ho raha ho to agla sawal yehi hota hai. Jawab na
  // mil sake to NULL rehta hai aur safha "—" likhta hai -- sifar likh
  // dena "godam khali hai" ka jhoot hai.
  const godamStock = new Map<string, number>();
  let godamMaloom = false;
  if (!dealer && branch && inventory.length) {
    const { data: otherWh, error: whErr } = await supabase
      .from("warehouses")
      .select("id")
      .eq("branch_id", branch.id);
    const otherIds = (otherWh ?? []).map((w) => w.id).filter((id) => id !== warehouseId);
    if (!whErr) {
      if (otherIds.length === 0) {
        godamMaloom = true; // dekh liya: koi doosra godam hai hi nahi
      } else {
        const { data: rows, error: invErr } = await supabase
          .from("inventory")
          .select("product_id, quantity_on_hand")
          .in("warehouse_id", otherIds)
          .in("product_id", inventory.map((i: any) => i.product_id));
        if (!invErr) {
          godamMaloom = true;
          for (const r of rows ?? []) {
            godamStock.set(r.product_id, (godamStock.get(r.product_id) ?? 0) + Number(r.quantity_on_hand ?? 0));
          }
        }
      }
    }
  }
  for (const it of inventory as any[]) {
    it.warehouse_stock = godamMaloom ? godamStock.get(it.product_id) ?? 0 : null;
  }

  // Lagat sirf us ke liye jise dekhne ki ijazat hai. Chhupana safhe par
  // nahi -- yahan, server par. Jo bheja hi nahi gaya wo browser ke andar
  // se bhi nahi nikalta.
  if (!perms.canSeeCost) {
    for (const it of inventory as any[]) {
      if (it.products) delete it.products.purchase_price;
    }
  }

  const sellerName = dealer ? dealer.business_name : shopName ? `${branch!.name} - ${shopName}` : branch!.name;
  // Counter ke teen kaam upar. Load/Bill ka khana sirf us bande ko
  // dikhta hai jise wo safha khulta hai -- warna wo ek aisa darwaza dekh
  // raha hota jo us ke liye band hai, aur har dafa dabane par inkaar
  // milta. Ijazat wahin se poochi jati hai jahan se baqi poora menu
  // banta hai, warna do jagah do jawab ban jate.
  const access = await loadUserAccess(user.id);
  const loadBillAllowed = access ? can(access, "load-bill", "view") : false;

  return (
    <>
      {loadBillAllowed && <CounterTabs active="products" />}
      <PosClient
        lang={lang}
        sellerName={sellerName}
        inventory={inventory}
        groups={groups}
        customers={rawCustomers ?? []}
        branchId={branch?.id ?? null}
        rateBaqiCount={rateBaqiCount}
        perms={perms}
      />
    </>
  );
}
