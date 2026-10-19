import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { WHATSAPP_REPLY_INTENT, WHATSAPP_REPLY_ROLES } from "@/lib/whatsapp/inbound-policy";
import { ReplyCard, UnknownSenderRow } from "./reply-card";

export const dynamic = "force-dynamic";

/**
 * Kisan WhatsApp -- jawab staff ke haath (malik, go-live 5, 19 Oct 2026).
 *
 * Webhook kisan ko AI ka jawab KHUD nahi bhejta. Har aane wala text/voice
 * yahan ek pending qatar ban kar aata hai, AI ke mashware ke sath. Staff
 * parhta hai, theek karta hai, "Preview" aur phir "Confirm send" -- tab hi
 * paighaam jata hai. Neeche anjaan numbers ki qatar: in se farmer record
 * khud nahi banta; staff chahe to Farmers safhe par khud banaye.
 *
 * (Ye wohi raasta hai jis ka link "Farmer Ko Expert Advice Chahiye"
 * notification pehle se de rahi thi.)
 */
export default async function FarmerAiRequestsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me || !me.is_active || !WHATSAPP_REPLY_ROLES.includes(me.role)) redirect("/admin");

  // RLS par kisan sirf apni qataarein dekhta hai; staff ke liye service
  // client -- upar role ki rok ke baad.
  const svc = createServiceClient() as any;
  const [{ data: rows }, { data: unknown }] = await Promise.all([
    svc
      .from("farmer_ai_requests")
      .select("id, status, description, details, created_at, responded_at, expert_response, farmers(full_name, farmer_code, whatsapp_number, phone_number)")
      .eq("intent_type", WHATSAPP_REPLY_INTENT)
      .order("created_at", { ascending: false })
      .limit(100),
    svc.from("whatsapp_onboarding").select("phone_key, phone_number, full_name, created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const all = (rows ?? []) as any[];
  const pending = all.filter((r) => r.status === "pending");
  const done = all.filter((r) => r.status !== "pending").slice(0, 20);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <PageHeader
        title="Kisan WhatsApp jawab"
        description="AI ab kisan ko khud jawab nahi deta. Mashwara parhein, theek karein, preview dekh kar Confirm send karein."
        actions={<Badge tone={pending.length ? "amber" : "green"}>{pending.length} pending</Badge>}
      />

      <section className="space-y-3">
        {pending.length === 0 ? (
          <EmptyState title="Koi WhatsApp jawab baqi nahi" description="Naya paighaam aate hi yahan nazar aayega." />
        ) : (
          pending.map((r) => {
            const f = Array.isArray(r.farmers) ? r.farmers[0] : r.farmers;
            return (
              <ReplyCard
                key={r.id}
                id={r.id}
                farmer={`${f?.full_name ?? "Kisan"}${f?.farmer_code ? ` · ${f.farmer_code}` : ""}`}
                phone={f?.whatsapp_number ?? r.details?.from_phone ?? f?.phone_number ?? ""}
                inbound={r.details?.inbound_text ?? (r.details?.message_type === "text" ? "" : "🎤 Voice note")}
                suggestion={r.details?.suggested_reply ?? ""}
                aiError={r.details?.ai_error ?? null}
                unsigned={r.details?.signature === "unsigned"}
                createdAt={r.created_at}
              />
            );
          })
        )}
      </section>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-surface-900 dark:text-white">Anjaan numbers (unknown sender)</h2>
          <Badge tone="gray">{(unknown ?? []).length}</Badge>
        </div>
        <p className="mb-3 text-sm text-surface-500 dark:text-surface-400">
          In numbers ka koi farmer record nahi. Khud-ba-khud farmer nahi banta aur inhein koi paighaam nahi jata. Asal kisan ho to{" "}
          <Link href="/admin/farmers" className="font-medium text-brand-700 underline dark:text-brand-300">Farmers</Link> safhe par khud banayein.
        </p>
        {(unknown ?? []).length === 0 ? (
          <p className="text-sm text-surface-500">Koi anjaan number nahi.</p>
        ) : (
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {(unknown as any[]).map((u) => (
              <UnknownSenderRow key={u.phone_key} phoneKey={u.phone_key} phone={u.phone_number} name={u.full_name} createdAt={u.created_at} />
            ))}
          </ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold text-surface-900 dark:text-white">Haal hi mein mukammal</h2>
          <ul className="divide-y divide-surface-100 text-sm dark:divide-surface-800">
            {done.map((r) => {
              const f = Array.isArray(r.farmers) ? r.farmers[0] : r.farmers;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-surface-700 dark:text-surface-200">{f?.full_name ?? "Kisan"} — {r.description}</span>
                  <Badge tone={r.status === "approved" ? "green" : "gray"}>{r.status === "approved" ? "bheja gaya" : "band"}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
