-- 712 rollback. Tables aur feature hataata hai. Party rows (dealers/buyers/...) nahi.

delete from public.dashboard_features where feature_key = 'hr.party-invite';
delete from public.role_feature_permissions where feature_key = 'hr.party-invite';
delete from public.feature_help where feature_key = 'hr.party-invite';
delete from public.features where key = 'hr.party-invite';

drop function if exists public.fn_party_invite_phone_taken(text);
drop table if exists public.party_invite_sends;
drop table if exists public.party_invite_accounts;
