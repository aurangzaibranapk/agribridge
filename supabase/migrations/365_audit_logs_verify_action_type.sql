-- 'verify' action_type chahiye (364: kharchaVerify) -- audit_logs is se
-- pehle sirf approve/reject/create/update/delete/login/logout/view janta tha.
alter table audit_logs drop constraint if exists audit_logs_action_type_check;
alter table audit_logs add constraint audit_logs_action_type_check
  check (action_type = any (array['create','update','delete','approve','reject','verify','login','logout','view']));
