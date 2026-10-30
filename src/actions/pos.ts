"use server";
import { validateCheckoutTotals, findRecentDuplicate, DUPLICATE_SALE_MARKER, DUPLICATE_WINDOW_SECONDS } from "@/lib/pos/checkout-guards";
import { lineStockUnits, sellableFromLots, stockLimitMessage, todayPkt, type StockLot } from "@/lib/pos/stock-availability";
import { discountOverCap, POS_DISCOUNT_MAX_PCT, POS_DISCOUNT_MAX_RS } from "@/lib/money/review-guards";
import { createClient } from "@/lib/supabase/server";
import { checkOverdueCreditBlock, getCreditBlockInfo } from "@/lib/recovery/credit-block";
import { createServiceClient } from "@/lib/supabase/service";
import { ACC, failed, glForFinanceAccount } from "@/lib/ledger/rules";
import { postJournal, type JournalLine, type SourceClaim } from "@/lib/ledger/post";
import type { Json } from "@/lib/types/database.types";
import { loadPosPermissions } from "@/lib/pos/permissions";
import { requireAction } from "@/lib/access/guard";
import { notifyUser } from "@/lib/notifications";

export interface PosCheckoutState {
  error?: string;
  notice?: string;
  saleId?: string;
  /** Purane baqaye ki rok -- POS dialog ke liye poori tafseel (538). */
  creditBlock?: import("@/lib/recovery/credit-position").CreditBlockInfo;
  /** Abhi abhi bilkul aisa hi bill bana -- client confirm kar ke allowDuplicate bheje. */
  duplicateOf?: { saleId: string; createdAt: string; total: number };
}

export interface PosCartItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  /**
   * Server tay karta hai (browser nahi): "carton" ho to create_pos_sale
   * quantity x units_per_pack bottle stock se ghatata hai (513).
   */
  sale_unit?: "carton" | "unit";
}

export interface PosPaymentLine {
  method: string;
  amount: number;
  reference?: string;
  receipt_url?: string;
}

/**
 * POS ka checkout.
 *
 * Pehle browser seedha create_pos_sale ko bulata tha. Wo function bikri
 * likh deta tha, stock ghata deta tha, khata barha deta tha, aur cash
 * book mein qatar daal deta tha -- magar LEDGER mein kuch nahi jata tha.
 *
 * Us ka nateeja raat ki ginti par nazar aata tha: expectedCash ledger se
 * poochta hai (khata 1000), aur ledger ko POS ki bikri ka pata hi nahi
 * hota. Yani golak mein har roz "zyada" paisa nikalta -- poore din ki
 * bikri jitna -- aur manager ko har raat ek aisa farq milta jis ki koi
 * wajah nahi hoti. Zero-Rupee ki nazar ise pakaR to rahi thi (har bikri
 * "ledger mein nahi gayi" ki fehrist mein khaRi thi) magar theek karne
 * ka koi raasta nahi tha.
 *
 * Ab checkout yahan se guzarta hai: pehle wohi purana function (bikri,
 * stock, khata, cash book), phir ledger.
 *
 * Ledger ka posting SQL ke andar NAHI daala gaya. Wahan daalne ka matlab
 * hota ke hisaab ke usool do zabanon mein likhe jayen -- ek TypeScript
 * mein aur ek plpgsql mein -- aur phir wo ek din alag ho jate.
 */
