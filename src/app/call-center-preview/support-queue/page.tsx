import { ComplaintQueue } from "@/components/support/complaint-queue";

export const metadata = { title: "Support complaint queue" };

const people = [
  { id: "ag", full_name: "Sana Iqbal", role: "call_center_agent" },
  { id: "fin", full_name: "Imran Ali", role: "finance" },
  { id: "wh", full_name: "Rashid", role: "warehouse" },
  { id: "dev", full_name: "Admin Assistant", role: "admin_assistant" },
];

export default function PreviewSupportQueue() {
  return (
    <main className="min-h-screen bg-surface-50 p-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium text-brand-700">Development Support Dashboard</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Complaint queue</h1>
        <ComplaintQueue
          example
          canAssign
          people={people}
          agents={[{ key: "codex_subscription", label: "ChatGPT / Codex (Subscription)" }]}
          tickets={[
            {
              id: "cmp",
              ticketNo: 123,
              title: "CMP-000123 · Muhammad Aslam",
              description: "18 Oct ko DAP 1 bag likha gaya hai, caller kehta hai bag nahi liya.",
              status: "new",
              intake: "call_center",
              suggested: "accounts",
              routed: null,
              assignee: null,
              reporter: "Sana Iqbal",
              createdAt: "20 Oct 2026, 13:44",
              history: [
                { at: "13:44", event: "status", from: null, to: "new", note: "Tajweez department: accounts. Assign nahi — Admin aage bhejega. SMS only.", actor: "Sana Iqbal" },
              ],
            },
            {
              id: "staff",
              ticketNo: 124,
              title: "Rate list purani hai",
              description: "Aaj ki urea rate update nahi hui.",
              status: "new",
              intake: "staff",
              suggested: null,
              routed: null,
              assignee: null,
              reporter: "Imran Staff",
              createdAt: "20 Oct 2026, 14:05",
              history: [
                { at: "14:05", event: "status", from: null, to: "new", note: "Staff shikayat seedha Admin queue mein. Koi department, koi auto-assign nahi.", actor: "Imran Staff" },
              ],
            },
          ]}
        />
      </div>
    </main>
  );
}
