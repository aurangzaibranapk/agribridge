import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { joRiyan, type CategoryLite } from "@/lib/products/category-pairs";
import { MergeClient } from "./merge-client";

export const dynamic = "force-dynamic";

const SIRF = ["owner", "super_admin", "admin"];

/**
 * Categories ki safai.
 *
 * Testing par 42 categories thin aur un mein "Cooking Oil & Ghee" bhi
 * tha aur "Ghee & Cooking Oil" bhi. Ek hi cheez do jagah baithi ho to
 * dukan par banda dono jagah dhoondhta hai, stock ki qeemat do hisson
 * mein bat jati hai, aur "is category mein kitna maal hai" ka jawab
 * hamesha kam aata hai -- bina kisi ko pata chale ke kam kyun hai.
 *
 * -------------------------------------------------------------------
 * SAFHA FAISLA NAHI KARTA.
 *
 * Ye sirf jodiyan saamne rakhta hai: ye do naam bohot milte hain, aur
 * har ek mein itna maal hai. Kaunsi kis mein milani hai, malik tay
 * karte hain -- aur wajah likhe baghair kuch nahi hota, kyunki ye kaam
 * ULTA NAHI HOTA. Product ek ek kar ke wapas bhejne parte hain.
 *
 * Milte julte naam ka matlab hamesha "ek hi cheez" nahi hota. "Poultry
 * Feed" aur "Cattle/Dairy Feed" ke aadhe lafz ek hain magar wo do alag
 * cheezein hain -- aur unhen mila dena poultry ka stock hamesha ke liye
 * cattle mein daal dega.
 */
export default async function CategoryMergePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) redirect("/login");

  if (!SIRF.includes(me.role)) {
    return (
      <div>
        <PageHeader title="Categories ki safai" />
        <Card>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Category milana sirf Malik ya Admin ka kaam hai — kyunki ye ulta nahi hota.
          </p>
          <Link href="/admin/categories" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
            Categories par wapas →
          </Link>
        </Card>
      </div>
    );
  }

  const service = createServiceClient();

  const { data: cats, error: catErr } = await service
    .from("categories")
    .select("id, name, parent_category_id")
    .order("name");

  if (catErr) {
    return (
      <div>
        <PageHeader title="Categories ki safai" />
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Categories parhi nahi ja sakin: {catErr.message}
          </p>
        </Card>
      </div>
    );
  }

  // Har category mein kitne product hain -- ek hi sawal mein, har
  // category ke liye alag sawal poochne se safha dheema ho jata hai.
  const { data: prods } = await service.from("products").select("category_id");
  const ginti = new Map<string, number>();
  for (const p of prods ?? []) {
    const k = p.category_id as string | null;
    if (k) ginti.set(k, (ginti.get(k) ?? 0) + 1);
  }

  const list: CategoryLite[] = (cats ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    products: ginti.get(c.id as string) ?? 0,
    parentId: (c.parent_category_id as string | null) ?? null,
  }));

  const { data: purane } = await service
    .from("category_merges")
    .select("id, from_name, into_name, products_moved, children_moved, reason, merged_at")
    .order("merged_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <PageHeader
        title="Categories ki safai"
        description={`${list.length} categories — jo ek jaisi lagti hain wo neeche hain`}
        actions={
          <Link
            href="/admin/categories"
            className="inline-flex items-center rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            Categories
          </Link>
        }
      />
      <MergeClient
        categories={list}
        jodiyan={joRiyan(list).slice(0, 25)}
        purane={(purane ?? []).map((m) => ({
          id: m.id as string,
          from: m.from_name as string,
          into: m.into_name as string,
          products: Number(m.products_moved),
          children: Number(m.children_moved),
          reason: (m.reason as string | null) ?? null,
          waqt: String(m.merged_at),
        }))}
      />
    </div>
  );
}
