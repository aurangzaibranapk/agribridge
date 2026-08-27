import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import {
  FileText, Clock, CheckCircle2, Users, Calendar, Award, Send, ThumbsUp, ThumbsDown, UserCheck, XCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "pending", label: "New Applications", icon: FileText, color: "text-blue-600" },
  { key: "under_review", label: "Under Review", icon: Clock, color: "text-surface-600" },
  { key: "eligible", label: "Eligible", icon: CheckCircle2, color: "text-brand-600" },
  { key: "interview_scheduled", label: "Interviews Scheduled", icon: Calendar, color: "text-amber-600" },
  { key: "scored", label: "Interviews Completed", icon: Award, color: "text-purple-600" },
  { key: "offered", label: "Offers Sent", icon: Send, color: "text-indigo-600" },
  { key: "accepted", label: "Offers Accepted", icon: ThumbsUp, color: "text-green-600" },
  { key: "joined", label: "Joined", icon: UserCheck, color: "text-green-700" },
  { key: "not_eligible", label: "Not Eligible", icon: XCircle, color: "text-red-500" },
  { key: "rejected", label: "Rejected", icon: ThumbsDown, color: "text-red-600" },
];

export default async function HrDashboardPage() {
  const supabase = createClient();
  const { data: applications } = await supabase.from("job_applications").select("status");

  const counts: Record<string, number> = {};
  (applications ?? []).forEach((a) => {
    counts[a.status] = (counts[a.status] ?? 0) + 1;
  });
  const total = applications?.length ?? 0;

  return (
    <div>
      <PageHeader title="HR Dashboard" description="Recruitment pipeline overview" />

      <div className="mb-6 rounded-card border border-brand-200 bg-brand-50 p-5 dark:border-brand-900/40 dark:bg-brand-950/30">
        <div className="flex items-center gap-2 text-brand-600">
          <Users className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Total Applications</span>
        </div>
        <p className="mt-2 font-display text-3xl font-bold text-brand-800 dark:text-brand-200">{total}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          return (
            <Card key={stage.key} className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
              <div className={`flex items-center gap-2 ${stage.color}`}>
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{stage.label}</span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
                {counts[stage.key] ?? 0}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}