export async function posCheckout(input: {
  customerId: string | null;
  paymentMode: string;
  cashPaid: number;
  khataAmount: number;
  /** Bill se zyada received payment; selected customer ke Jama/Advance mein credit hoti hai. */
  overpayment?: number;
  items: PosCartItem[];
  paymentLines: PosPaymentLine[];
  /** Bill par chhoRi hui raqam. 0 = discount diya hi nahi. */
  discount?: number;
  discountReason?: string;
  /** POS Counter (366/367) -- diya jaye to staff ke khule Shift se sale juRti hai. */
  counterId?: string | null;
  /**
   * Jab khata wale ka naam aur maal lene wala alag ho (malik, 15
   * September: "khata Aurangzaib ka hai, lay ke jaane wala Mohsin
   * hai") -- sirf record ke liye, koi ledger/hisaab is se nahi badalta.
   */
  receivedBy?: string;
  clientActionId?: string;
  /** 30 din wali udhaar rok ka Admin override -- wajah lazmi (migration 523). */
  creditOverrideReason?: string | null;
  /** Hadd se upar discount, ya bina ijazat discount: doosre manager ka code (631). */
  managerCode?: string | null;
  /**
   * fix/pos-card-cash-dupes: staff ne "haan, ye naya bill hai" confirm kiya
   * (ya offline sync hai, jahan client_action_id hi kaafi hai).
   */
  allowDuplicate?: boolean;
}): Promise<PosCheckoutState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Idempotency: wohi client_action_id dobara aaye (double click, network
  // retry, offline sync) to naya bill nahi -- pehle wala wapas. DB par bhi
  // unique index idx_pos_sales_client_action (504) yehi rokta hai; yahan
  // pehle pakadne se credit/rate jaanch dobara nahi chalti.
  const clientActionId = input.clientActionId && UUID_RE.test(input.clientActionId) ? input.clientActionId : undefined;
  if (clientActionId && user) {
    const existing = await findSaleByClientAction(clientActionId, user.id);
    if (existing) return { saleId: existing };
  }

  // Farmer ko POS ki customer fehrist mein dikhaya jata hai "farmer:<id>"
  // jaisi banawati ID se (384) -- asal customers.id nahi, kyunke us waqt
  // tak us farmer ka koi Customer record bana hi nahi hota. Yahan, sab se
  // pehle, use asal customers.id mein badal dete hain -- taake neeche
  // rate/udhaar ki jaanch aur create_pos_sale ko hamesha ek asal, valid
  // customer ID hi mile, kabhi "farmer:..." jaisi string na jaye (wo
  // uuid khane mein seedha jaate hi bikri gira degi).
  if (input.customerId?.startsWith("farmer:")) {
    const resolved = await resolveFarmerCustomerId(input.customerId.slice("farmer:".length));
    if (!resolved) return { error: "Is farmer ka Customer record nahi ban saka. Dobara koshish karein." };
    input = { ...input, customerId: resolved };
  }

  // Feature-level ijazat -- sirf branch/shop wale staff par (dealer
  // apna alag darwaza hai, `dealers` table se, is nizam ka hissa nahi).
  // Legacy fallback (koi permission row hi nahi) chup chaap guzarne
  // deta hai -- purana kaam nahi tootega.
  if (user) {
    const { data: dealerRow } = await supabase.from("dealers").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
    if (!dealerRow) {
      const guard = await requireAction("pos", "create");
      if ("error" in guard) return { error: guard.error };
    }
  }

  // Rate ki rok -- safhe par nahi, YAHAN.
  //
  // Rate browser se aata hai. Safhe par khana band kar dena us bande ko
  // nahi rokta jo seedha ye request bhej de -- aur counter par paise ka
  // faisla isi ek adad par hota hai. Is liye jis ke paas rate badalne ki
  // ijazat nahi, us ka bheja hua rate manzoor nahi hota: server khud
  // apna rate nikalta hai aur farq par bikri rok deta hai.
  const rateGhalat = await checkRates(input, user?.id ?? null);
  if (rateGhalat) return { error: rateGhalat };

  // Bina naam ka udhaar kabhi nahi.
  //
  // Malik ka usool (4 September): "Cash mein customer optional, Udhar
  // mein customer mandatory." Jo raqam kisi ke zimme nahi likhi gayi, wo
  // kisi se maangi bhi nahi ja sakti -- aur mahine baad wo sirf golak ke
  // farq ki soorat mein nazar aati hai, jahan us ka koi ilaj nahi hota.
  const udhaarGhalat = await checkCredit(input);
  if (udhaarGhalat) return { error: udhaarGhalat };

  // 30 din ki hadd (malik, 10 October): purana baqaya ho to naya udhaar
  // band. Naqad bikri par ye rok nahi lagti (khata 0).
  const purana = await checkOverdueCreditBlock({
    customerId: input.customerId,
    khataAmount: input.khataAmount,
    context: "pos",
    overrideReason: input.creditOverrideReason ?? null,
  });
  if (purana) {
    const creditBlock = input.customerId ? await getCreditBlockInfo(input.customerId, input.khataAmount).catch(() => undefined) : undefined;
    return { error: purana, creditBlock };
  }

  // Discount ki rok bhi YAHAN, safhe par nahi -- wohi wajah jo rate ki
  // rok ki hai. Jis ke paas rate girane ki ijazat nahi, us ke haath
  // mein discount dena bhi wohi taqat hai: maal us qeemat par chala
  // jata hai jo malik ne tay nahi ki.
  // Paise ki jaanch RPC se PEHLE: cash + khata + overpayment = net bill,
  // discount <= gross, aur dono adad paymentLines se mile hue.
  const totals = validateCheckoutTotals({
    items: input.items,
    discount: input.discount,
    cashPaid: input.cashPaid,
    khataAmount: input.khataAmount,
    paymentLines: input.paymentLines,
  });
  if (!totals.ok) return { error: totals.error };
  const discount = totals.discount;
  const overpayment = totals.overpayment;
  if (overpayment > 0 && !input.customerId) {
    return { error: "Zyada payment ko customer ke Jama/Advance mein dalne ke liye customer select karein." };
  }
  const discountReason = (input.discountReason ?? "").trim();
  const managerCode = (input.managerCode ?? "").trim();
  if (discount < 0) return { error: "Discount manfi nahi hota." };
  if (discount > 0) {
    const { canGiveDiscount } = await loadPosPermissions(user?.id ?? null);
    const overCap = discountOverCap(totals.gross, discount);
    if (discountReason.length < 3) {
      return { error: "Discount ki wajah likhein — jo raqam bina wajah ke di jaye us ka hisaab kabhi nahi milta." };
    }
    if (overCap && !managerCode) {
      return { error: `Discount hadd (Rs ${POS_DISCOUNT_MAX_RS.toLocaleString()} ya ${POS_DISCOUNT_MAX_PCT}%) se upar hai. Doosre manager ka code likhein.` };
    }
    if (!canGiveDiscount && !managerCode) {
      return { error: "Discount dene ki ijazat aap ke paas nahi. Manager se kehein." };
    }
  }

  // Carton ya bottle? Wholesale counter par quantity carton mein hoti hai
  // (rate = wholesale_price), magar stock bottle mein. Pehle 1 carton par
  // 1 bottle ghatta tha -- stock zyada aur nafa phoola hua dikhta tha.
  const itemsWithUnit = await markSaleUnits(input.items);

  // Stock ki hadd bhi YAHAN. Cart par rok hai, magar jo request seedha
  // yahan aaye (ya offline sync purana cart le aaye) wo dukan ke bechne
  // layak stock se zyada nahi bech sakta. Godam ka maal is hadd mein
  // nahi. Expire batch shamil nahi.
  if (user) {
    const stockGhalat = await checkSellableStock(itemsWithUnit, input.counterId, user.id);
    if (stockGhalat) return { error: stockGhalat };
  }

  // Double-submit ki rok: isi staff ne pichhle 2 minute mein bilkul yehi
  // bill (customer + raqam + cheezein) banaya ho to pehle poocha jata hai.
  if (!input.allowDuplicate && user) {
    const dup = await findDuplicateSale(user.id, input.customerId, totals.net, input.items);
    if (dup) {
      const secs = Math.max(0, Math.round((Date.now() - new Date(dup.createdAt).getTime()) / 1000));
      return {
        error: `${DUPLICATE_SALE_MARKER} Bilkul aisa hi bill (Rs ${dup.total.toLocaleString()}) ${secs} second pehle ban chuka hai (#${dup.id.slice(0, 8).toUpperCase()}). Kya ye naya, alag bill hai?`,
        duplicateOf: { saleId: dup.id, createdAt: dup.createdAt, total: dup.total },
      };
    }
  }

  const rpcArgs = {
    p_customer_id: input.customerId as string,
    p_credit_override_reason: input.creditOverrideReason?.trim() || null,
    p_payment_mode: input.paymentMode,
    // Sirf asal CASH -- Waseela Card/bank/wallet ab cash_paid mein nahi
    // (tafseel pos_sale_payment_details mein, ledger bhi wahin se).
    p_cash_paid: totals.cashOnly,
    p_khata_amount: totals.khata,
    p_items: itemsWithUnit as unknown as Json,
    p_payment_lines: input.paymentLines as unknown as Json,
    p_discount: discount,
    p_discount_reason: discount > 0 ? discountReason : undefined,
    p_manager_code: managerCode || undefined,
    p_counter_id: input.counterId ?? undefined,
    ...(clientActionId ? { p_client_action_id: clientActionId } : {}),
  };
  const { data: saleIdRaw, error } = await (supabase as any).rpc("create_pos_sale_with_credit_approval", rpcArgs);

  const saleId = saleIdRaw as string | null;
  if (error || !saleId) return { error: error?.message ?? "Bikri nahi ho saki." };

  const receivedBy = (input.receivedBy ?? "").trim();
  if (receivedBy) {
    // pos_sales par -- pehle ghalti se `sales` table par likha jata tha.
    const { error: rbError } = await (supabase as any)
      .from("pos_sales")
      .update({ received_by_name: receivedBy.slice(0, 120) })
      .eq("id", saleId);
    if (rbError) console.error("[posCheckout] received_by_name save nahi hua:", rbError.message);
  }

  const posted = await postSaleToLedger(saleId, user?.id ?? null, overpayment);

  // Malik (18 September): "My Work par Bill, Load, Udhaar, Recovery to
  // Live Notifications mein pehle se hain (load-bill.ts, customer-
  // udhaar.ts ke notifyUser se) -- sirf POS Sale isi tarah nazar nahi
  // aati thi." Load & Bill wale isi pattern ke barabar.
  // await nahi karte -- notification cosmetic hai, bill aane mein delay
  // nahi karna chahiye.
  const saleTotal = totals.net;
  void notifyUser(user?.id ?? null, "POS Sale darj", `Rs ${saleTotal.toLocaleString()}`, "/admin/pos");

  // Bikri ho chuki hai aur maal gahak ke haath mein ja chuka hai. Usay
  // mitana ab ghalat hoga. Magar chup rehna us se bhi bura: bulane wale
  // ko maloom hona chahiye ke ye bikri ledger mein nahi gayi, taake wo
  // raat ki ginti se pehle theek karwa sake.
  if (posted) return { saleId, notice: posted };

  return { saleId };
}

