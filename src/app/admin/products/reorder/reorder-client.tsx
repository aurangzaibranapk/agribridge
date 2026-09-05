"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, ShoppingCart } from "lucide-react";
import { createReorderPurchases, type ReorderState } from "@/actions/reorder";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Select } from "@/components/ui/form";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const initial: ReorderState = {};

interface Row {
  id: string;
  name: string;
  packSize: string | null;
  sold30: number;
  sold7: number;
  onHand: number;
  dailyRate: number;
  daysCover: number | null;
  suggested: number;
  urgency: string;
  minStock: number;
  lastSupplierId: string | null;
  lastSupplierName: string | null;
  lastCost: number | null;
  tradeRate: number | null;
  lastPurchaseDate: string | null;
}

const URGENCY: Record<string, { key: TranslationKey; tone: "red" | "amber" | "blue" | "gray" }> = {
  out: { key: "pf_ro_u_out", tone: "red" },
  critical: { key: "pf_ro_u_critical", tone: "red" },
  soon: { key: "pf_ro_u_soon", tone: "amber" },
  low: { key: "pf_ro_u_low", tone: "blue" },
  ok: { key: "pf_ro_u_ok", tone: "gray" },
};

function Submit({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      <span className="inline-flex items-center gap-1.5">
        <ShoppingCart className="h-4 w-4" /> {pending ? "…" : label}
      </span>
    </Button>
  );
}

export function ReorderClient({ lang, rows, suppliers }: { lang: Lang; rows: Row[]; suppliers: { id: string; name: string }[] }) {
  const [state, action] = useFormState(createReorderPurchases, initial);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(rows.filter((r) => r.suggested > 0 && r.lastSupplierId).map((r) => r.id)));

  const counts = useMemo(() => {
    const c = { out: 0, critical: 0, soon: 0, low: 0 };
    for (const r of rows) if (r.urgency in c) c[r.urgency as keyof typeof c] += 1;
    return c;
  }, [rows]);

  function toggle(id: string, on: boolean) {
    setPicked((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["out", "critical", "soon", "low"] as const).map((k) => (
          <Card key={k} className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t(URGENCY[k].key, lang)}</p>
            <p className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">{counts[k]}</p>
          </Card>
        ))}
      </div>

      <Card>
        <p className="text-sm text-surface-600">{t("pf_ro_hint", lang)}</p>
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
          <p className="flex items-center gap-2 text-sm text-emerald-900">
            <CheckCircle2 className="h-4 w-4" /> {t("pf_ro_made", lang).replace("{n}", String(state.made ?? 0))}
          </p>
          {state.notice && <p className="mt-1 text-sm text-amber-800">{state.notice}</p>}
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-surface-600">{t("pf_ro_none", lang)}</p>
        </Card>
      ) : (
        <form action={action} className="space-y-3">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] text-sm">
                <thead>
                  <tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500">
                    <th className="w-8 py-2"></th>
                    <th className="py-2">{t("pf_th_name", lang)}</th>
                    <th className="py-2">{t("pf_ro_th_urgency", lang)}</th>
                    <th className="py-2 text-right">{t("pf_ro_th_sold30", lang)}</th>
                    <th className="py-2 text-right">{t("pf_ro_th_sold7", lang)}</th>
                    <th className="py-2 text-right">{t("pf_ro_th_stock", lang)}</th>
                    <th className="py-2 text-right">{t("pf_ro_th_days", lang)}</th>
                    <th className="w-24 py-2">{t("pf_ro_th_qty", lang)}</th>
                    <th className="w-24 py-2">{t("pf_ro_th_cost", lang)}</th>
                    <th className="w-44 py-2">{t("pf_ro_th_supplier", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const u = URGENCY[r.urgency] ?? URGENCY.ok;
                    const on = picked.has(r.id);
                    return (
                      <tr key={r.id} className={`border-b border-surface-100 align-top ${on ? "" : "opacity-70"}`}>
                        <td className="py-2">
                          <input type="checkbox" name="pick" value={r.id} checked={on} onChange={(e) => toggle(r.id, e.target.checked)} />
                        </td>
                        <td className="py-2 pr-2">
                          <span className="font-medium">{r.name}</span>
                          {r.packSize && <span className="block text-xs text-surface-400">{r.packSize}</span>}
                          {r.lastPurchaseDate && (
                            <span className="block text-[11px] text-surface-400">
                              {t("pf_ro_last_buy", lang)} {r.lastPurchaseDate}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <Badge tone={u.tone}>{t(u.key, lang)}</Badge>
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">{r.sold30}</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-surface-500">{r.sold7}</td>
                        <td className={`py-2 pr-2 text-right tabular-nums font-semibold ${r.onHand <= 0 ? "text-red-600" : ""}`}>{r.onHand}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {/* Bikri sifar ho to din ka hisaab nahi banta -- "—", sifar nahi. */}
                          {r.daysCover == null ? <span className="text-surface-400">—</span> : r.daysCover}
                        </td>
                        <td className="py-2 pr-2">
                          <Input type="number" name={`qty_${r.id}`} min={0} step="any" defaultValue={r.suggested || ""} className="h-8 w-24 text-right tabular-nums" />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            type="number"
                            name={`cost_${r.id}`}
                            min={0}
                            step="0.01"
                            defaultValue={r.lastCost ?? r.tradeRate ?? ""}
                            placeholder={r.lastCost == null && r.tradeRate == null ? t("pf_pending_word", lang) : ""}
                            className="h-8 w-24 text-right tabular-nums"
                          />
                        </td>
                        <td className="py-2">
                          <Select name={`sup_${r.id}`} defaultValue={r.lastSupplierId ?? ""} className="h-8 text-xs">
                            <option value="">{t("pu_select", lang)}</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-surface-200 pt-3">
              <p className="text-xs text-surface-500">{t("pf_ro_submit_hint", lang)}</p>
              <Submit label={t("pf_ro_make", lang).replace("{n}", String(picked.size))} disabled={picked.size === 0} />
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
