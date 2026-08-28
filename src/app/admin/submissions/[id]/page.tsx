import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { ReviewForm } from "./review-form";
import { signedMediaUrl, KIND_LABEL, STATUS_LABEL, type SubmissionKind, type SubmissionStatus } from "@/lib/whatsapp-submissions";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["owner", "super_admin", "admin", "manager"];

function statusTone(status: string) {
  if (status === "approved") return "green" as const;
  if (status === "rejected") return "red" as const;
  if (status === "sent_back") return "amber" as const;
  return "blue" as const;
}

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();

  const { data: s } = await supabase.from("whatsapp_submissions").select("*").eq("id", id).maybeSingle();
  if (!s) return <div className="p-8 text-center text-surface-400">Submission nahi mili.</div>;

  const { data: staff } = await supabase.from("profiles").select("full_name").eq("id", s.staff_profile_id).maybeSingle();
  const { data: branch } = s.branch_id
    ? await supabase.from("branches").select("name").eq("id", s.branch_id).maybeSingle()
    : { data: null };
  const { data: manager } = s.manager_profile_id
    ? await supabase.from("profiles").select("full_name").eq("id", s.manager_profile_id).maybeSingle()
    : { data: null };

  // Cash ki entry kis khate mein jayegi — manager chunega. Sirf chaalu
  // khate dikhate hain.
  const { data: accounts } = await supabase
    .from("finance_accounts")
    .select("id, name, account_type")
    .eq("is_active", true)
    .order("account_type")
    .order("name");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, branch_id").eq("id", user.id).maybeSingle() : { data: null };
  const isAdminLevel = me ? ["owner", "super_admin", "admin"].includes(me.role) : false;
  const canReview =
    !!me &&
    MANAGER_ROLES.includes(me.role) &&
    s.status === "pending" &&
    (isAdminLevel || !me.branch_id || !s.branch_id || me.branch_id === s.branch_id);

  const evidenceUrl = await signedMediaUrl(s.media_path);
  const managerUrls = await Promise.all((s.manager_media_paths ?? []).map((p: string) => signedMediaUrl(p)));

  const flags = Array.isArray(s.flags) ? (s.flags as string[]) : [];
  const isImage = (s.media_mime ?? "").startsWith("image/");

  return (
    <div>
      <PageHeader title={s.submission_number} description={`${KIND_LABEL[s.kind as SubmissionKind] ?? s.kind} — ${staff?.full_name ?? "Staff"}`} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tone={statusTone(s.status)}>{STATUS_LABEL[s.status as SubmissionStatus] ?? s.status}</Badge>
        {s.original_amount != null && (
          <span className="font-display text-lg font-bold text-surface-900 dark:text-white">
            Rs {Number(s.corrected_amount ?? s.original_amount).toLocaleString()}
          </span>
        )}
        {s.corrected_amount != null && Number(s.corrected_amount) !== Number(s.original_amount) && (
          <span className="text-sm text-surface-400 line-through">Rs {Number(s.original_amount).toLocaleString()}</span>
        )}
      </div>

      {flags.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-4 w-4" /> System ne ye baatein pakri hain:</p>
          <ul className="mt-1 list-inside list-disc">
            {flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          <p className="mt-1 text-xs">Ye sirf ishara hai — faisla aap ka hai.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Staff ne kya bheja (asal saboot)</h3>
            {s.raw_text && <p className="mb-3 whitespace-pre-wrap rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800">{s.raw_text}</p>}
            {evidenceUrl ? (
              isImage ? (
                <a href={evidenceUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={evidenceUrl} alt="Saboot" className="max-h-96 rounded-lg border border-surface-200" />
                </a>
              ) : (
                <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">
                  File kholein
                </a>
              )
            ) : (
              <p className="text-sm text-surface-400">Koi photo nahi bheji gayi.</p>
            )}
          </Card>

          {s.ai_summary && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">AI ne kya samjha</h3>
              <p className="whitespace-pre-wrap text-sm text-surface-600 dark:text-surface-400">{s.ai_summary}</p>
              <p className="mt-2 text-xs text-surface-500">Ye AI ka andaza hai — asal saboot upar hai. Milaa kar dekh lein.</p>
            </Card>
          )}

          {s.status !== "pending" && (
            <Card className="p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
                <MessageSquare className="h-4 w-4" /> Manager ka faisla
              </h3>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-50 p-3 text-sm dark:bg-surface-800">{s.manager_comment}</p>
              <p className="mt-2 text-xs text-surface-500">
                {manager?.full_name ?? "Manager"} — {s.reviewed_at ? new Date(s.reviewed_at).toLocaleString() : ""}
              </p>
              {managerUrls.filter(Boolean).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {managerUrls.filter(Boolean).map((url, i) => (
                    <a key={i} href={url as string} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url as string} alt={`Manager ki tasveer ${i + 1}`} className="h-24 rounded-lg border border-surface-200" />
                    </a>
                  ))}
                </div>
              )}
            </Card>
          )}

          {canReview && (
            <ReviewForm
              submissionId={s.id}
              kind={s.kind}
              originalAmount={s.original_amount == null ? null : Number(s.original_amount)}
              suggestedParty={typeof (s.ai_extracted as { partyName?: unknown } | null)?.partyName === "string" ? String((s.ai_extracted as { partyName?: string }).partyName) : ""}
              accounts={accounts ?? []}
            />
          )}

          {!canReview && s.status === "pending" && (
            <Card className="p-4">
              <p className="text-sm text-surface-500">Is par faisla is branch ka Manager ya Admin hi kar sakta hai.</p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Tafseel</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-surface-500">Staff</span><span>{staff?.full_name ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Branch</span><span>{branch?.name ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Number</span><span className="font-mono text-xs">{s.whatsapp_number}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Qism</span><span>{KIND_LABEL[s.kind as SubmissionKind] ?? s.kind}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">Aayi</span><span>{new Date(s.created_at).toLocaleString()}</span></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