/**
 * Farmer ke apne record se, ek juRa hua Customer record -- ya to pehle
 * se bana hua wapas de deta hai, ya pehli dafa bana deta hai (384).
 *
 * Farmer ka WALLET (jo hum use dete hain) bilkul nahi chhua jata -- ye
 * naya Customer record sirf itna karta hai ke farmer POS ke KHATA/udhaar
 * nizam mein bhi shamil ho sake, apne naam/phone/CNIC ke sath.
 */
async function resolveFarmerCustomerId(farmerId: string): Promise<string | null> {
  const service = createServiceClient();

  const { data: existing } = await service.from("customers").select("id").eq("farmer_id", farmerId).maybeSingle();
  if (existing) return existing.id;

  const { data: farmer } = await service.from("farmers").select("full_name, phone_number, cnic").eq("id", farmerId).eq("is_deleted", false).maybeSingle();
  if (!farmer?.phone_number) return null;

  // Isi phone number ka Customer pehle se ho sakta hai -- jaise bulk
  // balance import se (409), jo kabhi farmer se juRa hi nahi jata tha.
  // Naya banane se pehle isi ko link kar dena behtar hai: warna do
  // record ban jate, ek asal balance ke sath (chup chaap), doosra
  // khaali (jo POS mein dikhta).
  const { data: byPhone } = await service
    .from("customers")
    .select("id")
    .eq("phone_number", farmer.phone_number)
    .is("farmer_id", null)
    .maybeSingle();
  if (byPhone) {
    await service.from("customers").update({ farmer_id: farmerId }).eq("id", byPhone.id);
    return byPhone.id;
  }

  const { data: created, error } = await service
    .from("customers")
    .insert({
      name: farmer.full_name ?? "Farmer",
      phone_number: farmer.phone_number,
      cnic: farmer.cnic,
      farmer_id: farmerId,
      customer_type: "retail",
    })
    .select("id")
    .single();
  // Ek hi lamhe mein do bill isi farmer ke liye ban rahe hon to unique
  // index (384) doosri koshish ko yahin rok deta hai -- us soorat mein
  // pehli wali qatar dobara dhoond lete hain, nayi nahi banate.
  if (error) {
    const { data: retry } = await service.from("customers").select("id").eq("farmer_id", farmerId).maybeSingle();
    return retry?.id ?? null;
  }
  return created?.id ?? null;
}

