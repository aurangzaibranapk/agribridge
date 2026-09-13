import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { MessagesClient } from "./messages-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const STAFF_ROLES = [
  "owner", "super_admin", "admin", "manager", "sales_staff", "finance",
  "warehouse", "admin_assistant", "hr", "procurement", "milk_collection", "machinery", "ai_assistant",
];

export default async function MessagesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <div className="p-8 text-center text-surface-400">{t("at_login_required", lang)}</div>;
  }

  const { data: contactsRaw } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", STAFF_ROLES)
    .eq("is_active", true)
    .neq("id", user.id)
    .order("full_name");

  const { data: allMessages } = await supabase
    .from("staff_messages")
    .select("*")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: true });

  const unreadBySender: Record<string, number> = {};
  (allMessages ?? []).forEach((m) => {
    if (m.recipient_id === user.id && !m.is_read) {
      unreadBySender[m.sender_id] = (unreadBySender[m.sender_id] ?? 0) + 1;
    }
  });

  const contacts = (contactsRaw ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name ?? "User",
    role: c.role,
    unreadCount: unreadBySender[c.id] ?? 0,
  }));

  const messages = (allMessages ?? []).map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    recipient_id: m.recipient_id,
    message: m.message,
    attachment_url: m.attachment_url,
    attachment_type: m.attachment_type,
    created_at: m.created_at,
  }));

  return (
    <div>
      <PageHeader title={t("at_messages", lang)} description="Staff ke sath direct baat karein - AI Assistant se bhi puchh sakte hain" />
      <MessagesClient currentUserId={user.id} contacts={contacts} messages={messages} />
    </div>
  );
}