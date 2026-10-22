"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BHero, Panel, INPUT, BTN, BTN_O, Pill, TH, TD } from "../parts";
import { countAudience, previewBroadcast, submitBroadcast, type DraftInput } from "../actions";
import { smsSegments, BROADCAST_VARS } from "@/lib/broadcast/text";

type Tpl = { id: string; name: string; lang: string; category: string; body: string; var_count: number; meta_status: string };
type Preview = Awaited<ReturnType<typeof previewBroadcast>>;

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function Wizard({ L, rtl, templates, campaigns, departments }: { L: Record<string, string>; rtl: boolean; templates: Tpl[]; campaigns: { id: string; name: string; crop: string | null }[]; departments: { key: string; label: string }[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<DraftInput["spec"]["role"]>("farmers");
  const [villages, setVillages] = useState("");
  const [campIds, setCampIds] = useState<string[]>([]);
  const [udhaarDays, setUdhaarDays] = useState("");
  const [udhaarMin, setUdhaarMin] = useState("");
  const [dairyOnly, setDairyOnly] = useState(false);
  const [depts, setDepts] = useState<string[]>([]);
  const [picked, setPicked] = useState("");
  const [csvText, setCsvText] = useState("");
  const [count, setCount] = useState<Awaited<ReturnType<typeof countAudience>> | null>(null);
  const [channel, setChannel] = useState<DraftInput["channel"]>("whatsapp");
  const approved = templates.filter((x) => x.meta_status === "APPROVED");
  const [tplId, setTplId] = useState<string>(approved[0]?.id ?? "");
  const [tplVars, setTplVars] = useState<string[]>(["naam", "baqi_raqam", "", "", ""]);
  const [msgLang, setMsgLang] = useState<DraftInput["lang"]>("rm");
  const [sms, setSms] = useState<{ en: string; rm: string; ur: string }>({ en: "", rm: "Assalam o alaikum {naam}, AgriBridge: ", ur: "" });
  const [smsTab, setSmsTab] = useState<"en" | "rm" | "ur">("rm");
  const [schedule, setSchedule] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const tpl = templates.find((x) => x.id === tplId) ?? null;

  const spec = (): DraftInput["spec"] => ({ role, villages: split(villages), campaignIds: campIds, udhaarDays: udhaarDays ? Number(udhaarDays) : null, udhaarMin: udhaarMin ? Number(udhaarMin) : null, dairyOnly, departments: depts, pickedIds: split(picked), csvText });
  const draft = (): DraftInput => ({ title, spec: spec(), channel, templateId: channel === "sms" ? null : tplId || null, templateVars: tplVars.slice(0, tpl?.var_count ?? 0), smsBody: sms, lang: msgLang, scheduleAt: schedule || null, season: campaigns.find((c) => campIds.includes(c.id))?.name ?? "" });
  const seg = smsSegments(sms[smsTab]);
  const doCount = () => start(async () => { setErr(null); try { setCount(await countAudience(spec())); } catch (e) { setErr(String((e as Error).message)); } });
  const doPreview = () => start(async () => { setErr(null); try { setPreview(await previewBroadcast(draft())); setStep(2); } catch (e) { setErr(String((e as Error).message)); } });
  const doSubmit = () => start(async () => { setErr(null); const r = await submitBroadcast(draft()); if (r.error) setErr(r.error); if (r.id && !r.error) router.push(`/admin/broadcast/${r.id}`); });

  const Seg = ({ on, onClick, children, testid }: { on: boolean; onClick: () => void; children: React.ReactNode; testid?: string }) => (
    <button type="button" data-testid={testid} onClick={onClick} className={`rounded-xl border px-3 py-1.5 text-sm ${on ? "border-emerald-700 bg-emerald-700 text-white" : "border-surface-300 text-surface-700 hover:bg-surface-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"}`}>{children}</button>
  );
  const Lbl = ({ children }: { children: React.ReactNode }) => <label className="mb-1 mt-2 block text-[11.5px] text-surface-500 dark:text-slate-400">{children}</label>;
  const steps = [L.bc_audience, L.bc_message, L.bc_preview];

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="flex h-full min-h-0 flex-col gap-2.5 p-4" data-testid="broadcast-wizard">
      <BHero title={L.bc_new} sub={L.bc_self_note} />
      <div className="grid grid-cols-3 gap-2">
        {steps.map((s, i) => (
          <div key={s} className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2 dark:bg-[#111a2e] ${i === step ? "border-emerald-700 ring-2 ring-emerald-700/15" : "border-surface-200 dark:border-white/10"}`}>
            <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${i < step ? "bg-emerald-100 text-emerald-800" : i === step ? "bg-emerald-700 text-white" : "bg-surface-100 text-surface-600 dark:bg-white/10 dark:text-slate-300"}`}>{i < step ? "✓" : i + 1}</span>
            <div><div className="text-[11px] text-surface-500 dark:text-slate-400">{L.bc_step} {i + 1}</div><div className="text-sm font-semibold text-surface-900 dark:text-white">{s}</div></div>
          </div>))}
      </div>
      {err ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" data-testid="wizard-error">{err}</div> : null}

      {step === 0 && (
        <div className="grid min-h-0 flex-1 gap-2.5 lg:grid-cols-[1.15fr_1.3fr_1fr]">
          <Panel title={L.bc_role}>
            <Lbl>{L.bc_title_f}</Lbl><input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gandum beej booking" data-testid="bc-title" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["farmers", "customers", "staff", "all", "custom"] as const).map((r) => <Seg key={r} on={role === r} onClick={() => setRole(r)} testid={`role-${r}`}>{L[`bc_${r}`]}</Seg>)}
            </div>
            <Lbl>{L.bc_picked}</Lbl><input className={INPUT} value={picked} onChange={(e) => setPicked(e.target.value)} placeholder="uuid, uuid" />
            <Lbl>{L.bc_csv}</Lbl><textarea className={INPUT} rows={4} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={"Ali Raza,0300-1234567"} />
            <input type="file" accept=".csv,text/csv" className="mt-1 text-xs" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsvText(await f.text()); }} />
          </Panel>
          <Panel title={L.bc_filters}>
            <Lbl>{L.bc_village}</Lbl><input className={INPUT} value={villages} onChange={(e) => setVillages(e.target.value)} placeholder="Kot Rana, Chak 45" />
            <Lbl>{L.bc_season}</Lbl>
            <div className="flex flex-wrap gap-1.5">{campaigns.length === 0 ? <span className="text-xs text-surface-400">—</span> : campaigns.map((c) => <Seg key={c.id} on={campIds.includes(c.id)} onClick={() => setCampIds((v) => (v.includes(c.id) ? v.filter((x) => x !== c.id) : [...v, c.id]))}>{c.name}</Seg>)}</div>
            <div className="grid grid-cols-2 gap-2"><div><Lbl>{L.bc_udhaar_days}</Lbl><input type="number" min={0} className={INPUT} value={udhaarDays} onChange={(e) => setUdhaarDays(e.target.value)} placeholder="60" /></div>
              <div><Lbl>{L.bc_udhaar_min}</Lbl><input type="number" min={0} className={INPUT} value={udhaarMin} onChange={(e) => setUdhaarMin(e.target.value)} placeholder="5000" /></div></div>
            <label className="mt-3 flex items-center gap-2 text-sm text-surface-700 dark:text-slate-200"><input type="checkbox" checked={dairyOnly} onChange={(e) => setDairyOnly(e.target.checked)} /> {L.bc_dairy}</label>
            <Lbl>{L.bc_dept}</Lbl>
            <div className="flex flex-wrap gap-1.5">{departments.map((d) => <Seg key={d.key} on={depts.includes(d.key)} onClick={() => setDepts((v) => (v.includes(d.key) ? v.filter((x) => x !== d.key) : [...v, d.key]))}>{d.label}</Seg>)}</div>
          </Panel>
          <Panel title={L.bc_recipients}>
            <div className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-300" data-testid="aud-count">{count ? count.count.toLocaleString() : "—"}</div>
            <p className="text-xs text-surface-500 dark:text-slate-400">{L.bc_excluded}: {count ? `${count.noNumber} · ${count.duplicates}` : "—"}</p>
            <button type="button" className={`${BTN_O} mt-2`} onClick={doCount} disabled={pending} data-testid="aud-count-btn">{L.bc_count}</button>
            {count?.sample?.length ? (<table className="mt-2 w-full"><tbody>{count.sample.map((s, i) => (<tr key={i}><td className={TD}>{s.name}</td><td className={TD}>{s.type}</td><td className={TD}>{s.vars.gaon || "—"}</td></tr>))}</tbody></table>) : null}
            <div className="mt-3 flex justify-end"><button type="button" className={BTN} onClick={() => setStep(1)} data-testid="to-message">{L.bc_message} →</button></div>
          </Panel>
        </div>)}

      {step === 1 && (
        <div className="grid min-h-0 flex-1 gap-2.5 lg:grid-cols-[1.2fr_1.3fr_1fr]">
          <Panel title={L.bc_channel}>
            <div className="flex flex-wrap gap-1.5">
              <Seg on={channel === "whatsapp"} onClick={() => setChannel("whatsapp")} testid="ch-whatsapp">WhatsApp</Seg>
              <Seg on={channel === "sms"} onClick={() => setChannel("sms")} testid="ch-sms">SMS</Seg>
              <Seg on={channel === "both"} onClick={() => setChannel("both")} testid="ch-both">{L.bc_both}</Seg>
            </div>
            {channel !== "sms" && (<>
              <Lbl>{L.bc_template}</Lbl>
              <select className={INPUT} value={tplId} onChange={(e) => setTplId(e.target.value)} data-testid="tpl-select">
                <option value="">—</option>
                {templates.map((x) => <option key={x.id} value={x.id} disabled={x.meta_status !== "APPROVED"}>{x.name} · {x.lang} · {x.category} · {x.meta_status}</option>)}
              </select>
              <p className="mt-1 text-[11.5px] text-amber-800 dark:text-amber-300">{L.bc_template_rule}</p>
              {tpl ? (<>
                <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-50 p-2 text-xs text-surface-700 dark:bg-white/5 dark:text-slate-300">{tpl.body}</p>
                <Lbl>{L.bc_tpl_vars}</Lbl>
                <div className="grid grid-cols-2 gap-1.5">{Array.from({ length: tpl.var_count }).map((_, i) => (
                  <select key={i} className={INPUT} value={tplVars[i] ?? ""} onChange={(e) => setTplVars((v) => v.map((x, j) => (j === i ? e.target.value : x)))}>
                    <option value="">{`{{${i + 1}}}`}</option>{BROADCAST_VARS.map((k) => <option key={k} value={k}>{`{{${i + 1}}} → {${k}}`}</option>)}
                  </select>))}</div></>) : null}
            </>)}
            <Lbl>{L.bc_lang}</Lbl>
            <div className="flex flex-wrap gap-1.5">{(["en", "rm", "ur", "pref"] as const).map((l) => <Seg key={l} on={msgLang === l} onClick={() => setMsgLang(l)}>{l === "pref" ? L.bc_lang_pref : l === "ur" ? "اردو" : l === "rm" ? "Roman" : "EN"}</Seg>)}</div>
          </Panel>
          <Panel title={L.bc_sms_text} right={<span className="text-[11px] text-surface-500 dark:text-slate-400">{L.bc_vars}: {BROADCAST_VARS.map((v) => `{${v}}`).join(" ")}</span>}>
            {channel === "whatsapp" ? <p className="py-8 text-center text-sm text-surface-400">WhatsApp → template</p> : (<>
              <div className="mb-1.5 flex gap-1.5">{(["en", "rm", "ur"] as const).map((l) => <Seg key={l} on={smsTab === l} onClick={() => setSmsTab(l)}>{l === "ur" ? "اردو" : l === "rm" ? "Roman" : "EN"}</Seg>)}</div>
              <textarea dir={smsTab === "ur" ? "rtl" : "ltr"} className={`${INPUT} h-40`} value={sms[smsTab]} onChange={(e) => setSms((s) => ({ ...s, [smsTab]: e.target.value }))} data-testid="sms-text" />
              <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="sms-counter"><Pill s={seg.encoding === "GSM-7" ? "draft" : "PENDING"} label={`${seg.encoding} · ${seg.chars}/${seg.perSegment} · ${seg.segments} ${L.bc_segments}`} /></div>
              <p className="mt-1 text-[11px] text-surface-500 dark:text-slate-400">STOP likh kar band karein — opt-out line rakhein.</p></>)}
          </Panel>
          <Panel title={L.bc_schedule}>
            <div className="flex flex-wrap gap-1.5"><Seg on={!schedule} onClick={() => setSchedule("")}>{L.bc_now}</Seg></div>
            <input type="datetime-local" className={`${INPUT} mt-2`} value={schedule} onChange={(e) => setSchedule(e.target.value)} />
            <p className="mt-1 text-[11px] text-surface-500 dark:text-slate-400">{L.bc_rate_note}</p>
            <div className="mt-auto flex justify-between pt-4"><button type="button" className={BTN_O} onClick={() => setStep(0)}>← {L.bc_back}</button>
              <button type="button" className={BTN} onClick={doPreview} disabled={pending} data-testid="to-preview">{L.bc_preview} →</button></div>
          </Panel>
        </div>)}

      {step === 2 && preview && (
        <div className="grid min-h-0 flex-1 gap-2.5 lg:grid-cols-[1.3fr_1.2fr_0.9fr]">
          <Panel title={`${L.bc_recipients} · ${preview.count.toLocaleString()}`}>
            <table className="w-full"><thead><tr><th className={TH}>Name</th><th className={TH}>Phone</th><th className={TH}>!</th></tr></thead>
              <tbody>{preview.rows.map((r, i) => (<tr key={i}><td className={TD}>{r.name}</td><td className={TD}>{r.phone}</td><td className={TD}>{r.missing.length ? <Pill s="PENDING" label={r.missing.join(",")} /> : "✓"}</td></tr>))}</tbody></table>
          </Panel>
          <Panel title={L.bc_preview}>
            <div className="space-y-2 rounded-xl bg-[#e7ddd0] p-3 dark:bg-[#0d1b2a]" data-testid="msg-preview">
              {preview.rows.slice(0, 3).map((r, i) => (<div key={i} className="space-y-1">
                {r.wa ? <div className="max-w-[92%] whitespace-pre-line rounded-lg bg-[#dcf8c6] px-3 py-2 text-[13px] text-surface-900 shadow-sm dark:bg-[#005c4b] dark:text-emerald-50"><b>WhatsApp · {r.name}</b>{"\n"}{r.wa}</div> : null}
                {r.sms ? <div className="max-w-[92%] whitespace-pre-line rounded-lg bg-white px-3 py-2 text-[13px] text-surface-900 shadow-sm dark:bg-[#111a2e] dark:text-slate-100"><b>SMS · {r.name}</b>{"\n"}{r.sms}</div> : null}
              </div>))}
            </div>
          </Panel>
          <Panel title={L.bc_cost}>
            <table className="w-full" data-testid="cost"><tbody>
              <tr><td className={TD}>WhatsApp × {preview.cost.waCount}</td><td className={TD}>${preview.cost.waUsd.toFixed(2)}</td></tr>
              <tr><td className={TD}>SMS × {preview.cost.smsCount} ({preview.cost.smsSegments} {L.bc_segments})</td><td className={TD}>{preview.cost.smsUsd == null ? "TBD" : `$${preview.cost.smsUsd.toFixed(2)}`}</td></tr>
              <tr><td className={`${TD} font-semibold`}>Total</td><td className={`${TD} font-semibold`}>{preview.cost.totalUsd == null ? `$${preview.cost.waUsd.toFixed(2)} + SMS TBD` : `$${preview.cost.totalUsd.toFixed(2)}`}</td></tr>
            </tbody></table>
            <p className="mt-1 text-[11px] text-surface-500 dark:text-slate-400">{preview.cost.note}</p>
            {preview.errors.length ? <div className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{preview.errors.join(" · ")}</div> : null}
            <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-900 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200">{L.bc_self_note}</div>
            <div className="mt-auto flex justify-between pt-3"><button type="button" className={BTN_O} onClick={() => setStep(1)}>← {L.bc_back}</button>
              <button type="button" className={BTN} onClick={doSubmit} disabled={pending || preview.errors.length > 0 || preview.count === 0} data-testid="submit-approval">{L.bc_submit} ✓</button></div>
          </Panel>
        </div>)}
    </div>
  );
}
