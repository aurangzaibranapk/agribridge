const fs = require("fs");
const assert = require("assert");
const s = fs.readFileSync("src/components/call-center/shell.tsx", "utf8");
assert(s.includes('ERP_HOME = "/admin/my-work"'), "ERP_HOME");
assert(s.includes('data-testid="cc-back-erp"'), "top back button");
assert(!/<Link[^>]*href="\/admin\/my-work"/.test(s), "no client Link to my-work");
const top = s.indexOf("cc-back-erp"), nav = s.indexOf("<nav");
assert(top > 0 && top < nav, "back button above nav");
console.log("call-center-back-erp OK");
