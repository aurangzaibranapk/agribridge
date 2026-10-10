import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { loadCustomerAging } from "@/lib/recovery/load-aging";
import { getRecoverySettings } from "@/lib/recovery/credit-block";
import { formatRs, formatDatePk, reminderStageFor } from "@/lib/recovery/aging";
import { updateRecoverySettings, setReminderPref } from "@/actions/receivable-recovery";

export const dynamic = "force-dynamic";

/** Wasooli WhatsApp yaad-dihani: settings, har gahak ka pause/skip, aur log (migration 523). */
export default async function ReceivableRemindersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [viewGuard, editGuard] = await Promise.all([
    requireAction("system.receivable_reminders", "view"),
    requireAction("system.receivable_reminders", "edit"),
  ]);
  if ("error" in viewGuard) return <div className="p-8 text-center text-surface-400">{viewGuard.error}</div>;
  const canEdit = !("error" in editGuard);

  const service = createServiceClient() as any;
  const [settings, { rows }, { data: prefs }, { data: log }, { data: overrides }] = await Promise.all([
    getRecoverySettings(),
    loadCustomerAging(),
    service.from("receivable_reminder_prefs").select("*"),
    service.from("receivable_reminders").select("*").order("created_at", { ascending: false }).limit(100),
    service.from("credit_block_overrides").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const prefMap = new Map<string, any>((prefs ?? []).map((p: any) => [p.customer_id, p]));
  const nameMap = new Map(rows.map((r) => [r.customer_id, r.name]));
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <PageHeader title="Wasooli Yaad-dihani" description="15ve din narm yaad-dihani, 30ve din aakhri notice -- WhatsApp par. Har stage ek hi dafa." />

      <Card className="space-y-3 p-4 text-xs">
        <div className={settings.reminders_enabled ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
          WhatsApp yaad-dihani: {settings.reminders_enabled ? "CHALU" : "BAND (koi paighaam nahi ja raha)"}
        </div>
        {canEdit && (
          <form action={updateRecoverySettings} className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="flex items-center gap-2"><input type="checkbox" name="reminders_enabled" defaultChecked={settings.reminders_enabled} /> Yaad-dihani chalu</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="block_overdue_credit" defaultChecked={settings.block_overdue_credit} /> 30+ din par naya udhaar band</label>
            <label>Aakhri hadd (din)<input className="input w-full" name="due_days" defaultValue={settings.due_days} /></label>
            <label>Yaad-dihani din<input className="input w-full" name="reminder_day" defaultValue={settings.reminder_day} /></label>
            <label>Aakhri notice din<input className="input w-full" name="final_notice_day" defaultValue={settings.final_notice_day} /></label>
            <label>Kam az kam baqaya (Rs)<input className="input w-full" name="min_amount" defaultValue={settings.min_amount} /></label>
            <label>Aam udhaar hadd (Rs, khali = koi nahi)<input className="input w-full" name="default_credit_limit" defaultValue={settings.default_credit_limit ?? ""} /></label>
            <button className="btn-primary rounded-md px-3 py-2" type="submit">Mehfooz karein</button>
          </form>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-xs">
          <thead className="bg-surface-50 text-surface-500 dark:bg-surface-800">
            <tr>
              <th className="px-3 py-2 text-left">Gahak</th>
              <th className="px-3 py-2 text-right">Baqaya</th>
              <th className="px-3 py-2 text-right">Din</th>
              <th className="px-3 py-2 text-left">Aakhri tareekh</th>
              <th className="px-3 py-2 text-left">Aaj ka stage</th>
              <th className="px-3 py-2 text-left">Halat</th>
              <th className="px-3 py-2 text-left">Amal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = prefMap.get(r.customer_id);
              const stage = reminderStageFor({ balance: r.balance, oldestDays: r.oldest_days }, settings);
              const status = p?.paused ? "Ruka hua" : p?.skip_until && p.skip_until >= today ? `Skip ${formatDatePk(p.skip_until)} tak` : "Chalu";
              return (
                <tr key={r.customer_id} className="border-t border-surface-100 dark:border-surface-800">
                  <td className="px-3 py-2 font-semibold">{r.name}<div className="text-[10px] text-surface-400">{r.phone ?? "phone nahi"}</div></td>
                  <td className="px-3 py-2 text-right">{formatRs(r.balance)}</td>
                  <td className="px-3 py-2 text-right">{r.oldest_days}</td>
                  <td className="px-3 py-2">{formatDatePk(r.due_date)}</td>
                  <td className="px-3 py-2">{stage === "day30" ? "Aakhri notice" : stage === "day15" ? "Yaad-dihani" : "—"}</td>
                  <td className="px-3 py-2">{status}</td>
                  <td className="px-3 py-2">
                    {canEdit && (
                      <div className="flex gap-1">
                        {(["pause", "skip7", "resume"] as const).map((op) => (
                          <form key={op} action={setReminderPref}>
                            <input type="hidden" name="customer_id" value={r.customer_id} />
                            <input type="hidden" name="op" value={op} />
                            <button className="rounded border px-2 py-0.5" type="submit">
                              {op === "pause" ? "Rokein" : op === "skip7" ? "7 din skip" : "Chalu"}
                            </button>
                          </form>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="p-3 text-sm font-semibold">Bheji gayi yaad-dihani</div>
        <table className="w-full text-xs">
          <tbody>
            {(log ?? []).map((l: any) => (
              <tr key={l.id} className="border-t border-surface-100 dark:border-surface-800">
                <td className="px-3 py-2">{String(l.created_at).slice(0, 10)}</td>
                <td className="px-3 py-2">{nameMap.get(l.customer_id) ?? l.customer_id}</td>
                <td className="px-3 py-2">{l.stage === "day30" ? "Aakhri notice" : "Yaad-dihani"}</td>
                <td className="px-3 py-2 text-right">{formatRs(Number(l.amount_due))}</td>
                <td className="px-3 py-2">{l.status}{l.last_error ? ` — ${l.last_error}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="p-3 text-sm font-semibold">Udhaar rok ke Admin override</div>
        <table className="w-full text-xs">
          <tbody>
            {(overrides ?? []).map((o: any) => (
              <tr key={o.id} className="border-t border-surface-100 dark:border-surface-800">
                <td className="px-3 py-2">{String(o.created_at).slice(0, 16).replace("T", " ")}</td>
                <td className="px-3 py-2">{nameMap.get(o.customer_id) ?? o.customer_id}</td>
                <td className="px-3 py-2">{o.context}</td>
                <td className="px-3 py-2 text-right">{formatRs(Number(o.amount ?? 0))}</td>
                <td className="px-3 py-2">{o.overridden_role}: {o.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
