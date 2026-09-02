"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, Barcode, CalendarClock, CheckCircle2, CircleDollarSign, ImageOff, Save, ShieldCheck } from "lucide-react";
import { saveSetupQueue, type SetupState } from "@/actions/product-setup";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input } from "@/components/ui/form";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const initial: SetupState = {};

export type Filter = "all" | "rate" | "barcode" | "image" | "expiry" | "approval";

interface Row {
  id: string;
  name: string;
  packSize: string | null;
  barcode: string | null;
  imageUrl: string | null;
  expiryDate: string | null;
  daysLeft: number | null;
  sellingPrice: number | null;
  purchasePrice: number | null;
  mrpPrice: number | null;
  saleMissing: boolean;
  tradeMissing: boolean;
  barcodeMissing: boolean;
  imageMissing: boolean;
  expired: boolean;
  expirySoon: boolean;
  approvalPending: boolean;
}

interface Counts {
  rate: number;
  barcode: number;
  image: number;
  expiry: number;
  approval: number;
  intakeOpen: number;
  total: number;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <span className="inline-flex items-center gap-1.5">
        <Save className="h-4 w-4" /> {pending ? "…" : label}
      </span>
    </Button>
  );
}

const TILES: { key: Filter; label: TranslationKey; icon: typeof Barcode; tone: string }[] = [
  { key: "rate", label: "pf_sq_c_rate", icon: CircleDollarSign, tone: "text-red-600" },
  { key: "barcode", label: "pf_sq_c_barcode", icon: Barcode, tone: "text-amber-600" },
  { key: "image", label: "pf_sq_c_image", icon: ImageOff, tone: "text-surface-500" },
  { key: "expiry", label: "pf_sq_c_expiry", icon: CalendarClock, tone: "text-amber-700" },
  { key: "approval", label: "pf_sq_c_approval", icon: ShieldCheck, tone: "text-brand-600" },
];

function matches(r: Row, f: Filter): boolean {
  switch (f) {
    case "rate":
      return r.saleMissing || r.tradeMissing;
    case "barcode":
      return r.barcodeMissing;
    case "image":
      return r.imageMissing;
    case "expiry":
      return r.expired || r.expirySoon;
    case "approval":
      return r.approvalPending;
    default:
      return true;
  }
}

/**
 * Upar chhe khane (har ek dabane se fehrist us par chhant jati hai),
 * neeche ek hi form. Jo maloom ho wo bharo, baqi khali -- khali khana
 * kuch nahi badalta.
 */
