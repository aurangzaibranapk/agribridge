"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateGeminiText } from "@/lib/ai/gemini-text-client";
import { aiKeyOrNull, AI_KEY_MISSING } from "@/lib/ai/ai-failure";
import { logAudit } from "@/lib/audit";

/**
 * "Jis cheez ki qism darj nahi -- AI tajweez de, hum OK karein."
 *
 * Malik ka kehna (5 September): *"jo jo products bahar hain, AI ko yahan
 * hona chahiye. Us ko hum command dein to wo un products ka, jo un ki
 * category banti hai, us mein move ka DRAFT banaye -- phir hum check kar
 * ke us ko OK karein."*
 *
 * 52 cheezein aisi thin jin par maal para tha (Rs 91,545) magar qism
 * darj nahi thi -- is liye wo kisi bhi qism ke safhe par nazar hi nahi
 * aati thin. Ek ek kar ke 52 cheezon ki qism haath se lagana wo kaam hai
 * jo koi nahi karta, aur isi liye ye masla mahinon chalta raha.
 *
 * -------------------------------------------------------------------
 * AI YAHAN KUCH MEHFOOZ NAHI KARTA.
 *
 * Ye is project ka pehle se tay shuda usool hai aur yahan bhi wohi
 * chalta hai: AI sirf TAJWEEZ deta hai. Qatar tab badalti hai jab banda
 * us tajweez par nishan laga kar "OK" dabata hai -- aur us waqt bhi
 * ijazat ki purani rok (Admin/Owner) apni jagah rehti hai.
 *
 * Do baatein jaan boojh kar:
 *
 * 1. **AI nayi qism nahi bana sakta.** Usay sirf MAUJOODA qismon ki
 *    fehrist di jati hai aur wohi mein se chunna parta hai. Warna wo
 *    "Snacks", "Snack", "Snacks & Chips" jaisi teen qismein bana deta
 *    aur masla pehle se bara ho jata.
 *
 * 2. **Jis cheez par bharosa na ho, us ko chhor deta hai.** Har tajweez
 *    ke sath `yaqeen` (pakka / shayad) aata hai. "Shayad" wali qatar par
 *    nishan khud se nahi lagta -- banda khud lagata hai. Andaze ko
 *    yaqeen ki tarah pesh karna is project mein pehle bhi ghalat adad de
 *    chuka hai.
 */

export interface Tajweez {
  productId: string;
  productName: string;
  stock: number;
  categoryId: string;
  categoryName: string;
  yaqeen: "pakka" | "shayad";
  wajah: string;
}

export interface SuggestState {
  error?: string;
  notice?: string;
  tajaweez?: Tajweez[];
  /** Jin par AI kuch tay na kar saka -- inhen chhupaya nahi jata. */
  naMaloom?: { productId: string; productName: string }[];
}

const ALLOWED = ["owner", "super_admin", "admin"];

async function gate() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." as const };
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return { error: "Sirf Admin/Owner qism badal sakta hai." as const };
  }
  return { userId: user.id };
}

/**
 * Qadam 1 -- AI se draft.
 *
 * Kuch mehfooz nahi hota. Sirf ek fehrist wapas aati hai jo safhe par
 * dikhti hai.
 */
