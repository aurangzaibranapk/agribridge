import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DEPARTMENTS, departmentForRole } from "@/lib/departments";

export const dynamic = "force-dynamic";

/**
 * Kis se baat ho sakti hai -- ye faisla server par hota hai, client par
 * nahi.
 *
 * Pehle widget seedha `profiles` se saari staff utha leta tha: har naye
 * mulazim ko poore idare ki directory nazar aati thi -- Owner, Finance,
 * HR, sab. Malik ka faisla (3 September): aam staff ko poori directory
 * nahi dikhni chahiye.
 *
 * Ab tarteeb ye hai:
 *   Owner / Admin / Manager  -> saari staff + saare department + elaan
 *   Baqi staff               -> AI, apna manager/department head,
 *                               apne department ke sathi, aur jin se
 *                               pehle se baat ho rahi hai
 *
 * "Jin se pehle se baat ho rahi hai" jaan boojh kar shamil hai: kisi ne
 * pehle paighaam bhej diya to jawab ka raasta band nahi hona chahiye,
 * warna banda adhoori baat cheet mein phansa reh jata hai.
 */

const MASTER = ["owner", "super_admin", "admin", "manager"];
const AI_ROLE = "ai_assistant";

const STAFF_ROLES = [
  "owner", "super_admin", "admin", "manager", "sales_staff", "finance",
  "warehouse", "admin_assistant", "hr", "procurement", "milk_collection", "machinery", AI_ROLE,
];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Admin", admin: "Admin", owner: "Owner", admin_assistant: "Admin Assistant",
  manager: "Manager", sales_staff: "Sales", finance: "Finance", warehouse: "Warehouse",
  hr: "HR", procurement: "Procurement", milk_collection: "Milk Collection",
  machinery: "Machinery", ai_assistant: "AI Assistant",
};

interface Row {
  id: string;
  full_name: string | null;
  role: string;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });

  const service = createServiceClient();
  const { data: me } = await service
    .from("profiles")
    .select("id, role, full_name, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) return NextResponse.json({ error: "inactive" }, { status: 403 });

  const isMaster = MASTER.includes(me.role);
  const myDept = departmentForRole(me.role);

  const { data: allStaff } = await service
    .from("profiles")
    .select("id, full_name, role")
    .in("role", STAFF_ROLES)
    .eq("is_active", true)
    .neq("id", user.id)
    .order("full_name");
  const staff = (allStaff ?? []) as Row[];

  // Jin se pehle se baat ho rahi hai -- dono taraf se.
  const { data: msgs } = await service
    .from("staff_messages")
    .select("sender_id, recipient_id, created_at")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(400);
  const seen = new Set<string>();
  const recentIds: string[] = [];
  for (const m of msgs ?? []) {
    const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    if (!other || other === user.id || seen.has(other)) continue;
    seen.add(other);
    recentIds.push(other);
  }

  // Mere department ke head (chhutti par gaye kisi ki jagah banaye gaye
  // head bhi) -- taake sawal poochne ki jagah hamesha rahe.
  const { data: headRows } = await service
    .from("department_head_grants")
    .select("profile_id, department_key, starts_at, expires_at");
  const nowMs = Date.now();
  const myHeads = new Set(
    (headRows ?? [])
      .filter((g) => !myDept || g.department_key === myDept.key)
      .filter((g) => !g.starts_at || new Date(g.starts_at).getTime() <= nowMs)
      .filter((g) => !g.expires_at || new Date(g.expires_at).getTime() > nowMs)
      .map((g) => g.profile_id as string)
  );

  const allowed = isMaster
    ? staff
    : staff.filter(
        (c) =>
          c.role === AI_ROLE ||
          c.role === "manager" ||
          myHeads.has(c.id) ||
          (myDept != null && departmentForRole(c.role)?.key === myDept.key) ||
          seen.has(c.id)
      );

  const byId = new Map(allowed.map((c) => [c.id, c]));
  const contacts = allowed.map((c) => ({
    id: c.id,
    name: c.full_name ?? "User",
    role: c.role,
    roleLabel: ROLE_LABELS[c.role] ?? c.role,
    isAi: c.role === AI_ROLE,
  }));

  // Department: master ko saare, staff ko sirf apna.
  const deptSource = isMaster ? DEPARTMENTS : myDept ? [myDept] : [];
  const departments = deptSource.map((d) => ({
    key: d.key,
    label: d.label,
    count: staff.filter((s) => departmentForRole(s.role)?.key === d.key).length,
  }));

  return NextResponse.json({
    me: { id: user.id, name: me.full_name ?? "User", role: me.role },
    isMaster,
    canAnnounce: isMaster,
    announceCount: staff.length,
    contacts,
    departments,
    recent: recentIds.filter((id) => byId.has(id)).slice(0, 6),
  });
}
