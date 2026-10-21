import { AlertTriangle, ArrowRight } from "lucide-react";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import type { Lang } from "@/lib/i18n/translations";
import { fmtQty, fmtVal, mergeChip, type MergePanel, type ProductEditDiff, type ProductPendingExtra } from "@/lib/pending/product-diff";
import { cn } from "@/lib/utils/format";

const tk = (k: string) => k as TranslationKey;

export function OldName({ children }: { children: React.ReactNode }) {
  return <span data-diff-old className="rounded bg-red-50 px-1 text-red-700 line-through dark:bg-red-500/10 dark:text-rose-300">{children}</span>;
}
export function NewName({ children }: { children: React.ReactNode }) {
  return <span data-diff-new className="rounded bg-emerald-50 px-1 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{children}</span>;
}
export function Chip({ tone = "blue", children }: { tone?: "blue" | "warn" | "grey"; children: React.ReactNode }) {
  return (
    <span
      data-diff-chip={tone}
      className={cn(
        "mr-1 inline-flex items-center gap-1 rounded-full px-2 py-px text-[10.5px] font-semibold",
        tone === "blue" && "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
        tone === "warn" && "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
        tone === "grey" && "bg-surface-100 text-surface-600 dark:bg-white/5 dark:text-surface-300",
      )}
    >
      {children}
    </span>
  );
}
const Arrow = () => <ArrowRight className="mx-1 inline h-3 w-3 text-surface-400" />;

function editLine(d: ProductEditDiff, lang: Lang) {
  if (d.newName) {
    return (
      <>
        {t(tk("ped_rename"), lang)}: <OldName>{d.oldName}</OldName>
        <Arrow />
        <NewName>{d.newName}</NewName>
      </>
    );
  }
  return <>{d.productName}</>;
}

/** Pending list ki qataar ka "item" khana (mockup list.png). */
export function ProductPendingSummary({ extra, lang }: { extra: ProductPendingExtra; lang: Lang }) {
  if (extra.kind === "merge") return <MergeSummary p={extra} lang={lang} />;
  const d = extra;
  const n = d.changes.length;
  return (
    <div data-product-diff="edit" className="min-w-0">
      <p className="font-bold text-surface-900 dark:text-white">{editLine(d, lang)}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-y-1 text-[11.5px] text-surface-500 dark:text-surface-400">
        {d.flags.includes("no_change") ? (
          <Chip tone="grey">{t(tk("ped_flag_no_change"), lang)}</Chip>
        ) : (
          !d.flags.some((f) => f !== "no_change") && (
            <>
              <Chip>{n} {t(tk(n === 1 ? "ped_fields_one" : "ped_fields_many"), lang)}</Chip>
              {d.changes.map((c) => t(tk(c.label), lang)).join(", ")}
            </>
          )
        )}
        {d.flags.filter((f) => f !== "no_change").map((f) => (
          <Chip key={f} tone="warn"><AlertTriangle className="h-3 w-3" />{t(tk(`ped_flag_${f}`), lang)}</Chip>
        ))}
      </p>
    </div>
  );
}

