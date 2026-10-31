"use server";

import { revalidatePath } from "next/cache";
import { kharchaManzoor, kharchaRadd, kharchaTheek, kharchaVerify } from "@/actions/kharche";
import { mazdooriManzoor, mazdooriRadd } from "@/actions/mazdoori";
import { approveSupplierPayment, editSupplierPayment, rejectSupplierPayment } from "@/actions/supplier-payment-requests";
import { mayDecideEntry } from "@/lib/approval/guards";
import { billQismKaLabel, qismDhoondein } from "@/lib/kharche";
import {
  handoffActionCategory,
  popupCaps,
  showRs,
  showText,
  type PendingPopupData,
  type PopupCommit,
  type PopupField,
} from "@/lib/pending/popup";
import type { PendingItem } from "@/lib/pending/categories";
import { createClient } from "@/lib/supabase/server";

/**
 * Popup sirf parhta hai, aur faisla purane actions ko deta hai.
 * Koi naya journal, koi naya manzoori ka raasta nahi.
 */
const UUID = /^[0-9a-f-]{36}$/i;
const P = "/admin/my-work/pending";
const UNREAD = "Ye parha nahi ja saka — is ka matlab sifar nahi.";

type Sb = ReturnType<typeof createClient>;
type ActionState = { error?: string; success?: boolean; message?: string };

function fail(error: string): PopupCommit {
  return { ok: false, error };
}

function fromAction(res: ActionState | null | undefined, effect: "done" | "stay", decision?: "approve" | "reject"): PopupCommit {
  if (!res || typeof res !== "object") return fail("Save nahi hua.");
  if (res.error) return fail(res.error);
  if (!res.success) return fail("Save nahi hua.");
  const message = res.message || "Ho gaya.";
  if (effect === "done") return { ok: true, effect, decision: decision ?? "approve", message };
  return { ok: true, effect: "stay", message };
}

async function who(sb: Sb): Promise<{ id: string; role: string | null } | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { id: user.id, role: (me as { role?: string } | null)?.role ?? null };
}

async function accountList(sb: Sb): Promise<{ id: string; name: string }[]> {
  const { data } = await sb.from("finance_accounts").select("id, name").eq("is_active", true).order("name").limit(80);
  return ((data ?? []) as { id: string; name: string | null }[]).map((a) => ({ id: a.id, name: a.name || a.id.slice(0, 8) }));
}

function accountName(list: { id: string; name: string }[], id: string | null): string {
  if (!id) return "—";
  return list.find((a) => a.id === id)?.name ?? id.slice(0, 8);
}

function pack(
  openedCategory: string,
  openedId: string,
  actionCategory: string,
  actionId: string,
  headline: string,
  status: string | null,
  fields: PopupField[],
  role: string | null,
  isOwn: boolean,
  hasAccount: boolean,
  editKind: PendingPopupData["editKind"],
  edit: Record<string, string> | null,
  accounts: { id: string; name: string }[],
  hintOverride?: PendingPopupData["hint"]
): PendingPopupData {
  const caps = popupCaps({ category: actionCategory, status, role, isOwn, hasAccount });
  const hint = hintOverride ?? caps.hint;
  return {
    openedCategory,
    openedId,
    actionCategory,
    actionId,
    headline,
    status,
    fields,
    caps: { ...caps, hint },
    editKind,
    edit,
    accounts,
    hint,
  };
}

