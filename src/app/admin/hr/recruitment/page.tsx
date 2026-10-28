import { createClient } from "@/lib/supabase/server";
import { addCandidate, moveStage } from "@/actions/hr-kpi";
import { STAGE_STATUS } from "@/lib/hr-kpi/core";
import { BLOOD_GROUPS, staffGenderOrNull } from "@/lib/jobs/apply-input";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { Flash, Field, HrSubHeader, NoAccess, btnCls, cardCls, inputCls, requireHr } from "@/components/hr-kpi/hr-form-bits";

export const dynamic = "force-dynamic";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

const STAGE_LABEL: Record<string, string> = { applied: "Applied", screened: "Screened", interview: "Interview", offer: "Offer", hired: "Hired", rejected: "Rejected" };
function stageOf(status: string): string {
  const hit = Object.entries(STAGE_STATUS).find(([, s]) => s === status);
  if (hit) return hit[0];
  if (status === "under_review") return "applied";
  if (status === "scored") return "interview";
  if (status === "accepted") return "offer";
  if (status === "not_eligible") return "rejected";
  return "applied";
}

export default async function RecruitmentPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  if (!(await requireHr())) return <NoAccess />;
  const lang = getLanguageFromCookies("rm");
  const db = createClient() as unknown as Db;
  const vacQ = await db.from("job_vacancies").select("id,title,is_open").order("created_at", { ascending: false });
  let appQ = await db.from("job_applications").select("id,full_name,phone,status,created_at,hired_at,vacancy_id,gender").order("created_at", { ascending: false }).limit(200);
  if (appQ.error && /gender/i.test(String(appQ.error.message ?? ""))) {
    appQ = await db.from("job_applications").select("id,full_name,phone,status,created_at,hired_at,vacancy_id").order("created_at", { ascending: false }).limit(200);
  }
  const vac = vacQ.data;
  const data = appQ.data;
  const vacs = (vac ?? []) as { id: string; title: string; is_open: boolean }[];
  const vt = new Map(vacs.map((v) => [v.id, v.title]));
  const rows = (data ?? []) as { id: string; full_name: string; phone: string | null; status: string; created_at: string; hired_at: string | null; vacancy_id: string; gender?: string | null }[];
  const genderLabel = (value: string | null | undefined) => {
    const gender = staffGenderOrNull(value);
    if (gender === "male") return "Male";
    if (gender === "female") return "Female";
    if (gender === "other") return "Other";
    return "—";
  };
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <HrSubHeader title="Recruitment" sub="Candidate darj karein aur marhala badlein: Applied → Screened → Interview → Offer → Hired. Tareekhen khud lagti hain (time to hire)." />
      <Flash sp={searchParams} />
      {vacs.length ? (
        <form action={addCandidate} className={`${cardCls} grid gap-3 sm:grid-cols-4`}>
          <Field label="Vacancy"><select name="vacancy_id" required className={inputCls}>{vacs.map((v) => <option key={v.id} value={v.id}>{v.title}{v.is_open ? "" : " (band)"}</option>)}</select></Field>
          <Field label="Naam"><input name="full_name" required minLength={2} className={inputCls} /></Field>
          <Field label="Email"><input type="email" name="email" required className={inputCls} /></Field>
          <Field label="Mobile"><input name="phone" className={inputCls} /></Field>
          <Field label={t("sp_cnic_number", lang)}><input name="cnic" className={inputCls} /></Field>
          <Field label="Gender">
            <select name="gender" className={inputCls}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label={t("sp_blood_group", lang)}>
            <select name="blood_group" className={inputCls} defaultValue="">
              <option value="">{t("sp_blood_unknown", lang)}</option>
              {BLOOD_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </Field>
          <Field label={t("sp_emergency_name", lang)}><input name="emergency_contact_name" className={inputCls} /></Field>
          <Field label={t("sp_emergency_phone", lang)}><input name="emergency_contact_phone" className={inputCls} /></Field>
          <div className="sm:col-span-4"><button className={btnCls}>Candidate darj karein</button></div>
        </form>
      ) : <p className={`${cardCls} text-sm text-surface-500`}>Pehle <a className="text-brand-700 underline" href="/admin/job-applications">Careers</a> mein vacancy banayein.</p>}
      <div className={cardCls}>
        {rows.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-surface-500"><th>Tareekh</th><th>Naam</th><th>Gender</th><th>Vacancy</th><th>Marhala</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-surface-100 dark:border-surface-800">
                  <td className="py-1.5">{r.created_at.slice(0, 10)}</td><td><a className="font-medium text-brand-700 hover:underline dark:text-brand-300" href={`/admin/hr/recruitment/${r.id}`}>{r.full_name}</a></td><td>{genderLabel(r.gender)}</td><td>{vt.get(r.vacancy_id) ?? "—"}</td>
                  <td>
                    <form action={moveStage} className="flex gap-1">
                      <input type="hidden" name="id" value={r.id} />
                      <select name="stage" defaultValue={stageOf(r.status)} className="rounded border border-surface-200 px-1 py-0.5 text-xs dark:border-surface-700 dark:bg-surface-900">
                        {Object.keys(STAGE_STATUS).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                      </select>
                      <button className="rounded bg-surface-200 px-2 text-xs dark:bg-surface-700">Badlein</button>
                    </form>
                  </td>
                  <td><a className="text-xs font-semibold text-green-700 hover:underline" href={`/admin/hr/recruitment/${r.id}`}>Tankhwah / Offer</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="py-6 text-center text-sm text-surface-400">Abhi koi candidate nahi.</p>}
      </div>
    </div>
  );
}
