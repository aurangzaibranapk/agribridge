"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { ACC } from "@/lib/ledger/rules";
import { REASON_MIN } from "@/lib/ledger/stock-count";
import { requireAction } from "@/lib/access/guard";
import { logAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Ginti karte waqt hi product ka naam theek karna (malik, 14 September)
 * -- alag safhe par jane ki zaroorat nahi. Ijazat ka usool wahi hai jo
 * poore Products module mein hai: Owner/Admin ya "edit_needs_approval =
 * false" wale seedha badal dete hain; baaqi sab ki tajweez ban jati hai
 * (`product_edit_requests`), naam FORAN nahi badalta -- Admin ki
 * tasdeeq ka intezar rehta hai. `changes` mein sirf `name` hai, is liye
 * manzoori par sirf naam hi badlega, koi aur khana khali nahi hoga.
 */
export async function renameProductFromCount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const productId = String(formData.get("product_id") ?? "");
  if (!productId) return { error: "Product saaf nahi." };

  const newName = String(formData.get("new_name") ?? "").trim();
  if (newName.length < 2) return { error: "Naya naam likhein." };

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isUnrestricted = ["owner", "super_admin", "admin"].includes(me?.role ?? "");

  const { data: permission } = await supabase
    .from("staff_product_permissions")
    .select("can_edit, edit_needs_approval")
    .eq("profile_id", user.id)
    .maybeSingle();

  // Ginti ke dauran naam ki tajweez kabhi FLAT nahi rukni chahiye (malik,
  // 14 September: "ijazat to di thi, lakin approval admin ne dena thi").
  // Poore Products module mein "can_edit nahi to koi tajweez bhi nahi"
  // chalta hai -- yahan jaan boojh kar alag hai: jo bhi ginti kar raha
  // hai wo galat naam dekh sakta hai, is liye tajweez hamesha ban sakti
  // hai, sirf FORAN badalne (bina admin dekhe) ke liye can_edit +
  // edit_needs_approval=false dono chahiye.
  const skipApproval = isUnrestricted || (permission?.can_edit === true && permission?.edit_needs_approval === false);

  if (skipApproval) {
    const { error } = await supabase
      .from("products")
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (error) return { error: error.message };
    revalidatePath("/admin/stock-count");
    return { success: true, message: "Naam badal gaya." };
  }

  const { data: current } = await supabase.from("products").select("name").eq("id", productId).maybeSingle();
  const { error } = await supabase.from("product_edit_requests").insert({
    product_id: productId,
    proposed_by: user.id,
    changes: { name: newName },
    status: "pending",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/products/pending-edits");
  return {
    success: true,
    message: `Tajweez bhej di gayi ("${current?.name ?? "purana naam"}" → "${newName}") — Admin ki tasdeeq ka intezar hai, foran nahi badalega.`,
  };
}

/**
 * Ginti shuru karna.
 *
 * Isi lamhe do cheezein mahfooz ho jati hain: system ka adad, aur maal
 * ki qeemat. Dono ko baad mein badalne se database rok deta hai.
 *
 * Adad ab mahfooz karna zaroori hai kyunki ginti ke DAURAN bikri aur
 * kharid chalti rehti hai. Baad mein milaan karte waqt inventory se
 * poochhein to farq us cheez ka niklega jo ginti ke beech mein hui --
 * aur us ka ilzam ginne wale par aayega.
 *
 * Qeemat is liye mahfooz hoti hai ke kal rate badal jaye to purani
 * ginti ka nuqsan bhi badal jata -- yani guzra hua hisaab khud ba khud
 * badalta rehta. Ye sab se mushkil qism ki ghalti hai, kyunki koi is ko
 * dhoondta bhi nahi.
 */
export async function startCount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const warehouseId = String(formData.get("warehouse_id") ?? "");
  if (!warehouseId) return { error: "Godam select karein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const { data: existing } = await service
    .from("stock_counts")
    .select("id")
    .eq("warehouse_id", warehouseId)
    .eq("status", "counting")
    .maybeSingle();
  if (existing) return { error: "Is godam ki ek ginti pehle se khuli hai. Pehle wo mukammal karein." };

  const { data: stock } = await service
    .from("inventory")
    .select("id, product_id, quantity_on_hand, products(name, purchase_price, is_deleted)")
    .eq("warehouse_id", warehouseId);

  const rows = (stock ?? []).filter(
    (r) => !(r.products as { is_deleted: boolean } | null)?.is_deleted
  );

  if (rows.length === 0) {
    return { error: "Is godam mein koi maal darj nahi — ginne ke liye kuch nahi." };
  }

  const { data: header, error: headerError } = await service
    .from("stock_counts")
    .insert({ warehouse_id: warehouseId, started_by: user.id })
    .select("id")
    .single();
  if (headerError) return { error: headerError.message };

  const { error: lineError } = await service.from("stock_count_lines").insert(
    rows.map((r) => ({
      count_id: header.id,
      product_id: r.product_id,
      inventory_id: r.id,
      expected_qty: Number(r.quantity_on_hand),
      unit_cost: Number((r.products as { purchase_price: number } | null)?.purchase_price ?? 0),
    }))
  );
  if (lineError) return { error: lineError.message };

  revalidatePath("/admin/stock-count");
  return {
    success: true,
    message: `${rows.length} cheezon ki ginti shuru. System ka adad mahfooz ho gaya aur ab chhupa hua hai — jo aap ginein wohi likhein.`,
  };
}

/**
 * Ginti ke dauran koi cheez mile jo list mein hi nahi thi (malik,
 * 14 September) -- na naya product banane ka GRN chahiye, na koi
 * alag manzoori ka chakkar. Seedha Maal Andar jaisa: stock foran
 * barh jata hai, koi document nahi banta.
 *
 * Naam se milan pehle try hota hai (case-insensitive) -- agar wo
 * product pehle se hai (chahe kisi bhi godam mein), usi ka stock
 * badhta hai. Na mile to naya product ban jata hai.
 *
 * Isi ginti mein ek nayi qatar bhi ban jati hai (expected_qty=0),
 * taake milaan ke waqt ye cheez dikhe aur farq ki wajah ("list mein
 * nahi thi, mili") likhna lazmi ho -- kahin chup chaap na reh jaye.
 */
interface ExtraItemInput {
  name: string;
  quantity: number;
  purchasePrice: number | null;
}

/** Ek cheez ke liye asal kaam -- warehouse aur user pehle se tasdeeq shuda. */
async function addOneExtraItem(
  service: ReturnType<typeof createServiceClient>,
  countId: string,
  warehouseId: string,
  userId: string,
  item: ExtraItemInput
): Promise<{ ok: true; name: string; isNew: boolean } | { ok: false; error: string }> {
  const { name, quantity, purchasePrice } = item;

  // Naam se milan -- pehle se hai to usi ka stock badhta hai, naya
  // product nahi banta (do jagah ek hi cheez do naamon se na ho jaye).
  const { data: existing } = await service
    .from("products")
    .select("id")
    .ilike("name", name)
    .eq("is_deleted", false)
    .maybeSingle();

  let productId = existing?.id ?? null;

  if (!productId) {
    const { data: created, error: createErr } = await service
      .from("products")
      .insert({
        name,
        purchase_price: purchasePrice ?? 0,
        // Rate na diya ho to "Rate Baqi" ki fehrist mein khud aa jata
        // hai -- sifar likhna "ye muft aati hai" kehna hoga.
        trade_rate_pending: purchasePrice === null,
        // Ye form SALE rate kabhi poochta hi nahi (sirf trade/cost),
        // is liye selling_price hamesha 0 jata hai -- `sale_rate_pending`
        // zaroor TRUE hona chahiye, warna POS is 0 ko "waqai muft"
        // samajh kar counter par bech deta (252 ki wahi rok, agar flag
        // sahi na ho to kaam nahi karti).
        selling_price: 0,
        sale_rate_pending: true,
        is_verified: true,
        created_by: userId,
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return { ok: false, error: `"${name}": naya product nahi ban saka: ${createErr?.message ?? "wajah maloom nahi"}` };
    }
    productId = created.id;
  }

  const { data: existingInv } = await service
    .from("inventory")
    .select("id")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  let inventoryId = existingInv?.id ?? null;
  if (!inventoryId) {
    const { data: createdInv, error: invErr } = await service
      .from("inventory")
      .insert({ product_id: productId, warehouse_id: warehouseId })
      .select("id")
      .single();
    if (invErr || !createdInv) return { ok: false, error: `"${name}": warehouse mein stock ka khana nahi bana: ${invErr?.message}` };
    inventoryId = createdInv.id;
  }

  // "Extra Item" un cheezon ke liye hai jo list mein bilkul nahi thi --
  // agar ye product isi ginti mein pehle se ek qatar rakhta hai (chahe
  // khali ho ya gin li gayi ho), to usi qatar mein number likhna hai,
  // dobara "extra" se add karne se ek DOOSRI qatar ban jati jo ginti
  // khatam hone tak baaqi dikhti chahe pehli mein kuch aa chuka ho.
  const { data: existingLine } = await service
    .from("stock_count_lines")
    .select("id")
    .eq("count_id", countId)
    .eq("product_id", productId)
    .maybeSingle();
  if (existingLine) {
    return {
      ok: false,
      error: `"${name}" is ginti ki list mein pehle se hai — search se wo qatar dhoond kar seedha wahin adad likhein, "Extra Item" sirf naye/list-se-bahar maal ke liye hai.`,
    };
  }

  // Stock seedha nahi likha jata -- movement se hi hilta hai (129),
  // taake "ye kahan se aaya" ka nishan hamesha rahe. Isi waqt chalta
  // hai (foran istemal ho sake) -- is liye post karte waqt yahi adad
  // dobara na chala jaye, uska dhyan `postCount` mein rakha gaya hai
  // (pehle se hui harkat dhoond kar usi qadar ki kami karta hai).
  const { error: mvErr } = await service.from("stock_movements").insert({
    inventory_id: inventoryId,
    movement_type: "adjustment_increase",
    quantity,
    reference_type: "stock_count",
    reference_id: countId,
    notes: "Ginti ke dauran mila — list mein pehle nahi tha.",
    created_by: userId,
  });
  if (mvErr) return { ok: false, error: `"${name}": stock ki harkat darj nahi ho saki: ${mvErr.message}` };

  // Isi ginti ki apni nayi qatar -- taake milaan mein dikhe aur wajah
  // likhni paRe, chup chaap gum na ho. `expected_qty` ko yahan WOHI
  // (upar wali harkat ke BAAD ka) adad dena zaroori hai -- 0 likhne se
  // milaan ke waqt farq dobara "mila" gin leta aur stock DOBARA barh
  // jata (ek dafa yahan, ek dafa post karte waqt) -- wahi "do jagah,
  // ek hi fact" ghalti jo pehle machinery mein Rs 32,000 ka farq bana
  // chuki thi (313).
  const { data: freshInv } = await service
    .from("inventory")
    .select("quantity_on_hand")
    .eq("id", inventoryId)
    .single();
  const trueQty = Number(freshInv?.quantity_on_hand ?? quantity);

  const { error: lineErr } = await service.from("stock_count_lines").insert({
    count_id: countId,
    product_id: productId,
    inventory_id: inventoryId,
    expected_qty: trueQty,
    unit_cost: purchasePrice ?? 0,
    counted_qty: quantity,
    difference_qty: 0,
  });
  if (lineErr) return { ok: false, error: `"${name}": ginti ki qatar nahi ban saki: ${lineErr.message}` };

  return { ok: true, name, isNew: !existing };
}

/**
 * Ginti ke dauran koi cheez mile jo list mein hi nahi thi (malik,
 * 14 September) -- na naya product banane ka GRN chahiye, na koi
 * alag manzoori ka chakkar. Seedha Maal Andar jaisa: stock foran
 * barh jata hai, koi document nahi banta.
 *
 * Ek dafa mein ek se zyada cheez bhi darj ho sakti hain (malik ne
 * kaha "jitni add karna chahoon") -- form apni taraf se qataren jorta
 * hai, yahan sab ek sath "items" (JSON) mein aati hain.
 */
export async function addExtraCountItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const service = createServiceClient();
  const supabase = createClient();

  const countId = String(formData.get("count_id") ?? "");
  if (!countId) return { error: "Ginti nahi mili." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Cheezon ki fehrist saaf nahi." };
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: "Koi cheez darj nahi ki gayi." };
  }

  const items: ExtraItemInput[] = [];
  for (const raw of rawItems) {
    const r = raw as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    if (name.length < 2) return { error: "Har cheez ka naam likhein." };

    const quantity = Number(r.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `"${name}": kitni cheez mili, sahi adad likhein — sifar ya manfi nahi.` };
    }

    const rawRate = r.purchasePrice;
    const purchasePrice = rawRate === null || rawRate === "" || rawRate === undefined ? null : Number(rawRate);
    if (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) {
      return { error: `"${name}": rate sahi nahi likha gaya.` };
    }

    items.push({ name, quantity, purchasePrice });
  }

  const { data: count } = await service
    .from("stock_counts")
    .select("id, warehouse_id, status")
    .eq("id", countId)
    .maybeSingle();
  if (!count) return { error: "Ginti nahi mili." };
  if (count.status !== "counting") {
    return { error: "Ye ginti ab counting ke marhale mein nahi — extra cheez sirf khuli ginti mein darj ho sakti hai." };
  }

  // Sirf wahi banda jo isi godam ki ginti kar sakta hai -- ijazat wahi
  // do raaste jo page.tsx par hain (role ya zimmedari), warna koi bhi
  // logged-in banda kisi aur ki ginti mein cheez daal sakta.
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  const ROLES = ["owner", "super_admin", "admin", "manager", "finance", "warehouse"];
  const roleSeIjazat = Boolean(me?.is_active) && ROLES.includes(me?.role ?? "");
  if (!roleSeIjazat) {
    const { data: mereGodam } = await supabase.rpc("fn_stock_count_mere_godam");
    const zimmedar = (mereGodam ?? []).some((r) => r.warehouse_id === count.warehouse_id);
    if (!Boolean(me?.is_active) || !zimmedar) {
      return { error: "Is godam ki ginti mein aap ki ijazat nahi hai." };
    }
  }

  const done: string[] = [];
  const failed: string[] = [];
  for (const item of items) {
    const result = await addOneExtraItem(service, countId, count.warehouse_id, user.id, item);
    if (result.ok) done.push(`${result.name} (${result.isNew ? "naya" : "mojood"})`);
    else failed.push(result.error);
  }

  revalidatePath("/admin/stock-count");

  if (done.length === 0) {
    return { error: failed.join(" | ") };
  }
  return {
    success: true,
    message:
      `${done.length} cheez${done.length > 1 ? "en" : ""} darj ho gayi: ${done.join(", ")}.` +
      (failed.length > 0 ? ` (${failed.length} nahi ho saki: ${failed.join(" | ")})` : ""),
  };
}

