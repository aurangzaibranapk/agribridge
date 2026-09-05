import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { NotificationsClient } from "./notifications-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const HQ_ROLES = ["super_admin", "admin", "owner", "manager"];

export default async function NotificationsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <div className="p-8 text-center text-surface-400">{t("at_login_required", lang)}</div>;
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const canBroadcast = HQ_ROLES.includes(profile?.role ?? "");
  const canViewAll = HQ_ROLES.includes(profile?.role ?? "");

  const { data: myNotifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  let allNotifications: any[] = [];
  if (canViewAll) {
    const { data } = await supabase
      .from("notifications")
      .select("*, profiles!notifications_recipient_user_id_fkey(full_name, role)")
      .order("created_at", { ascending: false })
      .limit(100);
    allNotifications = (data ?? []).map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      is_read: n.is_read,
      created_at: n.created_at,
      recipient_name: Array.isArray(n.profiles) ? n.profiles[0]?.full_name : n.profiles?.full_name,
      recipient_role: Array.isArray(n.profiles) ? n.profiles[0]?.role : n.profiles?.role,
    }));
  }

  const my = (myNotifications ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    link_url: n.link_url,
    is_read: n.is_read,
    created_at: n.created_at,
  }));

  return (
    <div>
      <PageHeader title={t("at_notifications", lang)} description="Aapki notifications aur (agar access ho) poori company ki activity" />
      <NotificationsClient myNotifications={my} allNotifications={allNotifications} canBroadcast={canBroadcast} canViewAll={canViewAll} />
    </div>
  );
}