const assert=require("assert");const fs=require("fs");
const sb=fs.readFileSync("src/components/layout/sidebar.tsx","utf8");
assert.ok(!sb.includes("data-pending-legend"),"legend box removed");
assert.ok(!sb.includes("apb_legend_"),"legend keys unused");
assert.ok(sb.includes("<RedBadge")&&sb.includes("<NayaPill")&&sb.includes("<ZeroMark"),"badges still rendered");
console.log("sidebar-no-legend OK");
