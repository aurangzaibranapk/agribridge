import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { HRClient } from "./hr-client";

export const dynamic = "force-dynamic";

export default async function HRPage() {
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("is_active", true)
    .in("role", ["super_admin", "admin", "manager", "sales_staff"])
    .order("full_name");

  const { data: branches } = await supabase.from("branches").select("id, name").order("name");

  const { data: details } = await supabase.from("staff_details").select("*");
  const detailsMap = new Map((details ?? []).map((d) => [d.profile_id, d]));

  const staff = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
    details: detailsMap.get(p.id)
      ? {
          designation: detailsMap.get(p.id)!.designation,
          cnic: detailsMap.get(p.id)!.cnic,
          phone: detailsMap.get(p.id)!.phone,
          address: detailsMap.get(p.id)!.address,
          hire_date: detailsMap.get(p.id)!.hire_date,
          basic_salary: detailsMap.get(p.id)!.basic_salary ? Number(detailsMap.get(p.id)!.basic_salary) : null,
          bank_account: detailsMap.get(p.id)!.bank_account,
        }
      : null,
  }));

  const staffNameMap = new Map(staff.map((s) => [s.id, s.full_name]));

  const { data: rawAttendance } = await supabase
    .from("attendance_records")
    .select("id, profile_id, attendance_date, status")
    .order("attendance_date", { ascending: false })
    .limit(100);

  const attendance = (rawAttendance ?? []).map((a) => ({
    ...a,
    staff_name: staffNameMap.get(a.profile_id) ?? "-",
  }));

  const { data: rawSalaries } = await supabase
    .from("salary_payments")
    .select("id, profile_id, pay_month, pay_year, basic_salary, bonus, deductions, advance_deduction, net_salary, status")
    .order("pay_year", { ascending: false })
    .order("pay_month", { ascending: false });

  const salaries = (rawSalaries ?? []).map((s) => ({
    ...s,
    basic_salary: Number(s.basic_salary),
    bonus: Number(s.bonus ?? 0),
    deductions: Number(s.deductions ?? 0),
    advance_deduction: Number(s.advance_deduction ?? 0),
    net_salary: Number(s.net_salary),
    staff_name: staffNameMap.get(s.profile_id) ?? "-",
  }));

  return (
    <div>
      <PageHeader title="HR - Staff Management" description="Staff details, attendance, and salary records" />
      <HRClient staff={staff} attendance={attendance} salaries={salaries} branches={branches ?? []} />
    </div>
  );
}