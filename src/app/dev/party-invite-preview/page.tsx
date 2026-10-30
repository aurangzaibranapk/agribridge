import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteClient } from "@/app/admin/hr/users/invite-client";
import { PREVIEW_LOGIN, previewAccount, previewSends } from "@/lib/party-invite";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HR / Users preview",
  robots: { index: false, follow: false },
};

/** Dev screenshot. Production par 404. Login nahi chahiye. */
export default function PartyInvitePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const account = previewAccount();
  return (
    <div className="min-h-screen bg-[#071610] md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden flex-col gap-1 bg-[#071a14] p-4 text-sm text-[#d7efe2] md:flex">
        <p className="text-base font-semibold text-[#3ecf6e]">AgriBridge</p>
        <p className="rounded-lg px-2 py-1.5 text-[#9dccb0]">Dashboard</p>
        <p className="rounded-lg bg-[#1f7a4d] px-2 py-1.5 font-semibold">HR / Users</p>
        <p className="rounded-lg px-2 py-1.5 text-[#9dccb0]">Staff</p>
      </aside>
      <InviteClient
        loginUrl={PREVIEW_LOGIN}
        branches={[{ id: "mah", name: account.branchName }]}
        accounts={[account]}
        sends={previewSends()}
        dbError={null}
        previewMode
      />
    </div>
  );
}