async function loadExpense(sb: Sb, role: string | null, userId: string, id: string, prefix: PopupField[]): Promise<{ ok: true; data: PendingPopupData } | { ok: false; error: string }> {
  const { data, error } = await sb
    .from("company_expense_requests")
    .select("id, expense_number, expense_date, kind, category, description, party_name, party_type, amount, status, paid_from_account_id, rejection_reason, document_url, requested_by")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: UNREAD };
  if (!data) return { ok: false, error: "Ye kharcha nazar nahi aaya." };
  const accounts = await accountList(sb);
  const kind = qismDhoondein(String(data.kind ?? ""))?.label ?? showText(data.kind);
  const fields: PopupField[] = [
    ...prefix,
    { key: "ref", value: showText(data.expense_number) },
    { key: "date", value: showText(data.expense_date) },
    { key: "kind", value: kind },
    { key: "category", value: billQismKaLabel(data.category) },
    { key: "detail", value: showText(data.description) },
    { key: "party", value: showText(data.party_name || data.party_type) },
    { key: "amount", value: showRs(data.amount) },
    { key: "account", value: accountName(accounts, data.paid_from_account_id) },
    { key: "status", value: showText(data.status) },
  ];
  if (data.rejection_reason) fields.push({ key: "notes", value: showText(data.rejection_reason) });
  if (data.document_url) fields.push({ key: "doc", value: showText(data.document_url) });
  const edit = {
    description: data.description ?? "",
    amount: String(data.amount ?? ""),
    expense_date: data.expense_date ?? "",
    party_name: data.party_name ?? "",
    category: data.category ?? "",
    paid_from_account_id: data.paid_from_account_id ?? "",
  };
  return {
    ok: true,
    data: pack("expenses", id, "expenses", id, showText(data.expense_number), data.status, fields, role, data.requested_by === userId, !!data.paid_from_account_id, "expense", edit, accounts),
  };
}

async function loadLabour(sb: Sb, role: string | null, userId: string, id: string, prefix: PopupField[]): Promise<{ ok: true; data: PendingPopupData } | { ok: false; error: string }> {
  const { data, error } = await sb
    .from("labour_work_entries")
    .select("id, entry_number, work_date, work_detail, amount, quantity, rate, unit, received_by_name, status, rejection_reason, party_type, created_by")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: UNREAD };
  if (!data) return { ok: false, error: "Ye mazdoori nazar nahi aayi." };
  const fields: PopupField[] = [
    ...prefix,
    { key: "ref", value: showText(data.entry_number) },
    { key: "date", value: showText(data.work_date) },
    { key: "work", value: showText(data.work_detail) },
    { key: "party", value: showText(data.received_by_name || data.party_type) },
    { key: "qty", value: data.quantity != null ? `${data.quantity} ${data.unit ?? ""}`.trim() : "—" },
    { key: "amount", value: showRs(data.amount) },
    { key: "status", value: showText(data.status) },
  ];
  if (data.rejection_reason) fields.push({ key: "notes", value: showText(data.rejection_reason) });
  return {
    ok: true,
    data: pack("labour", id, "labour", id, showText(data.entry_number), data.status, fields, role, data.created_by === userId, false, null, null, []),
  };
}

async function loadSupplier(sb: Sb, role: string | null, id: string, prefix: PopupField[]): Promise<{ ok: true; data: PendingPopupData } | { ok: false; error: string }> {
  const { data, error } = await sb
    .from("supplier_payment_requests")
    .select("id, request_number, amount, payment_method, notes, status, rejection_reason, slip_url, finance_account_id, payment_date, requested_by, suppliers(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: UNREAD };
  if (!data) return { ok: false, error: "Ye supplier request nazar nahi aayi." };
  const accounts = await accountList(sb);
  const row = data as typeof data & { suppliers?: { name?: string } | { name?: string }[] | null };
  const sup = row.suppliers;
  const supplierName = Array.isArray(sup) ? sup[0]?.name : sup?.name;
  const fields: PopupField[] = [
    ...prefix,
    { key: "ref", value: showText(data.request_number) },
    { key: "party", value: showText(supplierName) },
    { key: "amount", value: showRs(data.amount) },
    { key: "method", value: showText(data.payment_method) },
    { key: "date", value: showText(data.payment_date) },
    { key: "account", value: accountName(accounts, data.finance_account_id) },
    { key: "notes", value: showText(data.notes) },
    { key: "status", value: showText(data.status) },
  ];
  if (data.rejection_reason) fields.push({ key: "detail", value: showText(data.rejection_reason) });
  if (data.slip_url) fields.push({ key: "slip", value: showText(data.slip_url) });
  const edit = {
    amount: String(data.amount ?? ""),
    payment_method: data.payment_method ?? "",
    notes: data.notes ?? "",
    finance_account_id: data.finance_account_id ?? "",
    payment_date: data.payment_date ?? "",
  };
  return {
    ok: true,
    data: pack(
      "supplier_payments",
      id,
      "supplier_payments",
      id,
      showText(data.request_number),
      data.status,
      fields,
      role,
      false,
      !!data.finance_account_id,
      "supplier",
      edit,
      accounts
    ),
  };
}

async function loadTxn(sb: Sb, role: string | null, id: string): Promise<{ ok: true; data: PendingPopupData } | { ok: false; error: string }> {
  const { data, error } = await sb
    .from("txn_whatsapp_alerts")
    .select("id, entry_number, entry_date, alert_type, amount, party_label, account_label, detail, status, source_module, last_error, attempts")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: UNREAD };
  if (!data) return { ok: false, error: "Ye alert nazar nahi aaya." };
  const fields: PopupField[] = [
    { key: "ref", value: showText(data.entry_number) },
    { key: "date", value: showText(data.entry_date) },
    { key: "alert", value: showText(data.alert_type) },
    { key: "module", value: showText(data.source_module) },
    { key: "amount", value: showRs(data.amount) },
    { key: "party", value: showText(data.party_label) },
    { key: "account", value: showText(data.account_label) },
    { key: "detail", value: showText(data.detail) },
    { key: "status", value: showText(data.status) },
    { key: "qty", value: data.attempts != null ? String(data.attempts) : "—" },
  ];
  if (data.last_error) fields.push({ key: "error", value: showText(data.last_error) });
  return {
    ok: true,
    data: pack("txn_alerts", id, "txn_alerts", id, showText(data.entry_number || data.alert_type), data.status, fields, role, false, false, null, null, []),
  };
}

