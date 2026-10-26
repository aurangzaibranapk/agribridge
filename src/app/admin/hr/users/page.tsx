import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { siteOrigin } from "@/lib/payroll/site-origin";
import { canCreatePartyInvite, mapAccount, mapSend, type InviteAccount, type InviteSend } from "@/lib/party-invite";
import { InviteClient } from "./invite-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HR / Users",
  robots: { index: false, follow: false },
};

export default async function PartyInvitePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role, organization_id, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !me.organization_id || !canCreatePartyInvite(me.role)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Sirf Admin ya Owner naya dealer / buyer bana sakta hai.
      </div>
    );
  }

  const service = createServiceClient() as unknown as {
    from(table: string): any;
  };
  const { data: branches } = await service
    .from("branches")
    .select("id, name")
    .eq("organization_id", me.organization_id)
    .eq("is_active", true)
    .order("name");

  let accounts: InviteAccount[] = [];
  let sends: InviteSend[] = [];
  let dbError: string | null = null;
  const loaded = await service
    .from("party_invite_accounts")
    .select("id, party_role, full_name, phone, email, branch_name, created_at")
    .eq("organization_id", me.organization_id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (loaded.error) {
    dbError = "Invite ka record abhi nahi mila. Migration 712 pehle Testing par lagayein.";
  } else {
    accounts = (loaded.data ?? []).map(mapAccount).filter(Boolean) as InviteAccount[];
    const ids = accounts.map((a) => a.id);
    if (ids.length) {
      const sent = await service.from("party_invite_sends").select("id, account_id, channel, recipient, subject, content, status, error, created_at").in("account_id", ids).order("created_at", { ascending: false });
      if (sent.error) dbError = sent.error.message;
      else sends = (sent.data ?? []).map(mapSend).filter(Boolean) as InviteSend[];
    }
  }

  return (
    <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6">
    <InviteClient
      loginUrl={`${siteOrigin()}/login`}
      branches={(branches ?? []) as { id: string; name: string }[]}
      accounts={accounts}
      sends={sends}
      dbError={dbError}
    />
    </div>
  );
}
