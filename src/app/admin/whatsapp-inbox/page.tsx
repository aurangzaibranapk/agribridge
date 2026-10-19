import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { inboxEnabled } from "@/lib/whatsapp/inbox/flag";
import { applyFilter, filterCounts, parseFilter, tx, type ConversationRow, type MessageRow, type Party360, type TemplateRow } from "@/lib/whatsapp/inbox/model";
import { InboxShell } from "@/components/whatsapp-inbox/inbox-shell";
import { sendInboxReply, assignConversation, createInboxDraft, linkInboxNumber } from "@/actions/whatsapp-inbox";

export const dynamic = "force-dynamic";

/**
 * WhatsApp Chat Inbox (malik ki manzoori 19 Oct 2026). Har parhna user ke
 * apne session se -- staff scope DB (614 RLS / fn_wa_inbox_can_see) lagata hai.
 * Flag WHATSAPP_INBOX=1 ke bagair sirf "band hai".
 */
export default async function WhatsAppInboxPage({ searchParams }: { searchParams: { f?: string; q?: string; c?: string } }) {
  const lang = getLanguageFromCookies("rm");
  if (!inboxEnabled()) {
    return <div className="p-8 text-sm text-slate-500">{tx(lang, "off")}</div>;
  }
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  const me = user?.id ?? null;
  const filter = parseFilter(searchParams.f);
  const search = (searchParams.q ?? "").slice(0, 80);

  const { data: rows } = await sb.rpc("fn_wa_inbox_list" as never, { p_filter: "all", p_search: search || null, p_limit: 300 } as never);
  const all = ((rows as unknown) as ConversationRow[] | null) ?? [];
  const conversations = applyFilter(all, filter, me);
  const selected = all.find((c) => c.id === searchParams.c) ?? null;

  let messages: MessageRow[] = [];
  let party: Party360 | null = null;
  if (selected) {
    await sb.rpc("fn_wa_inbox_open" as never, { p_conv: selected.id } as never);
    const { data: msgs } = await sb
      .from("wa_messages" as never)
      .select("id, direction, msg_type, body, media_path, media_mime, transcript, ai_intent, ai_draft, send_status, sent_by, created_at")
      .eq("conversation_id", selected.id)
      .order("created_at", { ascending: true })
      .limit(200);
    const list = ((msgs as unknown) as (MessageRow & { media_path: string | null; sent_by: string | null })[] | null) ?? [];
    const senders = [...new Set(list.map((m) => m.sent_by).filter(Boolean))] as string[];
    const { data: names } = senders.length ? await sb.from("profiles").select("id, full_name").in("id", senders) : { data: [] };
    const nameOf = new Map((names ?? []).map((n: { id: string; full_name: string | null }) => [n.id, n.full_name]));
    messages = await Promise.all(list.map(async (m) => {
      let media_url: string | null = null;
      if (m.media_path) {
        const { data: s } = await sb.storage.from("wa-media").createSignedUrl(m.media_path, 600);
        media_url = s?.signedUrl ?? null;
      }
      return { ...m, media_url, sent_by_name: m.sent_by ? nameOf.get(m.sent_by) ?? null : null };
    }));
    const { data: p } = await sb.rpc("fn_wa_inbox_party360" as never, { p_conv: selected.id } as never);
    party = (p as unknown as Party360) ?? null;
  }
  const { data: tpls } = await sb.from("wa_templates" as never).select("key, label, body_preview, param_count").eq("is_active", true);
  const { data: myRole } = me ? await sb.from("profiles").select("role").eq("id", me).maybeSingle() : { data: null };
  const { data: staff } = await sb.from("profiles").select("id, full_name, role").not("role", "in", "(farmer,customer,customer_portal,ai_assistant)").eq("is_active", true).limit(200);

  return (
    <InboxShell
      key={selected?.id ?? "none"}
      lang={lang}
      filter={filter}
      search={search}
      counts={filterCounts(all, me)}
      conversations={conversations}
      selected={selected}
      messages={messages}
      party={party}
      templates={((tpls as unknown) as TemplateRow[] | null) ?? []}
      staff={(staff ?? []).map((s: { id: string; full_name: string | null }) => ({ id: s.id, name: s.full_name ?? s.id.slice(0, 8) }))}
      isAdmin={["owner", "super_admin", "admin"].includes(String((myRole as { role?: string } | null)?.role))}
      now={Date.now()}
      basePath="/admin/whatsapp-inbox"
      actions={{ send: sendInboxReply, assign: assignConversation, draft: createInboxDraft, link: linkInboxNumber }}
    />
  );
}
