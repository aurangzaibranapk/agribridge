"use client";
import { TERMS } from "@/lib/recovery/credit-report";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  MessageCircle,
  Printer,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/form";
import { enqueue, allActions } from "@/lib/offline/queue";
import { registerSender, syncQueue } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";
import { defaultAgainstAccount, partyAccountProblem } from "@/lib/finance/recovery-party-accounts";
import { GlassStyles } from "@/components/glass/glass-styles";
import { PaymentLiveSummary } from "@/components/glass/payment-live-summary";
import { queueReceipt, ReceiptHost } from "@/components/glass/receipt-print";

export type RecoveryParty = {
  type: string;
  id: string;
  name: string;
  phone: string | null;
  cnic: string | null;
  email: string | null;
  outstanding: number;
  lastActivity: string | null;
  dueDate: string | null;
  overdueDays: number | null;
  status: "overdue" | "due_today" | "upcoming";
  lastReminder: string | null;
};

export type ReminderTemplate = {
  id: string;
  name: string;
  language: string;
  channel: string;
  body: string;
  stage: string;
};

export type CollectedPayment = {
  id: string;
  entryNumber: string;
  description: string;
  sourceModule: string;
  accountCode: string;
  amount: number;
  partyType: string | null;
  partyId: string | null;
  memo: string | null;
};

export type MoneyPartyOption = { type: string; id: string; name: string; phone: string | null };
export type FinanceAccountOption = { id: string; name: string; accountType: string; balance: number; glCode: string | null };
export type LedgerAccountOption = { code: string; name: string; accountType: string };
export type PaymentDestinationOption = {
  id: string; partyType: string; partyId: string | null; channelType: string;
  institutionName: string; accountTitle: string; accountNumber: string;
};

const PAYMENT_INSTITUTIONS = [
  ["easypaisa", "Easypaisa"], ["jazzcash", "JazzCash"], ["sadapay", "SadaPay"],
  ["nayapay", "NayaPay"], ["upaisa", "UPaisa"], ["other_wallet", "Other Wallet"],
  ["bank", "Allied Bank (ABL)"], ["bank", "Askari Bank"], ["bank", "Bank Alfalah"],
  ["bank", "Bank Al Habib"], ["bank", "Bank of Punjab (BOP)"], ["bank", "Faysal Bank"],
  ["bank", "Habib Bank (HBL)"], ["bank", "Habib Metropolitan Bank"], ["bank", "JS Bank"],
  ["bank", "MCB Bank"], ["bank", "Meezan Bank"], ["bank", "National Bank (NBP)"],
  ["bank", "Soneri Bank"], ["bank", "Standard Chartered"], ["bank", "UBL"],
  ["bank", "Other Bank"],
] as const;

const PAGE_SIZE = 8;

function rs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString("en-PK")}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Party ka apna raasta-nishan -- asal id se, taake har baar wahi bane. */
function khataRef(p: RecoveryParty): string {
  const stage = p.type === "farmer" ? "UD" : "KH";
  return `ART-${stage}-${p.id.replace(/-/g, "").slice(-5).toUpperCase()}`;
}

function statusBadge(p: RecoveryParty) {
  if (p.status === "overdue") return <Badge tone="red">Overdue</Badge>;
  if (p.status === "due_today") return <Badge tone="amber">Due Today</Badge>;
  return <Badge tone="blue">Upcoming</Badge>;
}

const STAGE_FOR_STATUS: Record<RecoveryParty["status"], string> = {
  overdue: "overdue",
  due_today: "friendly",
  upcoming: "friendly",
};

/**
 * {{placeholder}} ko asal qeemat se badalna -- template ka apna matn
 * kabhi nahi badalta, sirf preview mein bharta hai.
 */
function renderTemplate(body: string, party: RecoveryParty): string {
  return body
    .replace(/\{\{\s*party_name\s*\}\}/g, party.name)
    .replace(/\{\{\s*outstanding_amount\s*\}\}/g, Math.round(party.outstanding).toLocaleString("en-PK"))
    .replace(/\{\{\s*due_date\s*\}\}/g, party.dueDate ?? "as soon as possible");
}

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "sms", label: "SMS", icon: Smartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "download", label: "Print (PDF)", icon: Printer },
] as const;

