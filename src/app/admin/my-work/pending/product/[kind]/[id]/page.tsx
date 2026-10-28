import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { ageDays, roleLabelKey, type PendingItem } from "@/lib/pending/categories";
import { attachProductExtras } from "@/lib/pending/product-attach";
import { loadProductPendingExtras } from "@/lib/pending/product-diff-load";
import { AgeChip } from "@/components/pending/pending-ui";
import { ProductEditDetail, ProductMergeDetail } from "@/components/pending/product-diff-ui";
import { DecideButtons } from "../../../decide-buttons";
import { PendingLive } from "../../../live-state";

export const dynamic = "force-dynamic";
const tk = (k: string) => k as TranslationKey;
type Rpc = (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

function fmtWhen(iso: string, lang: string) {
  return (
    new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)) + " (PKT)"
  );
}

/** Product tabdeeli / merge ki tafseel (mockups detail.png + merge.png). Sirf parhta hai; faisla wahi purana action. */
export default async function ProductPendingDetail({ params }: { params: { kind: string; id: string } }) {
  const kind = params.kind === "merge" ? "merge" : params.kind === "edit" ? "edit" : null;
  if (!kind) notFound();
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const lang = getLanguageFromCookies("rm");
  const category = kind === "edit" ? "product_edits" : "product_merge";
  const rpc = sb.rpc.bind(sb) as unknown as Rpc;
  const { data } = await rpc("fn_admin_pending_items", { p_limit: 200, p_category: category });
  const row = ((data as PendingItem[] | null) ?? []).find((r) => r.item_id === params.id);
  const back = "/admin/my-work/pending?route=/admin/products/pending-edits";
  if (!row) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-800">{t(tk("ped_not_found"), lang)}</p>
        <Link href={back} className="mt-3 inline-block text-sm font-semibold text-blue-600">← {t(tk("ped_back"), lang)}</Link>
      </div>
    );
  }
  const extras = await loadProductPendingExtras(sb as never, kind === "edit" ? [row.item_id] : [], kind === "merge" ? [row.item_id] : []);
  const [item] = attachProductExtras([row], extras);
  const x = item.product_extra;
  const title =
    kind === "merge" ? t(tk("ped_merge_title"), lang).toUpperCase() : `${t(tk("ped_edit_title"), lang).toUpperCase()} — ${x?.kind === "edit" ? x.oldName : ""}`;
  const approveLabel =
    x?.kind === "merge" ? t(tk("ped_approve_merge"), lang) : x?.kind === "edit" && x.newName && x.changes.length === 1 ? t(tk("ped_approve_rename"), lang) : t(tk("ped_approve_edit"), lang);
  return (
    <PendingLive counts={[]}>
      <div data-product-pending-detail={kind} className="mx-auto max-w-4xl space-y-3 pb-10">
        <Link href={back} className="text-xs font-semibold text-blue-600 dark:text-blue-400">← {t(tk("ped_back"), lang)}</Link>
        <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f1b3d]">
          <header className="flex items-center justify-between gap-2">
            <h1 className="text-[13px] font-extrabold uppercase tracking-wider text-surface-800 dark:text-surface-100">{title}</h1>
            <AgeChip days={ageDays(item.created_at)} lang={lang} />
          </header>
          <div className="mt-2 flex flex-wrap gap-x-7 gap-y-1 text-[12px] text-surface-500 dark:text-surface-400">
            <span>{t(tk("ped_sent_by"), lang)}: <b className="text-surface-900 dark:text-white">{item.entered_by_name ?? t("apb_noname", lang)}</b></span>
            <span>{t(tk("ped_date"), lang)}: <b className="text-surface-900 dark:text-white">{fmtWhen(item.created_at, lang)}</b></span>
            <span>{t(tk("ped_with"), lang)}: <b className="text-surface-900 dark:text-white">{item.actor_name ?? t(roleLabelKey(item.pending_with), lang)}</b></span>
          </div>
          {x?.kind === "edit" && <ProductEditDetail d={x} lang={lang} />}
          {x?.kind === "merge" && <ProductMergeDetail p={x} lang={lang} />}
          <div className="mt-3">
            <DecideButtons item={item} href={back} approveLabel={approveLabel} hideOpen />
          </div>
        </section>
      </div>
    </PendingLive>
  );
}
