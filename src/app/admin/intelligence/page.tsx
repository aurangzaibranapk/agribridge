import Link from "next/link";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { PARTY_TYPES, type PartyType } from "@/lib/intelligence/core";
import { listParties } from "@/lib/intelligence/data";
import { requireIntelligence } from "@/lib/intelligence/access";

export const dynamic = "force-dynamic";

const PARTY_LABEL_KEY = {
  customer: "ppi_type_customer", farmer: "ppi_type_farmer", dealer: "ppi_type_dealer", supplier: "ppi_type_supplier",
  buyer: "ppi_type_buyer", investor: "ppi_type_investor", staff: "ppi_type_staff",
} as const;

export default async function IntelligencePage({ searchParams }: { searchParams: { type?: string; q?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const me = await requireIntelligence("intelligence.party");
  if (!me) return <div className="p-8 text-center text-surface-500">{t("ppi_no_access", lang)}</div>;
  const type: PartyType = (PARTY_TYPES as readonly string[]).includes(searchParams.type ?? "") ? (searchParams.type as PartyType) : "customer";
  const q = (searchParams.q ?? "").slice(0, 60);
  const { rows, error } = await listParties(type, q, me.organization_id);
  return (
    <div className="space-y-4">
      <PageHeader title={t("ppi_title", lang)} description={t("ppi_subtitle", lang)} actions={<Link href="/admin/intelligence/products" className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white">{t("ppi_products", lang)}</Link>} />
      <div className="flex flex-wrap gap-2 text-sm">
        {PARTY_TYPES.map((pt) => <Link key={pt} href={`?type=${pt}`} className={`rounded-full border px-3 py-1 ${pt === type ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-surface-200 text-surface-600"}`}>{t(PARTY_LABEL_KEY[pt], lang)}</Link>)}
      </div>
      <form className="flex gap-2"><input type="hidden" name="type" value={type} /><input name="q" defaultValue={q} placeholder={t("ppi_search", lang)} className="w-64 rounded-lg border px-3 py-1.5 text-sm" /><button className="rounded-lg border px-3 text-sm">{t("ppi_search", lang)}</button></form>
      {error && <p className="text-xs text-red-700">{t("ppi_data_na", lang)}: {error}</p>}
      <Card className="divide-y divide-surface-100 p-0">
        {rows.map((r: { id: string; name: string; sub: string }) => (
          <Link key={r.id} href={`/admin/intelligence/party?type=${type}&id=${r.id}`} className="flex justify-between px-4 py-2.5 text-sm hover:bg-surface-50">
            <span className="font-medium">{r.name}</span><span className="text-xs text-surface-500">{r.sub}</span>
          </Link>
        ))}
        {!rows.length && <p className="p-6 text-center text-sm text-surface-400">{t("ppi_none", lang)}</p>}
      </Card>
    </div>
  );
}