/**
 * Bheja hua rate wohi hai jo hona chahiye?
 *
 * Jis ke paas rate badalne ki ijazat hai, us par koi rok nahi -- wo
 * faisla us ka hai aur bikri par likha bhi jata hai.
 *
 * Baqi sab ke liye rate server khud nikalta hai: thok wali dukan ho AUR
 * us cheez ka thok ka rate darj ho to thok, warna retail. Yehi hisaab
 * safhe par bhi chalta hai, is liye theek chalne wale counter par ye rok
 * kabhi saamne nahi aayegi -- ye sirf us raaste par khaRi hai jo safhe
 * se nahi guzarta.
 *
 * Ek paisa tak ka farq nahi pakaRa jata (0.01), warna gol karne se hi
 * bikri ruk jati.
 */
/**
 * Har line par sale_unit lagao: units_per_pack > 1 aur rate wholesale
 * (carton) rate ke barabar ho to "carton", warna "unit".
 */
/**
 * Is bill ka godam -- wahi jo create_pos_sale kaat-ta hai.
 * Counter diya ho to us ka warehouse. Warna staff ki dukan, phir
 * branch ka MAIN. Na mile to null: sifar stock nahi, tasdeeq nahi.
 */
async function resolvePosWarehouse(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  counterId: string | null | undefined
): Promise<{ warehouseId: string } | { error: string }> {
  if (counterId) {
    const { data, error } = await service
      .from("pos_counters")
      .select("warehouse_id, is_active")
      .eq("id", counterId)
      .maybeSingle();
    if (error) return { error: "Stock ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein." };
    if (!data?.is_active) return { error: "Ye POS counter nahi mila ya band hai." };
    if (!data.warehouse_id) return { error: "Is counter ka stock source (warehouse) set nahi hai." };
    return { warehouseId: data.warehouse_id };
  }
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("shop_id, branch_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: "Stock ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein." };
  }
  if (profile.shop_id) {
    const { data: shopWarehouse, error: shopError } = await service
      .from("warehouses")
      .select("id")
      .eq("shop_id", profile.shop_id)
      .maybeSingle();
    if (shopError) return { error: "Stock ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein." };
    if (shopWarehouse?.id) return { warehouseId: shopWarehouse.id };
  }
  if (profile.branch_id) {
    const { data: mainWarehouse, error: mainError } = await service
      .from("warehouses")
      .select("id")
      .eq("branch_id", profile.branch_id)
      .eq("code", "MAIN")
      .maybeSingle();
    if (mainError) return { error: "Stock ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein." };
    if (mainWarehouse?.id) return { warehouseId: mainWarehouse.id };
  }
  return { error: "Stock ki tasdeeq nahi ho saki — dukaan ka godam nahi mila. Bikri rok di gayi." };
}

