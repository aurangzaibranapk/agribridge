import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "Meri Profile" };

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, phone_number")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold text-surface-900 dark:text-white">Meri Profile</h1>
      <ProfileClient
        fullName={profile?.full_name ?? ""}
        email={user.email ?? ""}
        role={profile?.role ?? ""}
        phone={profile?.phone_number ?? ""}
      />
    </div>
  );
}
