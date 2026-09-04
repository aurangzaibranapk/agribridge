"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateProductImage } from "@/lib/ai/product-image-client";
import { logAudit } from "@/lib/audit";

/**
 * Cheez ki tasveer: banti AI se, LAGTI aadmi ke dekhne ke baad.
 *
 * Malik ka usool (5 September): "Never automatically publish hundreds of
 * generated images without review."
 *
 * Is liye do qadam alag rakhe gaye hain. Pehla qadam masoda banata hai
 * -- us se cheez par kuch nahi badalta. Doosra qadam wo masoda lagata
 * hai. Ek hi qadam rakhne se teen sau tasveerein ek dabane par chaRh
 * jatin, aur un mein se jo ghalat hoti wo teen sau jagah ghalat hoti --
 * aur counter par kisi ko ye shak bhi na hota ke tasveer banayi hui hai.
 *
 * DOOSRA USOOL: ASAL TASVEER KI JAGAH AI KI TASVEER KABHI NAHI. Jis
 * cheez par kisi ne asal tasveer lagayi hui hai, us par AI wali khud ba
 * khud nahi lagti -- us ke liye bande ko saaf kehna parta hai ke haan,
 * purani hata do. Aur us soorat mein purani ka pata bhi likha jata hai.
 */

export interface ImageState {
  error?: string;
  notice?: string;
  success?: boolean;
  bane?: number;
  nakaam?: number;
}

const CAN_GENERATE = ["owner", "super_admin", "admin", "manager"];
const CAN_APPROVE = ["owner", "super_admin", "admin", "manager"];

/** Ek dafa mein itni se zyada nahi. */
const BULK_LIMIT = 15;

async function gate(allowed: string[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null as string | null, ok: false };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  return { supabase, userId: user.id, ok: !!me?.is_active && allowed.includes(me.role) };
}

const paths = () => {
  revalidatePath("/admin/products/images");
  revalidatePath("/admin/products");
  revalidatePath("/admin/pos");
};

/**
 * Ek cheez ka masoda.
 *
 * Naam wali cheez (jis ka brand ya company darj ho) par AI se asal dabbe
 * ki tasveer nahi maangi jati -- sirf ek saada nishaan, bina kisi logo
 * aur bina kisi likhai ke. Ye faisla yahan hota hai, safhe par nahi.
 */
