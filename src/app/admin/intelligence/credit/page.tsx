import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireIntelligence } from "@/lib/intelligence/access";
import { TRUST_LABEL, trustOf, type Band, type Trust } from "@/lib/recovery/credit-report";
import { TRUST_CLS } from "@/components/party360/credit-report-card";

export const dynamic = "force-dynamic";
const CARD = "rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#24324a]";
const TYPE_LABEL: Record<string, string> = { customer: "Customer", farmer: "Kisan", vendor: "Vendor" };

/** 541: Members ka credit darja -- kis par bharosa, kis par nahi. */
export default async function CreditCategoriesPage({ searchParams }: { searchParams: { trust?: string } }) {
  const me = await requireIntelligence("intelligence.party");
  if (!me) return <div className="p-8 text-center text-slate-500">Ijazat nahi.</div>;
  const sb = createClient() as any;
  const { data } = await sb.from("v_member_credit_categories").select("*").limit(2000);
  const rows = (data ?? []).map((r: any) => ({ ...r, trust: trustOf({ band: r.band as Band | null, defaultActive: r.default_active, state: r.state }) as Trust }));
  const count = (t: Trust) => rows.filter((r: any) => r.trust === t).length;
  const filter = searchParams.trust as Trust | undefined;
  const shown = rows.filter((r: any) => !filter || r.trust === filter).sort((a: any, b: any) => (a.score ?? 999) - (b.score ?? 999)).slice(0, 300);
  const tiles: [Trust, string][] = [["trusted", "#0F766E"], ["watch", "#B7791F"], ["risky", "#DC2626"], ["default", "#7F1D1D"], ["building", "#64748B"]];
  return (
    <div className="space-y-4 bg-[#F6F7FB] p-1 text-slate-900 dark:bg-[#172033] dark:text-slate-100">
      <div><h1 className="text-xl font-bold">Members ka credit darja</h1><p className="text-sm text-slate-500 dark:text-slate-400">Kis par bharosa, kis par nahi — andaroni credit report (tasdeeq) se.</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([t, c]) => <Link key={t} href={filter === t ? "?" : `?trust=${t}`} className={`${CARD} border-t-4`} style={{ borderTopColor: c }}><div className="text-xs text-slate-500 dark:text-slate-400">{TRUST_LABEL[t]}</div><div className="mt-1 text-2xl font-bold tabular-nums">{count(t)}</div></Link>)}
      </div>
      <div className={`${CARD} overflow-auto p-0`}>
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="text-left text-xs text-slate-500 dark:text-slate-400"><th className="p-3">Member</th><th>Qisam</th><th>Score</th><th>Darja</th><th>Updated</th></tr></thead>
          <tbody>{shown.map((r: any) => (
            <tr key={`${r.subject_type}-${r.subject_id}`} className="border-t border-slate-100 dark:border-white/[0.06]">
              <td className="p-3">{r.subject_type === "vendor" ? (r.name ?? "Vendor") : <Link className="font-medium hover:underline" href={`/admin/intelligence/party?type=${r.subject_type}&id=${r.subject_id}`}>{r.name ?? r.subject_id.slice(0, 8)}</Link>}</td>
              <td>{TYPE_LABEL[r.subject_type] ?? r.subject_type}</td><td className="tabular-nums">{r.score ?? "—"}</td>
              <td><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TRUST_CLS[r.trust as Trust]}`}>{r.band ? `${r.band} · ` : ""}{TRUST_LABEL[r.trust as Trust]}</span></td>
              <td className="text-xs text-slate-500">{r.snapshot_date}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
