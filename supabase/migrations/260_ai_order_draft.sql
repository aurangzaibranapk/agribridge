-- =====================================================================
-- AgriBridge — Migration 260: AI se shop order ka draft
-- =====================================================================
-- Naqshe (docs/AI-PURCHASE-PIPELINE.md) ka qadam G.
--
-- Bridge AI ko ek naya tool milta hai: draft_shop_order -- "Mahabali ke
-- liye DAP 20, Urea 30" -> agri_orders mein DRAFT. AI shop aur product
-- ka naam database se milata hai; jo na mile ya do mil jayen, wahan
-- order nahi banta, wapas poochha jata hai. Draft ordering ki chain
-- (Sales -> Finance -> Manager -> dispatch -> GRN) mein tab jata hai jab
-- koi banda action-requests par manzoor kare. AI khud kabhi 'submitted'
-- nahi karta.
--
-- Is migration mein sirf ek khana: action request se bana hua order.
-- =====================================================================

alter table bridge_ai_action_requests
  add column if not exists created_order_id uuid references agri_orders(id) on delete set null;

create index if not exists idx_ai_action_requests_order
  on bridge_ai_action_requests (created_order_id) where created_order_id is not null;

comment on column bridge_ai_action_requests.created_order_id is
  'AI ka banaya agri_orders draft. Manzoori par submitted, radd par cancelled (260).';
