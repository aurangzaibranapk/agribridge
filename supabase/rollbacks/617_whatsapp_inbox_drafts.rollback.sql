-- Rollback 617. Bane hue drafts purane tables mein rehte hain (approval qatar ka hissa) -- un ko NAHI mitata.
drop trigger if exists trg_wa_inbox_guard_demand on public.farmer_product_demands;
drop trigger if exists trg_wa_inbox_guard_submission on public.whatsapp_submissions;
drop function if exists public.fn_wa_inbox_guard_demand();
drop function if exists public.fn_wa_inbox_guard_submission();
drop function if exists public.fn_wa_inbox_link(uuid,text,uuid);
drop function if exists public.fn_wa_inbox_create_draft(uuid,text,jsonb);
drop function if exists public.fn_wa_inbox_next_submission_number();
drop table if exists public.wa_inbox_drafts;
