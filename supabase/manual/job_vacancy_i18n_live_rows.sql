-- =====================================================================
-- MANUAL. Is file ko migration samajh kar mat chalana.
-- supabase/migrations mein nahi hai, is liye khud nahi chalti.
--
-- Live par, backup ki tasdeeq ke BAAD, aur
-- 20261022082729_job_vacancy_public_i18n.sql ke BAAD.
-- Sirf do maujood rows. Insert nahi. title/description (purana matn)
-- nahi chhedta — fallback wahan hi rehta hai.
-- Testing par ye ids na hon to poora kaam ruk jata hai, koi likhai nahi.
-- =====================================================================

begin;

do $$
declare n int;
begin
  select count(*) into n
    from public.job_vacancies
   where id in (
     '4142631f-5e2c-4b77-99b7-07b0ea8d2613',
     'bb95b584-c11b-4c31-a31e-75986f4fcdc4'
   );
  if n <> 2 then
    raise exception 'Expected 2 live vacancy rows, found %. No update was written.', n;
  end if;
end $$;

update public.job_vacancies set
  title_en = $job$Milk Collection Officer (MCO) - Mahanbali$job$,
  title_roman = $job$Doodh Wasooli Afsar (MCO) - Mahanbali$job$,
  title_ur = $job$دودھ وصولی افسر (ایم سی او) — مہانبالی$job$,
  description_en = $job$Work at our Mahanbali milk center: collecting milk from farmers, checking fat/LR, keeping records, and looking after the chiller. Salary: Rs 25,000 per month. Positions: 2.$job$,
  description_roman = $job$Hamare Mahanbali milk center par kaam: kisanon se doodh wasool karna, fat/LR check karna, record rakhna, aur chiller ki dekh bhaal. Tankhwah: Rs 25,000 mahana. Aasamiyan: 2.$job$,
  description_ur = $job$ہمارے مہانبالی دودھ مرکز پر کام: کسانوں سے دودھ وصول کرنا، فیٹ/ایل آر چیک کرنا، ریکارڈ رکھنا، اور چلر کی دیکھ بھال۔ تنخواہ: 25,000 روپے ماہانہ۔ آسامیاں: 2۔$job$
where id = '4142631f-5e2c-4b77-99b7-07b0ea8d2613';

update public.job_vacancies set
  title_en = $job$Milk Collection Officer (MCO) - 157NB$job$,
  title_roman = $job$Doodh Wasooli Afsar (MCO) - 157NB$job$,
  title_ur = $job$دودھ وصولی افسر (ایم سی او) — 157NB$job$,
  description_en = $job$Work at our 157NB milk center: collecting milk from farmers, checking fat/LR, keeping records, and looking after the chiller. Salary: Rs 25,000 per month. Positions: 1.$job$,
  description_roman = $job$Hamare 157NB milk center par kaam: kisanon se doodh wasool karna, fat/LR check karna, record rakhna, aur chiller ki dekh bhaal. Tankhwah: Rs 25,000 mahana. Aasamiyan: 1.$job$,
  description_ur = $job$ہمارے 157NB دودھ مرکز پر کام: کسانوں سے دودھ وصول کرنا، فیٹ/ایل آر چیک کرنا، ریکارڈ رکھنا، اور چلر کی دیکھ بھال۔ تنخواہ: 25,000 روپے ماہانہ۔ آسامیاں: 1۔$job$
where id = 'bb95b584-c11b-4c31-a31e-75986f4fcdc4';

commit;
