import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { AgentsData, BoardData, ConsoleData, PartyData, SearchHit } from "@/lib/call-center/model";
import { CATEGORY_LABEL, type ComplaintCategory, type PartyKind } from "@/lib/call-center/rules";
import { veevoEnv, veevoReady } from "@/lib/sms/veevo";

const KIND_LABEL: Record<string, string> = { farmer: "Kisan", customer: "Customer", dealer: "Dealer" };

type Session =
  | { ok: false; error: string }
  | { ok: true; supabase: ReturnType<typeof createClient>; userId: string; roles: string[] };

async function db(): Promise<Session> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Login zaroori hai." };
  const { data: me } = await supabase.from("profiles").select("role, extra_roles, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return { ok: false, error: "Ye account fa'aal nahi hai." };
  const roles = [String(me.role), ...((me.extra_roles as string[] | null) ?? [])];
  return { ok: true, supabase, userId: user.id, roles };
}

function fail(message: string): string {
  if (/fn_cc_|schema cache|does not exist|Could not find/i.test(message)) {
    return "Call center ki tables abhi is database par nahi. Migration 624 aur 625 sirf backup ke baad chalti hain.";
  }
  return message;
}

export async function loadConsole(query: string): Promise<ConsoleData> {
  const who = await db();
  const empty: ConsoleData = {
    example: false, query, results: null, recent: [], callsToday: null, complaintsToday: null, openComplaints: null, notice: null,
  };
  if (!who.ok) return { ...empty, notice: who.error };
  const { data, error } = await (who.supabase as unknown as { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> })
    .rpc("fn_cc_console");
  if (error) return { ...empty, notice: fail(error.message) };
  const row = (data ?? {}) as { calls_today?: number; complaints_today?: number; open_complaints?: number; recent?: { at: string; name: string; kind: string; id: string; code: string; phone_masked: string }[] };
  let results: SearchHit[] | null = null;
  if (query.trim().length >= 2) {
    const found = await (who.supabase as unknown as { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> })
      .rpc("fn_cc_search", { p_query: query.trim() });
    if (!found.error && Array.isArray(found.data)) {
      results = (found.data as Record<string, string>[]).map((h) => ({
        kind: h.kind as PartyKind,
        id: h.id,
        name: h.name,
        code: h.code,
        place: h.place ?? null,
        phoneMasked: h.phone_masked ?? "",
      }));
    }
  }
  return {
    example: false,
    query,
    results,
    callsToday: row.calls_today ?? null,
    complaintsToday: row.complaints_today ?? null,
    openComplaints: row.open_complaints ?? null,
    notice: null,
    recent: (row.recent ?? []).map((r) => ({
      at: r.at,
      name: r.name,
      kindLabel: KIND_LABEL[r.kind] ?? r.kind,
      place: null,
      phoneMasked: r.phone_masked,
      href: `/admin/call-center/party/${r.kind}/${r.id}`,
    })),
  };
}

export async function loadParty(kind: string, id: string): Promise<PartyData> {
  const blank: PartyData = {
    example: false, found: false, kind: "farmer", id, name: "", code: "", place: null, typeLabel: "",
    phoneMasked: "", tracked: false, balance: null, balanceSide: null, lines: [],
    milk: { tracked: false, todayLiters: null, rate: null, nextPayment: null },
    rates: [], complaints: [], notice: null,
  };
  const who = await db();
  if (!who.ok) return { ...blank, notice: who.error };
  const device = headers().get("user-agent")?.slice(0, 300) ?? "";
  const { data, error } = await (who.supabase as unknown as { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> })
    .rpc("fn_cc_party_360", { p_kind: kind, p_id: id, p_device: device });
  if (error) return { ...blank, notice: fail(error.message) };
  const row = (data ?? {}) as Record<string, unknown>;
  if (!row.found) return { ...blank, found: false, notice: "Caller nahi mila." };
  const milk = (row.milk ?? {}) as Record<string, unknown>;
  return {
    example: false,
    found: true,
    kind: row.kind as PartyKind,
    id: String(row.id),
    name: String(row.name ?? ""),
    code: String(row.code ?? ""),
    place: (row.place as string | null) ?? null,
    typeLabel: String(row.type_label ?? ""),
    phoneMasked: String(row.phone_masked ?? ""),
    tracked: row.tracked === true,
    balance: row.balance == null ? null : Number(row.balance),
    balanceSide: (row.balance_side as "Dr" | "Cr" | null) ?? null,
    lines: ((row.lines as Record<string, unknown>[]) ?? []).map((l) => ({
      date: String(l.date),
      detail: String(l.detail ?? ""),
      debit: l.debit == null ? null : Number(l.debit),
      credit: l.credit == null ? null : Number(l.credit),
      balance: l.balance == null ? null : Number(l.balance),
      side: (l.side as "Dr" | "Cr") ?? "Cr",
    })),
    milk: {
      tracked: milk.tracked === true,
      todayLiters: milk.today_liters == null ? null : Number(milk.today_liters),
      rate: milk.rate == null ? null : Number(milk.rate),
      nextPayment: (milk.next_payment as string | null) ?? null,
    },
    rates: ((row.rates as { name: string; rate: number }[]) ?? []),
    complaints: ((row.complaints as { number: string; category: string; status: string }[]) ?? []).map((c) => ({
      number: c.number,
      category: (c.category as ComplaintCategory),
      status: c.status as PartyData["complaints"][number]["status"],
    })),
    notice: null,
  };
}

