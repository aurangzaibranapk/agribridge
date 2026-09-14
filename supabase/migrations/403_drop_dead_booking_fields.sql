-- Hissa A.2 (14 September) -- 9 khane jo kabhi koi form-input nahi
-- rakhte the (grep se poore src/ mein zero UI-reference tasdeeq shuda),
-- is liye har booking par hamesha khali/sifar the.
--
-- `total_area` pehle (wo generated hai, base columns se pehle girana
-- padta hai).

alter table public.machinery_bookings drop column if exists total_area;
alter table public.machinery_bookings drop column if exists total_area_acres;
alter table public.machinery_bookings drop column if exists total_area_kanal;
alter table public.machinery_bookings drop column if exists field_access;
alter table public.machinery_bookings drop column if exists special_instructions;
alter table public.machinery_bookings drop column if exists required_units;
alter table public.machinery_bookings drop column if exists trolley_required;
alter table public.machinery_bookings drop column if exists other_service;
alter table public.machinery_bookings drop column if exists rate_amount;
