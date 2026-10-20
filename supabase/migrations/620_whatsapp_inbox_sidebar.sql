-- 620: WhatsApp Chat Inbox ka sidebar link (malik ki manzoori 20 Oct 2026). ADDITIVE ONLY, idempotent.
-- 599 (Broadcast) wala hi tareeqa: features + dashboard_features. Sensitive: owner/admin/super_admin
-- ko hamesha; staff ko sirf /admin/whatsapp-inbox ki view ijazat par. Page khud WHATSAPP_INBOX=1 ke
-- bagair "band hai" dikhata hai; chats ka scope 614 RLS (fn_wa_inbox_can_see) lagata hai.
insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values ('whatsapp-inbox', 'WhatsApp Inbox', 'WhatsApp Inbox', 'واٹس ایپ ان باکس',
  'WhatsApp ki saari chats, jawab aur assign', 'All WhatsApp chats, replies and assignment', 'واٹس ایپ کی تمام چیٹس، جواب اور اسائن',
  '/admin/whatsapp-inbox', 'MessageCircle', true, true)
on conflict (key) do nothing;
insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values ('admin', 'whatsapp-inbox', 'Operations', 2, 273)
on conflict (dashboard_key, feature_key) do nothing;
