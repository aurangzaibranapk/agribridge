import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { IdCardClient } from "./id-card-client";

export const dynamic = "force-dynamic";

export default async function StaffIdCardPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const supabase = createClient();

  const { data: profile } = await supabase.from("profiles").select("id, full_name, branch_id").eq("id", profileId).single();
  const { data: staff } = await supabase
    .from("staff_details")
    .select("designation, phone, photo_url, blood_group, emergency_contact_name, emergency_contact_phone, employee_code, cnic")
    .eq("profile_id", profileId)
    .single();

  let branchName: string | null = null;
  if (profile?.branch_id) {
    const { data: branch } = await supabase.from("branches").select("name").eq("id", profile.branch_id).single();
    branchName = branch?.name ?? null;
  }

  return (
    <div>
      <PageHeader title={`${profile?.full_name ?? "Staff"} - ID Card`} description="5 designs mein se select karein, Print/Download/WhatsApp/Email karein" />
      <IdCardClient
        profileId={profileId}
        fullName={profile?.full_name ?? "-"}
        designation={staff?.designation ?? "-"}
        phone={staff?.phone ?? null}
        photoUrl={staff?.photo_url ?? null}
        bloodGroup={staff?.blood_group ?? null}
        emergencyName={staff?.emergency_contact_name ?? null}
        emergencyPhone={staff?.emergency_contact_phone ?? null}
        employeeCode={staff?.employee_code ?? null}
        cnic={staff?.cnic ?? null}
        branchName={branchName}
      />
    </div>
  );
}