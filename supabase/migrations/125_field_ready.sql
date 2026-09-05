-- =====================================================================
-- AgriBridge — Migration 125: Khet tayyar hai? Fasal pakk gayi?
-- =====================================================================
-- Booking form par saat khane aise the jo kabhi kisi kaam nahi aaye:
-- pasandeeda waqt, kitni machinein, trolley chahiye, deegar service,
-- khet tak rasai, kattai ki tareekh, aur khaas hidayat. Wo khane form se
-- hata diye gaye (khaane database mein rehne diye -- purani bookings ka
-- likha hua mitana theek nahi).
--
-- Un ki jagah do sawal aaye hain, aur ye do isi liye hain ke inhi ka
-- jawab na hone se machine khali jati hai:
--
--   khet tayyar hai?   -- paani khara ho ya pichli fasal ka rehna baqi
--                         ho to machine wapas aa jati hai
--   fasal pakk gayi?   -- kachi fasal par harvester bhejna nuqsan hai
--
-- Dono ka jawab HAAN/NAHI/PATA NAHI hai, aur teesra jaan boojh kar hai:
-- booking aksar hafta pehle hoti hai, us waqt "pata nahi" hi sach hota
-- hai. Usay majboori se "haan" likhwana jhoot ko record bana deta hai.
-- =====================================================================

alter table machinery_bookings
  add column if not exists field_ready text,
  add column if not exists harvest_ready text;

alter table machinery_bookings drop constraint if exists machinery_bookings_field_ready_check;
alter table machinery_bookings add constraint machinery_bookings_field_ready_check
  check (field_ready is null or field_ready in ('yes', 'no', 'unknown'));

alter table machinery_bookings drop constraint if exists machinery_bookings_harvest_ready_check;
alter table machinery_bookings add constraint machinery_bookings_harvest_ready_check
  check (harvest_ready is null or harvest_ready in ('yes', 'no', 'unknown'));

alter table machinery_requests
  add column if not exists field_ready text,
  add column if not exists harvest_ready text;

alter table machinery_requests drop constraint if exists machinery_requests_field_ready_check;
alter table machinery_requests add constraint machinery_requests_field_ready_check
  check (field_ready is null or field_ready in ('yes', 'no', 'unknown'));

alter table machinery_requests drop constraint if exists machinery_requests_harvest_ready_check;
alter table machinery_requests add constraint machinery_requests_harvest_ready_check
  check (harvest_ready is null or harvest_ready in ('yes', 'no', 'unknown'));

comment on column machinery_bookings.field_ready is
  'yes / no / unknown -- booking ke waqt khet machine ke liye tayyar hai ya nahi.';
comment on column machinery_bookings.harvest_ready is
  'yes / no / unknown -- fasal kattai ke qabil hai ya nahi.';
