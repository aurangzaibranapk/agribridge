import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { handoverGate, loadHandoverParties } from "@/lib/milk-handover-page";
import { HandoverTabs } from "../tabs";
import { PartyMaster } from "./party-form";

export const dynamic = "force-dynamic";

export default async function HandoverPartiesPage({ searchParams }: { searchParams?: { date?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const gate = await handoverGate("view");
  if ("error" in gate) return <p className="p-8 text-center text-sm text-surface-500">{gate.error}</p>;
  const date = searchParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : "";
  const loaded = await loadHandoverParties();

  return (
    <div>
      <PageHeader title={t("mh_parties_title", lang)} description={t("mh_parties_sub", lang)} />
      <HandoverTabs lang={lang} current="parties" date={date} />
      {loaded.error && <p className="mb-3 text-sm text-amber-800">{loaded.error}</p>}
      <Card>
        {gate.canWrite ? (
          <PartyMaster lang={lang} parties={loaded.parties} />
        ) : (
          <ul className="space-y-2 text-sm">
            {loaded.parties.length === 0 && <li>{t("mh_party_none", lang)}</li>}
            {loaded.parties.map((party) => (
              <li key={party.id}>
                {party.name}{party.contact ? ` · ${party.contact}` : ""}{party.active ? "" : " (band)"}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
