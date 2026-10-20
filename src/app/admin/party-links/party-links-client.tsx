"use client";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { Link2, Unlink } from "lucide-react";
import { partyLinkBanayein, partyLinkKhatam, type LinkState } from "@/actions/party-links";
import { t, type Lang } from "@/lib/i18n/translations";
import type { LinkedParty } from "@/lib/party-links/load";

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const KHALI: LinkState = {};

function Btn({ children, tone = "navy" }: { children: React.ReactNode; tone?: "navy" | "red" }) {
  const { pending } = useFormStatus();
  const c = tone === "navy" ? "bg-[#0f2747] text-white hover:bg-[#16345e]" : "border border-red-200 text-red-700 hover:bg-red-50";
  return <button disabled={pending} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${c}`}>{children}</button>;
}

function Msg({ s }: { s: LinkState }) {
  if (s.error) return <p className="text-sm text-red-600">{s.error}</p>;
  if (s.message) return <p className="text-sm text-emerald-700">{s.message}</p>;
  return null;
}

export function NetCard({ l, lang }: { l: LinkedParty; lang: Lang }) {
  const net = l.net.net;
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950/30"><div className="text-[11px] text-surface-500">{t("pl_they_owe", lang)}</div><div className="font-semibold tabular-nums text-amber-700">{rs(l.net.theyOwe)}</div></div>
      <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950/30"><div className="text-[11px] text-surface-500">{t("pl_we_owe", lang)}</div><div className="font-semibold tabular-nums text-red-700">{rs(l.net.weOwe)}</div></div>
      <div className="rounded-lg bg-[#0f2747]/5 p-2 dark:bg-white/5"><div className="text-[11px] text-surface-500">{t("pl_net", lang)}</div><div className="font-semibold tabular-nums text-[#0f2747] dark:text-white">{rs(Math.abs(net))}</div><div className="text-[10px] text-surface-500">{net > 0 ? t("pl_net_they", lang) : net < 0 ? t("pl_net_we", lang) : t("pl_net_even", lang)}</div></div>
    </div>
  );
}

function UnlinkForm({ id, lang }: { id: string; lang: Lang }) {
  const [s, action] = useFormState(partyLinkKhatam, KHALI);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Btn tone="red"><Unlink className="h-4 w-4" />{t("pl_unlink_btn", lang)}</Btn>
      <Msg s={s} />
    </form>
  );
}

export function PartyLinksClient({ lang, links, customers, suppliers }: {
  lang: Lang; links: LinkedParty[];
  customers: { id: string; label: string }[]; suppliers: { id: string; label: string }[];
}) {
  const [s, action] = useFormState(partyLinkBanayein, KHALI);
  const sel = "w-full rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900";
  return (
    <div className="space-y-4">
      <form action={action} className="grid grid-cols-1 gap-3 rounded-xl border border-surface-200 bg-white p-4 shadow-sm sm:grid-cols-4 dark:border-surface-800 dark:bg-surface-900">
        <label className="text-sm"><span className="mb-1 block font-medium">{t("pl_customer", lang)}</span>
          <select name="customer_id" required defaultValue="" className={sel}><option value="">{t("pl_choose", lang)}</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">{t("pl_supplier", lang)}</span>
          <select name="supplier_id" required defaultValue="" className={sel}><option value="">{t("pl_choose", lang)}</option>{suppliers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">{t("pl_note", lang)}</span>
          <input name="note" className={sel} placeholder="Diesel deta hai, saman leta hai" /></label>
        <div className="flex items-end"><Btn><Link2 className="h-4 w-4" />{t("pl_link_btn", lang)}</Btn></div>
        <div className="sm:col-span-4"><Msg s={s} /></div>
      </form>

      <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-200">{t("pl_active_links", lang)}</h2>
      {links.length === 0 ? <p className="text-sm text-surface-400">{t("pl_none", lang)}</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {links.map((l) => (
            <div key={l.id} className="space-y-3 rounded-xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
              <div className="text-sm">
                <Link className="font-semibold text-[#0f2747] hover:underline dark:text-white" href={`/admin/intelligence/party?type=customer&id=${l.customerId}`}>{l.customerName}</Link>
                <span className="mx-1 text-surface-400">↔</span>
                <Link className="font-semibold text-[#0f2747] hover:underline dark:text-white" href={`/admin/intelligence/party?type=supplier&id=${l.supplierId}`}>{l.supplierName}</Link>
                {l.note ? <p className="text-xs text-surface-500">{l.note}</p> : null}
              </div>
              <NetCard l={l} lang={lang} />
              <div className="flex items-center justify-between"><span className="text-xs text-surface-500">{t("pl_limit", lang)}: {rs(l.settleLimit)}</span><UnlinkForm id={l.id} lang={lang} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
