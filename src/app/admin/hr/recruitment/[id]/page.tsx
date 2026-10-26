import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHr, NoAccess } from "@/components/hr-kpi/hr-form-bits";
import { Chip, MoneyBox, PageTop, SO_CARD, SO_H3, SO_PAGE, SO_TD, SO_TH, Timeline, type ChipTone } from "@/components/payroll/salary-ui";
import { ApplicationTimeline, type TimelineMessage } from "@/app/admin/job-applications/timeline";
import { staffGenderOrNull } from "@/lib/jobs/apply-input";
import { OfferForm } from "@/components/payroll/salary-forms";
import { fmtDate, fmtDayMonth, gapVsExpected, offerTotal } from "@/lib/payroll/salary-offer";
import { pkr } from "@/lib/recovery/credit-report";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
const OFFER_STATUS: Record<string, [string, ChipTone]> = {
  pending: ["Bheji", "bl"], accepted: ["Qubool", "gr"], rejected: ["Radd", "rd"], countered: ["Mol-tol counter", "am"], withdrawn: ["Wapas", "gy"],
};
const EVENT: Record<string, [string, ChipTone]> = {
  sent: ["Bheji", "bl"], revised: ["Bheji (revised)", "bl"], countered: ["Mol-tol counter", "am"], accepted: ["Qubool", "gr"], rejected: ["Radd", "rd"], withdrawn: ["Wapas", "gy"],
};
const amt = (x: any) => (x == null || Number(x) === 0 ? "—" : pkr(Number(x)));
const incentive = (x: any) => (x?.incentive_pct != null ? `${Number(x.incentive_pct)}%${x.incentive_rule ? ` ${x.incentive_rule}` : ""}` : x?.incentive_rule ?? "—");

