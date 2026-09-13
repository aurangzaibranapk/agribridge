"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, Save, Sparkles, Check } from "lucide-react";
import { saveMissingRates, type RateState } from "@/actions/product-rates";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: RateState = {};

interface Row {
  id: string;
  name: string;
  packSize: string | null;
  barcode: string | null;
  sellingPrice: number | null;
  purchasePrice: number | null;
  mrpPrice: number | null;
  saleMissing: boolean;
  tradeMissing: boolean;
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

/**
 * Saari baqi qatarein ek hi form mein.
 *
 * Har product ka apna form banane se banda ek ek kar ke kholta hai aur
 * beech mein ek chhoot jata hai. Yahan sab saamne hain: jo maloom ho wo
 * bhar dein, baqi khali chhoR dein -- khali khana kuch nahi badalta.
 */
export function RatesClient({ lang, rows }: { lang: Lang; rows: Row[] }) {
  const [state, action] = useFormState(saveMissingRates, initial);

  // AI ki tajweez -- asal naam se durust naam.
  //
  // Tajweez khud kabhi nahi lagti. Wo saamne aati hai aur banda us par
  // click kar ke qabool karta hai. Product ka naam har raseed aur
  // counter par jata hai; usay AI ke haath mein dena us jagah khatarnak
  // hai jahan sab se zyada nazar paRti hai.
  const [suggest, setSuggest] = useState<Record<string, string>>({});
  const [aiState, setAiState] = useState<"idle" | "busy" | "none" | "off">("idle");
  const nameRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function askAi() {
    setAiState("busy");
    try {
      const res = await fetch("/api/products/name-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Wohi naam bhejein jo is waqt khane mein likha hai -- banda
        // pehle se kuch theek kar chuka ho to us par dobara tajweez
        // maangna us ka kaam ulta deta hai.
        body: JSON.stringify({ names: rows.map((r) => nameRefs.current[r.id]?.value?.trim() || r.name) }),
      });
      if (!res.ok) {
        setAiState("off");
        return;
      }
      const data = (await res.json()) as { suggestions?: Record<string, string> };
      const got = data.suggestions ?? {};
      setSuggest(got);
      setAiState(Object.keys(got).length === 0 ? "none" : "idle");
    } catch {
      setAiState("off");
    }
  }

  function accept(id: string, name: string, asal: string) {
    const el = nameRefs.current[id];
    if (el) el.value = name;
    setSuggest((cur) => {
      const next = { ...cur };
      delete next[asal];
      return next;
    });
  }

  return (
    <form action={action} className="space-y-3">
      <Card>
        <p className="text-sm text-surface-600">{t("pf_rb_hint", lang)}</p>
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
          <p className="text-sm text-emerald-900">
            {t("pf_rb_saved", lang).replace("{n}", String(state.saved ?? 0))}
          </p>
          {state.notice && <p className="mt-1 text-sm text-amber-800">{state.notice}</p>}
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500">
                <th className="py-2">{t("pf_th_name", lang)}</th>
                <th className="py-2">{t("pf_th_pack", lang)}</th>
                <th className="py-2 text-right">MRP</th>
                <th className="py-2 w-28">{t("pf_f_trade", lang)}</th>
                <th className="py-2 w-28">{t("pf_f_sale", lang)}</th>
                <th className="py-2">{t("pf_th_state", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-surface-100 align-top">
                  <td className="py-2 pr-2">
                    <input type="hidden" name="id" value={r.id} />
                    {/* Naam bhi yahin theek hota hai. Jo cheez banday ke
                        saamne ghalat likhi hai, us ko doosre safhe par
                        bhejna wo ghalti wahin chhoR deta hai -- aur
                        ghalat naam counter par bhi wohi rehta hai. */}
                    <Input
                      ref={(el) => {
                        nameRefs.current[r.id] = el;
                      }}
                      name={`name_${r.id}`}
                      defaultValue={r.name}
                      className="h-8 font-medium"
                      aria-label={t("pf_th_name", lang)}
                    />
                    {suggest[r.name] && (
                      <button
                        type="button"
                        onClick={() => accept(r.id, suggest[r.name], r.name)}
                        className="mt-1 inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300"
                        title={t("pf_rb_ai_accept", lang)}
                      >
                        <Check className="h-3 w-3" />
                        {suggest[r.name]}
                      </button>
                    )}
                    {r.barcode && <span className="mt-0.5 block font-mono text-xs text-surface-400">{r.barcode}</span>}
                  </td>
                  <td className="py-2 pr-2 text-surface-600">{r.packSize ?? "—"}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-surface-500">
                    {r.mrpPrice == null ? "—" : r.mrpPrice.toLocaleString()}
                  </td>
                  <td className="py-2 pr-2">
                    {/* Jo maloom nahi wo khali aata hai -- sifar nahi. */}
                    <Input
                      name={`trade_${r.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={r.purchasePrice ?? ""}
                      placeholder={r.tradeMissing ? t("pf_pending_word", lang) : ""}
                      className="h-8 text-right"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      name={`sale_${r.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={r.sellingPrice ?? ""}
                      placeholder={r.saleMissing ? t("pf_pending_word", lang) : ""}
                      className="h-8 text-right font-semibold"
                    />
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.saleMissing && <Badge tone="red">{t("pf_rb_not_sold", lang)}</Badge>}
                      {r.saleMissing && <Badge tone="amber">{t("pf_rb_sale_missing", lang)}</Badge>}
                      {r.tradeMissing && <Badge tone="gray">{t("pf_rb_trade_missing", lang)}</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-surface-200 pt-3">
          <Submit label={t("pf_rb_save", lang)} />

          <button
            type="button"
            onClick={() => void askAi()}
            disabled={aiState === "busy"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-600 hover:bg-surface-50 disabled:opacity-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
          >
            <Sparkles className="h-4 w-4 text-brand-600" />
            {aiState === "busy" ? t("pf_rb_ai_busy", lang) : t("pf_rb_ai_ask", lang)}
          </button>

          {/* Khali jawab aur "AI hai hi nahi" do alag baatein hain. */}
          {aiState === "none" && <span className="text-xs text-surface-500">{t("pf_rb_ai_none", lang)}</span>}
          {aiState === "off" && <span className="text-xs text-amber-700">{t("pf_rb_ai_off", lang)}</span>}
          {Object.keys(suggest).length > 0 && (
            <span className="text-xs text-surface-500">{t("pf_rb_ai_hint", lang)}</span>
          )}
        </div>
      </Card>
    </form>
  );
}