/**
 * Gine hue adad bharna (ANDHI GINTI ka marhala).
 *
 * Yahan sirf gina hua adad aata hai. Farq ki baat is marhale mein hoti
 * hi nahi -- na screen par, na jawab mein. Farq abhi bata dein to agli
 * qatar par ginne wala pehle hi jaan jayega ke kya "hona chahiye".
 */
export async function saveCounts(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const service = createServiceClient();
  const countId = String(formData.get("count_id") ?? "");
  if (!countId) return { error: "Ginti nahi mili." };

  const { data: count } = await service
    .from("stock_counts")
    .select("id, status")
    .eq("id", countId)
    .maybeSingle();
  if (!count) return { error: "Ginti nahi mili." };
  if (count.status !== "counting") return { error: "Ye ginti mukammal ho chuki hai." };

  const { data: lines } = await service
    .from("stock_count_lines")
    .select("id, expected_qty")
    .eq("count_id", countId);

  let filled = 0;
  for (const line of lines ?? []) {
    const raw = formData.get(`qty_${line.id}`);
    if (raw === null || String(raw).trim() === "") continue;

    const counted = Number(raw);
    if (!Number.isFinite(counted) || counted < 0) {
      return { error: "Koi adad sahi nahi likha gaya — manfi ya khali nahi ho sakta." };
    }

    const difference = round2(counted - Number(line.expected_qty));
    const { error } = await service
      .from("stock_count_lines")
      .update({ counted_qty: counted, difference_qty: difference })
      .eq("id", line.id);
    if (error) return { error: error.message };
    filled += 1;
  }

  if (filled === 0) return { error: "Koi adad nahi likha gaya." };

  revalidatePath("/admin/stock-count");
  return { success: true, message: `${filled} qataren mahfooz. Sab bhar jayen to milaan karein.` };
}

