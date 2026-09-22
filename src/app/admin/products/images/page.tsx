import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ProductSetupTabs } from "@/components/products/setup-tabs";
import { ProductImagesClient } from "./images-client";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Cheezon ki tasveerein: kis ki nahi lagi, aur kaunsa masoda dekhna baqi
 * hai.
 *
 * Ye safha un rolon par bilkul nahi khulta jinhen ye kaam nahi -- khali
 * fehrist dikha kar "kuch baqi nahi" ka taassur dena us se bura hai.
 */
export default async function ProductImagesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  const ALLOWED = ["owner", "super_admin", "admin", "manager"];
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("pi_only_admin", lang)}</div>;
  }

  // Ginti aur fehrist ek hi khane se aati hain (296). Do jagah ginne se
  // do adad ban jate hain, aur phir koi nahi bata sakta ke sahi kaunsa
  // hai.
  const { count: missingCount } = await supabase
    .from("v_products_missing_image")
    .select("product_id", { count: "exact", head: true });

  const { data: missing } = await supabase
    .from("v_products_missing_image")
    .select("product_id, name, pack_size, unit_code, is_branded, open_draft_id")
    .order("name")
    .limit(60);

  const { data: drafts } = await supabase
    .from("product_image_drafts")
    .select("id, product_id, image_url, is_branded, model, generated_at")
    .eq("status", "draft")
    .order("generated_at", { ascending: false })
    .limit(60);

  const ids = Array.from(new Set((drafts ?? []).map((d) => d.product_id)));
  const { data: prods } = ids.length
    ? await supabase.from("products").select("id, name, pack_size, image_url, image_source").in("id", ids)
    : { data: [] as any[] };
  const byId = new Map((prods ?? []).map((p: any) => [p.id, p]));

  const draftRows = (drafts ?? []).map((d) => {
    const p = byId.get(d.product_id);
    return {
      id: d.id,
      product_id: d.product_id,
      image_url: d.image_url,
      is_branded: d.is_branded,
      model: d.model,
      generated_at: d.generated_at,
      name: p?.name ?? "—",
      pack_size: p?.pack_size ?? null,
      // Purani tasveer ASAL hai ya nahi -- isi par ye rok khaRi hai ke
      // AI wali us ki jagah khud na le le.
      current_image_url: p?.image_url ?? null,
      current_is_real: !!p?.image_url && ["uploaded", "supplier", "verified_catalog"].includes(p?.image_source ?? ""),
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("pi_title", lang)} description={t("pi_desc", lang)} />
      <ProductSetupTabs current="images" lang={lang} />
      <ProductImagesClient
        lang={lang}
        missingCount={missingCount ?? null}
        missing={(missing ?? []).map((m: any) => ({
          product_id: m.product_id,
          name: m.name,
          pack_size: m.pack_size,
          unit_code: m.unit_code,
          is_branded: !!m.is_branded,
          has_draft: !!m.open_draft_id,
        }))}
        drafts={draftRows}
      />
    </div>
  );
}
