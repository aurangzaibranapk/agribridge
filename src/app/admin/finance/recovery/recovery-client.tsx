"use client";
import { useMemo, useState } from "react";
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
  MoreVertical,
  Printer,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/form";

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
  failedCount,
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
  failedCount: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RecoveryParty["status"]>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<"schedule" | "promise" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["key"]>("whatsapp");
  const [previewKey, setPreviewKey] = useState<string | null>(null);

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
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, parties: targets, channel: "whatsapp", ...extra }),
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
      <div className="flex min-h-0 flex-col gap-4">
        {/* ---- Stat cards ---- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3 rounded-card border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">Total Receivable</p>
              <p className="font-display text-xl font-semibold text-emerald-900 dark:text-emerald-100">{rs(totalReceivable)}</p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Across {parties.length} customers</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-card border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
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
          </div>
          <div className="flex items-start gap-3 rounded-card border border-red-100 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
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
          </div>
          <div className="flex items-start gap-3 rounded-card border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
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
          </div>
        </div>

        <div className="rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 p-4 dark:border-surface-800">
            <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold text-surface-900 dark:text-white">
              <Users className="h-4 w-4 text-surface-400" /> Outstanding Customers &amp; Farmers
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-surface-500">
              <RefreshCw className="h-3.5 w-3.5" /> {filtered.length} records
            </span>
          </div>

          {/* ---- Filters ---- */}
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-100 p-3 dark:border-surface-800">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Naam, mobile ya CNIC se dhoondein"
                className="w-full rounded-lg border border-surface-200 bg-transparent py-2 pl-8 pr-3 text-sm dark:border-surface-700"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as typeof statusFilter);
                setPage(0);
              }}
              className="rounded-lg border border-surface-200 bg-transparent px-3 py-2 text-sm dark:border-surface-700"
            >
              <option value="all">All Status</option>
              <option value="overdue">Overdue</option>
              <option value="due_today">Due Today</option>
              <option value="upcoming">Upcoming</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(0);
              }}
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
                value={dueFrom}
                onChange={(e) => {
                  setDueFrom(e.target.value);
                  setPage(0);
                }}
                className="bg-transparent text-xs text-surface-600 dark:text-surface-300"
              />
              <span className="text-surface-400">–</span>
              <input
                type="date"
                value={dueTo}
                onChange={(e) => {
                  setDueTo(e.target.value);
                  setPage(0);
                }}
                className="bg-transparent text-xs text-surface-600 dark:text-surface-300"
              />
            </div>
          </div>

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
            <Link
              href={previewParty ? statementHref(previewParty) : "#"}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Banknote className="h-4 w-4" /> Receive Payment
            </Link>
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
                      <Link href={statementHref(p)} className="text-surface-400 hover:text-brand-600">
                        <MoreVertical className="ml-auto h-4 w-4" />
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

      {mode && (
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
                <label className="block text-sm">
                  Promised amount
                  <input required name="amount" type="number" min="1" className="mt-1 w-full rounded-lg border p-2" />
                </label>
                <label className="block text-sm">
                  Promise date
                  <input required name="promiseDate" type="date" className="mt-1 w-full rounded-lg border p-2" />
                </label>
                <textarea name="notes" placeholder="Notes" className="w-full rounded-lg border p-2" />
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
