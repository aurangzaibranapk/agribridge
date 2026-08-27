import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpertPortalClient } from "./expert-portal-client";

export const dynamic = "force-dynamic";

export default async function ExpertPortalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  const ALLOWED_ROLES = ["agronomist", "manager", "super_admin", "admin", "owner"];
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) redirect("/login");

  const { data: pendingEscalations } = await supabase
    .from("farmer_ai_requests")
    .select("id, description, details, status, created_at, farmers(full_name, farmer_code, phone_number)")
    .eq("intent_type", "expert_escalation")
    .order("created_at", { ascending: false })
    .limit(50);

  const normalized = (pendingEscalations ?? []).map((r: any) => ({
    id: r.id,
    description: r.description,
    question: r.details?.question ?? r.description,
    reason: r.details?.reason ?? "-",
    status: r.status,
    createdAt: r.created_at,
    farmerName: Array.isArray(r.farmers) ? r.farmers[0]?.full_name : r.farmers?.full_name,
    farmerCode: Array.isArray(r.farmers) ? r.farmers[0]?.farmer_code : r.farmers?.farmer_code,
  }));

  return <ExpertPortalClient expertName={profile.full_name ?? "Expert"} escalations={normalized} />;
}