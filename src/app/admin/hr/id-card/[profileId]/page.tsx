import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { mergeIdCard } from "@/lib/hr/id-card-profile";
import { IdCardClient } from "./id-card-client";

export const dynamic = "force-dynamic";

type AppRow = {
  phone?: string | null;
  cnic?: string | null;
  blood_group?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  photo_url?: string | null;
  status?: string | null;
  created_at?: string | null;
};

async function joinedApplication(supabase: ReturnType<typeof createClient>, profileId: string): Promise<AppRow | null> {
  const full = await supabase
    .from("job_applications")
    .select("phone, cnic, blood_group, emergency_contact_name, emergency_contact_phone, photo_url, status, created_at")
    .eq("created_profile_id", profileId)
    .order("created_at", { ascending: false });
  if (!full.error) {
    const rows = (full.data ?? []) as AppRow[];
    return rows.find((row) => row.status === "joined") ?? rows[0] ?? null;
  }
  if (!/column|blood_group|emergency_contact|photo_url/i.test(full.error.message)) return null;
  const basic = await supabase
    .from("job_applications")
    .select("phone, cnic, status, created_at")
    .eq("created_profile_id", profileId)
    .order("created_at", { ascending: false });
  const rows = (basic.data ?? []) as AppRow[];
  return rows.find((row) => row.status === "joined") ?? rows[0] ?? null;
}

export default async function StaffIdCardPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const supabase = createClient();

  const [{ data: profile }, { data: staff }, application] = await Promise.all([
    supabase.from("profiles").select("id, full_name, branch_id, phone_number").eq("id", profileId).maybeSingle(),
    supabase
      .from("staff_details")
      .select("designation, phone, whatsapp_number, photo_url, blood_group, emergency_contact_name, emergency_contact_phone, employee_code, cnic")
      .eq("profile_id", profileId)
      .maybeSingle(),
    joinedApplication(supabase, profileId),
  ]);

  let branchName: string | null = null;
  if (profile?.branch_id) {
    const { data: branch } = await supabase.from("branches").select("name").eq("id", profile.branch_id).maybeSingle();
    branchName = branch?.name ?? null;
  }

  const card = mergeIdCard({
    fullName: profile?.full_name,
    designation: staff?.designation,
    employeeCode: staff?.employee_code,
    branchName,
    staffPhone: staff?.phone,
    whatsappNumber: staff?.whatsapp_number,
    profilePhone: profile?.phone_number,
    applicationPhone: application?.phone,
    staffCnic: staff?.cnic,
    applicationCnic: application?.cnic,
    staffPhoto: staff?.photo_url,
    applicationPhoto: application?.photo_url,
    staffBlood: staff?.blood_group,
    applicationBlood: application?.blood_group,
    staffEmergencyName: staff?.emergency_contact_name,
    applicationEmergencyName: application?.emergency_contact_name,
    staffEmergencyPhone: staff?.emergency_contact_phone,
    applicationEmergencyPhone: application?.emergency_contact_phone,
  });

  return (
    <div>
      <div className="print:hidden">
        <PageHeader title={`${card.fullName} - ID Card`} description="5 designs mein se select karein, Print/Download/WhatsApp/Email karein" />
      </div>
      <IdCardClient profileId={profileId} {...card} />
    </div>
  );
}
