import { createClient } from "@/lib/supabase/server";
import { BINA_QISM } from "@/lib/pos/constants";
import { redirect } from "next/navigation";
import { PosClient } from "@/components/pos/pos-client";
import { CounterShiftPicker } from "@/components/pos/counter-shift-picker";
import { ShiftBar } from "@/components/pos/shift-bar";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { loadPosPermissions } from "@/lib/pos/permissions";
import { t } from "@/lib/i18n/translations";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
export const dynamic = "force-dynamic";
export default async function PosPage({ searchParams }: { searchParams: Promise<{ counter?: string }> }) {
  const lang = getLanguageFromCookies("rm");
  const sp = await searchParams;
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
  let shopId: string | null = null;
  let warehouseId: string | null = null;
  let activeCounterId: string | null = null;
  let activeCounterName: string | null = null;
  let openShiftInfo: { id: string; shiftNumber: string; openedAt: string; openingCash: number } | null = null;
  let pendingHandover: { shiftId: string; countedCash: number; branchId: string | null; shopId: string | null; shifts: { date: string; amount: number }[] } | null = null;
  let otherCounters: { id: string; name: string; shopName: string; hasOpenShift: boolean }[] = [];

  if (!dealer) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id, shop_id, role")
      .eq("id", user.id)
      .maybeSingle();
    const unrestricted = UNRESTRICTED_ROLES.includes(String(profile?.role ?? ""));

    /**
     * POS Counter (366/367): agar is staff ko kisi counter ki ijazat
     * hai, to shop wahan se tay hoti hai -- profile.shop_id se nahi.
     *
     * Jis staff ke paas AAJ koi counter assign nahi (yani har koi jab
     * tak koi Manager use kisi counter par nahi laga deta), us ke liye
     * ye poora hissa khali rehta hai aur neeche wala PURANA raasta
     * bilkul waisa hi chalta hai jaisa 366 se pehle chalta tha.
     *
     * Owner/Admin (423): ye role har counter par shift khol sakta hai
     * bina `pos_counter_staff` mein qatar ke (`openShift` mein yehi
     * chhoot pehle se hai) -- is liye "Doosra Counter" switcher mein
     * bhi COMPANY KI HAR active counter dikhni chahiye, sirf wo nahi
     * jin par explicit assign hui ho -- warna admin ko switcher kabhi
     * nazar hi nahi aata.
     */
    const { data: myCounterRows } = unrestricted
      ? await supabase
          .from("pos_counters")
          .select("id, name, branch_id, shop_id, is_active, branches(name), shops(name)")
          .eq("is_active", true)
      : await supabase
          .from("pos_counter_staff")
          .select("counter_id, pos_counters!inner(id, name, branch_id, shop_id, is_active, branches(name), shops(name))")
          .eq("profile_id", user.id)
          .eq("is_active", true)
          .eq("pos_counters.is_active", true);

    const myCounters = ((myCounterRows ?? []) as any[])
      .map((r) => (unrestricted ? r : Array.isArray(r.pos_counters) ? r.pos_counters[0] : r.pos_counters))
      .filter(Boolean)
      .map((c: any) => ({
        id: c.id as string,
        name: c.name as string,
        branchId: c.branch_id as string,
        shopId: c.shop_id as string,
        branchName: (Array.isArray(c.branches) ? c.branches[0]?.name : c.branches?.name) ?? "—",
        shopName: (Array.isArray(c.shops) ? c.shops[0]?.name : c.shops?.name) ?? "—",
      }));

    if (myCounters.length > 0) {
      // Ek staff ab apne kai counters par ek sath khula shift rakh
      // sakta hai (423) -- Malik: "2/3 POS hon to shift band kiye
      // baghair doosre pay ja sakay". Is liye yahan poori fehrist,
      // `.maybeSingle()` nahi.
      const { data: openShiftRows } = await supabase
        .from("pos_shifts")
        .select("id, shift_number, counter_id, opened_at, opening_cash")
        .eq("staff_id", user.id)
        .eq("status", "open");
      const openShifts = openShiftRows ?? [];

      // Pichli band hui shift ka cash abhi Manager/Finance ko bheja
      // nahi gaya -- malik ka kaam #3 (8 September). "Cash bheja gaya
      // ya nahi" NULL/NOT-NULL se maloom hota hai, sifar se nahi.
      //
      // Do raaste "bhej diya" ginte hain: kisi bande ke hath (`pos_
      // shifts.cash_handover_id`) ya bank mein khud jama karwa kar slip
      // lagana (`pos_collection_deposits.shift_id`, 430) -- dono mein
      // se koi bhi ho to patti dobara nahi dikhti.
      const { data: pendingClosedRows } = await supabase
        .from("pos_shifts")
        .select("id, counter_id, counted_cash, closed_at")
        .eq("staff_id", user.id)
        .eq("status", "closed")
        .is("cash_handover_id", null)
        .gt("counted_cash", 0)
        .order("closed_at", { ascending: false })
        .limit(10);
      if (pendingClosedRows && pendingClosedRows.length > 0) {
        const { data: alreadyDeposited } = await supabase
          .from("pos_collection_deposits")
          .select("shift_id, status")
          .in("shift_id", pendingClosedRows.map((r) => r.id));
        const approvedIds = new Set(
          (alreadyDeposited ?? []).filter((d: any) => d.status === "approved").map((d: any) => d.shift_id as string)
        );
        const pending = pendingClosedRows.filter((r) => !approvedIds.has(r.id));
        if (pending.length > 0) {
          const ref = pending[0];
          const total = pending.reduce((s, r) => s + Number(r.counted_cash), 0);
          pendingHandover = {
            shiftId: ref.id,
            countedCash: total,
            branchId: myCounters.find((c) => c.id === ref.counter_id)?.branchId ?? null,
            shopId: myCounters.find((c) => c.id === ref.counter_id)?.shopId ?? null,
            shifts: pending.map((r) => ({
              date: r.closed_at ? new Date(r.closed_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—",
              amount: Number(r.counted_cash),
            })),
          };
        }
      }

      // ?counter=<id> se banda khud chunta hai kaunsa counter dekhna
      // hai (switcher se aya link) -- warna jo pehla khula shift mile.
      const requestedCounterId =
        sp.counter && myCounters.some((c) => c.id === sp.counter) ? sp.counter : null;
      const targetCounterId = requestedCounterId ?? openShifts[0]?.counter_id ?? null;
      const openShift = targetCounterId ? openShifts.find((s) => s.counter_id === targetCounterId) : undefined;
      const active = openShift ? myCounters.find((c) => c.id === openShift.counter_id) : undefined;

      otherCounters = myCounters
        .filter((c) => c.id !== active?.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          shopName: c.shopName,
          hasOpenShift: openShifts.some((s) => s.counter_id === c.id),
        }));

      if (!active) {
        // Requested counter par abhi shift khula nahi -- seedha usi
        // counter ka "Shift Open" form (switcher se poori fehrist
        // dobara dikhane ki zaroorat nahi). Koi counter request nahi
        // hua aur koi shift kahin khula bhi nahi to poori fehrist.
        const pickerCounters = requestedCounterId
          ? myCounters.filter((c) => c.id === requestedCounterId)
          : myCounters;
        const backHref = openShifts[0] ? `/admin/pos?counter=${openShifts[0].counter_id}` : "/admin/my-work";
        return <CounterShiftPicker counters={pickerCounters} pendingHandover={pendingHandover} backHref={backHref} />;
      }

      const { data: counterRow } = await supabase.from("pos_counters").select("warehouse_id").eq("id", active.id).maybeSingle();
      branch = { id: active.branchId, name: active.branchName };
      shopName = active.shopName;
      shopId = active.shopId;
      warehouseId = counterRow?.warehouse_id ?? null;
      activeCounterId = active.id;
      activeCounterName = active.name;
      openShiftInfo = {
        id: openShift!.id,
        shiftNumber: openShift!.shift_number,
        openedAt: openShift!.opened_at,
        openingCash: Number(openShift!.opening_cash),
      };
    } else if (profile?.branch_id) {
      // ---------------------------------------------------------------
      // PURANA raasta -- 366 se pehle jaisa tha, ek harf nahi badla.
      // ---------------------------------------------------------------
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
        cnic?: string | null;
        balance?: number | null;
        creditLimit?: number | null;
        isWholesaleShop: boolean;
        businessName?: string | null;
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
      .select("id, name, phone_number, cnic, customer_type, business_name, current_balance, credit_limit, farmer_id")
      .order("name");
    // Farmer khud POS mein customer ki tarah dhoonda ja sake (384) --
    // malik ka hukm (10 September). Jis farmer ka Customer record pehle
    // se bana hua hai (upar wali fehrist mein aa chuka), use yahan
    // dobara nahi dikhate -- ek hi banda do dafa nazar aana confusion
    // banata. "farmer:<id>" wali banawati ID posCheckout khud asal
    // customers.id mein badal deti hai, pehli khareed par.
    const linkedFarmerIds = new Set((cust ?? []).map((c: any) => c.farmer_id).filter(Boolean));
    const { data: farmersRaw } = await supabase
      .from("farmers")
      .select("id, full_name, phone_number, cnic")
      .eq("is_deleted", false)
      .order("full_name");

    // 20 September: combined balance -- farmer ka customer-side khata
    // (current_balance) aur farmer-side ledger (agri inputs, advances)
    // dono milake asal baqi banti hai. v_farmer_combined_balance yehi
    // karta hai. Agar sirf customer_balance dikhayein to counter par
    // galat tasweer milti hai.
    const allFarmerIds = [
      ...(cust ?? []).map((c: any) => c.farmer_id).filter(Boolean),
      ...(farmersRaw ?? []).filter((f: any) => !linkedFarmerIds.has(f.id)).map((f: any) => f.id),
    ];
    const farmerBalanceMap = new Map<string, number>();
    if (allFarmerIds.length > 0) {
      const { data: farmerBalances } = await (supabase as any)
        .from("v_farmer_combined_balance")
        .select("farmer_id, total_baqi")
        .in("farmer_id", allFarmerIds);
      for (const fb of farmerBalances ?? []) {
        farmerBalanceMap.set(fb.farmer_id, Number(fb.total_baqi ?? 0));
      }
    }

    rawCustomers = (cust ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone_number,
      cnic: c.cnic,
      // Hadd darj hi na ho to NULL. Sifar likh dena "is ko udhaar bilkul
      // nahi" kehna hai -- aur wo faisla kisi ne kiya hi nahi.
      creditLimit: c.credit_limit == null ? null : Number(c.credit_limit),
      // Gahak chunte hi us ka baqi saamne. Farmer-linked customer ke
      // liye combined balance (farmer + customer ledger dono), warna
      // sirf customer khata.
      balance: c.farmer_id
        ? (farmerBalanceMap.get(c.farmer_id) ?? (c.current_balance == null ? null : Number(c.current_balance)))
        : (c.current_balance == null ? null : Number(c.current_balance)),
      isWholesaleShop: c.customer_type === "wholesale_shop",
      // Malik (19 September): "wholesale ke liye Shop ka naam bhi POS
      // mein aana chahiye" -- dukaan ka naam, contact person ke naam se
      // alag.
      businessName: c.business_name ?? null,
    }));

    for (const f of farmersRaw ?? []) {
      if (linkedFarmerIds.has(f.id)) continue;
      rawCustomers.push({
        id: `farmer:${f.id}`,
        name: f.full_name ?? "Farmer",
        phone: f.phone_number,
        cnic: f.cnic,
        creditLimit: null,
        balance: farmerBalanceMap.has(f.id) ? farmerBalanceMap.get(f.id)! : null,
        isWholesaleShop: false,
      });
    }
  }

  // Search khali ho to poori (alphabetical) fehrist ki jagah sirf wo 4
  // gahak jin ki kul khareedari (completed sales) sab se zyada hai --
  // malik (12 September): "sirf 4 customer wo hon jin ki sab se zyada
  // buying hai." Dealer ke apne gahak alag table (dealer_customers) mein
  // hain, wahan ye hisaab nahi lagta.
  let topCustomerIds: string[] = [];
  if (!dealer) {
    // `fn_top_customers_by_purchase` migration 392 ka hai; generated
    // types abhi us se pehle ke hain. Types dobara banne par ye cast
    // hat jayega.
    const { data: topRows } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: { customer_id: string; total_amount: number }[] | null }>
    )("fn_top_customers_by_purchase", { p_limit: 4 });
    topCustomerIds = (topRows ?? []).map((r) => r.customer_id);
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

  /**
   * Load aur Bill POS se nikal gaye.
   *
   * Malik (6 September): *"POS se bill aur load bhi hata do. Slide bar
   * mein 1 tag banao Load/Bill ka, is par load aur bill ho ga."*
   *
   * Wo pehle bhi yehi keh chuke the: *"jab hum ye ordering bridge de
   * rahe hain to POS ke andar ordering app ke tuk nahi banta, wahan phir
   * nahi honi chahiye."* Wohi baat load aur bill par bhi lagti hai --
   * counter par bikri hoti hai; load aur bill alag kaam hain aur un ka
   * apna safha maujood hai.
   *
   * Safha `/admin/load-bill` waise ka waisa hai; sirf POS ke ooper se
   * us ke khane hataye gaye hain. Menu mein wo ek hi tag ban kar rehta
   * hai.
   */
  return (
    <>
      {openShiftInfo && activeCounterName && (
        <ShiftBar
          shiftId={openShiftInfo.id}
          shiftNumber={openShiftInfo.shiftNumber}
          counterName={activeCounterName}
          shopName={shopName ?? "—"}
          shopId={shopId}
          openingCash={openShiftInfo.openingCash}
          openedAt={openShiftInfo.openedAt}
          branchId={branch?.id ?? null}
          pendingHandover={pendingHandover}
          otherCounters={otherCounters}
        />
      )}
      <PosClient
        lang={lang}
        sellerName={sellerName}
        inventory={inventory}
        groups={groups}
        customers={rawCustomers ?? []}
        topCustomerIds={topCustomerIds}
        branchId={branch?.id ?? null}
        counterId={activeCounterId}
        rateBaqiCount={rateBaqiCount}
        perms={perms}
      />
    </>
  );
}