async function checkSellableStock(
  items: PosCartItem[],
  counterId: string | null | undefined,
  userId: string
): Promise<string | null> {
  if (items.length === 0) return null;
  for (const item of items) {
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return "Miqdar ghalat hai — sifar se zyada honi chahiye.";
  }

  const service = createServiceClient();
  const ids = Array.from(new Set(items.map((i) => i.product_id)));
  const { data: products, error: productError } = await service
    .from("products")
    .select("id, name, units_per_pack, selling_price")
    .in("id", ids);
  if (productError || !products) {
    return "Stock ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein.";
  }
  const productById = new Map(products.map((p) => [p.id, p]));

  const have = new Map<string, number>();
  const { data: dealer, error: dealerError } = await service
    .from("dealers")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (dealerError) return "Stock ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein.";

  if (dealer) {
    const { data: rows, error } = await service
      .from("dealer_inventory")
      .select("product_id, stock_quantity")
      .eq("dealer_id", dealer.id)
      .in("product_id", ids);
    if (error) return "Stock ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein.";
    for (const id of ids) have.set(id, 0);
    for (const row of rows ?? []) {
      const prev = have.get(row.product_id) ?? 0;
      have.set(row.product_id, prev + Math.max(0, Number(row.stock_quantity ?? 0)));
    }
  } else {
    const warehouse = await resolvePosWarehouse(service, userId, counterId);
    if ("error" in warehouse) return warehouse.error;
    const { data: rows, error } = await service
      .from("inventory")
      .select("product_id, quantity_on_hand, batch_id")
      .eq("warehouse_id", warehouse.warehouseId)
      .in("product_id", ids);
    if (error) return "Stock ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein.";
    const batchIds = Array.from(new Set((rows ?? []).map((r) => r.batch_id).filter((id): id is string => !!id)));
    const expiryByBatch = new Map<string, string | null>();
    if (batchIds.length > 0) {
      const { data: batches, error: batchError } = await service
        .from("stock_batches")
        .select("id, expiry_date")
        .in("id", batchIds);
      if (batchError) return "Stock ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein.";
      for (const batch of batches ?? []) expiryByBatch.set(batch.id, batch.expiry_date ?? null);
    }
    const lotsByProduct = new Map<string, StockLot[]>();
    for (const id of ids) lotsByProduct.set(id, []);
    for (const row of rows ?? []) {
      const list = lotsByProduct.get(row.product_id) ?? [];
      list.push({ batch_id: row.batch_id, quantity_on_hand: Number(row.quantity_on_hand ?? 0) });
      lotsByProduct.set(row.product_id, list);
    }
    const today = todayPkt();
    for (const id of ids) {
      have.set(id, sellableFromLots(lotsByProduct.get(id) ?? [], expiryByBatch, today).sellable);
    }
  }

  const needById = new Map<string, { bottles: number; carton: boolean; upp: number; name: string }>();
  for (const item of items) {
    const product = productById.get(item.product_id);
    if (!product) return "Is cheez ka stock nahi mila, bikri rok di gayi.";
    const upp = Number(product.units_per_pack ?? 1);
    const bottles = lineStockUnits({
      quantity: item.quantity,
      unitPrice: item.unit_price,
      saleUnit: item.sale_unit,
      unitsPerPack: upp,
      sellingPrice: product.selling_price,
    });
    const carton = bottles > Number(item.quantity) + 1e-6 && upp > 1;
    const prev = needById.get(item.product_id);
    if (!prev) {
      needById.set(item.product_id, { bottles, carton, upp, name: product.name ?? "Cheez" });
    } else {
      prev.bottles += bottles;
      prev.carton = prev.carton || carton;
    }
  }

  for (const [id, need] of needById) {
    const available = have.get(id) ?? 0;
    if (need.bottles > available + 1e-6) {
      return stockLimitMessage(need.name, available, { carton: need.carton, unitsPerPack: need.upp });
    }
  }
  return null;
}

async function markSaleUnits(items: PosCartItem[]): Promise<PosCartItem[]> {
  if (items.length === 0) return items;
  const service = createServiceClient();
  const ids = Array.from(new Set(items.map((i) => i.product_id)));
  const { data: products } = await service
    .from("products")
    .select("id, units_per_pack, wholesale_price, selling_price")
    .in("id", ids);
  const byId = new Map((products ?? []).map((p: any) => [p.id as string, p]));
  return items.map((item) => {
    const p: any = byId.get(item.product_id);
    const upp = Number(p?.units_per_pack ?? 0);
    const wholesale = p?.wholesale_price != null ? Number(p.wholesale_price) : null;
    const isCarton = upp > 1 && wholesale != null && wholesale > 0 && Math.abs(Number(item.unit_price) - wholesale) < 0.01;
    return isCarton ? { ...item, sale_unit: "carton" as const } : item;
  });
}