export async function suggestCategories(_prev: SuggestState, _formData: FormData): Promise<SuggestState> {
  const g = await gate();
  if ("error" in g) return { error: g.error };
  if (!aiKeyOrNull()) return { error: AI_KEY_MISSING };

  const service = createServiceClient();

  const [{ data: products }, { data: categories }] = await Promise.all([
    service
      .from("products")
      .select("id, name, pack_size, unit")
      .is("category_id", null)
      .eq("is_deleted", false)
      .order("name")
      .limit(200),
    service.from("categories").select("id, name, category_kind").order("name"),
  ]);

  if (!products || products.length === 0) {
    return { notice: "Har cheez ki qism pehle se darj hai — kuch baqi nahi." };
  }
  if (!categories || categories.length === 0) {
    return { error: "Koi qism bani hi nahi. Pehle Categories ke safhe par qismein banayein." };
  }

  // Stock alag se -- taake fehrist mein wo cheezein upar aayein jin par
  // waqai maal para hai.
  const ids = products.map((p) => p.id);
  const { data: inv } = await service
    .from("inventory")
    .select("product_id, quantity_on_hand")
    .in("product_id", ids);
  const stockBy = new Map<string, number>();
  for (const r of inv ?? []) {
    stockBy.set(r.product_id as string, (stockBy.get(r.product_id as string) ?? 0) + Number(r.quantity_on_hand));
  }

  const catList = categories.map((c) => `${c.id} = ${c.name} (${c.category_kind})`).join("\n");
  const prodList = products
    .map((p) => `${p.id} = ${p.name}${p.pack_size ? ` (${p.pack_size})` : ""}`)
    .join("\n");

  const prompt = `Aap ek Pakistani karyana aur zarai store ke ERP mein kaam kar rahe hain.

Neeche MAUJOODA qismein (category) hain. Har qatar "id = naam (kind)" ki shakal mein hai:
${catList}

Aur ye wo products hain jin ki qism darj nahi. Har qatar "id = naam" ki shakal mein hai:
${prodList}

Har product ke liye upar wali fehrist mein se SAB SE MUNASIB qism chunein.

Qawaid:
- Sirf upar di gayi qismon ki id istemal karein. Nayi qism NAHI banani.
- Jis product ki qism par aap ko yaqeen na ho, usay "shayad" likhein.
- Jis product ka koi munasib qism maujood hi na ho, usay bilkul chhor dein (jawab mein na daalein).
- Pakistani bazaar ke aam naam samjhein (misal: "capstan" = cigarette, "Rin" = detergent/soap, "Lays" = snacks, "sunsilk" = shampoo, "vital" = tea).

Jawab SIRF JSON array mein dein, aur kuch nahi:
[{"p":"product-id","c":"category-id","y":"pakka","w":"chhoti wajah Roman Urdu mein"}]

"y" sirf "pakka" ya "shayad" ho sakta hai.`;

  const raw = await generateGeminiText(prompt);
  if (!raw) return { error: "AI se jawab nahi aaya. Thori der baad dobara koshish karein." };

  // AI aksar jawab ko ```json ... ``` mein lapet deta hai.
  const jsonText = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = jsonText.indexOf("[");
  const end = jsonText.lastIndexOf("]");
  if (start === -1 || end === -1) {
    return { error: "AI ka jawab samajh nahi aaya. Dobara koshish karein." };
  }

  let parsed: { p?: string; c?: string; y?: string; w?: string }[];
  try {
    parsed = JSON.parse(jsonText.slice(start, end + 1));
  } catch {
    return { error: "AI ka jawab samajh nahi aaya. Dobara koshish karein." };
  }

  const catById = new Map(categories.map((c) => [c.id as string, c.name as string]));
  const prodById = new Map(products.map((p) => [p.id as string, p.name as string]));

  const tajaweez: Tajweez[] = [];
  const dekhe = new Set<string>();

  for (const row of parsed) {
    const pid = String(row.p ?? "");
    const cid = String(row.c ?? "");
    // AI ki di hui id ASAL fehrist se milani zaroori hai. Bina milaye
    // maan lena wo darwaza hai jahan se bani banai id andar aa jati hai.
    if (!prodById.has(pid) || !catById.has(cid)) continue;
    if (dekhe.has(pid)) continue;
    dekhe.add(pid);
    tajaweez.push({
      productId: pid,
      productName: prodById.get(pid)!,
      stock: stockBy.get(pid) ?? 0,
      categoryId: cid,
      categoryName: catById.get(cid)!,
      yaqeen: row.y === "pakka" ? "pakka" : "shayad",
      wajah: String(row.w ?? "").slice(0, 120),
    });
  }

  // Jis par AI kuch tay na kar saka -- wo chhupti nahi. Khali jagah ko
  // "kuch nahi tha" samajh lena is project ki purani ghalti hai.
  const naMaloom = products
    .filter((p) => !dekhe.has(p.id as string))
    .map((p) => ({ productId: p.id as string, productName: p.name as string }));

  // Jis par maal para hai wo upar.
  tajaweez.sort((a, b) => b.stock - a.stock);

  return {
    tajaweez,
    naMaloom,
    notice: `${tajaweez.length} tajweez taiyar hain${naMaloom.length ? `, aur ${naMaloom.length} par AI kuch tay nahi kar saka` : ""}. Dekh kar nishan lagayein, phir "Manzoor karein".`,
  };
}

/**
 * Qadam 2 -- jin par banda nishan lagaye, sirf wohi darj.
 *
 * Yahan AI ka koi taalluq nahi. Jo `chune` mein aaya wohi likha jata
 * hai, aur har qatar ka nishan audit mein jata hai -- taake kal ko ye
 * sawal jawab paye ke ye qism kis ne, kab aur kis ki tajweez par lagai.
 */
export async function applyCategorySuggestions(_prev: SuggestState, formData: FormData): Promise<SuggestState> {
  const g = await gate();
  if ("error" in g) return { error: g.error };

  const chune = formData.getAll("chuna").map(String).filter(Boolean);
  if (chune.length === 0) {
    return { error: "Kisi qatar par nishan nahi laga. Pehle nishan lagayein." };
  }

  const service = createServiceClient();
  let lagayin = 0;
  const nakaam: string[] = [];

  for (const jorra of chune) {
    // Shakal: "<productId>::<categoryId>"
    const [productId, categoryId] = jorra.split("::");
    if (!productId || !categoryId) continue;

    // Sirf usi cheez par jis ki qism ABHI TAK khali hai. Beech mein kisi
    // aur ne qism laga di ho to us par nahi chalta -- warna kisi ka kaam
    // chup chaap ulta ho jata.
    const { data, error } = await service
      .from("products")
      .update({ category_id: categoryId })
      .eq("id", productId)
      .is("category_id", null)
      .select("id, name")
      .maybeSingle();

    if (error || !data) {
      nakaam.push(productId);
      continue;
    }
    lagayin += 1;

    await logAudit({
      actionType: "update",
      module: "products",
      recordId: productId,
      recordLabel: data.name ?? productId,
      description: "Qism darj ki gayi (AI ki tajweez, insaan ki manzoori se)",
      changes: { category_id: { pehle: null, ab: categoryId } },
    });
  }

  revalidatePath("/admin/products/setup");
  revalidatePath("/admin/products");

  return {
    notice:
      `${lagayin} cheezon ki qism darj ho gayi.` +
      (nakaam.length ? ` ${nakaam.length} par nahi lagi — shayad un ki qism beech mein kisi aur ne laga di.` : ""),
  };
}