/**
 * Tasdeeq -- Branch Manager ka kaam, sirf apni branch ki hadd tak.
 *
 * Malik (8 September): Kharche wala tareeqa (364) yahan bhi. Ye
 * inventory ya ledger ko haath nahi lagata -- sirf agla marhala kholta
 * hai. Post (neeche) hi wo jagah hai jahan asal maal/paisa hilta hai.
 */
export async function verifyCount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const countId = String(formData.get("count_id") ?? "");
  if (!countId) return { error: "Ginti nahi mili." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const guard = await requireAction("stock-count", "verify");
  if ("error" in guard) return { error: guard.error };
  const { caller } = guard;

  const { data: count } = await service
    .from("stock_counts")
    .select("id, status, started_by, warehouses(branch_id)")
    .eq("id", countId)
    .maybeSingle();
  if (!count) return { error: "Ginti nahi mili." };
  if (count.status !== "counting") {
    return { error: "Ye ab tasdeeq ke marhale mein nahi hai (pehle hi tasdeeq/post ho chuka)." };
  }

  const warehouseBranch = (count.warehouses as { branch_id: string } | null)?.branch_id ?? null;
  if (!caller.unrestricted && caller.scope !== "all") {
    if (!caller.branchId || warehouseBranch !== caller.branchId) {
      return { error: "Ye ginti aapki branch ki nahi hai — sirf apni branch ki tasdeeq kar sakte hain." };
    }
  }
  if (count.started_by === user.id) {
    return { error: "Apni shuru ki hui ginti khud tasdeeq nahi kar sakte — doosra authorized banda kare." };
  }

  const { data: lines } = await service.from("stock_count_lines").select("counted_qty").eq("count_id", countId);
  const unfilled = (lines ?? []).filter((l) => l.counted_qty === null);
  if (unfilled.length > 0) {
    return { error: `${unfilled.length} cheezen abhi gini nahi gayin. Tasdeeq se pehle poori ginti lazmi hai.` };
  }

  const { error } = await service
    .from("stock_counts")
    .update({ status: "verified", verified_by: user.id, verified_at: new Date().toISOString() })
    .eq("id", countId);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "verify",
    module: "stock-count",
    recordId: countId,
    description: "Branch Manager ki tasdeeq — ab Finance/Admin/Owner ki final post ka intezar.",
  });

  revalidatePath("/admin/stock-count");
  return { success: true, message: "Tasdeeq ho gayi — ab final post ka intezar hai." };
}