async function checkRates(
  input: { customerId: string | null; items: PosCartItem[] },
  userId: string | null
): Promise<string | null> {
  const { canEditRate } = await loadPosPermissions(userId);
  if (canEditRate) return null;
  if (input.items.length === 0) return null;

  const service = createServiceClient();

  let thok = false;
  if (input.customerId) {
    const { data: cust } = await service
      .from("customers")
      .select("customer_type")
      .eq("id", input.customerId)
      .maybeSingle();
    thok = cust?.customer_type === "wholesale_shop";
  }

  const ids = Array.from(new Set(input.items.map((i) => i.product_id)));
  const { data: products, error } = await service
    .from("products")
    .select("id, name, selling_price, wholesale_price")
    .in("id", ids);

  // Jawab hi na mile to bikri rok di jati hai. "Poochha nahi ja saka" ko
  // "sab theek hai" samajh lena wo ghalti hai jo sirf us din nazar aati
  // hai jab koi jaan boojh kar faida uthhata hai.
  if (error) return "Rate ki tasdeeq nahi ho saki, is liye bikri rok di gayi. Dobara koshish karein.";

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  for (const item of input.items) {
    const p = byId.get(item.product_id);
    if (!p) return "Is cheez ka rate nahi mila, bikri rok di gayi.";

    const chahiye = thok && p.wholesale_price != null ? Number(p.wholesale_price) : Number(p.selling_price);
    if (Math.abs(Number(item.unit_price) - chahiye) > 0.01) {
      return `"${p.name}" ka rate Rs ${chahiye.toLocaleString()} hai. Rate badalne ki ijazat aap ke paas nahi -- Admin se kehein.`;
    }
  }

  return null;
}

/**
 * Udhaar ka gahak maujood hai, aur hadd ke andar hai?
 *
 * DO alag jaanchein:
 *
 * 1. Khate par raqam ja rahi ho to gahak ka naam LAZMI. Safhe par bhi
 *    rok hai, magar safha ek darwaza hai -- ye rok us raaste par bhi
 *    khaRi hai jo safhe se nahi guzarta.
 *
 * 2. Udhaar ki hadd. Hadd DARJ HO (sifar se zyada) tabhi lagti hai.
 *    Khali ya sifar hadd ka matlab "hadd tay hi nahi hui" liya jata hai,
 *    "is ko udhaar bilkul nahi" nahi -- kyunke wo faisla kisi ne kiya hi
 *    nahi hota, aur us maan par har purana gahak aaj se ruk jata.
 */
async function checkCredit(input: {
  customerId: string | null;
  khataAmount: number;
}): Promise<string | null> {
  const khata = Number(input.khataAmount ?? 0);
  if (khata <= 0) return null;

  if (!input.customerId) {
    return "Udhaar sale ke liye darj shuda gahak chunein. Bina naam ke udhaar darj nahi hota.";
  }

  const service = createServiceClient();
  const { data: cust, error } = await service
    .from("customers")
    .select("name, current_balance, credit_limit")
    .eq("id", input.customerId)
    .maybeSingle();

  // Jawab na mile to bikri rok di jati hai. "Poochha nahi ja saka" ko
  // "sab theek hai" samajh lena wohi ghalti hai jo baad mein wasooli ke
  // waqt pakRi jati hai.
  if (error) return "Gahak ka khata nahi dekha ja saka, is liye udhaar rok diya gaya. Dobara koshish karein.";
  if (!cust) return "Gahak ka record nahi mila -- udhaar darj nahi ho sakta.";

  const hadd = cust.credit_limit == null ? 0 : Number(cust.credit_limit);
  if (hadd > 0) {
    const abTak = cust.current_balance == null ? 0 : Number(cust.current_balance);
    if (abTak + khata > hadd) {
      return `"${cust.name}" ki udhaar ki hadd Rs ${hadd.toLocaleString()} hai aur us par pehle hi Rs ${Math.round(
        abTak
      ).toLocaleString()} baqi hai. Ye bikri us hadd se aage nikal rahi hai -- Admin se manzoori lein.`;
    }
  }

  return null;
}

/**
 * Ek bikri ka hisaab.
 *
 *   Dr  cash / bank      jitna naqad (ya bank) aaya
 *   Dr  gahak ka udhaar  jitna khate par gaya
 *       Cr  dukan ki bikri            poori raqam
 *   Dr  maal ki lagat
 *       Cr  godam ka maal             lagat jitni
 *
 * Do alag baatein ek entry mein: paisa/udhaar aur lagat. Ye jaan boojh
 * kar ek hi entry hai -- waqia bhi ek hi hai. Do entriyan banane se ek
 * ke nakaam hone par doosri akeli reh jati hai.
 */