export async function loadBoard(): Promise<BoardData> {
  const empty: BoardData = {
    example: false, open: null, inProgress: null, resolved: null, slaBreach: null, rows: [], actorId: "", actorRoles: [], notice: null,
  };
  const who = await db();
  if (!who.ok) return { ...empty, notice: who.error };
  const { data, error } = await (who.supabase as unknown as { rpc: (n: string) => Promise<{ data: unknown; error: { message: string } | null }> })
    .rpc("fn_cc_complaints_board");
  if (error) return { ...empty, actorId: who.userId, actorRoles: who.roles, notice: fail(error.message) };
  const row = (data ?? {}) as Record<string, unknown>;
  const rows = ((row.rows as Record<string, string>[]) ?? []).map((r) => ({
    id: r.id,
    number: r.number,
    callerName: r.caller_name,
    category: r.category as ComplaintCategory,
    department: r.department,
    createdAt: r.created_at,
    slaDue: r.sla_due_at,
    status: r.status as BoardData["rows"][number]["status"],
    createdBy: r.created_by,
    createdByName: r.created_by_name || "—",
  }));
  return {
    example: false,
    open: row.open == null ? null : Number(row.open),
    inProgress: row.in_progress == null ? null : Number(row.in_progress),
    resolved: row.resolved == null ? null : Number(row.resolved),
    slaBreach: row.sla_breach == null ? null : Number(row.sla_breach),
    rows,
    actorId: who.userId,
    actorRoles: who.roles,
    notice: null,
  };
}

export async function loadAgents(): Promise<AgentsData> {
  const empty: AgentsData = { example: false, agents: [], audit: [], notice: null, canCreate: false, smsConfigured: veevoReady(veevoEnv()) };
  const who = await db();
  if (!who.ok) return { ...empty, notice: who.error };
  const canCreate = ["owner", "super_admin", "admin"].includes(who.roles[0] ?? "");
  if (!canCreate) return { ...empty, notice: "Agent admin sirf Owner ya Admin ke liye hai." };
  const client = who.supabase as unknown as { rpc: (n: string, a?: object) => Promise<{ data: unknown; error: { message: string } | null }> };
  const [agents, audit] = await Promise.all([client.rpc("fn_cc_list_agents"), client.rpc("fn_cc_audit_log", { p_limit: 50 })]);
  if (agents.error) return { ...empty, canCreate, notice: fail(agents.error.message) };
  return {
    example: false,
    canCreate,
    smsConfigured: veevoReady(veevoEnv()),
    notice: audit.error ? fail(audit.error.message) : null,
    agents: ((agents.data as Record<string, unknown>[]) ?? []).map((a) => ({
      code: String(a.code),
      name: String(a.name ?? ""),
      status: String(a.status ?? ""),
      callsToday: a.calls_today == null ? null : Number(a.calls_today),
    })),
    audit: ((audit.data as Record<string, string>[]) ?? []).map((a) => ({
      at: a.at, agent: a.agent, party: a.party, action: a.action, device: a.device,
    })),
  };
}

export function categoryTitle(category: string): string {
  return CATEGORY_LABEL[category as ComplaintCategory]?.en ?? category;
}
