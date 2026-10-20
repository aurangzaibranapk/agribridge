-- Rollback 620: sirf WhatsApp Inbox ka sidebar link hatata hai (chats/data ko haath nahi lagta).
delete from public.user_feature_permissions where feature_key = 'whatsapp-inbox';
delete from public.dashboard_features where dashboard_key = 'admin' and feature_key = 'whatsapp-inbox';
delete from public.features where key = 'whatsapp-inbox';
