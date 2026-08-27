import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AiAssistantClient } from "./ai-assistant-client";

export const dynamic = "force-dynamic";

export default async function FarmerAiAssistantPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase.from("farmers").select("id, full_name").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");

  const { data: pendingRequests } = await supabase
    .from("farmer_ai_requests")
    .select("id, intent_type, description, status, created_at")
    .eq("farmer_id", farmer.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return <AiAssistantClient farmerName={farmer.full_name} pendingRequests={pendingRequests ?? []} />;
}