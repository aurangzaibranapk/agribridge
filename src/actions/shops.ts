"use server";
import { revalidatePath } from "next/cache";
import { profileKaKhanaBadlein } from "@/lib/profile-write";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

/**
 * Dukanon ka intezam.
 *
 * Malik ka kehna (4 September): "mjhy bhi dell ki edit ki suspend ki
 * active in active ki idr kr dain sath".
 *
 * Usi raat ek asal khatra saamne aaya: `deleteShop` mein na koi ijazat
 * ki rok thi, na is baat ki jaanch ke us dukan ke godam mein maal para
 * hai ya nahi. Ek dukan ke godam mein poore din ka maal tha -- 2293
 * cheezein. Wo haath se bachi, code se nahi.
 *
 * Ab do taale hain:
 *   1. Yahan -- kaun kar sakta hai (ijazat).
 *   2. Database par (291) -- jis dukan ke peeche maal, bikri ya mulazim
 *      khaRe hon wo mit hi nahi sakti.
 *
 * Safha ek darwaza hai; database har darwaze ke peeche hai. Sirf safhe
 * par rok lagana wo rok hai jo doosre raaste se hat jati hai.
 */

export interface ActionState {
  error?: string;
  success?: boolean;
}

const BUSINESS_TYPES = ["karyana", "agri_inputs", "grain_procurement", "dairy", "machinery_fleet", "vet", "central"];
const STATUSES = ["active", "inactive", "suspended"];

/** Dukan banane, badalne aur halat badalne ka haq. */
const CAN_MANAGE = ["owner", "super_admin", "admin"];
/** Mitane ka haq -- is se aage koi nahi. */
const CAN_DELETE = ["owner", "super_admin", "admin"];

async function gate(allowed: string[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null as string | null, ok: false };

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  return { supabase, userId: user.id, ok: !!me?.is_active && allowed.includes(me.role) };
}

export async function createShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, ok } = await gate(CAN_MANAGE);
  if (!ok) return { error: "Ye kaam sirf Owner ya Admin kar sakta hai." };

  const name = String(formData.get("name") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "");
  const businessType = String(formData.get("business_type") ?? "");
  const code = (formData.get("code") as string) || null;

  if (!name) return { error: "Shop ka naam zaroori hai." };
  if (!branchId) return { error: "Branch select karein." };
  if (!BUSINESS_TYPES.includes(businessType)) return { error: "Business type sahi select karein." };

  const { data: branch } = await supabase.from("branches").select("organization_id").eq("id", branchId).single();
  if (!branch) return { error: "Branch nahi mili." };

  const { data: created, error } = await supabase
    .from("shops")
    .insert({
      name,
      branch_id: branchId,
      organization_id: branch.organization_id,
      business_type: businessType,
      code,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    actionType: "create",
    module: "shops",
    recordId: created?.id,
    recordLabel: name,
    description: `Nayi dukan banayi: ${name}`,
  });

  revalidatePath("/admin/shops");
  return { success: true };
}

/**
 * Dukan ka naam, code, shaakh aur qism badalna.
 *
 * Badle hue khane audit mein likhe jate hain -- "ye pehle kya tha" wo
 * sawal hai jo baad mein poocha jata hai, aur poori qatar likh dene se
 * us ka jawab nahi milta.
 */
export async function updateShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, ok } = await gate(CAN_MANAGE);
  if (!ok) return { error: "Ye kaam sirf Owner ya Admin kar sakta hai." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "");
  const businessType = String(formData.get("business_type") ?? "");
  const code = String(formData.get("code") ?? "").trim() || null;

  if (!id) return { error: "Dukan ki shanakht nahi mili." };
  if (!name) return { error: "Shop ka naam zaroori hai." };
  if (!branchId) return { error: "Branch select karein." };
  if (!BUSINESS_TYPES.includes(businessType)) return { error: "Business type sahi select karein." };

  const { data: pehle } = await supabase
    .from("shops")
    .select("name, code, branch_id, business_type")
    .eq("id", id)
    .maybeSingle();
  if (!pehle) return { error: "Dukan nahi mili." };

  const { data: branch } = await supabase.from("branches").select("organization_id").eq("id", branchId).single();
  if (!branch) return { error: "Branch nahi mili." };

  const { error } = await supabase
    .from("shops")
    .update({ name, code, branch_id: branchId, business_type: businessType, organization_id: branch.organization_id })
    .eq("id", id);
  if (error) return { error: error.message };

  const changes: Record<string, { pehle: unknown; ab: unknown }> = {};
  if (pehle.name !== name) changes.naam = { pehle: pehle.name, ab: name };
  if ((pehle.code ?? null) !== code) changes.code = { pehle: pehle.code, ab: code };
  if (pehle.branch_id !== branchId) changes.shaakh = { pehle: pehle.branch_id, ab: branchId };
  if (pehle.business_type !== businessType) changes.qism = { pehle: pehle.business_type, ab: businessType };

  await logAudit({
    actionType: "update",
    module: "shops",
    recordId: id,
    recordLabel: name,
    description: `Dukan ki tafseel badli: ${name}`,
    changes,
  });

  revalidatePath("/admin/shops");
  return { success: true };
}

