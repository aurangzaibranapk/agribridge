import Link from "next/link";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { PARTY_TYPES, FACETS, summarizeParty, type PartyType } from "@/lib/intelligence/core";
import { loadParty, STATEMENT_HREF } from "@/lib/intelligence/data";
import { requireIntelligence } from "@/lib/intelligence/access";

export const dynamic = "force-dynamic";
const money = (v: number | null) => (v == null ? null : `Rs ${Math.round(v).toLocaleString("en-PK")}`);

export default async function Party360Page({ searchParams }: { searchParams: { type?: string; id?: string; days?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const me = await requireIntelligence("intelligence.party");
  if (!me) return <div className="p-8 text-center text-surface-500">{t("ppi_no_access", lang)}</div>;
  const type = searchParams.type as PartyType;
  if (!(PARTY_TYPES as readonly string[]).includes(type) || !searchParams.id) return <div className="p-8 text-center">{t("ppi_none", lang)}</div>;
  const overdueDays = Math.min(365, Math.max(1, Number(searchParams.days) || 30));
  const data = await loadParty(type, searchParams.id);
  const s = summarizeParty(type, data.events, { now: new Date(), overdueDays, balanceOverride: data.balanceOverride });
  const na = t("ppi_data_na", lang);
  const tiles: [string, string | null][] = [
    [t("ppi_bought_from_us", lang), money(s.boughtFromUs)],
    [t("ppi_sold_to_us", lang), money(s.soldToUs)],
    [t("ppi_received", lang), FACETS[type].payments ? money(s.received) : null],
    [t("ppi_paid", lang), FACETS[type].payments ? money(s.paid) : null],
    [s.balance >= 0 ? t("ppi_receivable", lang) : t("ppi_payable", lang), money(Math.abs(s.balance))],
    [`${t("ppi_overdue", lang)} (>${overdueDays}d)`, money(s.overdue)],
    [t("ppi_last_txn", lang), s.lastTransaction ? new Date(s.lastTransaction).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" }) : null],
  ];
  const recent = [...data.events].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  return (
    <div className="space-y-4">
      <PageHeader title={`${data.name} — 360`} description={t(`ppi_type_${type}` as "ppi_type_customer", lang)}
        actions={<Link href={STATEMENT_HREF[type](searchParams.id)} className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white">{t("ppi_statement", lang)}</Link>} />
      {data.truncated && <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">{t("ppi_truncated", lang)}</p>}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <Card key={label} className="p-4"><p className="text-[11px] font-semibold uppercase text-surface-500">{label}</p><p className={`mt-1 text-xl font-semibold tabular-nums ${value == null ? "text-sm text-surface-400" : ""}`}>{value ?? na}</p></Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">{t("ppi_category_pref", lang)}</h2>
          {s.categories == null ? <p className="mt-2 text-xs text-surface-400">{na}</p> : (
            <ul className="mt-2 space-y-1 text-xs">{s.categories.map((c) => <li key={c.name} className="flex justify-between"><span>{c.name}</span><span className="tabular-nums">{money(c.amount)} · {c.share}%</span></li>)}{!s.categories.length && <li className="text-surface-400">{t("ppi_none", lang)}</li>}</ul>
          )}
        </Card>
        <Card className="p-0">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">{t("ppi_recent", lang)}</h2>
          <table className="w-full text-xs"><tbody className="divide-y divide-surface-100">
            {recent.map((e, i) => <tr key={i}><td className="px-4 py-1.5">{new Date(e.date).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}</td><td>{e.kind}</td><td>{e.ref}</td><td className="pr-4 text-right tabular-nums">{money(e.amount)}</td></tr>)}
            {!recent.length && <tr><td className="p-4 text-center text-surface-400">{t("ppi_none", lang)}</td></tr>}
          </tbody></table>
        </Card>
      </div>
      <p className="text-[11px] text-surface-500">{t("ppi_sources", lang)}: {data.notes.join(" · ") || "—"}</p>
    </div>
  );
}