/** 691 (mockup 1): Bharti -- maangi gayi, hamari offer, qubool shuda + mol-tol ki tareekh. */
export default async function RecruitmentOfferPage({ params }: { params: { id: string } }) {
  if (!(await requireHr())) return <NoAccess />;
  const sb = createClient() as any;
  let appQ = await sb.from("job_applications").select("id, full_name, status, expected_salary, vacancy_id, gender").eq("id", params.id).maybeSingle();
  if (appQ.error && /gender/i.test(String(appQ.error.message ?? ""))) {
    appQ = await sb.from("job_applications").select("id, full_name, status, expected_salary, vacancy_id").eq("id", params.id).maybeSingle();
  }
  const { data: app } = appQ;
  if (!app) notFound();
  const [{ data: vac }, { data: offersRaw }, ev] = await Promise.all([
    sb.from("job_vacancies").select("title, designation, branch_id").eq("id", app.vacancy_id).maybeSingle(),
    sb.from("job_offers").select("*").eq("application_id", app.id).order("created_at", { ascending: true }),
    sb.from("job_offer_events").select("*").eq("application_id", app.id).order("created_at", { ascending: true }),
  ]);
  const offers: any[] = offersRaw ?? [];
  const schemaReady = !ev.error;
  let events: any[] = ev.data ?? [];
  if (!schemaReady || (events.length === 0 && offers.length)) {
    // 691 se pehle ki offers: silsila offers se hi bana lo
    events = offers.flatMap((o, i) => [
      { kind: i === 0 ? "sent" : "revised", created_at: o.created_at, total: offerTotal(o), actor: o.created_by, via: "admin" },
      ...(o.status !== "pending" && o.responded_at ? [{ kind: o.status, created_at: o.responded_at, total: offerTotal(o), via: "public_link" }] : []),
    ]);
  }
  const [{ data: branch }, { data: actors }] = await Promise.all([
    vac?.branch_id ? sb.from("branches").select("name").eq("id", vac.branch_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("profiles").select("id, full_name").in("id", [...new Set(events.map((e) => e.actor).filter(Boolean))]),
  ]);
  const who = new Map<string, string>((actors ?? []).map((p: any) => [p.id, p.full_name]));

  const latest = offers[offers.length - 1] ?? null;
  const first = offers[0] ?? null;
  const accepted = [...offers].reverse().find((o) => o.status === "accepted") ?? null;
  const counter = [...events].reverse().find((e) => e.kind === "countered") ?? null;
  const expected = app.expected_salary != null ? Number(app.expected_salary) : null;
  const latestTotal = offerTotal(latest);
  const gap = gapVsExpected(latestTotal, expected);
  const [msgQ, actQ] = await Promise.all([
    sb.from("job_application_messages").select("id, channel, to_address, subject, body, link_url, attachment_name, status, error, triggered_by, created_at").eq("application_id", app.id).order("created_at", { ascending: true }),
    sb.from("application_activity_log").select("id, event_type, event_description, created_at").eq("application_id", app.id).order("created_at", { ascending: true }),
  ]);
  const rawMessages = msgQ.error ? [] : (msgQ.data ?? []);
  const actorIds = Array.from(new Set(rawMessages.map((m: { triggered_by: string | null }) => m.triggered_by).filter(Boolean)));
  const { data: msgActors } = actorIds.length ? await sb.from("profiles").select("id, full_name").in("id", actorIds) : { data: [] };
  const msgWho = new Map<string, string>((msgActors ?? []).map((p: any) => [p.id, p.full_name]));
  const messages: TimelineMessage[] = rawMessages.map((m: any) => ({
    id: m.id,
    channel: m.channel === "sms" || m.channel === "whatsapp" ? m.channel : "email",
    to_address: m.to_address,
    subject: m.subject,
    body: m.body,
    link_url: m.link_url,
    attachment_name: m.attachment_name,
    status: m.status === "failed" ? "failed" : "sent",
    error: m.error,
    triggered_name: m.triggered_by ? msgWho.get(m.triggered_by) ?? null : null,
    created_at: m.created_at,
  }));
  const gender = staffGenderOrNull(app.gender);
  const genderLabel = gender === "male" ? "Male" : gender === "female" ? "Female" : gender === "other" ? "Other" : "—";
  const designation = latest?.designation ?? vac?.designation ?? vac?.title ?? "Staff";
  const st = latest ? OFFER_STATUS[latest.status] ?? ["—", "gy"] : null;

  const rows: [string, (x: any) => string][] = [
    ["Basic", (x) => amt(x?.basic)], ["Ghar ka kiraya", (x) => amt(x?.house_rent)], ["Safar (Travel)", (x) => amt(x?.travel)], ["Mobile", (x) => amt(x?.mobile)],
  ];

  return (
    <div className={SO_PAGE}>
      <PageTop title={`Bharti — ${app.full_name}`} sub={`${designation}${branch?.name ? ` · ${branch.name} branch` : ""} · Gender: ${genderLabel} · Stage: Offer`}>
        <Link href="/admin/hr/recruitment" className="text-sm text-gray-500 hover:underline">← Recruitment</Link>
      </PageTop>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div className={SO_CARD}>
            <h3 className={SO_H3}>Tankhwah ka muqabla {st && <Chip tone={st[1]}>{st[0]}</Chip>}</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <MoneyBox kind="exp" chip={<Chip tone="bl">Maangi gayi tankhwah</Chip>} value={expected != null ? `Rs ${pkr(expected)}` : "—"} sub="Candidate ne form mein likhi" />
              <MoneyBox kind="off" chip={<Chip tone="am">Hamari offer (kul)</Chip>} value={latestTotal != null ? `Rs ${pkr(latestTotal)}` : "—"}
                sub={gap ? `${gap.diff < 0 ? "−" : "+"}${pkr(Math.abs(gap.diff))} maang se ${gap.diff < 0 ? "kam" : "zyada"} (${gap.pct > 0 ? "+" : gap.pct < 0 ? "−" : ""}${Math.abs(gap.pct)}%)` : "Abhi offer nahi bheji"} />
              <MoneyBox kind="acc" chip={<Chip tone="gr">Qubool shuda offer</Chip>} value={accepted ? `Rs ${pkr(Number(accepted.accepted_total ?? offerTotal(accepted)))}` : "—"}
                sub={accepted ? `${offers.length > 1 ? "Mol-tol ke baad · " : ""}${fmtDate(String(accepted.accepted_at ?? accepted.responded_at ?? "").slice(0, 10))}` : "Abhi qubool nahi"} />
            </div>
            <table className="mt-3.5 w-full border-collapse">
              <thead><tr><th className={SO_TH}>Hissa</th><th className={SO_TH}>Pehli offer</th><th className={SO_TH}>Counter (candidate)</th><th className={SO_TH}>Qubool shuda</th></tr></thead>
              <tbody>
                {rows.map(([k, f]) => (
                  <tr key={k}><td className={SO_TD}>{k}</td><td className={`${SO_TD} tabular-nums`}>{f(first)}</td><td className={`${SO_TD} tabular-nums`}>{f(counter)}</td><td className={`${SO_TD} font-bold tabular-nums`}>{f(accepted)}</td></tr>
                ))}
                <tr><td className={`${SO_TD} font-bold`}>Mahana kul</td><td className={`${SO_TD} tabular-nums`}>{amt(offerTotal(first))}</td><td className={`${SO_TD} tabular-nums`}>{amt(counter?.total ?? offerTotal(counter))}</td><td className={`${SO_TD} font-bold tabular-nums text-green-700 dark:text-green-300`}>{amt(accepted ? accepted.accepted_total ?? offerTotal(accepted) : null)}</td></tr>
                <tr><td className={SO_TD}>Bonus (saalana)</td><td className={SO_TD}>{first?.bonus ?? "—"}</td><td className={SO_TD}>{counter?.bonus ?? "—"}</td><td className={`${SO_TD} font-bold`}>{accepted?.bonus ?? "—"}</td></tr>
                <tr><td className={SO_TD}>Achhe kaam ka inaam</td><td className={SO_TD}>{incentive(first)}</td><td className={SO_TD}>{incentive(counter)}</td><td className={`${SO_TD} font-bold`}>{accepted ? incentive(accepted) : "—"}</td></tr>
              </tbody>
            </table>
          </div>
          <div className={SO_CARD}>
            <h3 className={SO_H3}>Offer ka silsila</h3>
            {events.length ? (
              <Timeline items={events.map((e) => {
                const [l, t] = EVENT[e.kind] ?? [e.kind, "gy"];
                const day = fmtDayMonth(String(e.created_at).slice(0, 10));
                const total = e.total != null ? `Rs ${pkr(Number(e.total))}` : null;
                const tail = e.kind === "countered" ? `candidate ne ${total ?? "—"} maange`
                  : e.kind === "accepted" ? (e.via === "public_link" ? "public link se" : `darj: ${who.get(e.actor) ?? "HR"}`)
                  : e.kind === "sent" ? `${total ?? ""}${e.actor && who.get(e.actor) ? ` · by ${who.get(e.actor)}` : ""}`
                  : total ?? "";
                return <span key={e.id ?? e.created_at} className="text-sm"><Chip tone={t}>{l}</Chip> {day}{tail ? ` · ${tail}` : ""}</span>;
              })} />
            ) : <p className="text-sm text-gray-500">Abhi koi offer nahi bheji.</p>}
            <ApplicationTimeline events={actQ.error ? [] : (actQ.data ?? [])} messages={messages} />
            {messages.length === 0 && <p className="mt-2 text-sm text-gray-500">Is candidate ko abhi koi email / SMS darj nahi. Agar email khali ho ya mail fail ho, yahan failed note aata hai.</p>}
          </div>
        </div>
        <div>
          <div className={SO_CARD}>
            <h3 className={SO_H3}>Hamari offer bhejein / badlein</h3>
            <OfferForm applicationId={app.id} offerId={latest?.id ?? null} status={latest?.status ?? null} canWrite={schemaReady}
              d={{ ...(accepted ?? latest ?? {}), designation, basic: (accepted ?? latest)?.basic ?? (latest && !latest.basic ? latest.proposed_salary : null) }} />
            {!schemaReady && <p className="mt-2 text-xs text-amber-700">Hissa-war offer ke liye migration 691 zaroori hai.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
