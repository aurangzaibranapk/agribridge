-- 723 rollback: naya feature hatao, payroll aur fuel ki purani madad wapas.
-- Koi table nahi girti. Koi raqam nahi badalti.

delete from public.dashboard_features where feature_key = 'finance.ops-cards';
delete from public.role_feature_permissions where feature_key = 'finance.ops-cards';
delete from public.feature_help where feature_key = 'finance.ops-cards';
delete from public.features where key = 'finance.ops-cards';

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
('hr.payroll', 'rm',
 'Mahine ki tankhwah ek sath: approved structure + hazri se ghair-hazri kattauti (basic / 30 x din, half day aadha) + advance qist. Overtime nahi.',
 'HR/Finance banate hain; Admin ya Owner manzoor aur ada karte hain.',
 'Mahina khatam hone par, hazri band karne ke baad.',
 array['Mahina aur branch chunein, "Hisaab chalayein".','Grid check karein -- hazri ke din, kattauti, qist, net.','"Manzoori ke liye bhejein".','Admin/Owner "Manzoor" -- journal banta hai (Tankhwahein Dr / Tankhwah baqi Cr).','"Ada karein" -- khata chunein; cash/bank se nikasi.'],
 'Payslip staff ko My HR mein nazar aati hai.',
 array['Hazri band kiye baghair run banaya to form par nishan rehta hai.','Banane wala khud manzoor/ada nahi kar sakta.','Structure manzoor na ho to staff run mein nahi aata.']),
('milk-collection.fuel', 'rm',
 'Tel ka hisaab: kis gaari mein kitna tel gaya.',
 'Doodh ka staff.',
 'Har dafa tel daalne par.',
 array['Gaari aur miqdar likhein.','Meter ka adad aur raseed lagayein.'],
 'Fi litre kharche mein yahi raqam jati hai.',
 array['Meter ka adad likhna na bhoolein -- us ke baghair mileage nahi nikalti.'])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  updated_at = now();
