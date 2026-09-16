-- Staff Dashboard ke Live Notifications ko INSERT hote hi browser tak
-- pohanchane ke liye notifications table Realtime publication mein honi
-- chahiye. RLS pehle se enabled hai aur SELECT sirf recipient_user_id =
-- auth.uid() ko milta hai, is liye har staff ko sirf apni notification
-- receive hoti hai.
do $$
begin
  if not exists (
    select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
     where p.pubname = 'supabase_realtime'
       and n.nspname = 'public'
       and c.relname = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
