import Link from "next/link";
import { redirect } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { NewBatchForm } from "./new-batch-form";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];

/**
 * Maal andar lene ke chakkar.
 *
 * Har chakkar ek baithak hai: tasveerein aur scan, phir ek sath
 * manzoori. Purane chakkar yahin rehte hain -- kis din kitna maal aaya,
 * ye sawal baad mein banta hai.
 */
export default async function IntakePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return (
      <div>
        <PageHeader title={t("pf_intake_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">
            {t("pf_intake_gate", lang)}
          </p>
        </Card>
      </div>
    );
  }

  const [{ data: batches }, { data: warehouses }] = await Promise.all([
    supabase
      .from("product_intake_batches")
      .select("id, name, status, created_at, approved_at, warehouses(name)")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("warehouses").select("id, name, code").order("name"),
  ]);

  // Har chakkar mein kitni qatarein hain -- ek hi sawal, sab ke liye.
  const ids = (batches ?? []).map((b) => b.id);
  const { data: counts } = ids.length
    ? await supabase.from("product_intake_items").select("batch_id, status").in("batch_id", ids)
    : { data: [] };

  const tally = new Map<string, { total: number; ready: number }>();
  for (const c of counts ?? []) {
    const row = tally.get(c.batch_id) ?? { total: 0, ready: 0 };
    if (c.status !== "skipped") row.total += 1;
    if (c.status === "ready") row.ready += 1;
    tally.set(c.batch_id, row);
  }

  return (
    <div>
      <PageHeader
        title={t("pf_intake_title", lang)}
        description={t("pf_intake_desc", lang)}
      />

      <NewBatchForm warehouses={(warehouses ?? []).map((w) => ({ id: w.id, name: w.name, code: w.code }))} />

      <Card className="mt-4">
        <h2 className="mb-2 text-sm font-semibold">{t("pf_past_batches", lang)}</h2>
        {(batches ?? []).length === 0 ? (
          <p className="text-sm text-surface-500">{t("pf_no_batches", lang)}</p>
        ) : (
          <ul className="divide-y divide-surface-100">
            {(batches ?? []).map((b) => {
              const c = tally.get(b.id) ?? { total: 0, ready: 0 };
              const wh = (b as unknown as { warehouses?: { name?: string } }).warehouses?.name;
              return (
                <li key={b.id}>
                  <Link href={`/admin/products/intake/${b.id}`} className="flex flex-wrap items-center gap-2 py-2.5 hover:bg-surface-50">
                    <PackagePlus className="h-4 w-4 shrink-0 text-surface-400" />
                    <span className="font-medium">{b.name}</span>
                    {wh && <span className="text-xs text-surface-500">{wh}</span>}
                    <span className="text-xs text-surface-400">{new Date(b.created_at).toLocaleDateString("en-GB")}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-surface-500">{c.total} {t("pf_rows", lang)}</span>
                      {b.status === "approved" ? (
                        <Badge tone="green">{t("pf_approved", lang)}</Badge>
                      ) : c.ready > 0 ? (
                        <Badge tone="amber">{c.ready} {t("pf_ready", lang)}</Badge>
                      ) : (
                        <Badge tone="gray">{t("pf_running", lang)}</Badge>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
