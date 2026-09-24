"use client";
import { useState, useTransition } from "react";
import { t, type Lang } from "@/lib/i18n/translations";
import { useFormState } from "react-dom";
import { Search, RotateCcw, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { returnPosSale, setAuthCode, type ReturnState } from "@/actions/pos-returns";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Textarea } from "@/components/ui/form";

const initialState: ReturnState = {};

interface FoundSale {
  id: string;
  createdAt: string;
  total: number;
  cash: number;
  khata: number;
  status: string;
  items: { name: string; quantity: number; unitPrice: number }[];
}

export function ReturnsClient({
  canHoldCode,
  hasCode,
  myName,
  myId,
  lang,
}: {
  canHoldCode: boolean;
  hasCode: boolean;
  myName: string;
  myId: string;
  /** Zaban server se aati hai -- dekhein pos-client.tsx ka note. */
  lang: Lang;
}) {
  const [state, formAction] = useFormState(returnPosSale, initialState);
  const [codeState, codeAction] = useFormState(setAuthCode, initialState);

  const [query, setQuery] = useState("");
  const [sale, setSale] = useState<FoundSale | null>(null);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /**
   * Bikri dhoondna. Raseed ka number nahi hota -- POS bikri ki apni id
   * deta hai, aur wohi raseed par chhapti hai. Is liye yahan wohi id
   * maangi jati hai, ya us ka aakhri hissa (jo parhne mein aasan hai).
   */
  function lookup() {
    setLookupMsg(null);
    setSale(null);
    const q = query.trim();
    if (q.length < 4) {
      setLookupMsg(t("pos_receipt_number_short", lang));
      return;
    }

    start(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pos_sales")
        .select("id, created_at, total_amount, cash_paid, khata_amount, status, pos_sale_items(quantity, unit_price, products(name))")
        .ilike("id", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setLookupMsg(t("pos_sale_not_found", lang));
        return;
      }

      setSale({
        id: data.id,
        createdAt: data.created_at,
        total: Number(data.total_amount),
        cash: Number(data.cash_paid ?? 0),
        khata: Number(data.khata_amount ?? 0),
        status: data.status,
        items: (data.pos_sale_items ?? []).map((i: any) => ({
          name: i.products?.name ?? "—",
          quantity: Number(i.quantity),
          unitPrice: Number(i.unit_price),
        })),
      });
    });
  }

  return (
    <div className="space-y-4">
      {canHoldCode && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-brand-600" />
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              {t("pos_your_code", lang)}{" "}
              {hasCode ? <Badge tone="green">{t("pos_code_set", lang)}</Badge> : <Badge tone="red">{t("pos_code_not_set", lang)}</Badge>}
            </h2>
          </div>
          <p className="text-sm text-surface-600 dark:text-surface-300">
            {myName} — {t("pos_code_explain", lang)}
          </p>
          {codeState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{codeState.error}</p>}
          {codeState.notice && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{codeState.notice}</p>
          )}
          <form action={codeAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="profile_id" value={myId} />
            <div>
              <Label>{t("pos_new_code", lang)}</Label>
              <Input name="code" type="password" inputMode="numeric" autoComplete="new-password" placeholder="****" />
            </div>
            <div>
              <Label>{t("pos_code_again", lang)}</Label>
              <Input name="code_again" type="password" inputMode="numeric" autoComplete="new-password" placeholder="****" />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              {hasCode ? t("pos_change_code", lang) : t("pos_set_code", lang)}
            </Button>
          </form>
        </Card>
      )}

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-brand-600" />
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("pos_return_do", lang)}</h2>
        </div>

        <div>
          <Label>{t("pos_receipt_number", lang)}</Label>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lookup();
                }
              }}
              placeholder={t("pos_receipt_number_hint", lang)}
            />
            <Button type="button" variant="secondary" onClick={lookup} disabled={pending}>
              <Search className="h-4 w-4" /> {pending ? t("pos_searching", lang) : t("pos_search", lang)}
            </Button>
          </div>
          {lookupMsg && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{lookupMsg}</p>}
        </div>

        {sale && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 dark:border-brand-900/40 dark:bg-brand-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-surface-600 dark:text-surface-300">
                {new Date(sale.createdAt).toLocaleString()}
              </p>
              <Badge tone={sale.status === "completed" ? "green" : "red"}>
                {sale.status === "completed" ? t("pos_return_possible", lang) : `${t("pos_already", lang)} ${sale.status}`}
              </Badge>
            </div>
            <ul className="mt-2 space-y-0.5 text-sm">
              {sale.items.map((i, n) => (
                <li key={n} className="text-surface-800 dark:text-surface-100">
                  {i.name} — {i.quantity} × Rs {i.unitPrice.toLocaleString()}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-medium text-surface-900 dark:text-surface-100">
              {t("pos_total", lang)} Rs {sale.total.toLocaleString()}
              {sale.khata > 0 && ` (${t("pos_khata_credit", lang)} Rs ${sale.khata.toLocaleString()})`}
            </p>
            <p className="mt-1 text-xs text-surface-500">
              {t("pos_full_return_note", lang)}
            </p>
          </div>
        )}

        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        {state.success && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {t("pos_return_number", lang)} — {state.returnNumber}. {state.notice ?? t("pos_return_done", lang)}
          </p>
        )}

        {sale && sale.status === "completed" && (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="sale_id" value={sale.id} />
            <div>
              <Label>{t("pos_return_reason", lang)}</Label>
              <Textarea name="reason" rows={2} placeholder={t("pos_return_reason_example", lang)} />
              <p className="mt-1 text-xs text-surface-500">{t("pos_return_reason_hint", lang)}</p>
            </div>
            <div>
              <Label>{t("pos_manager_code", lang)}</Label>
              <Input name="manager_code" type="password" inputMode="numeric" autoComplete="off" placeholder="****" />
              <p className="mt-1 text-xs text-surface-500">
                {t("pos_manager_code_hint", lang)}
              </p>
            </div>
            <Button type="submit">{t("pos_return_do", lang)}</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
