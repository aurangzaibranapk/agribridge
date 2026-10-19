// 579: live user_role enum has no 'cashier'/'accountant'; role checks must compare as text.
const fs=require("fs"),assert=require("assert");
const s=fs.readFileSync("supabase/migrations/579_customer_portal_role_enum_fix.sql","utf8");
assert(/function public\.fn_cp_staff_can\(/.test(s)&&/function public\.fn_admin_customer_portal\(/.test(s),"both functions redefined");
assert(!/p\.role in \(/.test(s),"p.role must be cast to text");
assert(!/'accountant'\]::public\.user_role\[\]/.test(s),"no enum array cast with non-enum roles");
console.log("customer-portal-role-enum: ok");