async function loadHandoff(sb: Sb, userId: string, role: string | null, id: string): Promise<{ ok: true; data: PendingPopupData } | { ok: false; error: string }> {
  const { data, error } = await sb
    .from("work_handoffs")
    .select("id, title, message, to_route, record_label, record_table, record_id, status, to_roles")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: UNREAD };
  if (!data) return { ok: false, error: "Ye hawala nazar nahi aaya." };
  const prefix: PopupField[] = [
    { key: "title", value: showText(data.title) },
    { key: "message", value: showText(data.message) },
    { key: "record", value: showText(data.record_label) },
    { key: "route", value: showText(data.to_route) },
    { key: "hstatus", value: showText(data.status) },
  ];
  const linked = handoffActionCategory(data.record_table);
  if (linked && data.record_id && UUID.test(data.record_id)) {
    const inner =
      linked === "expenses"
        ? await loadExpense(sb, role, userId, data.record_id, prefix)
        : linked === "labour"
          ? await loadLabour(sb, role, userId, data.record_id, prefix)
          : await loadSupplier(sb, role, data.record_id, prefix);
    if (inner.ok) {
      const actionable = inner.data.caps.approve || inner.data.caps.reject || inner.data.caps.verify || inner.data.caps.edit;
      return {
        ok: true,
        data: {
          ...inner.data,
          openedCategory: "work_handoffs",
          openedId: id,
          headline: showText(data.title),
          hint: actionable ? "linked" : "handoff",
          caps: { ...inner.data.caps, hint: actionable ? "linked" : "handoff" },
        },
      };
    }
  }
  return {
    ok: true,
    data: pack("work_handoffs", id, "work_handoffs", id, showText(data.title), data.status, prefix, role, false, false, null, null, []),
  };
}

async function loadSummary(sb: Sb, role: string | null, category: string, id: string): Promise<{ ok: true; data: PendingPopupData } | { ok: false; error: string }> {
  const rpc = sb.rpc.bind(sb) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("fn_admin_pending_items", { p_limit: 200, p_category: category });
  if (error) return { ok: false, error: UNREAD };
  const row = ((data as PendingItem[] | null) ?? []).find((r) => r.item_id === id);
  if (!row) return { ok: false, error: "Ye ab pending nahi (ya aap ko nazar nahi aata)." };
  const fields: PopupField[] = [
    { key: "ref", value: showText(row.ref) },
    { key: "title", value: showText(row.title) },
    { key: "amount", value: row.amount != null && row.amount !== "" ? showRs(row.amount) : "—" },
    { key: "party", value: showText(row.entered_by_name) },
    { key: "with", value: showText(row.actor_name || row.pending_with) },
    { key: "route", value: showText(row.link || row.route) },
  ];
  return {
    ok: true,
    data: pack(category, id, category, id, showText(row.ref || row.title), null, fields, role, !!row.is_own, false, null, null, []),
  };
}