/**
 * Halat badalna: chal rahi / band / roki gayi.
 *
 * "Band" aur "roki gayi" ek cheez nahi. Band dukan apni marzi se band
 * hai (mausam, abhi khuli nahi). Roki gayi dukan kisi faisle se ruki
 * hai -- aur us faisle ki wajah likhi jati hai, warna do mahine baad
 * koi nahi bata sakta ke ye kyun bandh hui thi.
 *
 * `is_active` yahan haath se nahi likha jata -- wo halat se database ka
 * trigger khud banata hai (291). Do jagah alag likhne se kisi din wo do
 * alag baat kehne lagte hain.
 */
export async function updateShopStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, userId, ok } = await gate(CAN_MANAGE);
  if (!ok) return { error: "Ye kaam sirf Owner ya Admin kar sakta hai." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Dukan ki shanakht nahi mili." };

  // Purana safha sirf is_active bhejta tha; naya safha status bhejta
  // hai. Dono chalte rehte hain taake koi raasta toota na rahe.
  const rawStatus = String(formData.get("status") ?? "").trim();
  const status = rawStatus || (formData.get("is_active") === "true" ? "active" : "inactive");
  if (!STATUSES.includes(status)) return { error: "Halat sahi nahi." };

  const reason = String(formData.get("suspend_reason") ?? "").trim();
  if (status === "suspended" && !reason) {
    return { error: "Dukan rokne ki wajah likhna zaroori hai." };
  }

  const { data: pehle } = await supabase.from("shops").select("name, status").eq("id", id).maybeSingle();
  if (!pehle) return { error: "Dukan nahi mili." };

  const patch: Record<string, unknown> = { status };
  if (status === "suspended") {
    patch.suspend_reason = reason;
    patch.suspended_at = new Date().toISOString();
    patch.suspended_by = userId;
  }

  const { error } = await supabase.from("shops").update(patch).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "update",
    module: "shops",
    recordId: id,
    recordLabel: pehle.name,
    description:
      status === "suspended"
        ? `Dukan roki gayi: ${pehle.name} — wajah: ${reason}`
        : `Dukan ki halat: ${pehle.name} — ${status}`,
    changes: { halat: { pehle: pehle.status, ab: status } },
  });

  revalidatePath("/admin/shops");
  return { success: true };
}

/**
 * Dukan mitana.
 *
 * Database ki rok (291) pehle chalti hai: maal, bikri ya mulazim hon to
 * wo khud rok deti hai aur saaf Roman mein wajah batati hai. Wo paighaam
 * yahan se seedha aage bheja jata hai -- apne alfaz mein dobara likhne
 * se asal wajah gum ho jati hai.
 */
