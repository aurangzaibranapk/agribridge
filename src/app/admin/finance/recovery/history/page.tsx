import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/layout-primitives";
export const dynamic="force-dynamic";
export default async function RecoveryHistoryPage(){
 const db=createClient() as any;
 const [{data:reminders},{data:shares}]=await Promise.all([
  db.from("payment_reminders").select("id,party_type,party_id,outstanding_amount,channel,delivery_status,scheduled_at,sent_at,failure_reason,created_at").order("created_at",{ascending:false}).limit(200),
  db.from("statement_share_history").select("id,party_type,party_id,channel,recipient,delivery_status,sent_at,failure_reason,created_at").order("created_at",{ascending:false}).limit(100)
 ]);
 return <div className="space-y-4"><PageHeader title="Recovery History" description="Reminder aur statement bhejne ka sachcha record."/><Link href="/admin/finance/recovery" className="text-sm underline">← Recovery Dashboard</Link><Card className="p-0"><div className="overflow-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-surface-50 text-left text-xs"><tr><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Party</th><th className="p-3">Channel</th><th className="p-3">Status</th><th className="p-3">Failure</th></tr></thead><tbody>{[...(reminders||[]).map((r:any)=>({...r,kind:"Reminder"})),...(shares||[]).map((r:any)=>({...r,kind:"Statement"}))].sort((a:any,b:any)=>String(b.created_at).localeCompare(String(a.created_at))).map((r:any)=><tr key={`${r.kind}-${r.id}`} className="border-t"><td className="p-3">{new Date(r.created_at).toLocaleString("en-PK")}</td><td className="p-3">{r.kind}</td><td className="p-3 capitalize">{r.party_type}</td><td className="p-3 capitalize">{r.channel}</td><td className="p-3 capitalize">{String(r.delivery_status).replaceAll("_"," ")}</td><td className="max-w-xs p-3 text-xs text-red-600">{r.failure_reason||"—"}</td></tr>)}</tbody></table></div></Card></div>;
}