/**
 * Milaan aur mukammal karna.
 *
 * Ab dono adad saamne aate hain. Jahan farq ho wahan wajah lazmi hai.
 * Us ke baad teen kaam ek sath hote hain:
 *
 *   1. Inventory gine hue adad par set hoti hai (kyunki asal wohi hai).
 *   2. stock_movements mein nishan padta hai -- taake maal ka safar
 *      poora nazar aaye.
 *   3. Nuqsan ya izafa ledger mein jata hai. Ye teesra kaam sab se ahem
 *      hai: is ke baghair inventory to theek ho jati magar us maal ki
 *      qeemat kahin se ghayab ho jati -- yani kaghaz par kaarobar us se
 *      zyada munafa dikhata jitna hua.
 *
 * Malik ka #1 kaam: yahan pehle koi permission check hi nahi tha --
 * kisi bhi logged-in bande ko rok nahi sakti thi (272 ka role-table
 * faisla sirf kaghaz par tha, code kabhi poochta hi nahi tha).
 */
export async function postCount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const countId = String(formData.get("count_id") ?? "");
  if (!countId) return { error: "Ginti nahi mili." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const guard = await requireAction("stock-count", "approve");
  if ("error" in guard) return { error: guard.error };

  const { data: count } = await service
    .from("stock_counts")
    .select("id, status, warehouse_id, warehouses(name, branch_id)")
    .eq("id", countId)
    .maybeSingle();
  if (!count) return { error: "Ginti nahi mili." };
  if (count.status !== "counting" && count.status !== "verified") {
    return { error: "Ye ginti pehle hi mukammal ho chuki hai." };
  }

  const { data: lines } = await service
    .from("stock_count_lines")
    .select("id, product_id, inventory_id, expected_qty, counted_qty, difference_qty, unit_cost, reason, products(name)")
    .eq("count_id", countId);

  const rows = lines ?? [];
  const unfilled = rows.filter((r) => r.counted_qty === null);
  if (unfilled.length > 0) {
    // Admin/Owner force-close: jo cheezein nahi gini unhen expected_qty par set karo
    // (counted = expected, farq = 0, koi wajah ki zaroorat nahi)
    await Promise.all(
      unfilled.map((r) =>
        service
          .from("stock_count_lines")
          .update({ counted_qty: r.expected_qty ?? 0, difference_qty: 0 })
          .eq("id", r.id)
      )
    );
    for (const r of rows) {
      if (r.counted_qty === null) {
        (r as typeof r & { counted_qty: number; difference_qty: number }).counted_qty = r.expected_qty ?? 0;
        (r as typeof r & { counted_qty: number; difference_qty: number }).difference_qty = 0;
      }
    }
  }

  // Wajah har us qatar par jahan farq hai.
  const missingReason: string[] = [];
  const updates: { id: string; reason: string; value: number }[] = [];

  for (const line of rows) {
    const diff = Number(line.difference_qty ?? 0);
    const reason = String(formData.get(`reason_${line.id}`) ?? "").trim();
    const name = (line.products as { name: string } | null)?.name ?? "—";

    if (diff === 0) continue;
    if (reason.length < REASON_MIN) {
      missingReason.push(name);
      continue;
    }
    updates.push({ id: line.id, reason, value: round2(diff * Number(line.unit_cost)) });
  }

  if (missingReason.length > 0) {
    return {
      error: `In cheezon ka farq bina wajah ke nahi chhora ja sakta: ${missingReason.join(", ")}. "Shayad kam aayi thi" likhna bhi kaafi hai; kuch na likhna kaafi nahi.`,
    };
  }

  // Nuqsan aur izafa alag alag gine jate hain. Sirf net dikhayein to
  // "paanch bori kam, paanch zyada" barabar nazar aata hai -- jab ke wo
  // do alag masle hain, aur dono par sawal banta hai.
  let shortValue = 0;
  let overValue = 0;
  for (const u of updates) {
    if (u.value < 0) shortValue += Math.abs(u.value);
    else overValue += u.value;
  }
  shortValue = round2(shortValue);
  overValue = round2(overValue);
  const netValue = round2(overValue - shortValue);

  let entryId: string | null = null;
  if (shortValue !== 0 || overValue !== 0) {
    const journalLines: Array<{ account: string; debit?: number; credit?: number; memo?: string }> = [];
    if (shortValue > 0) {
      journalLines.push({ account: ACC.stockLoss, debit: shortValue, memo: "Ginti mein maal kam nikla" });
      journalLines.push({ account: ACC.stockGoods, credit: shortValue, memo: "Stock ghata" });
    }
    if (overValue > 0) {
      journalLines.push({ account: ACC.stockGoods, debit: overValue, memo: "Stock barha" });
      journalLines.push({ account: ACC.stockLoss, credit: overValue, memo: "Ginti mein maal zyada nikla" });
    }

    const posted = await postJournal({
      description: `Maal ki ginti — ${(count.warehouses as { name: string } | null)?.name ?? "godam"}`,
      sourceModule: "stock_count",
      sourceId: countId,
      branchId: (count.warehouses as { branch_id: string } | null)?.branch_id ?? null,
      createdBy: user.id,
      lines: journalLines,
    });
    if ("error" in posted) return { error: `Nuqsan ledger mein darj nahi ho saka: ${posted.error}` };
    entryId = posted.id;
  }

  for (const u of updates) {
    await service
      .from("stock_count_lines")
      .update({ reason: u.reason, difference_value: u.value })
      .eq("id", u.id);
  }

  // Inventory ab gine hue adad par. Asal wohi hai jo godam mein para
  // hai, wo nahi jo kaghaz par likha tha.
  const INCREASE_TYPES = new Set(["purchase_in", "transfer_in", "adjustment_increase", "return_in"]);
  for (const line of rows) {
    const diff = Number(line.difference_qty ?? 0);
    if (diff === 0 || !line.inventory_id) continue;
    const counted = Number(line.counted_qty);

    // Ginti seedha nahi likhi jati -- neeche wali adjustment daalte hi
    // trigger khud ginti gine hue adad par le aata hai (129). Pehle dono
    // kaam hote the, yani farq dugna lag jata tha.
    void counted;

    // "Extra Item" (ginti ke dauran mila) apna stock USI WAQT chala
    // deta hai, taake foran istemal ho sake -- is liye us qatar ka
    // stock yahan DOBARA nahi chalna chahiye. Isi ginti (countId) aur
    // isi inventory_id par pehle se koi harkat ho chuki ho to us ki
    // qadar minus kar ke sirf BAQI (agar staff ne baad mein adad theek
    // kiya ho) chalayen -- poori dobara nahi.
    const { data: already } = await service
      .from("stock_movements")
      .select("movement_type, quantity")
      .eq("inventory_id", line.inventory_id)
      .eq("reference_type", "stock_count")
      .eq("reference_id", countId);
    const alreadyApplied = (already ?? []).reduce(
      (sum, m) => sum + (INCREASE_TYPES.has(m.movement_type) ? 1 : -1) * Number(m.quantity),
      0
    );
    const remaining = round2(diff - alreadyApplied);
    if (remaining === 0) continue;

    await service.from("stock_movements").insert({
      inventory_id: line.inventory_id,
      movement_type: remaining < 0 ? "adjustment_decrease" : "adjustment_increase",
      quantity: Math.abs(remaining),
      reference_type: "stock_count",
      reference_id: countId,
      notes: updates.find((u) => u.id === line.id)?.reason ?? "Ginti se milaan",
      created_by: user.id,
    });
  }

  const { error } = await service
    .from("stock_counts")
    .update({
      status: "posted",
      posted_by: user.id,
      posted_at: new Date().toISOString(),
      total_difference_value: netValue,
      journal_entry_id: entryId,
    })
    .eq("id", countId);
  if (error) return { error: error.message };

  revalidatePath("/admin/stock-count");
  revalidatePath("/admin/money-trail");
  revalidatePath("/admin/inventory");

  return {
    success: true,
    message:
      updates.length === 0
        ? "Ginti mukammal — koi farq nahi nikla."
        : `Ginti mukammal. ${updates.length} cheezon mein farq mila: Rs ${shortValue.toLocaleString()} ka maal kam, Rs ${overValue.toLocaleString()} ka zyada. Nuqsan "Stock ka nuqsan" khate mein chala gaya.`,
  };
}

