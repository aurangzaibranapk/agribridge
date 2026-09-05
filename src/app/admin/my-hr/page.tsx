import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { CheckinClient } from "@/app/admin/my-attendance/checkin-client";
import { loadNeedsAttention, filterAttention } from "@/lib/access/needs-attention";
import { loadNav } from "@/lib/access/nav";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { AttendanceCalendar } from "./attendance-calendar";
import { CalendarDays, FileText, Wallet, Receipt, Users, ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Mera HR — staff ka apna safha.
 *
 * Malik ne 5 September ko ek HR self-service app dikha kar kaha: *"mujhe
 * ye saara kaam chahiye, same to same bana do."*
 *
 * Us app ki asal khoobi safhe ka design nahi -- **ek jagah** hona hai.
 * Staff ko apni hazri, apni chhutti, apni tankhwah aur apne baqi kaam ke
 * liye chaar alag safhe yaad nahi rakhne parte.
 *
 * Hamare yahan ye saari cheezein pehle se maujood thin, magar bikhri hui
 * -- Meri Hazri, Chhutti, Staff Khata, Mera Kaam. Yahan koi naya nizam
 * nahi bana: wohi purane khane, wohi purani rok, sirf ek jagah jama.
 *
 * -------------------------------------------------------------------
 * JO CHEEZ NAHI HAI, US KA KHANA BHI NAHI BANAYA.
 *
 * Us app par "Request Travel", "Work From Home", "Browse Policies",
 * "Organogram" aur "Submit Resignation" ke box the. Hamare yahan wo
 * nizam abhi bane hi nahi. Khali box laga dena -- jo dabane par kuch na
 * kare -- us se bura hai ke box hi na ho: banda us par bharosa kar ke
 * intezar karta hai, aur us ki darkhwast kahin jati hi nahi.
 *
 * Is liye yahan sirf wo box hain jo waqai kaam karte hain.
 */
export default async function MyHrPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) redirect("/login");

  const service = createServiceClient();
  const aaj = new Date();
  const saal = aaj.getFullYear();
  const saalShuru = `${saal}-01-01`;
  const mahinaShuru = `${saal}-${String(aaj.getMonth() + 1).padStart(2, "0")}-01`;
  const aajISO = aaj.toISOString().slice(0, 10);

  const [
    { data: todayRec },
    { data: saalKiHazri },
    { data: chhuttiyan },
    { data: policyRow },
    { data: tankhwah },
    { count: chhuttiBaqi },
  ] = await Promise.all([
    service
      .from("attendance_records")
      .select("check_in_at, check_out_at")
      .eq("profile_id", user.id)
      .eq("attendance_date", aajISO)
      .maybeSingle(),
    service
      .from("attendance_records")
      .select("attendance_date, status, late_minutes")
      .eq("profile_id", user.id)
      .gte("attendance_date", saalShuru)
      .order("attendance_date"),
    service
      .from("leave_requests")
      .select("days, status, from_date, to_date, leave_type")
      .eq("profile_id", user.id)
      .gte("from_date", saalShuru),
    service.from("hr_leave_policy").select("annual_leave_days, carry_forward_days").maybeSingle(),
    service
      .from("salary_payments")
      .select("id, pay_month, pay_year, basic_salary, bonus, deductions, advance_deduction, net_salary, status, paid_date")
      .eq("profile_id", user.id)
      .order("pay_year", { ascending: false })
      .order("pay_month", { ascending: false })
      .limit(6),
    service
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("status", "pending"),
  ]);

  const hazri = saalKiHazri ?? [];

  // ---- Chaar khane ----
  //
  // Har adad wahin se aata hai jahan wo asal mein likha hai. Jo cheez
  // maloom na ho us par "—" jata hai, sifar nahi -- "sifar chhutti li"
  // aur "hisaab hi nahi rakha" ek cheez nahi.
  const saalanaHaq = policyRow ? Number(policyRow.annual_leave_days ?? 0) + Number(policyRow.carry_forward_days ?? 0) : null;
  const liGayi = (chhuttiyan ?? [])
    .filter((l) => l.status === "approved")
    .reduce((s, l) => s + Number(l.days ?? 0), 0);
  const chhuttiBalance = saalanaHaq == null ? null : Math.max(0, saalanaHaq - liGayi);

  const isMahineDerSe = hazri.filter(
    (r) => String(r.attendance_date) >= mahinaShuru && Number(r.late_minutes ?? 0) > 0
  ).length;
  const saalGhairHazri = hazri.filter((r) => r.status === "absent").length;

  // Baqi kaam -- wohi ginti jo "Mera Kaam" par aati hai, taake do jagah
  // do adad na banein.
  const nav = await loadNav(user.id, me.role, lang);
  const attention = filterAttention(await loadNeedsAttention(), nav.unrestricted ? null : nav.allowedRoutes);
  const baqiKaam = attention.reduce((s, a) => s + (a.count ?? 0), 0);

  const naam = (me.full_name ?? "").split(" ")[0] || "ji";

  return (
    <div>
      <PageHeader
        title={`Assalam-o-Alaikum, ${naam}`}
        description="Aap ki apni hazri, chhutti, tankhwah aur baqi kaam — ek jagah"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Aaj ki hazri */}
          <Card>
            <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">Aaj ki hazri</p>
            <div className="mt-2">
              <CheckinClient today={todayRec ?? null} />
            </div>
          </Card>

          {/* Chaar khane */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile
              label="Chhutti baqi"
              value={chhuttiBalance == null ? "—" : String(chhuttiBalance)}
              note={
                chhuttiBalance == null
                  ? "policy darj nahi"
                  : `${saalanaHaq} mein se ${liGayi} li`
              }
              tone="brand"
            />
            <Tile
              label="Is mahine der se"
              value={String(isMahineDerSe)}
              note={isMahineDerSe === 0 ? "ek dafa bhi nahi" : "dafa"}
              tone={isMahineDerSe > 0 ? "amber" : undefined}
            />
            <Tile label="Baqi kaam" value={String(baqiKaam)} note="aap ke zimme" tone={baqiKaam > 0 ? "red" : undefined} />
            <Tile
              label="Is saal ghair-hazri"
              value={String(saalGhairHazri)}
              note={saalGhairHazri === 0 ? "ek din bhi nahi" : "din"}
              tone={saalGhairHazri > 0 ? "amber" : undefined}
            />
          </div>

          {/* Hazri ka calendar */}
          <AttendanceCalendar
            rows={hazri.map((r) => ({
              date: String(r.attendance_date),
              status: String(r.status),
            }))}
          />

          {/* Tankhwah ki parchi */}
          <Card>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
              <Receipt className="h-4 w-4 text-brand-600" /> Meri tankhwah
            </p>
            {(tankhwah ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-surface-400">
                Abhi tak koi tankhwah darj nahi hui.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 text-left dark:border-surface-800">
                      <th className="py-2 text-xs font-medium uppercase tracking-wide text-surface-500">Mahina</th>
                      <th className="py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">Basic</th>
                      <th className="py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">Bonus</th>
                      <th className="py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">Kati</th>
                      <th className="py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">Mili</th>
                      <th className="py-2 text-xs font-medium uppercase tracking-wide text-surface-500">Halat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tankhwah ?? []).map((s) => {
                      const kati = Number(s.deductions ?? 0) + Number(s.advance_deduction ?? 0);
                      return (
                        <tr key={s.id as string} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                          <td className="py-2 text-surface-800 dark:text-surface-200">
                            {new Date(Number(s.pay_year), Number(s.pay_month) - 1, 1).toLocaleDateString("en-GB", {
                              month: "long",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-2 text-right tabular-nums">{Number(s.basic_salary ?? 0).toLocaleString()}</td>
                          <td className="py-2 text-right tabular-nums">{Number(s.bonus ?? 0) > 0 ? Number(s.bonus).toLocaleString() : "—"}</td>
                          <td className="py-2 text-right tabular-nums text-red-600">{kati > 0 ? kati.toLocaleString() : "—"}</td>
                          <td className="py-2 text-right font-semibold tabular-nums text-surface-900 dark:text-white">
                            Rs {Number(s.net_salary ?? 0).toLocaleString()}
                          </td>
                          <td className="py-2">
                            <span
                              className={
                                s.status === "paid"
                                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              }
                            >
                              {s.status === "paid" ? "mil gayi" : String(s.status ?? "baqi")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Daayen taraf: raaste */}
        <div className="space-y-4">
          <Card>
            <p className="mb-3 text-sm font-semibold text-surface-900 dark:text-white">Jaldi wale kaam</p>
            <div className="grid grid-cols-2 gap-2">
              <Action href="/admin/hr/leave" icon={<CalendarDays className="h-4 w-4" />} label="Chhutti ki darkhwast" />
              <Action href="/admin/hr/corrections" icon={<ClipboardCheck className="h-4 w-4" />} label="Hazri theek karwayein" />
              <Action href="/admin/company-expenses" icon={<Receipt className="h-4 w-4" />} label="Kharcha claim" />
              <Action href="/admin/my-wallet" icon={<Wallet className="h-4 w-4" />} label="Mera batwa" />
              <Action href="/admin/my-attendance" icon={<CalendarDays className="h-4 w-4" />} label="Meri hazri" />
              <Action href="/admin/my-work" icon={<FileText className="h-4 w-4" />} label="Mera kaam" />
            </div>
            {Number(chhuttiBaqi ?? 0) > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                Aap ki {chhuttiBaqi} chhutti ki darkhwast manzoori ke muntazir hai.
              </p>
            )}
          </Card>

          <Card>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
              <Users className="h-4 w-4 text-brand-600" /> Meri team
            </p>
            <Action href="/admin/hr/team" icon={<Users className="h-4 w-4" />} label="Team aur reporting" />
          </Card>

          {/* Jo abhi nahi bana, us ka box bhi nahi -- magar baat chhupai
              bhi nahi jati. Khali box us se bura hai: banda us par
              bharosa kar ke intezar karta hai. */}
          <Card className="border-surface-200 dark:border-surface-800">
            <p className="text-xs font-medium text-surface-700 dark:text-surface-300">Ye abhi nahi bane</p>
            <p className="mt-1 text-xs leading-relaxed text-surface-500">
              Safar ki darkhwast, ghar se kaam, company ki policies, idare ka naqsha (organogram), aur istifa —
              in ka nizam abhi bana nahi hai. Jab banega, yahin aa jayega.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "brand" | "amber" | "red";
}) {
  const colour =
    tone === "red"
      ? "text-red-600 dark:text-red-400"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "brand"
          ? "text-brand-700 dark:text-brand-300"
          : "text-surface-900 dark:text-white";
  return (
    <Card>
      <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${colour}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-surface-400">{note}</p>
    </Card>
  );
}

function Action({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-lg border border-surface-200 bg-white p-3 text-center text-xs font-medium text-surface-700 hover:border-brand-300 hover:bg-brand-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300 dark:hover:bg-brand-950/20"
    >
      <span className="text-brand-600">{icon}</span>
      {label}
    </Link>
  );
}