function MergeSummary({ p, lang }: { p: MergePanel; lang: Lang }) {
  return (
    <div data-product-diff="merge" className="min-w-0">
      <p className="font-bold text-surface-900 dark:text-white">
        {t(tk("ped_merge"), lang)}: <OldName>{p.source.name}</OldName>
        <Arrow />
        <NewName>{p.target.name}</NewName>
      </p>
      <p className="mt-0.5 flex flex-wrap gap-y-1 text-[11.5px]">
        {!p.flags.includes("self_merge") && <Chip>{t(tk("ped_stock"), lang)} {mergeChip(p)}</Chip>}
        {p.flags.includes("self_merge") && <Chip tone="warn"><AlertTriangle className="h-3 w-3" />{t(tk("ped_flag_self_merge"), lang)}</Chip>}
        {p.flags.includes("rate_diff") && (
          <Chip tone="warn">{t(tk("ped_flag_rate_diff"), lang)}: Rs {fmtQty(p.source.rate ?? 0)} vs Rs {fmtQty(p.target.rate ?? 0)}</Chip>
        )}
        {p.flags.includes("snapshot_diff") && <Chip tone="warn">{t(tk("ped_flag_snapshot_diff"), lang)}</Chip>}
      </p>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p data-diff-warn className="my-3 flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Kholein: field / pehle / baad (mockup detail.png). */
export function ProductEditDetail({ d, lang }: { d: ProductEditDiff; lang: Lang }) {
  return (
    <div data-product-detail="edit">
      {d.flags.includes("changed_since") && <Warn>{t(tk("ped_warn_changed"), lang)}</Warn>}
      {d.flags.includes("instruction_name") && <Warn>{t(tk("ped_flag_instruction_name"), lang)}</Warn>}
      {d.flags.includes("merged_target") && <Warn>{t(tk("ped_flag_merged_target"), lang)}</Warn>}
      {d.flags.includes("no_change") && <Warn>{t(tk("ped_flag_no_change"), lang)}</Warn>}
      <table className="mt-2 w-full text-left text-[12.5px]">
        <thead className="text-[10.5px] font-bold uppercase tracking-wider text-surface-400">
          <tr>
            <th className="px-2.5 py-2">{t(tk("ped_col_field"), lang)}</th>
            <th className="px-2.5 py-2">{t(tk(d.beforeSource === "original" ? "ped_col_before_saved" : "ped_col_before"), lang)}</th>
            <th className="px-2.5 py-2">{t(tk("ped_col_after"), lang)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-white/5">
          {d.changes.map((c) => (
            <tr key={c.key} data-diff-field={c.key}>
              <td className="px-2.5 py-2 font-bold">{t(tk(c.label), lang)}</td>
              <td className="px-2.5 py-2"><OldName>{fmtVal(c.before)}</OldName></td>
              <td className="px-2.5 py-2"><NewName>{fmtVal(c.after)}</NewName></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mb-4 mt-2 text-[11.5px] text-surface-500 dark:text-surface-400">
        {t(tk("ped_only_changed"), lang)} {d.unchangedCount > 0 && <u>{d.unchangedCount} {t(tk("ped_rest_same"), lang)}</u>}
      </p>
    </div>
  );
}

function SideBox({ side, tag, tone, lang }: { side: MergePanel["source"]; tag: string; tone: "warn" | "blue"; lang: Lang }) {
  return (
    <div className="rounded-xl border border-surface-200 p-3 dark:border-white/10">
      <Chip tone={tone}>{tag}</Chip>
      <h4 className="mt-1 font-bold">{side.name}</h4>
      <p className="text-[12px] text-surface-600 dark:text-surface-300">{t(tk("ped_rate"), lang)}: {side.rate != null ? `Rs ${fmtQty(side.rate)}` : "—"}</p>
      <table className="mt-2 w-full text-[12.5px]">
        <tbody className="divide-y divide-surface-100 dark:divide-white/5">
          {side.stock.map((l) => (
            <tr key={l.warehouse}><td className="px-2 py-1.5">{l.warehouse}</td><td className="px-2 py-1.5 text-right tabular-nums">{fmtQty(l.qty)}</td></tr>
          ))}
          <tr><td className="px-2 py-1.5 font-bold">{t(tk("ped_total"), lang)}</td><td className="px-2 py-1.5 text-right font-bold tabular-nums">{fmtQty(side.total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** Merge panel (mockup merge.png). */
export function ProductMergeDetail({ p, lang }: { p: MergePanel; lang: Lang }) {
  const self = p.flags.includes("self_merge");
  return (
    <div data-product-detail="merge">
      {self && <Warn>{t(tk("ped_self_warn"), lang)}</Warn>}
      <div className="mt-3 grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_40px_1fr]">
        <SideBox side={p.source} tag={t(tk("ped_will_go"), lang)} tone="warn" lang={lang} />
        <div className="text-center text-2xl">➜</div>
        <SideBox side={p.target} tag={t(tk("ped_will_stay"), lang)} tone="blue" lang={lang} />
      </div>
      {!self && (
        <div className="mt-3 rounded-xl border border-surface-200 p-3 dark:border-white/10" data-merge-result>
          <b>{t(tk("ped_after_merge"), lang)}: {p.target.name}</b>
          <table className="mt-2 w-full text-left text-[12.5px]">
            <thead className="text-[10.5px] font-bold uppercase tracking-wider text-surface-400">
              <tr><th className="px-2 py-1.5">{t(tk("ped_col_wh"), lang)}</th><th className="px-2 py-1.5">{t(tk("ped_col_now"), lang)}</th><th className="px-2 py-1.5">{t(tk("ped_col_in"), lang)}</th><th className="px-2 py-1.5">{t(tk("ped_col_new"), lang)}</th></tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-white/5">
              {p.rows.map((r) => (
                <tr key={r.warehouse}><td className="px-2 py-1.5">{r.warehouse}</td><td className="px-2 py-1.5 tabular-nums">{fmtQty(r.now)}</td><td className="px-2 py-1.5 tabular-nums">{r.incoming ? `+${fmtQty(r.incoming)}` : "0"}</td><td className="px-2 py-1.5 tabular-nums">{fmtQty(r.after)}</td></tr>
              ))}
              <tr><td className="px-2 py-1.5 font-bold">{t(tk("ped_total"), lang)}</td><td className="px-2 py-1.5 tabular-nums">{fmtQty(p.totals.now)}</td><td className="px-2 py-1.5 tabular-nums">+{fmtQty(p.totals.incoming)}</td><td data-merge-total className="px-2 py-1.5 text-xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">{fmtQty(p.totals.after)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {p.flags.includes("rate_diff") && (
        <Warn>{t(tk("ped_rate_warn"), lang).replaceAll("{s}", fmtQty(p.source.rate ?? 0)).replaceAll("{t}", fmtQty(p.target.rate ?? 0))}</Warn>
      )}
      {p.flags.includes("snapshot_diff") && <Warn>{t(tk("ped_flag_snapshot_diff"), lang)}</Warn>}
    </div>
  );
}
