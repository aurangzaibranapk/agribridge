import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StaffStatementClient } from "./statement-client";

export const dynamic = "force-dynamic";

export default async function StaffStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { id: profileId } = await params;
  const sp = await searchParams;
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10);
  const startDate = sp.start ?? defaultStart;
  const endDate = sp.end ?? now.toISOString().slice(0, 10);

  const supabase = createClient();
  const { data: staff } = await supabase.from("profiles").select("id, full_name, role, phone_number").eq("id", profileId).single();

  const { data: rawLedger } = await supabase
    .from("staff_credit_ledger")
    .select("id, ledger_type, source_type, amount, notes, created_at")
    .eq("profile_id", profileId)
    .gte("created_at", startDate)
    .lte("created_at", endDate + "T23:59:59")
    .order("created_at", { ascending: true });

  type Entry = { date: string; description: string; debit: number; credit: number };
  const entries: Entry[] = (rawLedger ?? []).map((l) => ({
    date: (l.created_at as string).slice(0, 10),
    description: `${l.source_type.replace(/_/g, " ")}${l.notes ? ` - ${l.notes}` : ""}`,
    debit: l.ledger_type === "debit" ? Number(l.amount) : 0,
    credit: l.ledger_type === "credit" ? Number(l.amount) : 0,
  }));

  let runningBalance = 0;
  let totalCredit = 0;
  let totalDebit = 0;
  const entriesWithBalance = entries.map((e) => {
    runningBalance += e.credit - e.debit;
    totalCredit += e.credit;
    totalDebit += e.debit;
    return { ...e, runningBalance };
  });

  return (
    <div>
      <PageHeader title={`${staff?.full_name ?? "Staff"} - Khata Statement`} description="Credits (attendance/wages) aur Debits (spending/advance) ki poori history" />
      <StaffStatementClient
        profileId={profileId}
        staffName={staff?.full_name ?? "Staff"}
        role={staff?.role ?? null}
        startDate={startDate}
        endDate={endDate}
        entries={entriesWithBalance}
        totalCredit={totalCredit}
        totalDebit={totalDebit}
        closingBalance={runningBalance}
      />
    </div>
  );
}