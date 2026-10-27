-- =====================================================================
-- Job vacancy public text — teen zabanein, sirf izafa
-- =====================================================================
-- title / description pehle jaisay rehte hain (fallback).
-- Naye khane khali ho sakte hain. Koi purani row nahi badli jati,
-- koi policy nahi badli. Live ki do khali jagahein ka tarjuma
-- is migration mein NAHI — wo alag manual file hai:
--   supabase/manual/job_vacancy_i18n_live_rows.sql
-- Wo file khud nahi chalti. Backup ke baad owner chalayega.

alter table public.job_vacancies
  add column if not exists title_en text,
  add column if not exists title_ur text,
  add column if not exists title_roman text,
  add column if not exists description_en text,
  add column if not exists description_ur text,
  add column if not exists description_roman text,
  add column if not exists brand text,
  add column if not exists brand_en text,
  add column if not exists brand_ur text,
  add column if not exists brand_roman text;

comment on column public.job_vacancies.title_en is
  'English title. Blank falls back to title_en then title.';
comment on column public.job_vacancies.title_ur is
  'Urdu-script title. Blank falls back to title_en then title.';
comment on column public.job_vacancies.title_roman is
  'Roman Urdu title. Blank falls back to title_en then title.';
comment on column public.job_vacancies.description_en is
  'English description. Blank falls back to description_en then description.';
comment on column public.job_vacancies.description_ur is
  'Urdu-script description. Blank falls back to description_en then description.';
comment on column public.job_vacancies.description_roman is
  'Roman Urdu description. Blank falls back to description_en then description.';
comment on column public.job_vacancies.brand is
  'Optional job brand under AgriBridge. Blank means no public tag.';
comment on column public.job_vacancies.brand_en is
  'English brand tag. Blank falls back to brand_en then brand.';
comment on column public.job_vacancies.brand_ur is
  'Urdu-script brand tag. Blank falls back to brand_en then brand.';
comment on column public.job_vacancies.brand_roman is
  'Roman Urdu brand tag. Blank falls back to brand_en then brand.';
