import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import Link from "next/link";
import { Inbox, AlertTriangle, Check, X, CornerUpLeft } from "lucide-react";
import { KIND_LABEL, STATUS_LABEL, type SubmissionKind, type SubmissionStatus } from "@/lib/whatsapp-submissions";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "approved") return "green" as const;
  if (status === "rejected") return "red" as const;
  if (status === "sent_back") return "amber" as const;
  return "blue" as const;
}

export default async function SubmissionsInboxPage() {
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("whatsapp_submissions")
    .select("id, submission_number, kind, status, original_amount, corrected_amount, flags, created_at, staff_profile_id, branch_id, manager_comment")
    .order("created_at", { ascending: false })
    .limit(200);

  const submissions = rows ?? [];

  const staffIds = Array.from(new Set(submissions.map((s) => s.staff_profile_id).filter(Boolean))) as string[];
  const branchIds = Array.from(new Set(submissions.map((s) => s.branch_id).filter(Boolean))) as string[];

  const { data: profiles } = staffIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", staffIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const { data: branches } = branchIds.length
    ? await supabase.from("branches").select("id, name").in("id", branchIds)
    : { data: [] as { id: string; name: string }[] };

  const staffName = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Staff"]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const pending = submissions.filter((s) => s.status === "pending");
  const flagged = submissions.filter((s) => Array.isArray(s.flags) && (s.flags as unknown[]).length > 0);
  const pendingValue = pending.reduce((sum, s) => sum + Number(s.original_amount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Approval Inbox"
        description="WhatsApp se aaye bills, meter readings aur cash. Manager ki comment ke baghair koi transaction accounts mein nahi jati."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><Inbox className="h-3.5 w-3.5 text-blue-600" /> Faisle ke intezar mein</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{pending.length}</p>
          <p className="text-xs text-surface-500">Rs {pendingValue.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Nishan lage huye</p>
          <p className="mt-1 font-display text-xl font-bold text-amber-600">{flagged.length}</p>
          <p className="text-xs text-surface-500">System ne kuch ajeeb pakra</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><Check className="h-3.5 w-3.5 text-green-600" /> Faisla ho chuka</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{submissions.length - pending.length}</p>
        </Card>
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          title="Abhi tak koi submission nahi aayi."
          description="Jab staff WhatsApp par bill ya meter ki photo bhejega, wo yahan nazar aayegi."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">Number</th>
                <th className="px-3 py-2 font-medium text-surface-500">Qism</th>
                <th className="px-3 py-2 font-medium text-surface-500">Staff</th>
                <th className="px-3 py-2 font-medium text-surface-500">Branch</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">Raqam</th>
                <th className="px-3 py-2 font-medium text-surface-500">Haalat</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => {
                const flagCount = Array.isArray(s.flags) ? (s.flags as unknown[]).length : 0;
                const amount = s.corrected_amount ?? s.original_amount;
                return (
                  <tr key={s.id} className="border-b border-surface-100 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/50">
                    <td className="px-3 py-2">
                      <Link href={`/admin/submissions/${s.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                        {s.submission_number}
                      </Link>
                      {flagCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> {flagCount}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{KIND_LABEL[s.kind as SubmissionKind] ?? s.kind}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{staffName.get(s.staff_profile_id as string) ?? "-"}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{branchName.get(s.branch_id as string) ?? "-"}</td>
                    <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">
                      {amount == null ? "-" : `Rs ${Number(amount).toLocaleString()}`}
                      {s.corrected_amount != null && s.original_amount != null && Number(s.corrected_amount) !== Number(s.original_amount) && (
                        <span className="ml-1 text-xs text-surface-400 line-through">Rs {Number(s.original_amount).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={statusTone(s.status)}>
                        {s.status === "approved" && <Check className="mr-0.5 inline h-3 w-3" />}
                        {s.status === "rejected" && <X className="mr-0.5 inline h-3 w-3" />}
                        {s.status === "sent_back" && <CornerUpLeft className="mr-0.5 inline h-3 w-3" />}
                        {STATUS_LABEL[s.status as SubmissionStatus] ?? s.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