/**
 * Milan (Review) se pehle rate theek karna -- malik (15 September):
 * "Extra Item" se joRi gayi cheez ka rate ulta likha gaya tha (jaise
 * "surfexcel" Rs 9, jab ke asal Rs 250+ hai) -- ye rate seedha Milan ke
 * journal entry (Stock Loss/Stock Goods) mein chala jata hai, is liye
 * ghalat rehne se asal hisaab bhi ghalat ban jata.
 *
 * `stock_count_lines.unit_cost` seedhi UPDATE se mehfooz hai
 * (`fn_stock_count_guard`) -- ye action ek tang, SECURITY DEFINER
 * raaste (`fn_correct_stock_count_unit_cost`) se guzarta hai jo sirf
 * Owner/Admin ko, sirf jab tak ginti posted na ho, wajah ke sath
 * ijazat deta hai, aur audit mein likh deta hai.
 */
export async function correctStockCountRate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  const lineId = String(formData.get("line_id") ?? "");
  const newRate = Number(formData.get("new_rate") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!lineId) return { error: "Qatar saaf nahi." };
  if (!Number.isFinite(newRate) || newRate < 0) return { error: "Sahi rate likhein." };
  if (note.length < 5) return { error: "Wajah likhein (kam az kam 5 huroof) — rate kyun theek kiya ja raha hai." };

  const { error } = await supabase.rpc("fn_correct_stock_count_unit_cost", {
    p_line_id: lineId,
    p_new_unit_cost: newRate,
    p_note: note,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/stock-count");
  return { success: true, message: `Rate theek ho gaya — ab Rs ${newRate.toLocaleString()}.` };
}
