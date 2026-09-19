import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { AlertTriangle } from "lucide-react";
import { RecoveryClient, type RecoveryParty, type ReminderTemplate } from "./recovery-client";

export const dynamic = "force-dynamic";

const DEFAULT_DUE_DAYS = 15;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const loose = supabase as any;
  const today = new Date().toISOString().slice(0, 10);

  const [{ data, error: recoveryError }, { data: reminders }, { data: templates }, { data: customerDueDays }] = await Promise.all([
    loose.rpc("fn_recovery_outstanding", { p_search: sp.q?.trim() || null }),
    // Last reminder per party, aur aaj kis kis ko reminder ja chuka --
    // yahin se "Last Reminder" column aur "Collected Today" ke liye
    // reminder-status bhi milta hai.
    loose
      .from("payment_reminders")
      .select("party_type,party_id,sent_at,delivery_status")
      .order("sent_at", { ascending: false }),
    loose.from("reminder_templates").select("id,template_name,language,channel,message_body,reminder_stage,is_active").eq("is_active", true),
    loose.from("customers").select("id,payment_due_days"),
  ]);

  // Har party ka aakhri reminder -- pehli qatar jo mile (order by sent_at
  // desc se aa rahi hai).
  const lastReminderByParty = new Map<string, string | null>();
  for (const r of reminders ?? []) {
    const key = `${r.party_type}:${r.party_id}`;
    if (!lastReminderByParty.has(key)) lastReminderByParty.set(key, r.sent_at);
  }

  // Customer ki apni "kitne din mein wapas" -- na ho to project-wide
  // andaza (15 din). Farmer/dealer/supplier ke liye abhi ye khana kahin
  // nahi -- wahi andaza lagta hai.
  const dueDaysByCustomer = new Map<string, number>();
  for (const c of customerDueDays ?? []) {
    if (c.payment_due_days) dueDaysByCustomer.set(c.id, Number(c.payment_due_days));
  }

  // "Due date" is party ke aakhri ledger-harkat (last_activity) se, us
  // ke apne credit-din jama kar ke -- ledger khud kisi qatar par "ye
  // kab wapas mangna hai" nahi likhta, is liye ye hamesha ANDAZA hai,
  // asal tareekh nahi. Jahan last_activity hi nahi (kabhi lena-dena
  // hua hi nahi), wahan due date bhi nahi banta.
  const parties: RecoveryParty[] = (data ?? []).map((p: any) => {
    const dueDays = p.party_type === "customer" ? dueDaysByCustomer.get(p.party_id) ?? DEFAULT_DUE_DAYS : DEFAULT_DUE_DAYS;
    const dueDate = p.last_activity ? addDays(p.last_activity, dueDays) : null;
    const overdueDays = dueDate ? Math.round((new Date(today).getTime() - new Date(dueDate).getTime()) / 86400000) : null;
    const status: RecoveryParty["status"] = dueDate == null ? "upcoming" : overdueDays! > 0 ? "overdue" : overdueDays === 0 ? "due_today" : "upcoming";
    return {
      type: p.party_type,
      id: p.party_id,
      name: p.party_name,
      phone: p.phone,
      email: p.email,
      outstanding: Number(p.outstanding || 0),
      lastActivity: p.last_activity,
      dueDate,
      overdueDays: overdueDays != null && overdueDays > 0 ? overdueDays : null,
      status,
      lastReminder: lastReminderByParty.get(`${p.party_type}:${p.party_id}`) ?? null,
    };
  });

  const totalReceivable = parties.reduce((s, p) => s + p.outstanding, 0);
  const dueTodayParties = parties.filter((p) => p.status === "due_today");
  const overdueParties = parties.filter((p) => p.status === "overdue");
  const failedCount = (reminders ?? []).filter((r: any) => r.delivery_status === "failed").length;

  // "Collected today" -- customer/farmer ke khate mein aaj credit hua
  // paisa (1100/1150), seedha ledger se. Ye Recovery ki apni koi qatar
  // nahi -- kahin bhi wapsi darj ho (POS, load-bill, farmer credit), wo
  // yahan gin jati hai.
  const { data: collectedRows } = await loose
    .from("journal_lines")
    .select("credit, journal_entries!inner(entry_date)")
    .in("account_code", ["1100", "1150"])
    .gt("credit", 0)
    .eq("journal_entries.entry_date", today);
  const collectedToday = (collectedRows ?? []).reduce((s: number, r: any) => s + Number(r.credit || 0), 0);
  const collectedTodayCount = (collectedRows ?? []).length;

  const reminderTemplates: ReminderTemplate[] = (templates ?? []).map((t: any) => ({
    id: t.id,
    name: t.template_name,
    language: t.language,
    channel: t.channel,
    body: t.message_body,
    stage: t.reminder_stage,
  }));

  const todayLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "short",
  });

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <p className="text-xs text-surface-500">
        <Link href="/admin/dashboard" className="hover:underline">
          Home
        </Link>{" "}
        &gt; Khata &amp; Recovery
      </p>
      <PageHeader
        title="Khata Recovery"
        description="Track receivables, send reminders and manage customer payments"
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-800 dark:bg-surface-900">
            <CalendarDays className="h-4 w-4 text-brand-600" />
            <div className="leading-tight">
              <p className="text-[11px] text-surface-400">Today</p>
              <p className="font-medium text-surface-800 dark:text-surface-200">{todayLabel}</p>
            </div>
          </div>
        }
      />
      {/* Ye teen safhe bane hue the magar kahin se raasta hi nahi tha
          (admin panel review, 19 September) -- ab yahan se khulte hain. */}
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/finance/recovery/history" className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:hover:bg-surface-800">
          Recovery History
        </Link>
        <Link href="/admin/finance/recovery/promises" className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:hover:bg-surface-800">
          Wade (Promises)
        </Link>
        <Link href="/admin/finance/recovery/templates" className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:hover:bg-surface-800">
          Reminder Templates
        </Link>
      </div>
      {recoveryError && (
        <Card className="border-l-4 border-l-red-500 bg-red-50 p-4 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Data load nahi ho saka: {recoveryError.message}. Ye khali fehrist "kuch baqaya nahi" ka matlab NAHI —
              ye ek asal masla hai, safha dobara kholein ya Admin ko batayein.
            </span>
          </p>
        </Card>
      )}
      <RecoveryClient
        parties={parties}
        templates={reminderTemplates}
        totalReceivable={totalReceivable}
        dueTodayAmount={dueTodayParties.reduce((s, p) => s + p.outstanding, 0)}
        dueTodayCount={dueTodayParties.length}
        overdueAmount={overdueParties.reduce((s, p) => s + p.outstanding, 0)}
        overdueCount={overdueParties.length}
        collectedToday={collectedToday}
        collectedTodayCount={collectedTodayCount}
        failedCount={failedCount}
      />
    </div>
  );
}
