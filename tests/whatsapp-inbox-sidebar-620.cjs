// 620: WhatsApp Inbox sidebar -- migration additive/idempotent, Broadcast ke saath, fallback menu mein bhi.
const fs = require("fs"); const assert = require("assert");
const sql = fs.readFileSync("supabase/migrations/620_whatsapp_inbox_sidebar.sql", "utf8");
const body = sql.replace(/--.*$/gm, "");
assert(!/\b(update|delete|drop|alter)\b/i.test(body), "620 additive hona chahiye");
assert.strictEqual((body.match(/on conflict/g) || []).length, 2, "dono insert idempotent");
assert(body.includes("'/admin/whatsapp-inbox'") && body.includes("'MessageCircle'") && /'MessageCircle', true, true/.test(body), "route/icon/sensitive");
assert(/'admin', 'whatsapp-inbox', 'Operations', 2, 273/.test(body), "Broadcast (272) ke foran baad");
assert(fs.readFileSync("src/lib/access/icons.ts", "utf8").includes("MessageCircle"), "icon map");
assert(fs.existsSync("supabase/migrations/620_whatsapp_inbox_sidebar.rollback.sql"), "rollback");
const nav = fs.readFileSync("src/components/layout/nav-items.ts", "utf8");
assert(nav.indexOf('href: "/admin/whatsapp-inbox"') > nav.indexOf('href: "/admin/broadcast"'), "fallback menu");
console.log("whatsapp-inbox-sidebar-620: ok");
