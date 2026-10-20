"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { Scale } from "lucide-react";
import { linkedSettlementMaangein, type ActionState } from "@/actions/settlements";
import { t, type Lang } from "@/lib/i18n/translations";
import type { LinkedParty } from "@/lib/party-links/load";

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;

function Btn({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2747] px-3 py-2 text-sm font-medium text-white hover:bg-[#16345e] disabled:opacity-50">{children}</button>;
}

/** 622: Dr 2000 supplier / Cr 1100 customer — linked party ka adjustment, maker-checker ke sath. */
export function LinkedSettlementForm({ lang, links }: { lang: Lang; links: LinkedParty[] }) {
  const [s, action] = useFormState(linkedSettlementMaangein, {} as ActionState);
  const [linkId, setLinkId] = useState(links[0]?.id ?? "");
  const l = links.find((x) => x.id === linkId);
  const inp = "w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900";
  if (!links.length) return null;
  return (
    <form action={action} className="mb-4 space-y-3 rounded-xl border border-[#0f2747]/20 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-center gap-2 font-semibold text-[#0f2747] dark:text-white"><Scale className="h-4 w-4" />{t("pl_settle_title", lang)}</div>
      <p className="text-xs text-surface-500">{t("pl_settle_hint", lang)}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm"><span className="mb-1 block font-medium">{t("pl_linked_party", lang)}</span>
          <select name="party_link_id" value={linkId} onChange={(e) => setLinkId(e.target.value)} className={inp}>
            {links.map((x) => <option key={x.id} value={x.id}>{x.customerName} ↔ {x.supplierName}</option>)}
          </select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">{t("pl_amount", lang)}</span>
          <input name="amount" type="number" min="1" step="0.01" max={l?.settleLimit || undefined} required className={inp} />
          <span className="mt-1 block text-[11px] text-surface-400">{t("pl_limit", lang)}: {rs(l?.settleLimit ?? 0)} · 1100 {rs(l?.customerReceivable ?? 0)} · 2000 {rs(l?.supplierPayable ?? 0)}</span></label>
        <label className="text-sm"><span className="mb-1 block font-medium">{t("pl_reason", lang)}</span>
          <input name="wajah" required className={inp} placeholder="Diesel ka dena, saman ke lena se kata" /></label>
      </div>
      <div className="flex items-center gap-3"><Btn>{t("pl_request_btn", lang)}</Btn>
        {s.error ? <span className="text-sm text-red-600">{s.error}</span> : s.message ? <span className="text-sm text-emerald-700">{s.message}</span> : null}</div>
    </form>
  );
}