async function postSaleToLedger(saleId: string, userId: string | null, overpayment = 0): Promise<string | null> {
  const service = createServiceClient();
  const { data: existing, error: existingError } = await service
    .from("journal_entry_sources").select("entry_id")
    .eq("source_table", "pos_sales").eq("source_row_id", saleId).maybeSingle();
  if (existingError) return `Ledger link check failed: ${existingError.message}`;
  if (existing) return null; // Source transaction already posted and updated the balance.

  const [{ data: sale }, { data: payments }, { data: waselaSettingRow }] = await Promise.all([
    service
      .from("pos_sales")
      .select("id, total_amount, gross_amount, discount_amount, khata_amount, total_cogs, branch_id, dealer_id, customer_id, crm_customer_id, created_at")
      .eq("id", saleId)
      .maybeSingle(),
    service
      .from("pos_sale_payment_details")
      .select("payment_method, amount")
      .eq("sale_id", saleId),
    // Wasela Pakistan integration: jab enabled ho, Wasela Card ki adaigi
    // seedha 2062 (Wasela Pakistan Dena) par jati hai — hamara dena un ke
    // yahan usi waqt kam hota hai, hamare wallet mein nahi girta.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)
      .from("system_settings")
      .select("value")
      .eq("key", "wasela_pakistan_enabled")
      .maybeSingle(),
  ]);

  if (!sale) return "Bikri ka record nahi mila, ledger mein nahi ja saki.";

  /**
   * Dealer ki apni bikri, company ka journal nahi.
   *
   * =====================================================================
   * YE ROK KYUN LAGI
   * =====================================================================
   *
   * Malik (6 September): *"/admin/khata ko ledger se jorh do."*
   *
   * Us se pehle poora dealer wala raasta khangala gaya. Nateeja ye nikla
   * ke `create_pos_sale` (database function) dealer ki bikri par bhi
   * COGS/stock ki qatar KABHI nahi banati -- `v_item_cogs` dealer ke
   * liye hamesha sifar rehta hai (sirf `dealer_inventory` ghatta hai,
   * jo khud kabhi bharta hi nahi -- koi bhi safha us mein maal daalta
   * hi nahi). Is ke bawajood ye function har dealer ki bikri "Dukan ki
   * Bikri" (4000) mein CREDIT kar deta tha, bina kisi COGS ke.
   *
   * Yani agar kabhi ek bhi dealer sale hoti, wo company ke apne Sales
   * mein Rs jama kar deti bina kisi lagat ke -- company ka nafa hamesha
   * ke liye ghalat charh jata, aur wo ghalti kabhi khud nazar na aati.
   *
   * Live par is waqt EK BHI dealer sale nahi hai (0 rows), is liye ye
   * rok kisi purane hisaab ko nahi chhedti -- sirf AAGE ke liye rasta
   * band karti hai.
   *
   * Wajah asal mein saaf hai: dealer apna maal khud khareedta hai
   * (`dealers.current_payable`), aur apne gahak ko apni marzi se bechta
   * hai -- wo dealer ka apna karobar hai, company ka nahi. Dealer ki
   * bikri company ke Sales mein ginna wohi galti hai jo aaj din bhar
   * dhoondi gayi: do alag cheezon ko ek dikhana.
   *
   * Dealer ka apna khata (`/admin/khata`, `khata_accounts` jahan
   * `dealer_id` bhara ho) apni jagah chalta rehta hai -- wo dealer aur
   * us ke gahak ke darmiyan ka maamla hai, is function ka nahi.
   */
  if (sale.dealer_id) return null;

  const waselaEnabled = (waselaSettingRow as { value: string } | null)?.value === "true";

  const lines: JournalLine[] = [];
  const claims: SourceClaim[] = [{ table: "pos_sales", rowId: saleId }];

  // Har adaigi ke tareeqe ka apna khata. Ye Finance ke apne naqshe se
  // aata hai (payment_method_account_map), wohi jo cash book bharte waqt
  // istemal hota hai -- warna cash book kuch aur kehti aur ledger kuch
  // aur.
  // Sab payment lines ek sath fetch karo (parallel) taki ek ek kar ke
  // round trip na lage.
  await Promise.all(
    (payments ?? []).map(async (p) => {
      const amount = Number(p.amount);
      if (amount <= 0 || p.payment_method === "khata") return;

      // Wasela Card: integration ON ho to 2062 (dena kam karo), OFF ho to
      // aam raaste se 1019 (mobile wallet) mein girta hai.
      if (p.payment_method === "waseela_card" && waselaEnabled) {
        lines.push({ account: ACC.waselaPayable, debit: amount, memo: "POS — waseela_card (Wasela Pakistan dena)" });
        return;
      }

      const { data: map } = await service
        .from("payment_method_account_map")
        .select("finance_account_id")
        .eq("payment_method", p.payment_method)
        .maybeSingle();

      const gl = map?.finance_account_id ? await glForFinanceAccount(map.finance_account_id) : ACC.suspense;
      lines.push({ account: gl, debit: amount, memo: `POS — ${p.payment_method}` });

      // Cash book ki jis qatar ne ye paisa likha tha, us par is entry ka
      // daawa. Bina daawe ke wo qatar hamesha "ledger mein nahi gayi" ki
      // fehrist mein khaRi rehti.
      if (map?.finance_account_id) {
        // Daawa asal source row par: create_pos_sale (525) har cash-book
        // qatar par source_row_id = sale id likhta hai. Amount + time se
        // andaza ab nahi -- wo kisi aur bikri ki qatar utha sakta tha.
        const { data: txn } = await (service as any)
          .from("finance_transactions")
          .select("id")
          .eq("source_table", "pos_sales")
          .eq("source_row_id", saleId)
          .eq("account_id", map.finance_account_id)
          .eq("amount", amount)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (txn?.id) claims.push({ table: "finance_transactions", rowId: txn.id });
      }
    })
  );

  const khata = Number(sale.khata_amount ?? 0);
  if (khata > 0) {
    /**
     * Party linkage -- is ke baghair ye qatar kisi ke khaate mein
     * kabhi nazar nahi aati thi.
     *
     * `fn_customer_ledger`/`fn_customer_baqi` (339) sirf wahi qatarein
     * dekhte hain jin par `party_type='customer'` aur `party_id` bhara
     * ho. Ye khana yahan khali tha -- kul 1100 ("Customer se lena") ka
     * jorr theek nikalta tha, magar KISI EK customer ke statement par
     * ye bikri kabhi nahi aati thi. Ab jata hai.
     */
    lines.push({
      account: ACC.customerDue,
      debit: khata,
      partyType: sale.crm_customer_id ? "customer" : null,
      partyId: sale.crm_customer_id ?? null,
      memo: "POS — khata",
    });
  }

  // Bikri POORI raqam par likhi jati hai, aur jo chhoRa gaya wo apne
  // khate mein. Seedha kam raqam likh dene se kitab to barabar rehti,
  // magar ye sawal kabhi jawab na paata: "is mahine hum ne kitna
  // discount diya?"
  const discount = Number(sale.discount_amount ?? 0);
  if (overpayment > 0 && sale.crm_customer_id) {
    // Extra cash/bank payment customer ke khate mein Jama/Advance (credit) hai.
    // Is se POS receipt, customer statement aur available balance teenon ek hi hisaab dikhate hain.
    lines.push({
      account: ACC.customerDue,
      credit: overpayment,
      partyType: "customer",
      partyId: sale.crm_customer_id,
      memo: "POS — customer Jama / Advance",
    });
  }
  if (discount > 0) {
    lines.push({ account: ACC.salesDiscount, debit: discount, memo: "POS — discount diya" });
  }
  lines.push({
    account: ACC.salesShop,
    credit: Number(sale.gross_amount ?? sale.total_amount),
  });

  const cogs = Number(sale.total_cogs ?? 0);
  if (cogs > 0) {
    lines.push({ account: ACC.cogs, debit: cogs, memo: "POS — maal ki lagat" });
    lines.push({ account: ACC.stockGoods, credit: cogs });
  }

  const result = await postJournal({
    description: `POS bikri`,
    sourceModule: "pos",
    sourceId: saleId,
    branchId: sale.branch_id,
    lines,
    createdBy: userId,
    claims,
  });

  if (failed(result)) return `Bikri ho gayi magar ledger mein nahi gayi: ${result.error}`;

  // Balance GL se dobara banta hai (631). Parh kar jama karna race hai,
  // aur sale ka trigger pehle hi yahi hisaab likh chuka hota hai — dobara
  // jama karna udhaar ko dugna kar deta.
  if ((khata > 0 || overpayment > 0) && sale.crm_customer_id) {
    const { error: balErr } = await (service as any).rpc("fn_refresh_customer_balance", {
      p_customer_id: sale.crm_customer_id,
    });
    if (balErr) return `Bikri ho gayi magar gahak ka balance GL se nahi bana: ${balErr.message}`;
  }

  return null;
}

