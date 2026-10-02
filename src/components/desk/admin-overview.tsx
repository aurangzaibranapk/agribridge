import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { MessageSquare, FileText, Bell, CheckCircle2, Globe } from "lucide-react";

const ct = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-PK"));

export async function AdminOverview() {
  const service = createServiceClient();

  try {
    const [messagesRes, submissionsRes, blogRes, notificationsRes, recentMsgRes] = await Promise.all([
      service
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "unread"),
      service
        .from("whatsapp_submissions")
        .select("id", { count: "exact", head: true })
        .is("reviewed_at", null),
      service
        .from("blog_posts")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      service
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false),
      service
        .from("contact_messages")
        .select("id, name, email, subject, created_at, status")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const unreadMessages = messagesRes.count ?? 0;
    const pendingSubmissions = submissionsRes.count ?? 0;
    const publishedBlogs = blogRes.count ?? 0;
    const unreadNotifications = notificationsRes.count ?? 0;
    const recentMessages = recentMsgRes.data ?? [];

    return (
      <div className="staff-desk-screen">
        <div className="staff-desk-top-grid">
          <section className="desk-card staff-desk-ledger">
            <div className="staff-desk-card-title">
              <span><MessageSquare /> Messages</span>
              <span className="staff-desk-live">Admin</span>
            </div>
            <div className="staff-desk-ledger-total">
              <strong>{ct(unreadMessages)}</strong>
              <span>Unread contact messages</span>
            </div>
            <div className="staff-desk-ledger-split">
              <div><span>Submissions</span><strong>{ct(pendingSubmissions)}</strong></div>
              <div><span>Published blogs</span><strong>{ct(publishedBlogs)}</strong></div>
              <div><span>Notifications</span><strong>{ct(unreadNotifications)}</strong></div>
            </div>
            <Link href="/admin/contact-messages" className="mt-4 block text-[12px] text-brand-600 dark:text-brand-400">
              Messages kholein →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><FileText /> Submissions</h2>
            <div className="staff-desk-funnel">
              <div><strong>{ct(pendingSubmissions)}</strong><span>Pending review</span></div>
            </div>
            <Link href="/admin/submissions" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Submissions kholein →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><Globe /> Website</h2>
            <div className="staff-desk-health">
              <div><strong>{ct(publishedBlogs)}</strong><span>Blogs live</span></div>
              <div><strong>{ct(unreadMessages)}</strong><span>Unread msgs</span></div>
              <div><strong>—</strong><span>Galleries</span></div>
            </div>
            <Link href="/admin/blog" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Blog →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary staff-desk-urgent">
            <h2><Bell /> Unread</h2>
            {unreadMessages > 0 ? (
              <>
                <div className="staff-desk-funnel">
                  <div><strong className="text-amber-600 dark:text-amber-400">{ct(unreadMessages)}</strong><span>Messages</span></div>
                </div>
                <Link href="/admin/contact-messages" className="mt-3 block text-[12px] text-amber-600 dark:text-amber-400 font-medium">
                  Messages dekhein →
                </Link>
              </>
            ) : (
              <p className="flex items-center gap-1.5 mt-2 text-[12px] text-surface-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Koi unread message nahi
              </p>
            )}
          </section>
        </div>

        {/* Recent Contact Messages */}
        <section className="desk-card">
          <div className="staff-desk-card-title">
            <span><MessageSquare /> Haal Ke Contact Messages</span>
            <Link href="/admin/contact-messages" className="text-[11px] text-brand-600 dark:text-brand-400">Sab dekhein →</Link>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentMessages.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-surface-400">Koi message nahi mila.</p>
            ) : (
              recentMessages.map((m: any) => {
                const time = new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Asia/Karachi",
                  day: "2-digit",
                  month: "short",
                }).format(new Date(m.created_at));
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-surface-800 dark:text-surface-100">
                        {m.name ?? "—"} · {m.subject ?? "—"}
                      </p>
                      <p className="truncate text-[11px] text-surface-500">{m.email ?? "—"} · {time}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      m.status === "unread" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                      "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                    }`}>
                      {m.status === "unread" ? "Unread" : "Read"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    );
  } catch {
    return (
      <div className="desk-card">
        <p className="text-sm text-surface-500">Admin dashboard ka data load nahi hua. Refresh karein.</p>
        <Link href="/admin/contact-messages" className="mt-2 block text-sm text-brand-600">Messages kholein →</Link>
      </div>
    );
  }
}
