import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

export type SetupTab =
  | "queue" | "propose" | "pending" | "edits" | "intake" | "bill" | "rates" | "labels" | "import" | "export";

const TABS: { key: SetupTab; href: string; label: TranslationKey }[] = [
  { key: "queue", href: "/admin/products/setup", label: "pf_ps_t_queue" },
  { key: "propose", href: "/admin/products/propose", label: "pf_ps_t_propose" },
  { key: "pending", href: "/admin/products/pending", label: "pf_ps_t_pending" },
  { key: "edits", href: "/admin/products/pending-edits", label: "pf_ps_t_edits" },
  { key: "intake", href: "/admin/products/intake", label: "pf_ps_t_intake" },
  { key: "bill", href: "/admin/products/bill-rates", label: "pf_ps_t_bill" },
  { key: "rates", href: "/admin/products/rates-baqi", label: "pf_ps_t_rates" },
  { key: "labels", href: "/admin/products/labels", label: "pf_ps_t_labels" },
  { key: "import", href: "/admin/products/import", label: "pf_ps_t_import" },
  { key: "export", href: "/admin/products/catalog-export", label: "pf_ps_t_export" },
];

/**
 * Product Setup ka ek hi workspace (265). Pehle saat safhe alag alag
 * menu mein the; ab ek tab ki patti har us safhe ke upar, ginti ke
 * sath. Safhe wahi hain -- sirf raasta ek hua hai.
 */
export async function ProductSetupTabs({ current, lang }: { current: SetupTab; lang: Lang }) {
  const supabase = createClient();
  const [{ data: counts }, { count: pending }, { count: edits }, { count: bills }] = await Promise.all([
    supabase.from("v_product_setup_counts").select("*").maybeSingle(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_deleted", false).eq("is_verified", false),
    supabase.from("product_edit_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("supplier_bill_reads").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ]);
  const badge: Partial<Record<SetupTab, number>> = {
    queue: Number(counts?.total_products ?? 0),
    pending: pending ?? 0,
    edits: edits ?? 0,
    intake: Number(counts?.intake_open ?? 0),
    bill: bills ?? 0,
    rates: Number(counts?.rate_pending ?? 0),
    labels: Number(counts?.barcode_missing ?? 0),
  };

  return (
    <nav className="mb-4 -mt-2 flex flex-wrap gap-1 border-b border-surface-200 pb-2 text-sm dark:border-surface-800" aria-label="Product Setup">
      {TABS.map((tab) => {
        const on = tab.key === current;
        const n = badge[tab.key];
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${on ? "bg-brand-600 text-white" : "text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"}`}
          >
            {t(tab.label, lang)}
            {n != null && n > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] font-semibold ${on ? "bg-white/20" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"}`}>{n}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
