import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { LeaveCalendarClient } from "./calendar-client";

export const dynamic = "force-dynamic";

// Wohi fehrist jo /admin/hr/leave par faisla karne walon ki hai. Team ka
// board bhi wahi log dekhte hain -- ek staff ko poori team ki chhutti
// dikhana us ki apni baat nahi.
const DECIDERS = ["hr", "manager", "admin", "owner", "super_admin"];

/**
 * Team ki chhutti — ek mahina, ek nazar.
 *
 * Malik ne 5 September ko ek team leave calendar dikha kar kaha: *"ye
 * team board bhi theek karna hai."*
 *
 * Chhutti ka safha pehle se tha, magar wo FEHRIST hai -- kis ne maangi,
 * kis ki manzoori baqi. Us se ye sawal jawab nahi paata jo manager ko
 * asal mein poochna hota hai: **"agle hafte kaun kaun nahi hoga?"**
 * Fehrist mein wo jawab bikhra hua hota hai; calendar mein ek nazar mein
 * saamne aa jata hai.
 *
 * -------------------------------------------------------------------
 * DO BAATEIN JAAN BOOJH KAR:
 *
 * 1. **Manzoor shuda aur manzoori-baqi alag dikhte hain.** Sirf manzoor
 *    shuda dikhana adhoora hai -- jis din paanch darkhwastein pari hon,
 *    us din ka kaam bhi khatre mein hai. Aur dono ko ek jaisa dikhana us
 *    se bhi bura: manager us din par bharosa kar ke kaam baant deta hai
 *    jo abhi tay hi nahi hua.
 *
 * 2. **Chhutti (rukhsat) aur chhutti (holiday) alag cheezein hain.**
 *    14 August par koi bhi kaam par nahi hota -- wo kisi ki darkhwast
 *    nahi, poore idare ki chhutti hai. Dono ko ek rang dena ye sawal
 *    khara kar deta hai ke "us din itne log kyun gaye the".
 */
export default async function TeamLeaveCalendarPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) redirect("/login");

  if (!DECIDERS.includes(me.role)) {
    return (
      <div>
        <PageHeader title="Team ki chhutti" />
        <Card>
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Poori team ki chhutti sirf HR, Manager aur Admin dekh sakte hain.
          </p>
          <Link href="/admin/my-hr" className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline">
            Apni chhutti dekhein →
          </Link>
        </Card>
      </div>
    );
  }

  // Ek saal ki chhutti aur chhuttiyan -- calendar aage peeche chalta hai,
  // is liye har mahine par dobara server tak jane ki zaroorat nahi.
  const service = createServiceClient();
  const ab = new Date();
  const se = new Date(ab.getFullYear(), ab.getMonth() - 6, 1).toISOString().slice(0, 10);
  const tak = new Date(ab.getFullYear(), ab.getMonth() + 7, 0).toISOString().slice(0, 10);

  const [{ data: chhuttiyan, error: leaveErr }, { data: holidays }] = await Promise.all([
    service
      .from("leave_requests")
      .select("id, profile_id, from_date, to_date, leave_type, status, is_half_day")
      .in("status", ["approved", "pending"])
      .lte("from_date", tak)
      .gte("to_date", se),
    service.from("hr_holidays").select("holiday_date, name").gte("holiday_date", se).lte("holiday_date", tak),
  ]);

  // Khata na khule to khali calendar dikhana jhoot hai -- "kisi ne
  // chhutti nahi li" aur "dekha nahi ja saka" ek cheez nahi.
  if (leaveErr) {
    return (
      <div>
        <PageHeader title="Team ki chhutti" />
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Chhutti ka record is waqt parha nahi ja saka: {leaveErr.message}
          </p>
        </Card>
      </div>
    );
  }

  const ids = Array.from(new Set((chhuttiyan ?? []).map((l) => l.profile_id as string)));
  const { data: log } = ids.length
    ? await service.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null }[] };
  const naamById = new Map((log ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? "—"]));

  return (
    <div>
      <PageHeader
        title="Team ki chhutti"
        description="Kaun kis din nahi hoga — ek mahina, ek nazar"
      />
      <LeaveCalendarClient
        leaves={(chhuttiyan ?? []).map((l) => ({
          id: l.id as string,
          naam: naamById.get(l.profile_id as string) ?? "—",
          se: String(l.from_date),
          tak: String(l.to_date),
          kism: String(l.leave_type ?? "chhutti"),
          halat: String(l.status),
          aadhaDin: Boolean(l.is_half_day),
        }))}
        aajISO={`${ab.getFullYear()}-${String(ab.getMonth() + 1).padStart(2, "0")}-${String(ab.getDate()).padStart(2, "0")}`}
        holidays={(holidays ?? []).map((h) => ({
          date: String(h.holiday_date),
          naam: String(h.name ?? "Chhutti"),
        }))}
      />
    </div>
  );
}