/** Raseed print ka log. Har print ek qatar hai, number nahi badalta. */
export async function logReceiptPrint(saleId: string): Promise<{ count?: number; error?: string }> {
  const supabase = createClient();
  const { data, error } = await (supabase as any).rpc("fn_log_receipt_print", { p_sale_id: saleId });
  if (error) return { error: error.message };
  return { count: Number(data ?? 0) };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Isi staff ka, isi client_action_id wala bill (agar pehle ban chuka). */
async function findSaleByClientAction(clientActionId: string, userId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await (service as any)
    .from("pos_sales")
    .select("id")
    .eq("client_action_id", clientActionId)
    .eq("created_by", userId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Pichhle DUPLICATE_WINDOW_SECONDS mein isi staff ka bilkul aisa hi bill. */
async function findDuplicateSale(
  userId: string,
  customerId: string | null,
  total: number,
  items: PosCartItem[]
): Promise<{ id: string; createdAt: string; total: number } | null> {
  const service = createServiceClient();
  const since = new Date(Date.now() - DUPLICATE_WINDOW_SECONDS * 1000).toISOString();
  const { data: recent, error } = await (service as any)
    .from("pos_sales")
    .select("id, created_at, total_amount, crm_customer_id, customer_id, pos_sale_items(product_id, quantity, unit_price)")
    .eq("created_by", userId)
    .eq("status", "completed")
    .eq("total_amount", total)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);
  // Jaanch na ho sake to bikri nahi rokte -- ye sirf hifazati sawal hai.
  if (error || !recent?.length) return null;
  const rows = (recent as any[]).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    customerId: (r.crm_customer_id ?? r.customer_id ?? null) as string | null,
    total: Number(r.total_amount ?? 0),
    items: ((r.pos_sale_items ?? []) as any[]).map((i) => ({
      product_id: i.product_id as string,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
    })),
  }));
  const hit = findRecentDuplicate({ customerId, total, items }, rows);
  return hit ? { id: hit.id, createdAt: hit.createdAt, total: hit.total } : null;
}