export async function loadPendingPopup(category: string, id: string): Promise<{ ok: true; data: PendingPopupData } | { ok: false; error: string }> {
  if (!category || !UUID.test(id)) return { ok: false, error: "Ghalat darkhwast." };
  const sb = createClient();
  const actor = await who(sb);
  if (!actor) return { ok: false, error: "Login zaroori hai." };
  if (category === "expenses") return loadExpense(sb, actor.role, actor.id, id, []);
  if (category === "labour") return loadLabour(sb, actor.role, actor.id, id, []);
  if (category === "supplier_payments") return loadSupplier(sb, actor.role, id, []);
  if (category === "txn_alerts") return loadTxn(sb, actor.role, id);
  if (category === "work_handoffs") return loadHandoff(sb, actor.id, actor.role, id);
  return loadSummary(sb, actor.role, category, id);
}

export async function commitPendingPopup(fd: FormData): Promise<PopupCommit> {
  const category = String(fd.get("category") ?? "");
  const id = String(fd.get("id") ?? "");
  const decision = String(fd.get("decision") ?? "");
  if (!UUID.test(id)) return fail("Ghalat darkhwast.");

  let result: PopupCommit = fail("Is qism ka faisla yahan se nahi hota.");

  if (category === "expenses") {
    const f = new FormData();
    f.set("id", id);
    if (decision === "verify") result = fromAction(await kharchaVerify({}, f), "stay");
    else if (decision === "approve") result = fromAction(await kharchaManzoor({}, f), "done", "approve");
    else if (decision === "reject") {
      f.set("rejection_reason", String(fd.get("note") ?? "").trim());
      result = fromAction(await kharchaRadd({}, f), "done", "reject");
    } else if (decision === "edit") {
      for (const key of ["description", "amount", "expense_date", "party_name", "category", "paid_from_account_id"]) {
        f.set(key, String(fd.get(key) ?? ""));
      }
      result = fromAction(await kharchaTheek({}, f), "stay");
    }
  } else if (category === "labour") {
    const sb = createClient();
    const actor = await who(sb);
    if (!actor) return fail("Login zaroori hai.");
    const { data: row } = await sb.from("labour_work_entries").select("created_by").eq("id", id).maybeSingle();
    if (!row) return fail("Ye mazdoori nazar nahi aayi.");
    const f = new FormData();
    f.set("id", id);
    if (decision === "approve" || decision === "reject") {
      if (!mayDecideEntry(actor.role, actor.id, [row.created_by])) {
        return fail("Apni entry — koi doosra approve karega.");
      }
      if (decision === "approve") {
        f.set("comment", String(fd.get("note") ?? "").trim());
        result = fromAction(await mazdooriManzoor({}, f), "done", "approve");
      } else {
        f.set("rejection_reason", String(fd.get("note") ?? "").trim());
        result = fromAction(await mazdooriRadd({}, f), "done", "reject");
      }
    }
  } else if (category === "supplier_payments") {
    const f = new FormData();
    f.set("request_id", id);
    if (decision === "approve") {
      const acc = String(fd.get("finance_account_id") ?? "").trim();
      if (acc) f.set("finance_account_id", acc);
      result = fromAction(await approveSupplierPayment({}, f), "done", "approve");
    } else if (decision === "reject") {
      f.set("rejection_reason", String(fd.get("note") ?? "").trim());
      result = fromAction(await rejectSupplierPayment({}, f), "done", "reject");
    } else if (decision === "edit") {
      for (const key of ["amount", "payment_method", "notes", "finance_account_id", "payment_date"]) {
        f.set(key, String(fd.get(key) ?? ""));
      }
      result = fromAction(await editSupplierPayment({}, f), "stay");
    }
  }

  if (result.ok) revalidatePath(P);
  return result;
}
