import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { formatDateTime } from "@/lib/utils/format";
import { MessageStatusForm } from "@/app/admin/contact-messages/message-status-form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminContactMessagesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: messages } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title={t("at_contact_messages", lang)} description="Submissions from the public Contact Us form" />
      {!messages || messages.length === 0 ? (
        <EmptyState title={t("at_no_messages", lang)} />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-surface-900 dark:text-white">{m.name}</p>
                  <p className="text-xs text-surface-400 dark:text-surface-500">{[m.phone, m.email].filter(Boolean).join(" · ")} · {formatDateTime(m.created_at)}</p>
                  <p className="mt-2 text-sm text-surface-700 dark:text-surface-300">{m.message}</p>
                </div>
                <MessageStatusForm id={m.id} status={m.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
