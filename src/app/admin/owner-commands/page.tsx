import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { RespondForm, DoneButton } from "./owner-commands-client";
import { MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  received: "Aaya hai",
  acknowledged: "Dekh liya",
  responded: "Jawab likha",
  done: "Ho gaya",
};

const STATUS_COLOR: Record<string, string> = {
  received: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  acknowledged: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  responded: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  done: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400",
};

export default async function OwnerCommandsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [viewGuard, editGuard] = await Promise.all([
    requireAction("system.owner_commands", "view"),
    requireAction("system.owner_commands", "edit"),
  ]);
  if ("error" in viewGuard) {
    return <div className="p-8 text-center text-surface-400">{viewGuard.error}</div>;
  }
  const canEdit = !("error" in editGuard);

  const service = createServiceClient();
  const { data: rows } = await service
    .from("owner_whatsapp_commands")
    .select("id, from_phone, message, status, response_text, responded_at, resolved_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const open = (rows ?? []).filter((r) => r.status !== "done");
  const done = (rows ?? []).filter((r) => r.status === "done");

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp Commands"
        description="Malik ne WhatsApp par jo kaha, uski fehrist -- Command Center ka doosra qadam."
      />

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-surface-500" />
          <p className="text-xs text-surface-600 dark:text-surface-400">
            Malik ka WhatsApp paigham yahan &ldquo;Aaya hai&rdquo; ke sath aata hai. Jawab likhna Claude Code
            session ka kaam hai — jawab jama karte hi wo seedha malik ke WhatsApp par bhi chala jata hai (agar
            24 ghante ke andar ho). Kaam ho jane par &ldquo;Kaam ho gaya&rdquo; dabayein.
          </p>
        </div>
      </Card>

      {open.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-surface-500">Koi khula paigham nahi hai.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {open.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs font-medium text-surface-400">
                    <span className={`rounded-md px-1.5 py-0.5 ${STATUS_COLOR[r.status] ?? ""}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <span>{r.from_phone}</span>
                    <span>{new Date(r.created_at).toLocaleString("en-PK")}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-surface-900 dark:text-white">
                    {r.message}
                  </p>
                  {r.response_text && (
                    <p className="mt-2 rounded-lg bg-surface-50 px-2.5 py-2 text-xs text-surface-700 dark:bg-surface-900 dark:text-surface-300">
                      <strong>Jawab:</strong> {r.response_text}
                    </p>
                  )}
                  {canEdit && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {!r.response_text && <RespondForm commandId={r.id} />}
                      {r.response_text && <DoneButton commandId={r.id} />}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
            <h2 className="text-sm font-semibold text-surface-900 dark:text-white">Ho chuke</h2>
          </div>
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {done.map((r) => (
              <li key={r.id} className="px-4 py-2.5">
                <p className="text-sm text-surface-800 dark:text-surface-200">{r.message}</p>
                {r.response_text && <p className="mt-0.5 text-xs text-surface-500">{r.response_text}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
