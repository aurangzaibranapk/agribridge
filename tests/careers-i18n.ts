import assert from "node:assert/strict";
import fs from "node:fs";
import { applyInputError, readApplyFields } from "../src/lib/jobs/apply-input";
import { LIVE_VACANCY_COPY } from "../src/lib/jobs/vacancy-preview";
import {
  parsePositions,
  parseSalaryAmount,
  presentVacancy,
  vacancyBlurb,
  vacancyLocation,
  vacancyText,
  type VacancySource,
} from "../src/lib/jobs/vacancy-i18n";
import { t } from "../src/lib/i18n/translations";

const EN_MAHAN = "Work at our Mahanbali milk center: collecting milk from farmers, checking fat/LR, keeping records, and looking after the chiller. Salary: Rs 25,000 per month. Positions: 2.";
const EN_157 = "Work at our 157NB milk center: collecting milk from farmers, checking fat/LR, keeping records, and looking after the chiller. Salary: Rs 25,000 per month. Positions: 1.";

const base: VacancySource = { id: "1", title: "Base title", description: "Base text" };

assert.equal(vacancyText(base, "en").title, "Base title");
assert.equal(vacancyText(base, "ur").description, "Base text");
assert.equal(vacancyText({ ...base, title_en: "  ", description_en: "" }, "en").title, "Base title", "blank english is not a title");

const englishOnly: VacancySource = { ...base, title_en: "English title", description_en: "English text" };
assert.equal(vacancyText(englishOnly, "en").title, "English title");
assert.equal(vacancyText(englishOnly, "ur").title, "English title", "urdu falls back to english");
assert.equal(vacancyText(englishOnly, "rm").description, "English text");

const all: VacancySource = {
  ...englishOnly,
  title_ur: "اردو عنوان",
  title_roman: "Roman unwan",
  description_ur: "اردو متن",
  description_roman: "Roman matn",
};
assert.equal(vacancyText(all, "ur").title, "اردو عنوان");
assert.equal(vacancyText(all, "rm").description, "Roman matn");
assert.equal(vacancyText(all, "en").title, "English title");

assert.equal(parseSalaryAmount(EN_MAHAN), "25,000");
assert.equal(parseSalaryAmount("Tankhwah: Rs 25,000 mahana."), "25,000");
assert.equal(parseSalaryAmount("تنخواہ: 25,000 روپے ماہانہ۔"), "25,000");
assert.equal(parseSalaryAmount("Salary: Rs 0 per month."), null, "sifar tankhwah card par nahi");
assert.equal(parseSalaryAmount("No pay mentioned"), null);
assert.equal(parseSalaryAmount(null), null);

assert.equal(parsePositions("Positions: 2."), 2);
assert.equal(parsePositions("Aasamiyan: 1."), 1);
assert.equal(parsePositions("آسامیاں: 2۔"), 2);
assert.equal(parsePositions("Positions: 0"), null);
assert.equal(parsePositions("no seats"), null);

assert.equal(vacancyLocation("Milk Collection Officer (MCO) - Mahanbali", null), "Mahanbali");
assert.equal(vacancyLocation("دودھ وصولی افسر (ایم سی او) — مہانبالی", null), "مہانبالی");
assert.equal(vacancyLocation("Milk Collection Officer (MCO) - 157NB", "Shop 4"), "Shop 4");
assert.equal(vacancyLocation("Receptionist", null), null);

assert.equal(
  vacancyBlurb(EN_MAHAN),
  "Work at our Mahanbali milk center: collecting milk from farmers, checking fat/LR, keeping records, and looking after the chiller.",
);
assert.doesNotMatch(vacancyBlurb("تنخواہ: 25,000 روپے ماہانہ۔ آسامیاں: 2۔ کام۔") ?? "", /تنخواہ|آسامیاں/);

