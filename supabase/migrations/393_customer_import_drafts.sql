-- Purane khata-app (jaise DigiKhata) se customers import karne ka draft
-- marhala.
--
-- Malik (13 September): "main list bhejta hoon, isko aap draft mein
-- rakhein, final review kar ke koi changing hui to main submit karoon ga."
--
-- Yani seedha customer/ledger nahi banta -- pehle ek "draft" qatar banti
-- hai jo review/edit ho sakti hai, aur asal Customer + ledger entry sirf
-- tab banti hai jab is row par "Submit" dabaya jaye. Ye ek-tarfa raasta
-- hai: submit hone ke baad row wapas pending nahi hoti.

create table if not exists customer_import_drafts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text,
  opening_balance numeric not null default 0,
  note text,
  status text not null default 'pending' check (status in ('pending', 'imported', 'rejected')),
  imported_customer_id uuid references customers(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table customer_import_drafts enable row level security;

-- Sirf admin/owner is ka poora kaam sambhalte hain -- ye ek-dafa ka
-- migration tool hai, staff ki roz ki jagah nahi (feature-level
-- permission is liye nahi banayi gayi).
create policy owners_manage_import_drafts on customer_import_drafts for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'super_admin', 'admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'super_admin', 'admin'))
);