export function QueueClient({
  lang,
  filter,
  counts,
  rows,
  canApprove,
}: {
  lang: Lang;
  filter: Filter;
  counts: Counts;
  rows: Row[];
  canApprove: boolean;
}) {
  const [state, action] = useFormState(saveSetupQueue, initial);
  const shown = rows.filter((r) => matches(r, filter));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Link
          href="/admin/products/setup-queue"
          className={`rounded-card border p-3 ${filter === "all" ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30" : "border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900"}`}
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("pf_sq_c_total", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">{counts.total}</p>
        </Link>
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const n = counts[tile.key as keyof Counts] as number;
          return (
            <Link
              key={tile.key}
              href={`/admin/products/setup-queue?f=${tile.key}`}
              className={`rounded-card border p-3 ${filter === tile.key ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30" : "border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900"}`}
            >
              <p className={`flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide ${tile.tone}`}>
                <Icon className="h-3.5 w-3.5" /> {t(tile.label, lang)}
              </p>
              <p className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">{n}</p>
            </Link>
          );
        })}
      </div>

      {counts.barcode > 0 && (
        <p className="px-1 text-xs text-surface-500">
          {t("pf_sq_labels_hint", lang)}{" "}
          <Link href="/admin/products/labels?f=missing" className="font-medium text-brand-600 underline">
            {t("pf_lb_title", lang)}
          </Link>
        </p>
      )}

      {counts.intakeOpen > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {t("pf_sq_intake_open", lang).replace("{n}", String(counts.intakeOpen))}{" "}
            <Link href="/admin/products/intake" className="underline">
              {t("pf_sq_intake_link", lang)}
            </Link>
          </p>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className="flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> {t("pf_sq_none", lang)}
          </p>
        </Card>
      ) : (
        <form action={action} className="space-y-3">
          <Card>
            <p className="text-sm text-surface-600">{t("pf_sq_hint", lang)}</p>
          </Card>

          {state.error && (
            <Card className="border-red-200 bg-red-50">
              <p className="flex items-start gap-2 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
              </p>
            </Card>
          )}
          {state.success && (
            <Card className="border-emerald-200 bg-emerald-50">
              <p className="text-sm text-emerald-900">{t("pf_sq_saved", lang).replace("{n}", String(state.saved ?? 0))}</p>
              {state.notice && <p className="mt-1 text-sm text-amber-800">{state.notice}</p>}
            </Card>
          )}

          <Card>
            {shown.length === 0 ? (
              <p className="text-sm text-surface-500">{t("pf_sq_filter_empty", lang)}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[58rem] text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500">
                      <th className="py-2">{t("pf_th_name", lang)}</th>
                      <th className="py-2">{t("pf_sq_th_issues", lang)}</th>
                      <th className="w-24 py-2">{t("pf_f_trade", lang)}</th>
                      <th className="w-24 py-2">{t("pf_f_sale", lang)}</th>
                      <th className="w-40 py-2">{t("pf_sq_th_barcode", lang)}</th>
                      <th className="py-2">{t("pf_sq_th_expiry", lang)}</th>
                      <th className="py-2">{t("pf_sq_th_fix", lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id} className="border-b border-surface-100 align-top">
                        <td className="py-2 pr-2 font-medium">
                          <input type="hidden" name="id" value={r.id} />
                          {r.name}
                          {r.packSize && <span className="block text-xs font-normal text-surface-500">{r.packSize}</span>}
                          {r.mrpPrice != null && <span className="block text-xs font-normal text-surface-400">MRP {r.mrpPrice.toLocaleString()}</span>}
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex flex-wrap gap-1">
                            {r.saleMissing && <Badge tone="red">{t("pf_rb_sale_missing", lang)}</Badge>}
                            {r.tradeMissing && <Badge tone="gray">{t("pf_rb_trade_missing", lang)}</Badge>}
                            {r.barcodeMissing && <Badge tone="amber">{t("pf_sq_b_barcode", lang)}</Badge>}
                            {r.imageMissing && <Badge tone="gray">{t("pf_sq_b_image", lang)}</Badge>}
                            {r.expired && <Badge tone="red">{t("pf_sq_b_expired", lang)}</Badge>}
                            {r.expirySoon && <Badge tone="amber">{t("pf_sq_b_expiry_soon", lang)}</Badge>}
                            {r.approvalPending && <Badge tone="blue">{t("pf_sq_b_approval", lang)}</Badge>}
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          {r.tradeMissing ? (
                            <Input name={`trade_${r.id}`} type="number" step="0.01" min="0" placeholder={t("pf_pending_word", lang)} className="h-8 text-right" />
                          ) : (
                            <span className="text-surface-500 tabular-nums">{r.purchasePrice?.toLocaleString() ?? "—"}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {r.saleMissing ? (
                            <Input name={`sale_${r.id}`} type="number" step="0.01" min="0" placeholder={t("pf_pending_word", lang)} className="h-8 text-right font-semibold" />
                          ) : (
                            <span className="font-semibold tabular-nums">{r.sellingPrice?.toLocaleString() ?? "—"}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {r.barcodeMissing ? (
                            <div className="space-y-1">
                              <Input name={`barcode_${r.id}`} inputMode="numeric" placeholder={t("pf_sq_scan_here", lang)} className="h-8 font-mono" />
                              <label className="flex items-center gap-1 text-[11px] text-surface-500">
                                <input type="checkbox" name={`mkbc_${r.id}`} /> {t("pf_sq_make_internal", lang)}
                              </label>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-surface-500">{r.barcode}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-xs">
                          {r.expiryDate ? (
                            <span className={r.expired ? "font-medium text-red-600" : r.expirySoon ? "text-amber-700" : "text-surface-500"}>
                              {r.expiryDate}
                              {r.daysLeft != null && (r.expired || r.expirySoon) && (
                                <span className="block">{r.daysLeft < 0 ? t("inv_expired", lang) : `${r.daysLeft} ${t("inv_days", lang)}`}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-surface-400">—</span>
                          )}
                        </td>
                        <td className="py-2 text-xs">
                          <div className="flex flex-col gap-1">
                            {r.imageMissing && (
                              <Link href={`/admin/products/${r.id}/edit`} className="text-brand-600 underline">
                                {t("pf_sq_add_photo", lang)}
                              </Link>
                            )}
                            {(r.expired || r.expirySoon) && (
                              <Link href="/admin/inventory" className="text-brand-600 underline">
                                {t("pf_sq_see_stock", lang)}
                              </Link>
                            )}
                            {r.approvalPending &&
                              (canApprove ? (
                                <label className="flex items-center gap-1.5 text-surface-700 dark:text-surface-300">
                                  <input type="checkbox" name={`verify_${r.id}`} /> {t("pf_sq_approve", lang)}
                                </label>
                              ) : (
                                <span className="text-surface-400">{t("pf_sq_approve_admin_only", lang)}</span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 border-t border-surface-200 pt-3">
              <Submit label={t("pf_sq_save", lang)} />
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