const [mahan, nb] = LIVE_VACANCY_COPY;
for (const lang of ["en", "rm", "ur"] as const) {
  const card = presentVacancy(mahan, lang);
  assert.equal(card.salary, "25,000");
  assert.equal(card.positions, 2);
  assert.equal(card.location, lang === "ur" ? "مہانبالی" : "Mahanbali");
  assert.ok(card.blurb && !/Salary|Tankhwah|تنخواہ|Positions|Aasamiyan|آسامیاں/.test(card.blurb));
}
assert.equal(presentVacancy(base, "en").brand, null, "brand khali ho to tag nahi, AgriBridge ghalat tor par nahi");
assert.equal(presentVacancy({ ...base, brand: "  " }, "en").brand, null);
assert.equal(presentVacancy({ ...base, brand: "Future Brand" }, "ur").brand, "Future Brand");
assert.equal(presentVacancy({ ...base, brand: "Future Brand", brand_ur: "آئندہ برانڈ" }, "ur").brand, "آئندہ برانڈ");
assert.equal(presentVacancy(mahan, "en").brand, null);
assert.equal(presentVacancy(mahan, "ur").brand, null);
assert.equal(presentVacancy({ ...base, brand: "Al Rana Traders", brand_ur: "الرانا ٹریڈرز" }, "ur").brand, null);
assert.equal(presentVacancy(mahan, "en").title, "Milk Collection Officer (MCO) - Mahanbali");
assert.equal(presentVacancy(nb, "en").title, "Milk Collection Officer (MCO) - 157NB");
assert.equal(presentVacancy(nb, "en").positions, 1);
assert.match(presentVacancy(nb, "en").blurb ?? "", /157NB milk center/);
assert.equal(presentVacancy(mahan, "rm").title, mahan.title_roman);
assert.equal(presentVacancy(nb, "ur").title, nb.title_ur);
assert.equal(presentVacancy({ ...base, description: "Positions: 0", seats_total: 4 }, "en").positions, 4);
assert.equal(presentVacancy({ ...base, description_en: "Positions: 2.", seats_total: 1 }, "en").positions, 2);

assert.equal(mahan.description_en, EN_MAHAN);
assert.equal(nb.description_en, EN_157);

const romanKept: Record<string, string> = {
  sp_basic_info: "Buniyadi maloomat",
  sp_full_name: "Poora naam",
  sp_email: "Email",
  sp_phone: "Phone",
  sp_cnic_number: "Shanakhti card number",
  sp_address: "Pata",
  sp_expected_salary: "Tawaqqo ki tankhwah (Rs.)",
  sp_exp_qual: "Tajurba aur taleem",
  sp_qualification: "Taleem (misal: BSc Agriculture, 2022)",
  sp_past_work: "Pichla kaam / tajurba (kahan kaam kiya, kitna arsa)",
  sp_about_you: "Apne bare mein thora batayein (marzi se)",
  sp_documents: "Kaghazat",
  sp_cnic_front: "Shanakhti card — saamne",
  sp_cnic_back: "Shanakhti card — peeche",
  sp_qual_cert: "Taleem ka certificate",
  sp_exp_cert: "Tajurbe ka certificate (agar ho)",
  sp_cv: "CV / Resume (agar ho)",
  sp_apply: "Darkhwast dein",
  sp_cancel: "Rehne dein",
};
for (const [key, roman] of Object.entries(romanKept)) {
  assert.equal(t(key as "sp_apply", "rm"), roman, key);
}

const english: Record<string, string> = {
  sp_basic_info: "Basic information",
  sp_full_name: "Full name",
  sp_email: "Email",
  sp_phone: "Phone",
  sp_cnic_number: "CNIC number",
  sp_address: "Address",
  sp_expected_salary: "Expected salary (Rs.)",
  sp_exp_qual: "Experience & education",
  sp_qualification: "Education (e.g. BSc Agriculture, 2022)",
  sp_past_work: "Previous work / experience (where and how long)",
  sp_about_you: "Tell us about yourself (optional)",
  sp_documents: "Documents",
  sp_cnic_front: "CNIC front",
  sp_cnic_back: "CNIC back",
  sp_qual_cert: "Education certificate",
  sp_exp_cert: "Experience certificate",
  sp_cv: "CV / resume",
  sp_apply: "Apply Now",
  sp_submit: "Submit",
};
for (const [key, value] of Object.entries(english)) assert.equal(t(key as "sp_apply", "en"), value, key);

