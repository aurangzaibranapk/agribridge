import Link from "next/link";
import { Store, Building2, Warehouse, Users, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

/**
 * Karobar ka darakht — kis shaakh mein kaun si dukan.
 *
 * =====================================================================
 * YE SAFHA KYUN BANA
 * =====================================================================
 *
 * Malik (6 September): *"jaise team tree hai waise tree hona chahiye —
 * kis branch mein kaun kaun si shop hai."*
 *
 * Us se pehle unhon ne naqsha bhi likh diya tha: *"pehle branch create
 * hona chahiye, phir option branch ke andar create shop ka. HQ warehouse
 * kisi branch ka nahi, na kisi shop ka hai — wo alag hai."*
 *
 * Ye maang ek asal takleef se nikli. Live par **"Main Branch" naam ki DO
 * shaakhein** hain: ek ke neeche do dukanein, doosri bilkul khali. Users
 * ke safhe par dono bilkul ek jaisi nazar aati hain, is liye malik ne
 * khali wali chun li — aur Shop ka khana khali hi raha, bina koi wajah
 * bataye.
 *
 * Fehrist se ye baat kabhi nazar nahi aati. Darakht se pehli nazar mein
 * aa jati hai.
 *
 * =====================================================================
 * TEEN BAATEIN JAAN BOOJH KAR
 * =====================================================================
 *
 * 1. **Jis shaakh ke neeche koi dukan nahi, wo CHHUPTI nahi.** Wahi to
 *    dekhne wali cheez hai -- aisi shaakh par kaam karne wale ko dukan
 *    chuni hi nahi ja sakti.
 *
 * 2. **Ek naam do dafa ho to nishan lagta hai.** Ye wo qism ki ghalti
 *    hai jo screen par bilkul theek lagti hai aur ghante zaya karati
 *    hai.
 *
 * 3. **HQ ka godam darakht se BAHAR hai.** Malik ka apna usool: wo kisi
 *    shaakh ya dukan ka nahi. Usay kisi shaakh ke neeche dikha dena wo
 *    rishta bana deta jo hai hi nahi.
 */
export default async function BranchTreePage() {
  const supabase = createClient();

  const [{ data: branches }, { data: shops }, { data: warehouses }, { data: staff }] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, district, tehsil, is_main_branch, is_distribution_center, is_active, created_at")
      .order("is_main_branch", { ascending: false })
      .order("name"),
    supabase.from("shops").select("id, name, business_type, branch_id, is_active").order("name"),
    supabase.from("warehouses").select("id, name, code, branch_id, shop_id, is_active").order("name"),
    supabase.from("profiles").select("id, full_name, role, branch_id, shop_id").eq("is_active", true),
  ]);

  const QISM: Record<string, string> = {
    karyana: "Karyana",
    agri_inputs: "Agri Inputs",
    grain_procurement: "Anaj",
    dairy: "Doodh",
    machinery_fleet: "Machinery",
    vet: "Vet",
  };

  const sabShops = shops ?? [];
  const sabWarehouses = warehouses ?? [];
  const sabStaff = staff ?? [];

  // Ek naam do dafa? Ye wohi jaal hai jis mein malik phanse.
  const naamGinti = new Map<string, number>();
  for (const b of branches ?? []) naamGinti.set(b.name, (naamGinti.get(b.name) ?? 0) + 1);

  // HQ ka godam: jis ka koi dukan se rishta nahi.
  const alagGodam = sabWarehouses.filter((w) => !w.shop_id);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Karobar ka darakht"
        description="Kis shaakh mein kaun si dukan — aur HQ ka godam alag"
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/branches" className="rounded-lg border border-surface-200 px-3 py-1.5 text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300">
          Shaakhon ki fehrist
        </Link>
        <Link href="/admin/shops" className="rounded-lg border border-surface-200 px-3 py-1.5 text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300">
          Dukanein
        </Link>
      </div>

      <Card>
        {/* JAR */}
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E4A2E] text-white">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-semibold text-surface-900 dark:text-white">
              Al Rana Traders
            </p>
            <p className="text-xs text-surface-500">
              {(branches ?? []).length} shaakhein · {sabShops.length} dukanein
            </p>
          </div>
        </div>

        {/* SHAAKHEIN */}
        <div className="mt-4 space-y-3 border-l-2 border-surface-200 pl-4 dark:border-surface-700">
          {(branches ?? []).map((b) => {
            const meriDukanein = sabShops.filter((s) => s.branch_id === b.id);
            const mereLog = sabStaff.filter((p) => p.branch_id === b.id);
            const naamDoDafa = (naamGinti.get(b.name) ?? 0) > 1;

            return (
              <div key={b.id} className="relative">
                <span className="absolute -left-[1.3rem] top-4 h-px w-3 bg-surface-200 dark:bg-surface-700" />
                <div className="rounded-xl border border-surface-200 bg-white p-3 dark:border-surface-800 dark:bg-surface-900">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#1E4A2E] dark:text-brand-400" />
                    <span className="font-medium text-surface-900 dark:text-white">{b.name}</span>
                    {b.is_main_branch && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        Main
                      </span>
                    )}
                    {b.is_distribution_center && (
                      <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[11px] text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                        Distribution
                      </span>
                    )}
                    {!b.is_active && (
                      <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[11px] text-surface-500">band</span>
                    )}
                    <span className="text-xs text-surface-400">
                      {[b.district, b.tehsil].filter(Boolean).join(", ")}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-xs text-surface-500">
                      <Users className="h-3.5 w-3.5" /> {mereLog.length}
                    </span>
                  </div>

                  {/* Ek naam do dafa -- wahi jaal jis mein malik phanse. */}
                  {naamDoDafa && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Is naam ki ek se zyada shaakhein hain — chunte waqt ghalat wali lag sakti hai. Naam
                      alag rakhein ya khali wali band kar dein.
                    </p>
                  )}

                  {/* DUKANEIN */}
                  <div className="mt-2 space-y-1.5 border-l-2 border-surface-100 pl-3 dark:border-surface-800">
                    {meriDukanein.length === 0 ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Koi dukan nahi — is shaakh par kaam karne wale ko dukan chuni hi nahi ja sakegi.
                      </p>
                    ) : (
                      meriDukanein.map((s) => {
                        const godam = sabWarehouses.filter((w) => w.shop_id === s.id);
                        const dukanKeLog = sabStaff.filter((p) => p.shop_id === s.id);
                        return (
                          <div key={s.id} className="flex flex-wrap items-center gap-2 text-xs">
                            <Store className="h-3.5 w-3.5 text-[#A9791A]" />
                            <span className="font-medium text-surface-800 dark:text-surface-200">{s.name}</span>
                            <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[11px] text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                              {QISM[s.business_type] ?? s.business_type}
                            </span>
                            {godam.map((w) => (
                              <span key={w.id} className="flex items-center gap-1 text-[11px] text-surface-500">
                                <Warehouse className="h-3 w-3" /> {w.name}
                              </span>
                            ))}
                            {godam.length === 0 && (
                              <span className="text-[11px] text-amber-700 dark:text-amber-400">godam nahi</span>
                            )}
                            <span className="flex items-center gap-1 text-[11px] text-surface-400">
                              <Users className="h-3 w-3" /> {dukanKeLog.length}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* HQ KA GODAM -- DARAKHT SE BAHAR */}
      <Card>
        <p className="flex items-center gap-2 font-display text-sm font-semibold text-surface-900 dark:text-white">
          <Warehouse className="h-4 w-4 text-[#1E4A2E] dark:text-brand-400" /> HQ ka godam — alag
        </p>
        <p className="mt-1 text-xs text-surface-500">
          Malik ka usool: HQ ka godam kisi shaakh ya dukan ka nahi hota. Is liye wo darakht ke andar nahi,
          alag likha jata hai.
        </p>
        <div className="mt-3 space-y-1.5">
          {alagGodam.length === 0 ? (
            <p className="text-xs text-surface-400">Koi aisa godam nahi.</p>
          ) : (
            alagGodam.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-2 text-xs">
                <Warehouse className="h-3.5 w-3.5 text-surface-400" />
                <span className="font-medium text-surface-800 dark:text-surface-200">{w.name}</span>
                {w.code && <span className="font-mono text-[11px] text-surface-400">{w.code}</span>}
                {w.branch_id && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    abhi ek shaakh se juRa hua hai
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
