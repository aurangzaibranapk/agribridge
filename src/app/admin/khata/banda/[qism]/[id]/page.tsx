import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { BandaKhataClient } from "./banda-khata-client";
import { ArrowUpCircle, ArrowDownCircle, Scale } from "lucide-react";

export const dynamic = "force-dynamic";

const QISMEIN = ["farmer", "staff", "customer", "supplier"] as const;

/**
 * Ek banda, ek khata.
 *
 * =====================================================================
 * MALIK KA MARKAZI USOOL (6 September)
 * =====================================================================
 *
 *   *"One Person -> One ID -> One General Khata -> Many Activities ->
 *   One Financial Truth."*
 *
 *   *"Alag Labour Khata, Milk Khata, Shop Khata, Expense Khata bana dena
 *   system ko mushkil karega. Hamein ek aadmi ki ek hi General/Unified
 *   Party Ledger rakhni chahiye. Modules sirf transaction ka source
 *   batayenge."*
 *
 * Ye safha wo khata hai. Yahan koi naya table nahi -- ye ledger ki wohi
 * qatarein hain jin par is bande ka naam laga hua hai, chahe wo POS se
 * aayi hon, doodh se, mazdoori se ya kharche se.
 *
 * `source_module` sirf ye batata hai ke qatar KAHAN se aayi -- us se
 * chhanti banti hai, alag khata nahi.
 *
 * =====================================================================
 * GROSS LENA AUR DENA -- SIRF NET NAHI
 * =====================================================================
 *
 *   *"UI mein gross Lena aur Dena bhi alag dikhna chahiye, sirf net
 *   balance nahi."*
 *
 * Wajah malik ke apne misaal mein hai: khaad ka Rs 10,000 lena aur
 * mazdoori ka Rs 3,000 dena. Sirf "Rs 7,000 lena" likh dena DONO baatein
 * chhupa deta hai -- wasooli karne wala nahi jaanta ke us ki mazdoori
 * baqi hai, aur mazdoori dene wala nahi jaanta ke us par udhaar hai.
 *
 * Aur ye do adad "net" ke saath rakhne ka ek aur faida hai: set-off
 * apne aap NAHI hota. Dono taraf ki raqam kaatne ke liye alag, manzoor
 * shuda qadam chahiye.
 */
export default async function BandeKaKhataPage({
  params,
}: {
  params: Promise<{ qism: string; id: string }>;
}) {
  const { qism, id } = await params;
  if (!(QISMEIN as readonly string[]).includes(qism)) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const service = createServiceClient();
  const loose = service as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  };

  // Naam us ki apni fehrist se.
  let naam = "";
  let tafseel = "";
  if (qism === "farmer") {
    const { data } = await service.from("farmers").select("full_name, phone_number").eq("id", id).maybeSingle();
    naam = data?.full_name ?? "";
    tafseel = data?.phone_number ?? "";
  } else if (qism === "staff") {
    const { data } = await service.from("profiles").select("full_name, role").eq("id", id).maybeSingle();
    naam = data?.full_name ?? "";
    tafseel = String(data?.role ?? "");
  } else if (qism === "customer") {
    const { data } = await service.from("customers").select("name, phone_number").eq("id", id).maybeSingle();
    naam = data?.name ?? "";
    tafseel = data?.phone_number ?? "";
  } else {
    const { data } = await service.from("suppliers").select("name, phone_number").eq("id", id).maybeSingle();
    naam = data?.name ?? "";
    tafseel = data?.phone_number ?? "";
  }

  const [{ data: khulasa }, { data: lenden }] = await Promise.all([
    loose.rpc("fn_bande_ka_khulasa", { p_party_type: qism, p_party_id: id }),
    loose.rpc("fn_bande_ka_saara_lenden", { p_party_type: qism, p_party_id: id }),
  ]);

  const khaate = ((khulasa ?? []) as any[]).map((k) => ({
    code: String(k.khata_code),
    naam: String(k.khata_naam),
    lena: Number(k.lena ?? 0),
    dena: Number(k.dena ?? 0),
  }));

  const kulLena = khaate.reduce((s, k) => s + k.lena, 0);
  const kulDena = khaate.reduce((s, k) => s + k.dena, 0);
  const net = kulLena - kulDena;

  const qatarein = ((lenden ?? []) as any[]).map((l) => ({
    tareekh: String(l.entry_date),
    number: String(l.entry_number),
    tafseel: String(l.tafseel ?? ""),
    module: String(l.module ?? ""),
    khataCode: String(l.khata_code ?? ""),
    khataNaam: String(l.khata_naam ?? ""),
    debit: Number(l.debit ?? 0),
    credit: Number(l.credit ?? 0),
    baqiParAsar: l.baqi_par_asar === true,
  }));

  return (
    <div>
      <PageHeader
        title={naam || "(naam nahi mila)"}
        description={`${qism}${tafseel ? ` — ${tafseel}` : ""} · ek hi khata, har module ki qatarein`}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Aap ko is se LENA" value={`Rs. ${Math.round(kulLena).toLocaleString()}`} icon={ArrowUpCircle} tone="brand" />
        <StatCard label="Aap ne is ko DENA" value={`Rs. ${Math.round(kulDena).toLocaleString()}`} icon={ArrowDownCircle} tone="warn" />
        <StatCard
          label={net >= 0 ? "Net — lena" : "Net — dena"}
          value={`Rs. ${Math.abs(Math.round(net)).toLocaleString()}`}
          icon={Scale}
          tone={net >= 0 ? "blue" : "orange"}
        />
      </div>

      {/* Har khata alag -- taake ek baat doosri ko chhupa na de. */}
      {khaate.length > 0 && (
        <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-1 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Kis baat ka lena, kis baat ka dena
          </h2>
          <p className="mb-3 text-xs text-surface-400">
            Ye do adad khud-ba-khud ek doosre se nahi katte. Kaatne ke liye alag, manzoor shuda adjustment chahiye —
            warna baad mein koi nahi bata sakta ke kis cheez ka paisa kahan gaya.
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-xs text-surface-500 dark:border-surface-800">
                <th className="py-2 pr-3">Khata</th>
                <th className="py-2 pr-3 text-right">Lena</th>
                <th className="py-2 pr-3 text-right">Dena</th>
              </tr>
            </thead>
            <tbody>
              {khaate.map((k) => (
                <tr key={k.code} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                  <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">{k.naam}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    {k.lena > 0 ? `Rs. ${Math.round(k.lena).toLocaleString()}` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-400">
                    {k.dena > 0 ? `Rs. ${Math.round(k.dena).toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BandaKhataClient qatarein={qatarein} />
    </div>
  );
}
