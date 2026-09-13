-- 153: Kisan ne paisa VENDOR ko de diya
--
-- Maidan ki soorat: kaam khatam, bill Rs 70,000, aur kisan ne wo paisa
-- machine wale ke haath mein rakh diya -- hamare paas aaya hi nahi.
-- Ye maamool hai: kisan ke saamne machine wala khara hota hai, hum
-- nahi.
--
-- Ab tak yahan koi raasta nahi tha. Do ghalat raaste zaroor the:
--
--  1) "Cash mein aa gaya" likh dena -- jhoot. Wo paisa hamare kisi
--     khate mein nahi aaya; cash book us din se ghalat ho jati.
--  2) Kuch na likhna -- to kisan ke zimme wo raqam khari rehti jo wo
--     de chuka hai, aur agle mahine us se dobara maangi jati.
--
-- Aur us ke aage do alag soortein hain, jo hisaab mein bilkul alag
-- hain:
--
--  (a) VENDOR NE RAKH LIYA -- apne hisse mein se. Kisan ka zimma khatam
--      ho gaya, aur hamare zimme jo vendor ka paisa tha wo bhi utna kam
--      ho gaya. Koi cash kahin nahi hila. Agar wo raqam vendor ke apne
--      hisse se BARH jaye, to ab vendor hamara qarzdar hai (commission
--      ka hissa us ke paas chala gaya).
--
--  (b) VENDOR NE HAMEIN DE DIYA -- to do cheezein hui hain: kisan ka
--      zimma khatam, aur hamare paas cash aaya. Ye ek qadam nahi, do
--      hain, aur aksar do alag dinon mein hote hain.
--
-- Is liye qatar mein ye likha jata hai ke paisa kis ne wasool kiya aur
-- us ka kya hua. Method ka naam 'vendor_collected' hai -- 'cash' nahi,
-- kyunke cash ka matlab hamesha ye hona chahiye ke wo hamare khate mein
-- aaya.

alter table public.machinery_payments drop constraint if exists chk_machinery_payment_method;
alter table public.machinery_payments add constraint chk_machinery_payment_method check (
  method in ('cash', 'bank', 'wallet', 'khata', 'other', 'vendor_collected')
);

alter table public.machinery_payments
  add column if not exists collected_by_vendor_id uuid references public.machinery_vendors(id),
  add column if not exists vendor_settlement text;

alter table public.machinery_payments drop constraint if exists chk_vendor_settlement;
alter table public.machinery_payments add constraint chk_vendor_settlement check (
  vendor_settlement is null or vendor_settlement in ('kept', 'handed_over')
);

comment on column public.machinery_payments.collected_by_vendor_id is
  'Kisan ne paisa is vendor ke haath mein diya. Hamare khate mein wo paisa nahi aaya.';
comment on column public.machinery_payments.vendor_settlement is
  'kept = vendor ne apne hisse mein se rakh liya. handed_over = vendor ne hamein de diya.';

-- ---------------------------------------------------------------
-- Guard: vendor wali payment par khata nahi lagta
--
-- Khata ka matlab hai "paisa is khate mein aaya". Yahan wo aaya hi
-- nahi -- vendor ke haath mein gaya. Khata lagane dena cash book ko
-- jhoota kar deta.
-- ---------------------------------------------------------------
create or replace function public.fn_guard_vendor_collected()
returns trigger
language plpgsql
as $$
begin
  if new.method = 'vendor_collected' then
    if new.collected_by_vendor_id is null then
      raise exception 'Batayein ke paisa kis vendor ne wasool kiya.';
    end if;
    if new.vendor_settlement is null then
      raise exception 'Batayein ke vendor ne wo paisa apne hisse mein rakha ya hamein de diya.';
    end if;
    if new.finance_account_id is not null then
      raise exception 'Vendor ke haath gaya hua paisa kisi khate mein nahi aaya -- khata na lagayein.';
    end if;
  elsif new.collected_by_vendor_id is not null or new.vendor_settlement is not null then
    raise exception 'Vendor ka khana sirf us payment par lagta hai jo vendor ne wasool ki ho.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_vendor_collected on public.machinery_payments;
create trigger trg_guard_vendor_collected
  before insert or update on public.machinery_payments
  for each row execute function public.fn_guard_vendor_collected();

-- 116 ka purana guard kehta tha: khata ke ilawa har payment par khata
-- lazmi. vendor_collected us se bhi mustasna hai -- wahan khata hai hi
-- nahi.
alter table public.machinery_payments drop constraint if exists chk_machinery_payment_account;
alter table public.machinery_payments add constraint chk_machinery_payment_account check (
  method in ('khata', 'vendor_collected')
  or verification_status <> 'verified'
  or finance_account_id is not null
);

-- ---------------------------------------------------------------
-- Jaanch: vendor ke paas para hua hamara paisa
--
-- Jo raqam vendor ne wasool ki aur "hamein de dunga" kaha, magar abhi
-- tak di nahi. Ye us ke apne hisse se alag cheez hai -- ye hamara paisa
-- hai jo us ke paas para hai.
-- ---------------------------------------------------------------
create or replace view public.v_vendor_holding_our_cash as
select
  v.id            as vendor_id,
  v.vendor_name,
  v.phone,
  sum(p.amount)   as vendor_ke_paas,
  min(p.payment_date) as sab se purani,
  count(*)        as kitni_payments
from public.machinery_payments p
join public.machinery_vendors v on v.id = p.collected_by_vendor_id
where p.method = 'vendor_collected'
  and p.vendor_settlement = 'handed_over'
  and p.finance_account_id is null
  and fn_is_any_staff()
group by v.id, v.vendor_name, v.phone;

revoke all on public.v_vendor_holding_our_cash from anon;
grant select on public.v_vendor_holding_our_cash to authenticated, service_role;

comment on view public.v_vendor_holding_our_cash is
  'Jo paisa vendor ne kisan se wasool kiya aur hamein dene ka kaha, magar abhi tak hamare khate mein nahi aaya.';
