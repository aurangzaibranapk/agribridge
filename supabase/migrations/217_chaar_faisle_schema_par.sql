-- =====================================================================
-- Migration 217: Chaar faisle -- aur teenon ka ek hi usool
-- =====================================================================
-- Malik ke teen faisle alag alag lagte hain magar ek hi baat kehte hain:
-- NISHAN AUR WAJAH DO ALAG CHEEZEIN HAIN.
--
--   "booking mansookh hui"     -- nishan.  Kis ki wajah se? maloom nahi.
--   "raqam badli gayi"          -- nishan.  Ghalti thi ya nayi baat? maloom nahi.
--   "order kisi dukan ka hai"   -- nishan.  Kaunsi dukan? naam hai, pehchan nahi.
--
-- Teenon jagah nishan par faisla dena andaza hai. Is liye teenon jagah
-- WAJAH KA APNA KHANA banaya ja raha hai -- aur jab tak wo khali hai,
-- engine wahan se koi faisla nahi lega.

-- ---------------------------------------------------------------
-- 1) Mansookhi -- kis ki wajah se
-- ---------------------------------------------------------------
-- Abhi tak manfi waqia sirf ye dekh kar banta tha ke status 'cancelled'
-- hai aur machine khet tak pahunch chuki thi. Us mein ye kahin nahi
-- likha ke mansookh kis ne karwayi. Machine kharab ho jaye, mausam
-- kharab ho, vendor na pahunche -- teenon soorton mein nishan KISAN par
-- lag jata.
alter table machinery_bookings
  add column if not exists cancellation_party text;

alter table machinery_bookings drop constraint if exists chk_machinery_cancel_party;
alter table machinery_bookings add constraint chk_machinery_cancel_party
  check (cancellation_party is null or cancellation_party in
    ('farmer', 'company', 'vendor', 'weather', 'other'));

comment on column machinery_bookings.cancellation_party is
  'Mansookhi kis ki wajah se. Khali = maloom nahi -- aur us par kisi par nishan nahi lagta.';

-- ---------------------------------------------------------------
-- 2) Anaj ki adaigi ki durusti -- kyun badli
-- ---------------------------------------------------------------
-- is_edited, original_amount, edited_by aur edited_at pehle se hain --
-- yani "kya badla" aur "kis ne badla" maujood hai. "KYUN BADLA" nahi
-- hai, aur wohi asal sawal hai.
--
-- Durusti jurm nahi hoti. Pehli likhai mein ghalti bhi ho sakti hai aur
-- baat dobara tay bhi ho sakti hai -- dono jaiz. Sawal sirf wahan uthta
-- hai jahan raqam badli aur wajah koi nahi.
alter table grain_procurement_payments
  add column if not exists edit_reason text,
  add column if not exists edit_kind   text,
  add column if not exists edit_approved_by uuid references profiles(id),
  add column if not exists edit_approved_at timestamptz;

alter table grain_procurement_payments drop constraint if exists chk_grain_edit_kind;
alter table grain_procurement_payments add constraint chk_grain_edit_kind
  check (edit_kind is null or edit_kind in ('correction', 'renegotiation', 'unexplained'));

comment on column grain_procurement_payments.edit_kind is
  'correction = pehli likhai mein ghalti thi. renegotiation = baat dobara tay hui. unexplained = wajah nahi di gayi.';

-- ---------------------------------------------------------------
-- 3) Order kis ka hai -- naam nahi, pehchan
-- ---------------------------------------------------------------
-- agri_orders mein customer ka koi rishta hai hi nahi tha; doosri taraf
-- kaun hai ye khule matn se pata chalta tha.
--
-- PURANE ORDER KO NAAM MILA KAR NAHI JOR-A JA RAHA. Ek dafa do dukanein
-- ek ban jayen to us ka pata bhi nahi chalta -- aur us se bana hua score
-- na hone se ziyada khatarnak hai. Purane sab 'unlinked_unknown' rahenge
-- jab tak koi insaan khud na joRe.
alter table agri_orders
  add column if not exists customer_id uuid references customers(id),
  add column if not exists party_link_state text not null default 'unlinked_unknown',
  add column if not exists party_linked_by uuid references profiles(id),
  add column if not exists party_linked_at timestamptz;

alter table agri_orders drop constraint if exists chk_order_party_link;
alter table agri_orders add constraint chk_order_party_link
  check (party_link_state in ('linked', 'unlinked_unknown', 'not_applicable'));

-- Jahan doosri taraf hamari apni shaakh hai, wahan customer ka sawal hi
-- nahi banta.
update agri_orders set party_link_state = 'not_applicable'
 where order_to_type in ('Branch', 'Warehouse') and party_link_state = 'unlinked_unknown';

comment on column agri_orders.party_link_state is
  'linked = pehchan tay ho chuki. unlinked_unknown = naam likha hai magar pehchan nahi -- score isay chhoo-ta bhi nahi.';

create index if not exists idx_agri_orders_customer on agri_orders (customer_id)
  where customer_id is not null;