export async function deleteShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, ok } = await gate(CAN_DELETE);
  if (!ok) return { error: "Dukan mitane ka haq sirf Owner ya Admin ke paas hai." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Dukan ki shanakht nahi mili." };

  const { data: shop } = await supabase.from("shops").select("name").eq("id", id).maybeSingle();
  const naam = shop?.name ?? id;

  /**
   * Mitana chalta hai -- magar HISAAB kabhi nahi mitta.
   *
   * Malik (6 September): *"main agar delete karna chahta hoon to ho
   * jana chahiye."* Us waqt safha ye jawab de raha tha:
   *
   *     update or delete on table "shops" violates foreign key
   *     constraint "products_shop_id_fkey" on table "products"
   *
   * Wo jawab do wajah se bura tha: banda samajh nahi pata ke kya karna
   * hai, aur us mein ye farq bhi nahi ke kya ROKA ja raha hai.
   *
   * Do alag cheezein hain:
   *
   *   * **Juri hui cheezein** -- product, gahak, bande, godam. Ye dukan
   *     ke sath BANDHI hui hain, us ka hisaab nahi. Inhen khol dena
   *     mehfooz hai: product apni jagah rehta hai, bas kisi dukan ka
   *     nahi rehta.
   *
   *   * **Hisaab** -- bikri, kharid, stock, kharche ki darkhwastein.
   *     Ye us dukan ke KAAM ka record hai. Ye mitane ka matlab hai
   *     kitab se ek hissa gayab kar dena, aur wo is nizam mein kabhi
   *     nahi hota (wohi usool jo ledger par hai).
   *
   * Is liye: hisaab ho to mitne se saaf inkaar aur "Band karein" ka
   * mashwara. Hisaab na ho to juri hui cheezein khol kar dukan mit jati
   * hai.
   */
  const [bikri, puraniBikri, kharid, kharche, stock] = await Promise.all([
    supabase.from("pos_sales").select("id", { count: "exact", head: true }).eq("shop_id", id),
    supabase.from("sales").select("id", { count: "exact", head: true }).eq("shop_id", id),
    supabase.from("purchases").select("id", { count: "exact", head: true }).eq("shop_id", id),
    supabase.from("company_expense_requests").select("id", { count: "exact", head: true }).eq("shop_id", id),
    supabase.from("inventory").select("id", { count: "exact", head: true }).eq("shop_id", id).gt("quantity_on_hand", 0),
  ]);

  // Database ka apna guard (291) stock DUKAN KE GODAM se ginta hai, na
  // ke `inventory.shop_id` se. Dono raaste dekhne paRte hain -- warna
  // hamari jaanch guzar jati aur database ka raw paighaam saamne aa
  // jata, jo bilkul wohi cheez thi jis se malik uljhe.
  const { data: mereGodam } = await supabase.from("warehouses").select("id").eq("shop_id", id);
  let godamKaMaal = 0;
  if ((mereGodam ?? []).length > 0) {
    const { data: rows } = await supabase
      .from("inventory")
      .select("quantity_on_hand")
      .in("warehouse_id", (mereGodam ?? []).map((w) => w.id));
    godamKaMaal = (rows ?? []).reduce((sum, r) => sum + Number(r.quantity_on_hand ?? 0), 0);
  }

  const hisaab: string[] = [];
  if ((bikri.count ?? 0) > 0) hisaab.push(`${bikri.count} bikri`);
  if ((puraniBikri.count ?? 0) > 0) hisaab.push(`${puraniBikri.count} purani bikri`);
  if ((kharid.count ?? 0) > 0) hisaab.push(`${kharid.count} kharid`);
  if ((kharche.count ?? 0) > 0) hisaab.push(`${kharche.count} kharche ki darkhwast`);
  if ((stock.count ?? 0) > 0) hisaab.push(`${stock.count} cheezon ka stock`);
  if (godamKaMaal !== 0) hisaab.push(`godam mein ${godamKaMaal} maal`);

  if (hisaab.length > 0) {
    return {
      error: `${naam} ka hisaab maujood hai (${hisaab.join(", ")}) — is liye ye mitayi nahi ja sakti. Mitane ka matlab hota kitab se ye hissa gayab kar dena. Is dukan par kaam band karna ho to "Band karein" istemal karein: wo har jagah se hat jayegi, magar us ka purana hisaab apni jagah rahega.`,
    };
  }

  // Hisaab nahi hai -- ab sirf juRi hui cheezein kholni hain.
  const service = createServiceClient();
  await Promise.all([
    service.from("products").update({ shop_id: null }).eq("shop_id", id),
    service.from("customers").update({ shop_id: null }).eq("shop_id", id),
    service.from("profiles").update({ shop_id: null }).eq("shop_id", id),
    service.from("warehouses").update({ shop_id: null }).eq("shop_id", id),
    // Khali stock ki qatarein -- in mein kuch para hi nahi (upar jaanch
    // ho chuki), is liye inhen rakhna kisi kaam ka nahi.
    service.from("inventory").delete().eq("shop_id", id),
  ]);

  const { error } = await supabase.from("shops").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    actionType: "delete",
    module: "shops",
    recordId: id,
    recordLabel: naam,
    description: `Dukan mitayi: ${naam} — us se juRi cheezein (product, gahak, bande, godam) khol di gayin; koi hisaab nahi tha.`,
  });

  revalidatePath("/admin/shops");
  return { success: true };
}

export async function assignUserShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, ok } = await gate(CAN_MANAGE);
  if (!ok) return { error: "Ye kaam sirf Owner ya Admin kar sakta hai." };

  const userId = String(formData.get("user_id") ?? "");
  const shopId = (formData.get("shop_id") as string) || null;
  if (!userId) return { error: "Missing user id." };

  // Service client se, aur tasdeeq ke sath -- wajah `lib/profile-write.ts`
  // mein likhi hai: `profiles` par badalne ka koi RLS qanoon hai hi nahi,
  // is liye user wale client se ye update chup chaap 0 qatarein badalta
  // tha aur safha "ho gaya" keh deta tha.
  const res = await profileKaKhanaBadlein(userId, { shop_id: shopId });
  if (res.error) return { error: res.error };

  await logAudit({
    actionType: "update",
    module: "user_shop",
    recordId: userId,
    description: shopId ? `Dukan lagai: ${shopId}` : "Dukan hata di (poori shaakh)",
  });

  revalidatePath("/admin/users");
  return { success: true };
}
