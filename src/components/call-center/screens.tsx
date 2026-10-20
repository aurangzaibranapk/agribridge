"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { Lock, Phone, Search } from "lucide-react";
import { createCallCenterAgent, createComplaint, setComplaintStatus, type CcState } from "@/actions/call-center";
import { sendTestSms, type SmsTestState } from "@/actions/sms-test";
import type { AgentsData, BoardData, ConsoleData, PartyData } from "@/lib/call-center/model";
import {
  CATEGORIES, CATEGORY_LABEL, CATEGORY_ROUTE, DEPT_LABEL, ageLabel, mayResolve, routeFor, slaTone,
  type ComplaintCategory,
} from "@/lib/call-center/rules";

const card = "rounded-[22px] border border-white/80 bg-white shadow-[0_18px_50px_-28px_rgba(16,36,72,0.45)]";

function money(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-PK");
}
function pretty(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function Tri({ a, b, c }: { a: string; b: string; c: string }) {
  return <span>{a} <span className="text-[#90a0b4]">/ {b} / </span><span dir="rtl">{c}</span></span>;
}

export function ConsoleScreen({ data, variant }: { data: ConsoleData; variant: "live" | "preview" }) {
  const action = variant === "preview" ? "/call-center-preview/console" : "/admin/call-center";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-[#1a3f86] px-5 py-4 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-5 w-5 text-white/80" />
          <div>
            <div className="text-[12px] text-white/70">Coming soon — auto-popup</div>
            <div className="text-[18px] font-semibold">Call aa rahi hai… 0300-*****12</div>
            <div className="text-[12px] text-white/70">Jab RoboConnect/voipcom API judega, caller ki screen khud khulegi · کال آ رہی ہے</div>
          </div>
        </div>
        <button type="button" disabled className="rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-[#1a3f86] opacity-80">Placeholder</button>
      </div>

      {data.notice && <p className={`${card} px-5 py-4 text-sm text-[#8a5a12]`}>{data.notice}</p>}

      <section className={`${card} p-5`}>
        <div className="mb-2 text-[13px] text-[#607089]"><Tri a="Search caller" b="Caller talaash" c="کالر تلاش" /></div>
        <form action={action} method="get" className="flex gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-2xl border border-[#e4eaf2] bg-[#fbfcfe] px-4">
            <Search className="h-4 w-4 text-[#90a0b4]" />
            <input
              name="q"
              defaultValue={data.query}
              placeholder="0322-1234576 · ya naam · ya ID (FRM-000045 / CUS-000210)"
              className="h-12 w-full bg-transparent text-[15px] outline-none"
            />
          </label>
          <button className="rounded-2xl bg-[#101a4a] px-6 text-[15px] font-semibold text-white">Dhoondein</button>
        </form>
        {data.results && (
          <ul className="mt-3 divide-y divide-[#eef2f7]">
            {data.results.length === 0 && <li className="py-3 text-sm text-[#7b8798]">Koi caller nahi mila.</li>}
            {data.results.map((h) => (
              <li key={`${h.kind}-${h.id}`}>
                <Link href={`/admin/call-center/party/${h.kind}/${h.id}`} className="flex items-center justify-between py-2 text-sm hover:text-[#1a3f86]">
                  <span className="font-semibold">{h.name}</span>
                  <span className="text-[#7b8798]">{h.code} · {h.phoneMasked}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className="px-5 pt-4 text-[13px] text-[#607089]"><Tri a="Recent lookups" b="Haal hi mein dekhe gaye" c="حال ہی میں دیکھے" /></div>
        <table className="mt-2 w-full text-left text-[13px]">
          <thead className="text-[#90a0b4]">
            <tr>
              {["Time", "Name", "Type", "Village", "Mobile"].map((h) => (
                <th key={h} className="px-5 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.recent.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-[#90a0b4]">Abhi koi lookup nahi.</td></tr>
            )}
            {data.recent.map((r) => (
              <tr key={`${r.at}-${r.name}`} className="border-t border-[#f0f3f8]">
                <td className="px-5 py-3 text-[#607089]">{r.at}</td>
                <td className="px-5 py-3 font-semibold"><Link href={r.href}>{r.name}</Link></td>
                <td className="px-5 py-3">{r.kindLabel}</td>
                <td className="px-5 py-3">{r.place ?? "—"}</td>
                <td className="px-5 py-3 tabular-nums">{r.phoneMasked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <Stat k="Aaj ki calls" n={data.callsToday} />
        <Stat k="Aaj ki complaints" n={data.complaintsToday} />
        <Stat k="Khuli complaints" n={data.openComplaints} />
      </section>
    </div>
  );
}

function Stat({ k, n }: { k: string; n: number | null }) {
  return (
    <div className={`${card} px-5 py-4`}>
      <div className="text-[13px] text-[#607089]">{k}</div>
      <div className="font-display text-[40px] font-bold leading-none">{n == null ? "—" : n}</div>
    </div>
  );
}

export function PartyScreen({
  data,
  variant,
  modalOpen = false,
}: {
  data: PartyData;
  variant: "live" | "preview";
  modalOpen?: boolean;
}) {
  const [open, setOpen] = useState(modalOpen);
  const initials = data.name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "—";
  return (
    <div className="relative">
      {data.notice && <p className={`${card} mb-4 px-5 py-4 text-sm text-[#8a5a12]`}>{data.notice}</p>}
      {!data.found && !data.notice && <p className="text-[#7b8798]">Caller nahi mila.</p>}
      {data.found && (
        <div className="grid grid-cols-[320px_1fr] gap-4">
          <section className={`${card} p-5`}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8eeff] font-semibold text-[#1a3f86]">{initials}</div>
              <div>
                <div className="font-display text-lg font-bold">{data.name}</div>
                <div className="text-[13px] text-[#607089]">
                  {data.place ?? "—"} · <span className="rounded-full bg-[#e7f8ee] px-2 py-0.5 text-[12px] font-semibold text-[#1d8a4e]">{data.typeLabel}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-[13px] text-[#607089]">
              <div className="tabular-nums">{data.phoneMasked}</div>
              <div>ID: {data.code}</div>
            </div>
            <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#16306b] to-[#0d1b3d] px-4 py-4 text-white">
              <div className="text-[12px] text-white/70"><Tri a="Balance" b="Baqaya" c="بقایا" /></div>
              <div className="mt-1 font-display text-[32px] font-bold leading-none">
                {data.tracked && data.balance != null ? `Rs ${money(data.balance)}` : "—"}
              </div>
              <div className="mt-1 text-[12px] text-white/70">
                {data.tracked
                  ? data.balanceSide === "Cr" ? "Payable to kisan (Cr)" : "Unhon ne dena (Dr)"
                  : "Hisaab nahi rakha gaya"}
              </div>
            </div>
            <div className="mt-4 text-[13px]">
              <div className="mb-1 text-[#607089]"><Tri a="Milk" b="Doodh" c="دودھ" /></div>
              <Row k="Aaj ke litre" v={data.milk.tracked ? (data.milk.todayLiters == null ? "—" : `${data.milk.todayLiters} L`) : "Track nahi"} />
              <Row k="Rate" v={data.milk.rate == null ? "—" : `Rs ${money(data.milk.rate)}/L`} />
              <Row k="Agli payment" v={data.milk.nextPayment ?? "Tareekh set nahi"} />
            </div>
            <button type="button" onClick={() => setOpen(true)} className="mt-4 w-full rounded-2xl bg-[#101a4a] py-3 text-[15px] font-semibold text-white">
              + Nayi Complaint
            </button>
          </section>

          <div className="space-y-4">
            <section className={`${card} overflow-hidden`}>
              <div className="px-5 pt-4 text-[13px] text-[#607089]"><Tri a="Last 5 entries" b="Aakhri 5 entries" c="آخری اندراجات" /></div>
              <table className="mt-1 w-full text-[13px]">
                <thead className="text-[#90a0b4]">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium">Date</th>
                    <th className="px-5 py-2 text-left font-medium">Detail</th>
                    <th className="w-[18%] px-5 py-2 text-right font-medium">Debit / Naam</th>
                    <th className="w-[18%] px-5 py-2 text-right font-medium">Credit / Jama</th>
                    <th className="w-[20%] px-5 py-2 text-right font-medium">Balance / Baqaya</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-6 text-[#90a0b4]">{data.tracked ? "Koi qatar nahi." : "Khata track nahi hoti — Rs 0 nahi likha."}</td></tr>
                  )}
                  {data.lines.map((l) => (
                    <tr key={`${l.date}-${l.detail}`} className="border-t border-[#f0f3f8]">
                      <td className="px-5 py-3 text-[#607089]">{pretty(l.date)}</td>
                      <td className="px-5 py-3">{l.detail}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-[#d64545]">{l.debit == null ? "—" : money(l.debit)}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-[#1d8a4e]">{l.credit == null ? "—" : money(l.credit)}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{l.balance == null ? "—" : `${money(l.balance)} ${l.side}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <div className="grid grid-cols-2 gap-4">
              <section className={`${card} p-5`}>
                <div className="mb-3 text-[13px] text-[#607089]"><Tri a="Today's rates" b="Aaj ke rate" c="آج کے ریٹ" /></div>
                {data.rates.length === 0 && <p className="text-sm text-[#90a0b4]">Aaj ki khaad/beej rate list khali hai — track nahi ho rahi.</p>}
                <ul className="space-y-2 text-[14px]">
                  {data.rates.map((r) => (
                    <li key={r.name} className="flex justify-between border-b border-[#f3f6fb] py-1">
                      <span>{r.name}</span><span className="tabular-nums font-semibold">{money(r.rate)}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={`${card} p-5`}>
                <div className="mb-3 text-[13px] text-[#607089]"><Tri a="Previous complaints" b="Pichli shikayat" c="پچھلی شکایات" /></div>
                <ul className="space-y-2 text-[14px]">
                  {data.complaints.length === 0 && <li className="text-[#90a0b4]">Koi shikayat nahi.</li>}
                  {data.complaints.map((c) => (
                    <li key={c.number} className="flex items-center justify-between gap-2">
                      <span className="text-[#607089]">{c.number}</span>
                      <span className="flex-1">{CATEGORY_LABEL[c.category]?.en ?? c.category}</span>
                      <StatusPill status={c.status} />
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-center gap-1 text-[12px] text-[#90a0b4]"><Lock className="h-3.5 w-3.5" /> Edit / payment buttons nahi hain — sirf dekhna</p>
              </section>
            </div>
          </div>
        </div>
      )}
      {open && data.found && (
        <ComplaintModal data={data} variant={variant} onClose={() => setOpen(false)} saved={modalOpen && data.example ? "CMP-000123" : undefined} />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b border-[#f3f6fb] py-1.5"><span className="text-[#607089]">{k}</span><span className="font-medium">{v}</span></div>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-[#fde8e8] text-[#c03636]",
    in_progress: "bg-[#fff4d6] text-[#9a6b00]",
    resolved: "bg-[#e5f8ee] text-[#1d8a4e]",
  };
  const label = status === "in_progress" ? "In progress" : status === "resolved" ? "Resolved" : "Open";
  return <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${map[status] ?? ""}`}>{label}</span>;
}

function ComplaintModal({ data, variant, onClose, saved }: { data: PartyData; variant: "live" | "preview"; onClose: () => void; saved?: string }) {
  const [category, setCategory] = useState<ComplaintCategory>("khata_ghalat");
  const [state, action] = useFormState(createComplaint, {} as CcState);
  const route = routeFor(category) ?? CATEGORY_ROUTE.khata_ghalat;
  const number = state.number ?? saved;
  return (
    <div className="fixed bottom-0 left-[232px] right-0 top-0 z-[210] flex items-start justify-center overflow-y-auto bg-[#6d7f99]/35 px-6 py-8 backdrop-blur-[3px]">
      <div className={`${card} w-full max-w-3xl p-6`}>
        <div className="flex items-start justify-between">
          <h2 className="font-display text-xl font-bold"><Tri a="New Complaint" b="Nayi Complaint" c="نئی شکایت" /></h2>
          {number && <span className="rounded-full bg-[#e5f8ee] px-3 py-1 text-[12px] font-semibold text-[#1d8a4e]">Saved · {number}</span>}
        </div>
        <form action={variant === "live" ? action : undefined} className="mt-4 space-y-3" onSubmit={variant === "preview" ? (e) => e.preventDefault() : undefined}>
          <input type="hidden" name="kind" value={data.kind} />
          <input type="hidden" name="party_id" value={data.id} />
          <input type="hidden" name="category" value={category} />
          <div className="text-[12px] text-[#607089]"><Tri a="Category" b="Qism" c="قسم" /></div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-[13px] ${c === category ? "bg-[#101a4a] text-white" : "bg-[#f3f6fb] text-[#14233a]"}`}
              >
                {CATEGORY_LABEL[c].en}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 text-[13px]">
            <Field k="Department (auto)" v={`${DEPT_LABEL[route.department]} / ${route.department === "accounts" ? "Hisaab" : route.department}`} />
            <Field k="Priority / Ahmiyat" v={`${route.priority === "high" ? "High" : "Normal"} · SLA ${route.slaHours}h`} dot />
            <Field k="Reply channel / Jawab" v="SMS only" />
          </div>
          <label className="block text-[12px] text-[#607089]">
            <Tri a="Description" b="Tafseel" c="تفصیل" />
            <textarea name="description" required minLength={8} defaultValue={data.example ? "18 Oct ko DAP 1 bag likha gaya hai, caller kehta hai bag nahi liya. Check karein." : ""} className="mt-1 h-28 w-full rounded-2xl border border-[#e4eaf2] p-3 text-[14px] text-[#14233a] outline-none" />
          </label>
          <label className="block text-[12px] text-[#607089]">
            <Tri a="Images" b="Tasveer" c="تصویر" />
            <input name="images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="mt-1 block w-full text-[13px]" />
          </label>
          <div className="flex items-center justify-between rounded-2xl bg-[#101a4a] px-4 py-3 text-white">
            <div>
              <div className="text-[11px] text-white/60">Complaint number</div>
              <div className="font-display text-2xl font-bold">{number ?? "CMP-……"}</div>
            </div>
            <label className="flex items-center gap-2 text-[12px] text-white/80">
              <input type="checkbox" disabled checked={false} readOnly />
              Caller ko WhatsApp par number nahi — sirf SMS (band)
            </label>
          </div>
          {state.error && <p className="text-sm text-[#c03636]">{state.error}</p>}
          {state.ok && <p className="text-sm text-[#1d8a4e]">{state.ok}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#e4eaf2] px-4 py-2 text-sm">Band karein</button>
            <button className="rounded-xl bg-[#101a4a] px-4 py-2 text-sm font-semibold text-white">Save / Mehfooz</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ k, v, dot }: { k: string; v: string; dot?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#e4eaf2] px-3 py-2">
      <div className="text-[11px] text-[#90a0b4]">{k}</div>
      <div className="font-medium">{dot && <span className="mr-1 text-[#e0a100]">●</span>}{v}</div>
    </div>
  );
}

const SLA_DOT: Record<string, string> = { on_time: "bg-[#1d8a4e]", near: "bg-[#e0a100]", late: "bg-[#d64545]", none: "bg-[#c5ced8]" };

export function BoardScreen({ data }: { data: BoardData }) {
  const now = new Date();
  return (
    <div className="space-y-4">
      {data.notice && <p className={`${card} px-5 py-4 text-sm text-[#8a5a12]`}>{data.notice}</p>}
      <div className="grid grid-cols-4 gap-4">
        <Count k="Open / Khuli / کھلی" n={data.open} tone="text-[#c03636]" />
        <Count k="In progress / Jari / جاری" n={data.inProgress} tone="text-[#c47b00]" />
        <Count k="Resolved / Hal / حل شدہ" n={data.resolved} tone="text-[#1d8a4e]" />
        <div className="rounded-[22px] bg-[#101a4a] px-5 py-4 text-white">
          <div className="text-[13px] text-white/70">SLA breach</div>
          <div className="font-display text-[40px] font-bold leading-none">{data.slaBreach == null ? "—" : data.slaBreach}</div>
        </div>
      </div>
      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between px-5 pt-4 text-[13px] text-[#607089]">
          <span><Tri a="All complaints" b="Tamam shikayat" c="تمام شکایات" /></span>
          <span className="text-[12px]">SLA: <i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#1d8a4e]" /> on time · <i className="mx-1 inline-block h-2 w-2 rounded-full bg-[#e0a100]" /> near · <i className="mx-1 inline-block h-2 w-2 rounded-full bg-[#d64545]" /> late</span>
        </div>
        <table className="mt-2 w-full text-left text-[13px]">
          <thead className="text-[#90a0b4]">
            <tr>
              {["No.", "Caller", "Category", "Assigned dept", "Age", "SLA", "Status", "Created by", ""].map((h) => (
                <th key={h || "act"} className="px-4 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const tone = r.sla ?? slaTone(r.status, r.createdAt, r.slaDue, now);
              const can = !data.example && mayResolve({ actorId: data.actorId, createdBy: r.createdBy, actorRoles: data.actorRoles, department: r.department }) && r.status !== "resolved";
              return (
                <tr key={r.id} className="border-t border-[#f0f3f8]">
                  <td className="px-4 py-3 font-semibold">{r.number}</td>
                  <td className="px-4 py-3">{r.callerName}</td>
                  <td className="px-4 py-3">{CATEGORY_LABEL[r.category]?.en ?? r.category}</td>
                  <td className="px-4 py-3">{DEPT_LABEL[r.department as keyof typeof DEPT_LABEL] ?? r.department}</td>
                  <td className="px-4 py-3">{r.ageText ?? ageLabel(r.createdAt, now)}</td>
                  <td className="px-4 py-3"><span className={`inline-block h-2.5 w-2.5 rounded-full ${SLA_DOT[tone]}`} /></td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-[#607089]">{r.createdByName}</td>
                  <td className="px-4 py-3">
                    {can && (
                      <span className="flex gap-2">
                        <StatusButton id={r.id} status="in_progress" label="Jari" />
                        <StatusButton id={r.id} status="resolved" label="Band" />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="m-4 rounded-2xl bg-[#f4f0ff] px-4 py-3 text-[13px] text-[#3d3a66]">
          Maker-checker: Agent apni complaint khud band nahi kar sakta — sirf department ka banda hal kar ke band karega. ایجنٹ اپنی شکایت خود بند نہیں کر سکتا۔
          <span className="mt-1 block">Yeh CMP Support Dashboard ki admin queue mein bhi hai. Category sirf tajweez hai — assign Admin karta hai. Number sirf SMS.</span>
        </p>
      </section>
    </div>
  );
}

function Count({ k, n, tone }: { k: string; n: number | null; tone: string }) {
  return (
    <div className={`${card} px-5 py-4`}>
      <div className="text-[13px] text-[#607089]">{k}</div>
      <div className={`font-display text-[40px] font-bold leading-none ${tone}`}>{n == null ? "—" : n}</div>
    </div>
  );
}

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  const [state, action] = useFormState(setComplaintStatus, {} as CcState);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="text-[12px] font-semibold text-[#1a3f86] underline">{label}</button>
      {state.error && <div className="max-w-[140px] text-[11px] text-[#c03636]">{state.error}</div>}
    </form>
  );
}

export function AgentsScreen({ data }: { data: AgentsData }) {
  const [state, action] = useFormState(createCallCenterAgent, {} as CcState);
  const [smsState, smsAction] = useFormState(sendTestSms, {} as SmsTestState);
  const showTest = data.canCreate || data.example;
  return (
    <div className="space-y-4">
      {showTest && (
        <section className={`${card} p-5`}>
          <h2 className="font-display text-lg font-bold">Test SMS</h2>
          <p className="mt-1 text-[12px] text-[#7b8798]">
            Sirf Owner / Admin. Ek number par ek paighaam.
            {data.smsConfigured ? " Veevo set hai." : " Provider abhi set nahi — paighaam queue mein rahega."}
          </p>
          <form
            action={data.example ? undefined : smsAction}
            onSubmit={data.example ? (event) => event.preventDefault() : undefined}
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <label className="text-[12px] text-[#607089]">Mobile
              <input name="phone" placeholder="03xxxxxxxxx" defaultValue={data.example ? "0300-0000000" : ""} readOnly={data.example} className="mt-1 block h-11 w-48 rounded-xl border border-[#e4eaf2] px-3 text-[14px]" />
            </label>
            <label className="min-w-[240px] flex-1 text-[12px] text-[#607089]">Paighaam
              <input name="message" defaultValue="Al Rana Traders: yeh test SMS hai." readOnly={data.example} className="mt-1 block h-11 w-full rounded-xl border border-[#e4eaf2] px-3 text-[14px]" />
            </label>
            <button className="h-11 rounded-xl bg-[#101a4a] px-4 text-sm font-semibold text-white">Test SMS</button>
          </form>
          {smsState.error && <p className="mt-2 text-sm text-[#c03636]">{smsState.error}</p>}
          {smsState.ok && <p className="mt-2 text-sm text-[#14663a]">{smsState.ok}</p>}
        </section>
      )}
    <div className="grid grid-cols-2 gap-4">
      <section className={`${card} p-5`}>
        <h2 className="font-display text-lg font-bold"><Tri a="Create agent" b="Naya agent" c="نیا ایجنٹ" /></h2>
        <p className="mt-1 text-[12px] text-[#7b8798]">Admin staff khud banata hai — koi invite nahi.</p>
        {data.notice && <p className="mt-3 text-sm text-[#8a5a12]">{data.notice}</p>}
        <form action={data.example || !data.canCreate ? undefined : action} onSubmit={data.example ? (e) => e.preventDefault() : undefined} className="mt-4 space-y-3">
          <label className="block text-[12px] text-[#607089]">Naam
            <input name="full_name" defaultValue={data.example ? "Sana Iqbal (Example)" : ""} readOnly={data.example} className="mt-1 h-11 w-full rounded-xl border border-[#e4eaf2] px-3 text-[14px]" />
          </label>
          <label className="block text-[12px] text-[#607089]">Mobile / User ID
            <input name="mobile" defaultValue={data.example ? "0333-****41 · AGT-0003" : ""} readOnly={data.example} placeholder="03xxxxxxxxx" className="mt-1 h-11 w-full rounded-xl border border-[#e4eaf2] px-3 text-[14px]" />
          </label>
          <label className="block text-[12px] text-[#607089]">Role
            <input readOnly value="Call Center Agent" className="mt-1 h-11 w-full rounded-xl border border-[#e4eaf2] bg-[#f8fafc] px-3 text-[14px]" />
          </label>
          <div className="space-y-1 text-[13px]">
            <div className="text-[12px] text-[#607089]">Permissions / Ijazatein</div>
            <Check on label="View khata balance / Khata baqaya dekhna" />
            <Check on label="View rates / Rate dekhna" />
            <Check on label="View milk info / Doodh maloomat dekhna" />
            <Check on label="Create complaint / Complaint darj karna" />
            <Check on={false} label="Edit / payment / rate change — not allowed" />
          </div>
          <button disabled={!data.canCreate && !data.example} className="rounded-xl bg-[#101a4a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Agent banayein</button>
          {state.error && <p className="text-sm text-[#c03636]">{state.error}</p>}
          {state.ok && (
            <p className="rounded-xl bg-[#e5f8ee] p-3 text-sm text-[#14663a]">
              {state.ok}<br />Login: {state.login}<br />Password: {state.password}
            </p>
          )}
        </form>
      </section>
      <div className="space-y-4">
        <section className={`${card} overflow-hidden`}>
          <div className="px-5 pt-4 text-[13px] text-[#607089]"><Tri a="Audit log" b="kis ne kis ka khata kab dekha" c="کس نے کس کا کھاتہ کب دیکھا" /></div>
          <table className="mt-2 w-full text-left text-[12px]">
            <thead className="text-[#90a0b4]"><tr>{["Time", "Agent", "Party viewed", "Action", "Device"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {data.audit.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-[#90a0b4]">Abhi koi lookup nahi.</td></tr>}
              {data.audit.map((a, i) => (
                <tr key={`${a.at}-${i}`} className="border-t border-[#f0f3f8]">
                  <td className="px-4 py-2">{a.at}</td>
                  <td className="px-4 py-2">{a.agent}</td>
                  <td className="px-4 py-2">{a.party}</td>
                  <td className="px-4 py-2">{a.action}</td>
                  <td className="px-4 py-2">{a.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className={`${card} overflow-hidden`}>
          <div className="px-5 pt-4 text-[13px] text-[#607089]">Agents</div>
          <table className="mt-2 w-full text-left text-[13px]">
            <thead className="text-[#90a0b4]"><tr>{["ID", "Naam", "Status", "Aaj ki calls"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {data.agents.map((a) => (
                <tr key={a.code} className="border-t border-[#f0f3f8]">
                  <td className="px-4 py-2 font-semibold">{a.code}</td>
                  <td className="px-4 py-2">{a.name}</td>
                  <td className="px-4 py-2"><span className="rounded-full bg-[#e5f8ee] px-2 py-0.5 text-[12px] font-semibold text-[#1d8a4e]">{a.status === "active" ? "Active" : a.status}</span></td>
                  <td className="px-4 py-2 tabular-nums">{a.callsToday == null ? "—" : a.callsToday}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
    </div>
  );
}

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={on} disabled readOnly />
      <span className={on ? "" : "text-[#90a0b4]"}>{label}</span>
      {on && <span className="ml-auto rounded-full bg-[#eef0fb] px-2 text-[11px] text-[#3d4d93]">view-only</span>}
    </label>
  );
}
