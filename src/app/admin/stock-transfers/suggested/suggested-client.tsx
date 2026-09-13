"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, PackagePlus } from "lucide-react";
import { requestInternalTransfer } from "@/actions/stock-transfer-workflow";
import { Card } from "@/components/ui/layout-primitives";
import { Button, Input } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

export interface Row {
  shopId: string;
  shopName: string;
  productId: string;
  productName: string;
  packSize: string | null;
  shopOnHand: number;
  warehouseOnHand: number;
  dailyRate: number;
  daysCover: number | null;
  suggestedQty: number;
  urgency: string;
}

const URGENCY: Record<string, string> = {
  out: "bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-100",
  critical: "bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-100",
  low: "bg-wheat-50 text-wheat-600 dark:bg-wheat-500/15 dark:text-wheat-400",
};

/**
 * Tajweez se darkhwast tak -- ek qadam.
 *
 * Button wahi purana `requestInternalTransfer` chalata hai jo shop staff
 * khud istemal karta hai. Yani darkhwast usi qatar mein aati hai, usi
 * manzoori aur dispatch se guzarti hai. Yahan koi naya raasta nahi bana:
 * naya raasta banate to ek din do fehristein alag alag chalne lagtin.
 */
export function SuggestedClient({
  lang,
  rows,
  shops,
  showShopPicker,
  selectedShop,
}: {
  lang: Lang;
  rows: Row[];
  shops: { id: string; name: string }[];
  showShopPicker: boolean;
  selectedShop: string | null;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [state, action] = useFormState(requestInternalTransfer, {} as { error?: string; success?: boolean });

  const picked = useMemo(
    () =>
      rows
        .map((r) => ({ r, q: qty[`${r.shopId}:${r.productId}`] ?? 0 }))
        .filter((x) => x.q > 0),
    [rows, qty]
  );

  // Ek darkhwast ek shop ki -- do shop ka maal ek hi darkhwast mein
  // nahi ja sakta (godam ko alag alag bhejna hota hai).
  const shopOfPicked = picked.length ? picked[0].r.shopId : null;
  const mixedShops = picked.some((x) => x.r.shopId !== shopOfPicked);

  const itemsJson = JSON.stringify(
    picked.map((x) => ({ product_id: x.r.productId, quantity: x.q, unit_price: 1 }))
  );

  if (rows.length === 0) {
    return (
      <Card>
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> {t("sr_none", lang)}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {showShopPicker && shops.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/admin/stock-transfers/suggested"
            className={`rounded-full px-3 py-1 text-xs ${!selectedShop ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 dark:bg-surface-800"}`}
          >
            {t("sr_all_shops", lang)}
          </Link>
          {shops.map((s) => (
            <Link
              key={s.id}
              href={`/admin/stock-transfers/suggested?shop=${s.id}`}
              className={`rounded-full px-3 py-1 text-xs ${selectedShop === s.id ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 dark:bg-surface-800"}`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-200 text-left text-[11px] uppercase tracking-wide text-surface-400 dark:border-surface-800">
              <tr>
                <th className="px-4 py-2.5">{t("sr_c_product", lang)}</th>
                <th className="px-3 py-2.5 text-right">{t("sr_c_shop_stock", lang)}</th>
                <th className="px-3 py-2.5 text-right">{t("sr_c_daily", lang)}</th>
                <th className="px-3 py-2.5 text-right">{t("sr_c_days", lang)}</th>
                <th className="px-3 py-2.5 text-right">{t("sr_c_warehouse", lang)}</th>
                <th className="px-3 py-2.5 text-right">{t("sr_c_send", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {rows.map((r) => {
                const key = `${r.shopId}:${r.productId}`;
                const short = r.warehouseOnHand < r.suggestedQty;
                return (
                  <tr key={key} className="hover:bg-brand-25 dark:hover:bg-surface-800/40">
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-surface-900 dark:text-surface-100">{r.productName}</span>
                        {r.packSize && <span className="text-[11px] text-surface-400">{r.packSize}</span>}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${URGENCY[r.urgency] ?? ""}`}>
                          {t(`sr_u_${r.urgency}` as never, lang)}
                        </span>
                      </span>
                      {showShopPicker && <span className="mt-0.5 block text-[11px] text-surface-400">{r.shopName}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.shopOnHand}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-surface-500">{r.dailyRate}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {/* Bikri hi na hui ho to raftaar maloom nahi -- sifar
                          likhna "aaj khatam" kehta, jo jhoot hota. */}
                      {r.daysCover === null ? <span className="text-surface-400">—</span> : r.daysCover}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${short ? "text-danger-600" : ""}`}>
                      {r.warehouseOnHand}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Input
                        type="number"
                        min={0}
                        className="ml-auto w-20 text-right"
                        value={qty[key] ?? r.suggestedQty}
                        onChange={(e) => setQty((q) => ({ ...q, [key]: Number(e.target.value) }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {state.error && (
        <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{state.error}</p>
      )}
      {state.success && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> {t("sr_done", lang)}
        </p>
      )}
      {mixedShops && (
        <p className="flex items-center gap-2 rounded-lg bg-wheat-50 px-3 py-2 text-sm text-wheat-600">
          <AlertTriangle className="h-4 w-4" /> {t("sr_one_shop", lang)}
        </p>
      )}

      <form action={action} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
        <input type="hidden" name="items_json" value={itemsJson} />
        <input type="hidden" name="from_location" value="central" />
        <input type="hidden" name="to_location" value={shopOfPicked ?? ""} />
        <p className="text-sm text-surface-600 dark:text-surface-300">
          {t("sr_selected", lang).replace("{n}", String(picked.length))}
        </p>
        <SubmitButton disabled={picked.length === 0 || mixedShops} label={t("sr_create", lang)} />
      </form>
    </div>
  );
}

function SubmitButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      <PackagePlus className="mr-1.5 h-4 w-4" /> {label}
    </Button>
  );
}