assert.equal(t("sp_careers_title", "en"), "Careers at AgriBridge");
assert.equal(t("sp_careers_title", "rm"), "AgriBridge mein naukri");
assert.equal(t("sp_careers_title", "ur"), "AgriBridge میں نوکری");
assert.equal(t("sp_careers_company", "en"), "AgriBridge");
assert.equal(t("sp_careers_company", "rm"), "AgriBridge");
assert.equal(t("sp_careers_company", "ur"), "AgriBridge");
assert.equal(t("sp_careers_tagline", "en"), "The farmer's bridge");
assert.equal(t("sp_careers_tagline", "rm"), "Kisan ka Wasela");
assert.equal(t("sp_careers_tagline", "ur"), "کسان کا وسیلہ");
assert.equal(t("sp_careers_title", "en").startsWith("Careers at AgriBridge"), true);
assert.equal(t("sp_careers_title", "en").includes("Al Rana"), false);

const uiKeys = [
  "sp_careers_title", "sp_careers_tagline", "sp_careers_company", "sp_careers_lead", "sp_no_vacancy", "sp_apply", "sp_salary", "sp_currency",
  "sp_positions", "sp_per_month", "sp_job_location", "sp_apply_for", "sp_close", "sp_basic_info",
  "sp_full_name", "sp_email", "sp_phone", "sp_cnic_number", "sp_address", "sp_expected_salary",
  "sp_exp_qual", "sp_qualification", "sp_past_work", "sp_about_you", "sp_documents", "sp_cnic_front",
  "sp_cnic_back", "sp_qual_cert", "sp_exp_cert", "sp_cv", "sp_drop_or_browse", "sp_file_ready",
  "sp_clear_file", "sp_cancel", "sp_submit", "sp_submitting", "sp_step_basic", "sp_step_experience",
  "sp_step_documents", "sp_next", "c_back", "sp_apply_required", "sp_apply_failed", "sp_application_received",
] as const;
for (const key of uiKeys) {
  for (const lang of ["en", "rm", "ur"] as const) {
    const value = t(key, lang);
    assert.ok(value && value !== key && !value.includes("{brand}") && !value.includes("{tagline}"), `${key}/${lang}`);
  }
  const ur = t(key, "ur");
  if (ur !== "AgriBridge") assert.match(ur, /[\u0600-\u06FF]/, `${key} urdu script`);
}

const bag = (entries: Record<string, string>) => ({ get: (name: string) => entries[name] ?? null });
assert.equal(applyInputError(readApplyFields(bag({}))), t("sp_apply_required", "en"));
assert.equal(applyInputError(readApplyFields(bag({ ui_lang: "ur", full_name: "Ali" }))), t("sp_apply_required", "ur"));
assert.equal(applyInputError(readApplyFields(bag({
  ui_lang: "rm", vacancy_id: "v", full_name: "Ali", email: "a@b.c",
}))), null);

const manual = fs.readFileSync("supabase/manual/job_vacancy_i18n_live_rows.sql", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261022082729_job_vacancy_public_i18n.sql", "utf8");
assert.equal(fs.existsSync("supabase/migrations/job_vacancy_i18n_live_rows.sql"), false);
for (const row of LIVE_VACANCY_COPY) {
  assert.ok(manual.includes(row.id));
  for (const value of [row.title_en, row.title_roman, row.title_ur, row.description_en, row.description_roman, row.description_ur]) {
    assert.ok(value && manual.includes(value), value?.slice(0, 40));
  }
  assert.equal(row.brand ?? null, null);
  assert.equal(migration.includes(row.id), false, "migration must not write live rows");
}
assert.match(manual, /do not|MANUAL|khud nahi/i);
assert.match(migration, /title_en/);
assert.match(migration, /description_roman/);
assert.doesNotMatch(migration, /update\s+public\.job_vacancies/i);

console.log("careers i18n ok");
