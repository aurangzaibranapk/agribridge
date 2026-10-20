import { ComplaintQueue } from "@/components/support/complaint-queue";
import { ManagerGrantList } from "@/components/support/manager-grants";

export const metadata = { title: "Support complaint queue" };

const people = [
  { id: "ag", full_name: "Sana Iqbal", role: "call_center_agent" },
  { id: "fin", full_name: "Imran Ali", role: "finance" },
  { id: "wh", full_name: "Rashid", role: "warehouse" },
  { id: "dev", full_name: "Admin Assistant", role: "admin_assistant" },
];

const thumb = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect fill="#dbe7ff" width="160" height="120"/><text x="18" y="68" font-size="16" fill="#1a3f86">DAP</text></svg>',
);

export default function PreviewSupportQueue() {
  return (
    <main className="min-h-screen bg-surface-50 p-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium text-brand-700">Development Support Dashboard</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Complaint queue</h1>
        <ManagerGrantList
          example
          managers={[
            { id: "m1", full_name: "Kamran Raza", granted: false },
            { id: "m2", full_name: "Saima Khan", granted: true },
          ]}
        />
        <ComplaintQueue
          example
          canAssign
          canSendAi
          aiConnected={false}
          viewerId="admin"
          viewerRole="admin"
          people={people}
          agents={[{ key: "codex_subscription", label: "ChatGPT / Codex (Subscription)" }]}
          tickets={[
            {
              id: "fwd",
              ticketNo: 125,
              title: "Rate list purani hai",
              description: "Aaj ki urea rate update nahi hui. Check karein.",
              status: "investigating",
              intake: "staff",
              suggested: null,
              routed: "sales",
              assignee: "Imran Ali",
              assigneeId: "fin",
              reporter: "Imran Staff",
              reporterId: "staff",
              createdAt: "20 Oct 2026, 14:05",
              stage: "in_progress",
              percent: 55,
              managerForward: "Forwarded by Manager Kamran Raza",
              images: [{ src: thumb, alt: "Rate list photo" }],
              history: [
                { at: "14:05", event: "status", from: null, to: "received", note: "Staff shikayat seedha Admin queue mein.", actor: "Imran Staff" },
                { at: "14:22", event: "assignee", from: null, to: "Imran Ali", note: "Forwarded by Manager Kamran Raza Department: sales.", actor: "Kamran Raza" },
                { at: "14:40", event: "status", from: "assigned", to: "in_progress", note: "Rate sheet khol li.", actor: "Imran Ali" },
              ],
            },
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
              reporterId: "ag",
              createdAt: "20 Oct 2026, 13:44",
              stage: "received",
              percent: 10,
              history: [
                { at: "13:44", event: "status", from: null, to: "received", note: "Tajweez department: accounts. Assign nahi — Admin aage bhejega. SMS only.", actor: "Sana Iqbal" },
              ],
            },
          ]}
        />
      </div>
    </main>
  );
}