export function RecoveryClient({
  parties,
  templates,
  totalReceivable,
  dueTodayAmount,
  dueTodayCount,
  overdueAmount,
  overdueCount,
  collectedToday,
  collectedTodayCount,
  collectedPayments,
  failedCount,
  moneyParties,
  financeAccounts,
  ledgerAccounts,
  paymentDestinations,
}: {
  parties: RecoveryParty[];
  templates: ReminderTemplate[];
  totalReceivable: number;
  dueTodayAmount: number;
  dueTodayCount: number;
  overdueAmount: number;
  overdueCount: number;
  collectedToday: number;
  collectedTodayCount: number;
  collectedPayments: CollectedPayment[];
  failedCount: number;
  moneyParties: MoneyPartyOption[];
  financeAccounts: FinanceAccountOption[];
  ledgerAccounts: LedgerAccountOption[];
  paymentDestinations: PaymentDestinationOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [offlinePending, setOfflinePending] = useState(0);

  useEffect(() => {
    registerSender("recovery.action", async (queued) => {
      try {
        const res = await fetch("/api/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(queued.payload) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, retryable: res.status >= 500, error: json.error || "Recovery request fail ho gayi." };
        return { ok: true };
      } catch (e) {
        return { ok: false, retryable: true, error: e instanceof Error ? e.message : "Network error" };
      }
    });
    const refresh = async () => {
      const rows = await allActions().catch(() => []);
      setOfflinePending(rows.filter((r) => r.action_type === "recovery.action" && (r.sync_status === "pending" || r.sync_status === "syncing")).length);
    };
    const restored = async () => { await syncQueue().catch(() => undefined); await refresh(); };
    void refresh();
    window.addEventListener("online", restored);
    return () => window.removeEventListener("online", restored);
  }, []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RecoveryParty["status"]>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState<"all" | RecoveryParty["status"]>("all");
  const [draftType, setDraftType] = useState<"all" | string>("all");
  const [draftDueFrom, setDraftDueFrom] = useState("");
  const [draftDueTo, setDraftDueTo] = useState("");
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<"schedule" | "promise" | "money" | null>(null);
  const [moneyDirection, setMoneyDirection] = useState<"receive" | "pay">("receive");
  const [busy, setBusy] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [moneyPartyKey, setMoneyPartyKey] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [institutionKey, setInstitutionKey] = useState("");
  const [notice, setNotice] = useState("");
  const [moneyError, setMoneyError] = useState("");
  const [moneyProgress, setMoneyProgress] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["key"]>("whatsapp");
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [summaryView, setSummaryView] = useState<"receivable" | "due_today" | "overdue" | "collected">("receivable");
  const recordsRef = useRef<HTMLDivElement>(null);
  const collectedRef = useRef<HTMLDivElement>(null);
  const pendingMoneyActionId = useRef<string | null>(null);

  function openReceivableSummary(nextStatus: "all" | "due_today" | "overdue") {
    setSummaryView(nextStatus === "all" ? "receivable" : nextStatus);
    setSearch("");
    setDraftSearch("");
    setStatusFilter(nextStatus);
    setDraftStatus(nextStatus);
    setTypeFilter("all");
    setDraftType("all");
    setDueFrom("");
    setDraftDueFrom("");
    setDueTo("");
    setDraftDueTo("");
    setPage(0);
    requestAnimationFrame(() => recordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function openCollectedSummary() {
    setSummaryView("collected");
    requestAnimationFrame(() => collectedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const key = (p: RecoveryParty) => `${p.type}:${p.id}`;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parties.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      // Due date na ho to andaza hi nahi -- aisi qatarein range se bahar
      // nahi ki jatin, warna "shuruat hi nahi hui" wale khate chhup jate.
      if (dueFrom && p.dueDate && p.dueDate < dueFrom) return false;
      if (dueTo && p.dueDate && p.dueDate > dueTo) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.phone ?? "").includes(q) && !(p.cnic ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [parties, search, statusFilter, typeFilter, dueFrom, dueTo]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const chosen = useMemo(() => parties.filter((p) => selected.has(key(p))), [parties, selected]);

  const previewParty = useMemo(() => {
    if (previewKey) {
      const found = parties.find((p) => key(p) === previewKey);
      if (found) return found;
    }
    return chosen[0] ?? filtered[0] ?? parties[0] ?? null;
  }, [previewKey, chosen, filtered, parties]);

  const previewTemplate = useMemo(() => {
    if (!previewParty) return null;
    const stage = STAGE_FOR_STATUS[previewParty.status];
    return (
      templates.find((t) => t.channel === channel && t.stage === stage) ??
      templates.find((t) => t.channel === channel) ??
      templates.find((t) => t.channel === "whatsapp") ??
      null
    );
  }, [previewParty, templates, channel]);

  useEffect(() => { pendingMoneyActionId.current = null; }, [moneyPartyKey, moneyDirection, mode]);
  const selectedMoneyParty = useMemo(
    () => moneyParties.find((p) => `${p.type}:${p.id}` === moneyPartyKey) ?? null,
    [moneyParties, moneyPartyKey]
  );
  const partyDestinations = useMemo(
    () => paymentDestinations.filter((d) => d.partyType === selectedMoneyParty?.type && d.partyId === selectedMoneyParty?.id),
    [paymentDestinations, selectedMoneyParty]
  );

  function openMoney(direction: "receive" | "pay") {
    setMoneyDirection(direction);
    setPayDate(new Date().toISOString().slice(0, 10));
    setMoneyPartyKey(previewParty ? `${previewParty.type}:${previewParty.id}` : "");
    setDestinationId("");
    setInstitutionKey("");
    setMoneyError("");
    setMoneyProgress("");
    setMode("money");
  }

  function toggle(p: RecoveryParty) {
    const k = key(p);
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    setPreviewKey(k);
  }

  async function submit(action: string, extra: Record<string, unknown> = {}) {
    const targets = chosen.length ? chosen : previewParty ? [previewParty] : [];
    if (!targets.length) {
      setNotice("Pehle account select karein.");
      return;
    }
    const payload = { action, parties: targets, channel: "whatsapp", ...extra };
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      try {
        await enqueue({ actionType: "recovery.action", entityType: "recovery", payload: payload as Record<string, unknown> });
        const rows = await allActions();
        setOfflinePending(rows.filter((r) => r.action_type === "recovery.action" && r.sync_status === "pending").length);
        setNotice("Internet nahi hai. Recovery request device par save ho gayi; internet aate hi bhej di jayegi.");
        setMode(null);
      } catch { setNotice("Offline request save nahi ho saki."); }
      return;
    }
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(json.error || "Kaam mukammal nahi hua.");
      return;
    }
    setNotice(`${json.count} account update ho gaye${json.sent !== undefined ? `; ${json.sent} WhatsApp sent` : ""}.`);
    setMode(null);
  }

  function statementHref(p: RecoveryParty) {
    if (p.type === "customer") return `/admin/crm/${p.id}/statement`;
    if (p.type === "farmer") return `/admin/farmers/${p.id}/statement`;
    if (p.type === "dealer") return `/admin/dealers/${p.id}/statement`;
    return `/admin/suppliers/${p.id}/statement`;
  }

  async function downloadStatement(p: RecoveryParty) {
    // Farmer aur Customer ka statement ab isi ek raaste se banta hai
    // (424) -- Malik: "dono ek hi cheez honi chahiye." Dealer/Supplier
    // abhi apne alag safhe par hain.
    if (p.type !== "customer" && p.type !== "farmer") {
      window.open(statementHref(p), "_blank");
      return;
    }
    const res = await fetch(`/api/customer-statements/${p.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "download", partyType: p.type }),
    });
    if (!res.ok) {
      setNotice("Statement nahi ban saka.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.name.replace(/[^a-z0-9]+/gi, "-")}-statement.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <ReceiptHost />
      {offlinePending > 0 && <div className="fixed bottom-4 left-4 z-30 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-lg">{offlinePending} recovery request sync ka intezar kar rahi hai</div>}
      <div className="flex min-h-0 flex-col gap-4">
        {/* ---- Stat cards ---- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button type="button" onClick={() => openReceivableSummary("all")} className={`flex w-full items-start gap-3 rounded-card border bg-emerald-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-emerald-950/20 ${summaryView === "receivable" ? "border-emerald-500 ring-1 ring-emerald-400" : "border-emerald-100 dark:border-emerald-900/40"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">Total Receivable</p>
              <p className="font-display text-xl font-semibold text-emerald-900 dark:text-emerald-100">{rs(totalReceivable)}</p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Across {parties.length} customers</p>
            </div>
          </button>
          <button type="button" onClick={() => openReceivableSummary("due_today")} className={`flex w-full items-start gap-3 rounded-card border bg-amber-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-amber-950/20 ${summaryView === "due_today" ? "border-amber-500 ring-1 ring-amber-400" : "border-amber-100 dark:border-amber-900/40"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-amber-800 dark:text-amber-300">Due Today</p>
              <p className="font-display text-xl font-semibold text-amber-900 dark:text-amber-100">{rs(dueTodayAmount)}</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                {dueTodayCount} customer{dueTodayCount === 1 ? "" : "s"}
              </p>
            </div>
          </button>
          <button type="button" onClick={() => openReceivableSummary("overdue")} className={`flex w-full items-start gap-3 rounded-card border bg-red-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-red-950/20 ${summaryView === "overdue" ? "border-red-500 ring-1 ring-red-400" : "border-red-100 dark:border-red-900/40"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-red-800 dark:text-red-300">Overdue</p>
              <p className="font-display text-xl font-semibold text-red-900 dark:text-red-100">{rs(overdueAmount)}</p>
              <p className="text-xs text-red-700/80 dark:text-red-400/80">
                {overdueCount} customer{overdueCount === 1 ? "" : "s"}
              </p>
            </div>
          </button>
          <button type="button" onClick={openCollectedSummary} className={`flex w-full items-start gap-3 rounded-card border bg-emerald-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-emerald-950/20 ${summaryView === "collected" ? "border-emerald-500 ring-1 ring-emerald-400" : "border-emerald-100 dark:border-emerald-900/40"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">Collected Today</p>
              <p className="font-display text-xl font-semibold text-emerald-900 dark:text-emerald-100">{rs(collectedToday)}</p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                {collectedTodayCount} payment{collectedTodayCount === 1 ? "" : "s"}
              </p>
            </div>
          </button>
        </div>

        {summaryView === "collected" && (
          <div ref={collectedRef} className="scroll-mt-20 rounded-card border border-emerald-200 bg-white shadow-card dark:border-emerald-900/50 dark:bg-surface-900">
            <div className="border-b border-surface-100 p-4 dark:border-surface-800">
              <h2 className="font-display text-sm font-semibold text-surface-900 dark:text-white">Collected Today — Payment Details</h2>
              <p className="mt-1 text-xs text-surface-500">Aaj receivable accounts 1100/1150 mein post hui tamam recovery entries.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800"><tr><th className="px-4 py-2">Entry</th><th className="px-4 py-2">Detail</th><th className="px-4 py-2">Party</th><th className="px-4 py-2">Source</th><th className="px-4 py-2 text-right">Received</th></tr></thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {collectedPayments.map((payment) => <tr key={payment.id}><td className="px-4 py-2 font-mono text-xs">{payment.entryNumber}</td><td className="px-4 py-2">{payment.memo || payment.description}</td><td className="px-4 py-2 capitalize">{payment.partyType ?? "—"}</td><td className="px-4 py-2"><span className="capitalize">{payment.sourceModule.replaceAll("_", " ")}</span><span className="ml-2 text-xs text-surface-400">{payment.accountCode}</span></td><td className="px-4 py-2 text-right font-semibold tabular-nums">{rs(payment.amount)}</td></tr>)}
                  {collectedPayments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">Aaj koi received payment post nahi hui.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div ref={recordsRef} className="scroll-mt-20 rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 p-4 dark:border-surface-800">
            <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-surface-900 dark:text-white">
              <Users className="h-4 w-4 text-surface-400" /> Outstanding Customers &amp; Farmers
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-surface-500">
              <RefreshCw className="h-3.5 w-3.5" /> {filtered.length} records
            </span>
          </div>

          {/* ---- Filters ---- */}
          <form onSubmit={(event) => { event.preventDefault(); setSearch(draftSearch); setStatusFilter(draftStatus); setTypeFilter(draftType); setDueFrom(draftDueFrom); setDueTo(draftDueTo); setPage(0); }} className="flex flex-wrap items-center gap-2 border-b border-surface-100 p-3 dark:border-surface-800">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <input
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Naam, mobile ya CNIC se dhoondein"
                className="w-full rounded-lg border border-surface-200 bg-transparent py-2 pl-8 pr-3 text-sm dark:border-surface-700"
              />
            </div>
            <select
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value as typeof draftStatus)}
              className="rounded-lg border border-surface-200 bg-transparent px-3 py-2 text-sm dark:border-surface-700"
            >
              <option value="all">All Status</option>
              <option value="overdue">Overdue</option>
              <option value="due_today">Due Today</option>
              <option value="upcoming">Upcoming</option>
            </select>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value)}
              className="rounded-lg border border-surface-200 bg-transparent px-3 py-2 text-sm capitalize dark:border-surface-700"
            >
              <option value="all">All Customers</option>
              <option value="customer">Customer</option>
              <option value="farmer">Farmer</option>
              <option value="dealer">Dealer</option>
              <option value="supplier">Supplier</option>
            </select>
            <div className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-surface-700">
              <CalendarClock className="h-4 w-4 text-surface-400" />
              <input
                type="date"
                value={draftDueFrom}
                onChange={(e) => setDraftDueFrom(e.target.value)}
                className="bg-transparent text-xs text-surface-600 dark:text-surface-300"
              />
              <span className="text-surface-400">–</span>
              <input
                type="date"
                value={draftDueTo}
                onChange={(e) => setDraftDueTo(e.target.value)}
                className="bg-transparent text-xs text-surface-600 dark:text-surface-300"
              />
            </div>
            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Apply</button>
          </form>

          {/* ---- Bulk action buttons ---- */}
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-100 p-3 dark:border-surface-800">
            <button
              disabled={busy}
              onClick={() => submit("send")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              <MessageCircle className="h-4 w-4" /> Send WhatsApp
            </button>
            <button
              disabled
              title="SMS gateway abhi set nahi"
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-surface-700"
            >
              <Smartphone className="h-4 w-4" /> Send SMS
            </button>
            <button
              disabled={!previewParty}
              onClick={() => previewParty && downloadStatement(previewParty)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-surface-700"
            >
              <Download className="h-4 w-4" /> Download Statement
            </button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-surface-700">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button
              disabled={busy || !previewParty || (previewParty.type !== "customer" && previewParty.type !== "farmer")}
              onClick={async () => {
                if (!previewParty) return;
                const res = await fetch(`/api/customer-statements/${previewParty.id}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ channel: "email", partyType: previewParty.type }),
                });
                const json = await res.json().catch(() => ({}));
                setNotice(res.ok ? "Statement email ho gaya." : json.error || "Email nahi ja saka.");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-surface-700"
            >
              <Mail className="h-4 w-4" /> Email
            </button>
            <button
              disabled={!chosen.length}
              onClick={() => setMode("schedule")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-surface-700"
            >
              <CalendarClock className="h-4 w-4" /> Schedule Reminder
            </button>
            <button
              disabled={!previewParty}
              onClick={() => openMoney("receive")}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
            >
              <Banknote className="h-4 w-4" /> Receive Payment
            </button>
            <button
              onClick={() => openMoney("pay")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              <Send className="h-4 w-4" /> Pay Money
            </button>
            <button
              disabled={!chosen.length}
              onClick={() => setMode("promise")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-surface-700"
            >
              <CheckCircle2 className="h-4 w-4" /> Promise to Pay
            </button>
          </div>
          {notice && <p className="border-b border-surface-100 px-3 py-2 text-xs text-surface-600 dark:border-surface-800">{notice}</p>}

          {/* ---- Table ---- */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-surface-50 text-left text-xs text-surface-500 dark:bg-surface-800/60">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={pageRows.length > 0 && pageRows.every((p) => selected.has(key(p)))}
                      onChange={(e) =>
                        setSelected((old) => {
                          const next = new Set(old);
                          for (const p of pageRows) (e.target.checked ? next.add(key(p)) : next.delete(key(p)));
                          return next;
                        })
                      }
                    />
                  </th>
                  <th className="px-3 py-3">Customer / Farmer</th>
                  <th className="px-3 py-3">Mobile</th>
                  <th className="px-3 py-3 text-right">Outstanding</th>
                  <th className="px-3 py-3">Due Date</th>
                  <th className="px-3 py-3">Overdue Days</th>
                  <th className="px-3 py-3">Last Reminder</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p) => (
                  <tr
                    key={key(p)}
                    onClick={() => setPreviewKey(key(p))}
                    className={`cursor-pointer border-t border-surface-100 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/40 ${
                      previewKey === key(p) ? "bg-brand-50/60 dark:bg-brand-950/20" : ""
                    }`}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(key(p))} onChange={() => toggle(p)} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          {initials(p.name)}
                        </span>
                        <div>
                          <p className="font-medium text-surface-800 dark:text-surface-200">{p.name}</p>
                          <p className="text-xs capitalize text-surface-400">{p.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-surface-500">{p.phone || "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold text-surface-800 dark:text-surface-200">{rs(p.outstanding)}</td>
                    <td className="px-3 py-3 text-surface-500">{p.dueDate ?? "—"}</td>
                    <td className={`px-3 py-3 font-medium ${p.overdueDays ? "text-red-600" : "text-surface-400"}`}>
                      {p.overdueDays ? `${p.overdueDays} Days` : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-surface-500">
                      {p.lastReminder ? new Date(p.lastReminder).toLocaleDateString("en-PK") : "—"}
                    </td>
                    <td className="px-3 py-3">{statusBadge(p)}</td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={statementHref(p)}
                        aria-label={`${p.name} ka khata aur ledger kholein`}
                        className="ml-auto inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
                      >
                        Details <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-surface-400">
                      Koi outstanding account nahi mila.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ---- Pagination ---- */}
          <div className="flex items-center justify-between border-t border-surface-100 p-3 text-xs text-surface-500 dark:border-surface-800">
            <span>
              Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min(filtered.length, page * PAGE_SIZE + PAGE_SIZE)} of {filtered.length} records
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-surface-200 p-1.5 disabled:opacity-30 dark:border-surface-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`h-7 w-7 rounded-lg text-xs font-medium ${
                    i === page ? "bg-surface-900 text-white dark:bg-white dark:text-surface-900" : "border border-surface-200 dark:border-surface-700"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="rounded-lg border border-surface-200 p-1.5 disabled:opacity-30 dark:border-surface-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Right: Payment Reminder Preview ---- */}
      <div className="h-fit rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900 xl:sticky xl:top-4">
        <h3 className="mb-3 flex items-center gap-1.5 font-display text-sm font-semibold text-surface-900 dark:text-white">
          <Send className="h-4 w-4 text-surface-400" /> Payment Reminder Preview
        </h3>
        <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-surface-100 p-1 text-xs dark:bg-surface-800">
          {CHANNELS.map((c) => (
            <button
              key={c.key}
              onClick={() => setChannel(c.key)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 font-medium ${
                channel === c.key ? "bg-white text-brand-700 shadow-sm dark:bg-surface-900 dark:text-brand-300" : "text-surface-500"
              }`}
            >
              <c.icon className="h-3.5 w-3.5" /> {c.label}
            </button>
          ))}
        </div>

        {previewParty ? (
          <div className="rounded-lg border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-800/40">
            <div className="mb-3 flex items-center gap-2 border-b border-surface-200 pb-3 dark:border-surface-700">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">AR</span>
              <div>
                <p className="text-sm font-semibold text-surface-900 dark:text-white">AL RANA TRADERS</p>
                <p className="text-[11px] text-surface-500">Quality Inputs | Stronger Yields</p>
              </div>
            </div>
            <dl className="mb-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-surface-500">Customer:</dt>
                <dd className="font-medium text-surface-800 dark:text-surface-200">{previewParty.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Outstanding:</dt>
                <dd className="font-medium text-surface-800 dark:text-surface-200">{rs(previewParty.outstanding)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Due Date:</dt>
                <dd className="font-medium text-surface-800 dark:text-surface-200">{previewParty.dueDate ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-500">Khata Ref:</dt>
                <dd className="font-medium text-surface-800 dark:text-surface-200">{khataRef(previewParty)}</dd>
              </div>
            </dl>
            <p className="whitespace-pre-wrap border-t border-surface-200 pt-3 text-xs leading-relaxed text-surface-700 dark:border-surface-700 dark:text-surface-300">
              {previewTemplate ? renderTemplate(previewTemplate.body, previewParty) : "Is channel/stage ke liye koi template nahi bana — Templates safhe se banayein."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-surface-400">Koi account chunein.</p>
        )}

        <button
          disabled={busy || !previewParty || channel !== "whatsapp"}
          onClick={() => previewParty && submit("send")}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          <MessageCircle className="h-4 w-4" /> Send via WhatsApp
        </button>
        <button
          onClick={() => {
            const idx = CHANNELS.findIndex((c) => c.key === channel);
            setChannel(CHANNELS[(idx + 1) % CHANNELS.length].key);
          }}
          className="mt-2 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
        >
          Preview Other Channels
        </button>
      </div>

      {mode === "money" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setNotice("");
              setMoneyError("");
              setMoneyProgress("Payment tayyar ho rahi hai...");
              try {
                const party = selectedMoneyParty;
                f.set("direction", moneyDirection);
                // Har naye submit ki apni id; sirf timeout/server-error ke baad wahi form dobara bhejne par purani id (duplicate nahi banti).
                const actionId = pendingMoneyActionId.current ?? crypto.randomUUID();
                pendingMoneyActionId.current = actionId;
                f.set("clientActionId", actionId);
                f.set("partyType", party?.type ?? "other");
                f.set("partyId", party?.id ?? "");
                f.set("partyName", party?.name ?? String(f.get("otherPartyName") ?? ""));
                const accountProblem = partyAccountProblem(party?.type ?? "other", party?.id ?? "", String(f.get("againstAccountCode") ?? ""));
                if (accountProblem) { pendingMoneyActionId.current = null; throw new Error(accountProblem); }

                // Large proof files can hit the cPanel proxy body limit. Upload the
                // proof directly, then send only its URL with the accounting entry.
                const proof = f.get("proof");
                if (proof instanceof File && proof.size > 0) {
                  if (proof.size > 8 * 1024 * 1024) throw new Error("Proof file 8 MB se chhoti honi chahiye.");
                  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(proof.type)) {
                    throw new Error("Proof JPG, PNG, WebP ya PDF hona chahiye.");
                  }
                  setMoneyProgress("Screenshot / receipt upload ho rahi hai...");
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) throw new Error("Session khatam ho gayi. Dobara login karein.");
                  const safeName = proof.name.replace(/[^a-zA-Z0-9.-]/g, "_");
                  const path = `recovery/${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
                  const { error: uploadError } = await supabase.storage
                    .from("payment-slips")
                    .upload(path, proof, { contentType: proof.type, upsert: false });
                  if (uploadError) throw new Error(`Proof upload nahi hua: ${uploadError.message}`);
                  const proofUrl = supabase.storage.from("payment-slips").getPublicUrl(path).data.publicUrl;
                  f.delete("proof");
                  f.set("proofUrl", proofUrl);
                } else {
                  f.delete("proof");
                }

                setMoneyProgress("Ledger aur khata mein entry post ho rahi hai...");
                const controller = new AbortController();
                const timer = window.setTimeout(() => controller.abort(), 45000);
                let res: Response;
                try {
                  res = await fetch("/api/recovery/money", { method: "POST", body: f, signal: controller.signal });
                } finally {
                  window.clearTimeout(timer);
                }
                const raw = await res.text();
                let json: Record<string, any> = {};
                try { json = raw ? JSON.parse(raw) : {}; } catch { /* cPanel may return an HTML error page */ }
                if (!res.ok) {
                  // 4xx = server ne wajah batayi (form theek karke naya submit = nayi id); 5xx = wahi id dobara.
                  if (res.status < 500) pendingMoneyActionId.current = null;
                  throw new Error(json.error || `Payment save nahi hui (server ${res.status}).`);
                }
                pendingMoneyActionId.current = null;
                setNotice(`${moneyDirection === "receive" ? "Payment receive" : "Payment send"} ho gayi. Entry: ${json.entryNumber ?? json.movementNumber ?? "saved"}`);
                setMode(null);
                queueReceipt({ kind: "payment", no: String(json.entryNumber ?? json.movementNumber ?? "—"), date: String(f.get("paymentDate") ?? ""),
                  from: moneyDirection === "pay" ? financeAccounts.find((a) => a.id === f.get("financeAccountId"))?.name : String(f.get("partyName") ?? ""),
                  to: moneyDirection === "pay" ? String(f.get("partyName") ?? "") : financeAccounts.find((a) => a.id === f.get("financeAccountId"))?.name,
                  amount: Number(f.get("amount") ?? 0), lines: [["Mad", String(f.get("againstAccountCode") ?? "")], ["Purpose", String(f.get("purpose") ?? "")]] });
                window.location.reload();
              } catch (error) {
                const message = error instanceof DOMException && error.name === "AbortError"
                  ? "Server ne 45 seconds mein jawab nahi diya. Dobara try karein; duplicate entry nahi banegi."
                  : error instanceof Error ? error.message : "Payment darj nahi ho saki.";
                setMoneyError(message);
              } finally {
                setBusy(false);
                setMoneyProgress("");
              }
            }}
            className="gl-panel gl-bg max-h-[92vh] w-full max-w-3xl space-y-3 overflow-y-auto rounded-card bg-white/80 p-5 shadow-xl dark:bg-surface-900/80"
          >
            <div className="flex items-center justify-between">
              <div><h2 className="text-lg font-semibold">{moneyDirection === "receive" ? "Payment Receive Karein" : "Payment Send Karein"}</h2><p className="text-xs text-surface-500">Receive = Credit · Pay = Debit · Balance har entry ke baad</p></div>
              <button type="button" onClick={() => setMode(null)}>
                <X className="h-5 w-5 text-surface-400 hover:text-surface-700" />
              </button>
            </div>
            <GlassStyles />
            <p className="flex items-center gap-2 text-sm font-bold"><span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/15 text-xs text-emerald-700 dark:text-emerald-300">1</span>Kis ko aur kitna <span className="text-[10.5px] font-medium uppercase text-surface-400">Party · amount · date</span></p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">Kis party ka khata?<select required value={moneyPartyKey} onChange={(e) => { setMoneyPartyKey(e.target.value); setDestinationId(""); }} className="mt-1 w-full rounded-lg border border-surface-200 bg-white p-2 text-sm dark:border-surface-700 dark:bg-surface-800"><option value="">— list se chunein —</option>{moneyParties.map((p) => <option key={`${p.type}:${p.id}`} value={`${p.type}:${p.id}`}>{p.name} — {p.type}{p.phone ? ` (${p.phone})` : ""}</option>)}<option value="other:">Other / list mein nahi</option></select></label>
              {moneyPartyKey === "other:" && <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">Party ka naam<input required name="otherPartyName" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800" /></label>}
            </div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
              Raqam (Rs)
              <input
                required name="amount" type="number" min="1" step="1"
                defaultValue={moneyDirection === "receive" && previewParty ? Math.round(previewParty.outstanding) : undefined}
                className="mt-1 w-full rounded-lg border border-surface-200 bg-white p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
              />
            </label>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
              Tarikh
              <input
                required name="paymentDate" type="date"
                value={payDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPayDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-200 bg-white p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
              />
            </label>
            {payDate < new Date().toISOString().slice(0, 10) && (
              <label className="block text-sm font-medium text-amber-700 dark:text-amber-400">
                Purani date — wajah likhein
                <input
                  required name="backdateReason" type="text"
                  placeholder="Misaal: Kal ka paisa aaj darj kar raha hoon"
                  className="mt-1 w-full rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm dark:border-amber-700 dark:bg-amber-950/20"
                />
              </label>
            )}
            <p className="flex items-center gap-2 pt-1 text-sm font-bold"><span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/15 text-xs text-emerald-700 dark:text-emerald-300">2</span>Kahan se aur kis khate mein <span className="text-[10.5px] font-medium uppercase text-surface-400">Source · ledger</span></p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                {moneyDirection === "receive" ? "Paisa kis account mein aaya?" : "Paisa kis account se gaya?"}
                <select required name="financeAccountId" className="mt-1 w-full rounded-lg border border-surface-200 bg-white p-2 text-sm dark:border-surface-700 dark:bg-surface-800">
                  <option value="">— account chunein —</option>
                  {financeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {rs(a.balance)}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                Khate ki mad
                <select required name="againstAccountCode" key={`${moneyDirection}:${selectedMoneyParty?.type ?? "other"}:${selectedMoneyParty?.id ?? ""}`} defaultValue={defaultAgainstAccount(selectedMoneyParty?.type, moneyDirection)} className="mt-1 w-full rounded-lg border border-surface-200 bg-white p-2 text-sm dark:border-surface-700 dark:bg-surface-800">
                  <option value="">— ledger account —</option>
                  {ledgerAccounts.filter((a) => moneyDirection === "receive" ? a.accountType === "asset" : ["asset", "liability", "expense"].includes(a.accountType)).map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">Kis mad / purpose?<input required name="purpose" placeholder="Bill, khaad, mazdoori, machinery..." className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800" /></label>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">Bill / reference (ikhtiyari)<input name="billReference" placeholder="Bill no. ya reference" className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800" /></label>
            </div>
            <p className="flex items-center gap-2 pt-1 text-sm font-bold"><span className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-500/15 text-xs text-emerald-700 dark:text-emerald-300">3</span>Account aur saboot <span className="text-[10.5px] font-medium uppercase text-surface-400">Recipient · proof · notes</span></p>
            {moneyDirection === "pay" && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                <p className="text-sm font-semibold">Paisa kis bank / wallet account mein gaya?</p>
                {partyDestinations.length > 0 && (
                  <label className="block text-sm font-medium">Saved recipient account
                    <select name="destinationId" value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm dark:border-amber-800 dark:bg-surface-900">
                      <option value="">— Naya account add karein —</option>
                      {partyDestinations.map((d) => <option key={d.id} value={d.id}>{d.institutionName} — {d.accountTitle} — {d.accountNumber}</option>)}
                    </select>
                  </label>
                )}
                {!destinationId && <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium">Bank / wallet
                    <select required name="institutionKey" value={institutionKey} onChange={(e) => setInstitutionKey(e.target.value)} className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm dark:border-amber-800 dark:bg-surface-900">
                      <option value="">— bank ya wallet chunein —</option>
                      {PAYMENT_INSTITUTIONS.map(([type, name]) => <option key={`${type}:${name}`} value={`${type}|${name}`}>{name}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium">Account title / naam<input required name="beneficiaryName" placeholder="Jis naam par account hai" className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm dark:border-amber-800 dark:bg-surface-900" /></label>
                  <label className="block text-sm font-medium sm:col-span-2">IBAN / account number / mobile<input required name="beneficiaryAccount" placeholder="PK... ya account/mobile number" className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm dark:border-amber-800 dark:bg-surface-900" /></label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2"><input name="saveDestination" type="checkbox" defaultChecked /> Agli payment ke liye ye account save karein</label>
                </div>}
                <p className="text-xs text-amber-800 dark:text-amber-300">Source upar hamara account hai; yahan recipient ka account record hoga.</p>
              </div>
            )}
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">Screenshot / receipt proof<input name="proof" type="file" accept="image/*,.pdf" className="mt-1 block w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700" /></label>
            {moneyError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{moneyError}</p>}
            {busy && moneyProgress && <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-300">{moneyProgress}</p>}
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
              Notes (ikhtiyari)
              <input
                name="notes" type="text"
                placeholder="Misaal: Pehli qist"
                className="mt-1 w-full rounded-lg border border-surface-200 bg-white p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
              />
            </label>
            <PaymentLiveSummary direction={moneyDirection === "receive" ? "receive" : "pay"} accounts={financeAccounts} />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setMode(null)} className="flex-1 rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700">
                Wapas
              </button>
              <button disabled={busy} className="flex-1 rounded-lg bg-brand-600 p-2 text-sm font-medium text-white disabled:opacity-50">
                {busy ? "Darj ho raha hai..." : moneyDirection === "receive" ? "Receive Post Karein" : "Payment Post Karein"}
              </button>
            </div>
          </form>
        </div>
      )}

      {(mode === "schedule" || mode === "promise") && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              submit(mode, {
                dueDate: f.get("dueDate"),
                scheduledAt: f.get("scheduledAt"),
                promiseDate: f.get("promiseDate"),
                amount: f.get("amount"),
                notes: f.get("notes"),
                termsAccepted: f.get("termsAccepted") === "on",
              });
            }}
            className="w-full max-w-md space-y-3 rounded-card bg-white p-5 shadow-xl dark:bg-surface-900"
          >
            <h2 className="text-lg font-semibold">{mode === "schedule" ? "Schedule Reminder" : "Promise to Pay"}</h2>
            {mode === "schedule" ? (
              <>
                <label className="block text-sm">
                  Due date
                  <input name="dueDate" type="date" className="mt-1 w-full rounded-lg border p-2" />
                </label>
                <label className="block text-sm">
                  Send date &amp; time
                  <input required name="scheduledAt" type="datetime-local" className="mt-1 w-full rounded-lg border p-2" />
                </label>
              </>
            ) : (
              <>
                <div className="text-sm">
                  Kitne din mein dega?
                  <div className="mt-1 flex flex-wrap gap-2">
                    {[3, 7, 15, 30].map((d) => (
                      <button key={d} type="button" className="rounded-lg border px-3 py-1.5 text-xs hover:bg-orange-50"
                        onClick={(e) => { const input = e.currentTarget.form?.elements.namedItem("promiseDate") as HTMLInputElement | null; if (input) { const t = new Date(Date.now() + 5 * 3600_000); t.setUTCDate(t.getUTCDate() + d); input.value = t.toISOString().slice(0, 10); } }}>
                        {d} din
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-sm">
                  Promise date
                  <input required name="promiseDate" type="date" className="mt-1 w-full rounded-lg border p-2" />
                </label>
                <label className="block text-sm">
                  Promised amount (ikhtiyari)
                  <input name="amount" type="number" min="1" placeholder="Khali = poora late baqaya" className="mt-1 w-full rounded-lg border p-2" />
                </label>
                <textarea name="notes" placeholder="Notes" className="w-full rounded-lg border p-2" />
                <div className="rounded-lg border bg-surface-50 p-2 text-xs leading-5 dark:bg-surface-800">
                  <b>Sharaait</b>
                  <ol className="ml-4 list-decimal">{TERMS.map((t) => <li key={t}>{t}</li>)}</ol>
                </div>
                <label className="flex items-start gap-2 text-sm"><input required type="checkbox" name="termsAccepted" className="mt-1" /> Customer ne sharaait zubani maan li hain (staff ne parh kar sunayi).</label>
              </>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode(null)} className="flex-1 rounded-lg border p-2">
                Cancel
              </button>
              <button disabled={busy} className="flex-1 rounded-lg bg-emerald-600 p-2 text-white">
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