async function ekMasoda(productId: string, userId: string | null): Promise<{ ok: boolean; reason?: string }> {
  const service = createServiceClient();

  const { data: p } = await service
    .from("products")
    .select("id, name, pack_size, unit_code, brand_id, company_id, category_id, composition")
    .eq("id", productId)
    .maybeSingle();
  if (!p) return { ok: false, reason: "cheez nahi mili" };

  // Qism aur brand ka naam alag sawal se -- embed nakaam ho to wo khali
  // lauta deta hai, aur us soorat mein AI ko adhoori baat jati.
  const [{ data: cat }, { data: brand }] = await Promise.all([
    p.category_id
      ? service.from("categories").select("name").eq("id", p.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    p.brand_id ? service.from("brands").select("name").eq("id", p.brand_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const isBranded = !!p.brand_id || !!p.company_id;

  const made = await generateProductImage({
    name: p.name,
    category: (cat as { name?: string } | null)?.name ?? null,
    brand: (brand as { name?: string } | null)?.name ?? null,
    packSize: p.pack_size,
    unit: p.unit_code,
    description: p.composition,
    isBranded,
  });

  if (!made.base64) return { ok: false, reason: made.error ?? "tasveer nahi bani" };

  const bytes = Buffer.from(made.base64, "base64");
  const ext = made.mimeType?.includes("jpeg") ? "jpg" : "png";
  const path = `ai/${productId}/${Date.now()}.${ext}`;

  const { error: upErr } = await service.storage
    .from("products")
    .upload(path, bytes, { contentType: made.mimeType || "image/png", upsert: false });
  if (upErr) return { ok: false, reason: `tasveer mehfooz nahi hui: ${upErr.message}` };

  const { data: pub } = service.storage.from("products").getPublicUrl(path);

  const { error: insErr } = await service.from("product_image_drafts").insert({
    product_id: productId,
    image_url: pub.publicUrl,
    prompt: made.prompt ?? null,
    model: made.model ?? null,
    is_branded: isBranded,
    generated_by: userId,
  });
  if (insErr) return { ok: false, reason: insErr.message };

  return { ok: true };
}

export async function generateImageDraft(_prev: ImageState, formData: FormData): Promise<ImageState> {
  const { ok, userId } = await gate(CAN_GENERATE);
  if (!ok) return { error: "Tasveer banane ki ijazat sirf Owner, Admin ya Manager ke paas hai." };

  const productId = String(formData.get("product_id") ?? "");
  if (!productId) return { error: "Cheez ki shanakht nahi mili." };

  const res = await ekMasoda(productId, userId);
  if (!res.ok) return { error: res.reason ?? "tasveer nahi bani" };

  paths();
  return { success: true, notice: "Masoda ban gaya — dekh kar manzoor karein." };
}

/**
 * Bohat si cheezon ke masode ek sath.
 *
 * Ek dafa mein 15 se zyada nahi. Ye rok jaan boojh kar hai: har tasveer
 * paise aur waqt dono lagati hai, aur ek hi dabane par 300 banwa dena wo
 * qadam hai jis ka nateeja us waqt tak nazar nahi aata jab tak bill na
 * aa jaye. Baqi cheezein agli dafa.
 */
export async function generateMissingImages(_prev: ImageState, formData: FormData): Promise<ImageState> {
  const { ok, userId } = await gate(CAN_GENERATE);
  if (!ok) return { error: "Tasveer banane ki ijazat sirf Owner, Admin ya Manager ke paas hai." };

  const maanga = Number(formData.get("kitni") ?? 5);
  const kitni = Math.max(1, Math.min(Number.isFinite(maanga) ? maanga : 5, BULK_LIMIT));

  const service = createServiceClient();
  const { data: rows, error } = await service
    .from("v_products_missing_image")
    .select("product_id, open_draft_id")
    .is("open_draft_id", null)
    .limit(kitni);

  if (error) return { error: `Fehrist nahi mili: ${error.message}` };
  if (!rows || rows.length === 0) return { notice: "Koi cheez baqi nahi — sab ki tasveer ya masoda maujood hai." };

  let bane = 0;
  let nakaam = 0;
  let pehliWajah: string | null = null;

  for (const r of rows) {
    const res = await ekMasoda(r.product_id as string, userId);
    if (res.ok) bane += 1;
    else {
      nakaam += 1;
      if (!pehliWajah) pehliWajah = res.reason ?? null;
    }
  }

  paths();

  // Nakaam ki ginti aur PEHLI wajah dono batayi jati hain. Sirf "kuch
  // nahi bana" likh dena bande ko wahin bithha deta hai: chabi nahi
  // lagi, ya AI ne mana kiya, ya storage bhara hua -- teenon ka ilaj
  // alag hai.
  if (bane === 0) {
    return { error: `Ek bhi tasveer nahi bani. ${pehliWajah ?? ""}`.trim(), bane, nakaam };
  }
  return {
    success: true,
    bane,
    nakaam,
    notice:
      nakaam > 0
        ? `${bane} masode ban gaye, ${nakaam} nahi bane. Pehli wajah: ${pehliWajah ?? "maloom nahi"}`
        : `${bane} masode ban gaye — dekh kar manzoor karein.`,
  };
}

/**
 * Masoda manzoor -- ab ye tasveer cheez par lagegi.
 *
 * Jis cheez par pehle se ASAL tasveer lagi ho, us par ye khud ba khud
 * nahi lagti. Bande ko saaf kehna parta hai ke purani hata do -- aur
 * purani ka pata us masode par likh diya jata hai, taake "pehle kya laga
 * tha" ka jawab hamesha maujood rahe.
 */
export async function approveImageDraft(_prev: ImageState, formData: FormData): Promise<ImageState> {
  const { ok, userId } = await gate(CAN_APPROVE);
  if (!ok) return { error: "Tasveer manzoor karne ki ijazat sirf Owner, Admin ya Manager ke paas hai." };

  const draftId = String(formData.get("draft_id") ?? "");
  const replaceOk = formData.get("replace_ok") === "true";
  if (!draftId) return { error: "Masode ki shanakht nahi mili." };

  const service = createServiceClient();
  const { data: draft } = await service
    .from("product_image_drafts")
    .select("id, product_id, image_url, status")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { error: "Masoda nahi mila." };
  if (draft.status !== "draft") return { error: "Ye masoda pehle hi dekha ja chuka hai." };

  const { data: p } = await service
    .from("products")
    .select("id, name, image_url, image_source")
    .eq("id", draft.product_id)
    .maybeSingle();
  if (!p) return { error: "Cheez nahi mili." };

  const asalMaujood =
    !!p.image_url &&
    p.image_url.trim() !== "" &&
    ["uploaded", "supplier", "verified_catalog"].includes(p.image_source ?? "");

  if (asalMaujood && !replaceOk) {
    return {
      error:
        "Is cheez par pehle se ASAL tasveer lagi hui hai. AI ki banayi hui tasveer us ki jagah khud nahi lagti — pehle 'purani hata dein' par tick karein.",
    };
  }

  const { error: upErr } = await service
    .from("products")
    .update({ image_url: draft.image_url, image_source: "ai_generated" })
    .eq("id", draft.product_id);
  if (upErr) return { error: upErr.message };

  await service
    .from("product_image_drafts")
    .update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      replaced_image_url: p.image_url ?? null,
    })
    .eq("id", draftId);

  await logAudit({
    actionType: "approve",
    module: "products",
    recordId: draft.product_id,
    recordLabel: p.name,
    description: `AI ki banayi hui tasveer lagayi: ${p.name}`,
    changes: { tasveer: { pehle: p.image_url, ab: draft.image_url } },
  });

  paths();
  return { success: true, notice: "Tasveer lag gayi — POS par bhi nazar aayegi." };
}

export async function rejectImageDraft(_prev: ImageState, formData: FormData): Promise<ImageState> {
  const { ok, userId } = await gate(CAN_APPROVE);
  if (!ok) return { error: "Ye kaam sirf Owner, Admin ya Manager kar sakta hai." };

  const draftId = String(formData.get("draft_id") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!draftId) return { error: "Masode ki shanakht nahi mili." };

  const service = createServiceClient();
  // Masoda mitaya nahi jata, radd hota hai. Mita dene se ye sawal kabhi
  // nahi poocha ja sakta ke "AI ne kya banaya tha aur wo kyun radd hua".
  const { error } = await service
    .from("product_image_drafts")
    .update({ status: "rejected", reviewed_by: userId, reviewed_at: new Date().toISOString(), note })
    .eq("id", draftId)
    .eq("status", "draft");
  if (error) return { error: error.message };

  paths();
  return { success: true, notice: "Masoda radd kar diya gaya." };
}
