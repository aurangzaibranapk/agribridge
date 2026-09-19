-- =====================================================================
-- AgriBridge — Migration 426: notifications bhi Realtime publication mein
-- =====================================================================
-- Malik: Staff Sales Desk (Load/Bill/Udhaar/Recovery) transaction save
-- hote hi staff ke apne dashboard (ghanti + Mera Kaam) par foran nazar
-- aana chahiye -- "10 din baad pata chale" wala usool yahan bhi (353)
-- lagta hai.
--
-- `notifications` table pehle se hai (290), aur us par apna RLS bhi hai
-- (`own_notifications`: sirf apna recipient_user_id). Magar wo
-- `supabase_realtime` publication mein nahi thi -- Ghanti (notification-
-- bell.tsx) sirf 45 second ke polling se chalti thi, live push nahi.
--
-- Testing (`hwaiuwxqldxsoukkfefn`) par ye pehle hi kisi aur zariye se
-- ho chuka mila (dusri jagah is par kaam hua tha) -- is liye "already
-- in publication" check zaroori hai, warna `alter publication ... add`
-- dobara chalane par ghalti deta hai.
do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
     where p.pubname = 'supabase_realtime' and n.nspname = 'public' and c.relname = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
