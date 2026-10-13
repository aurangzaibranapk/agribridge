const fs = require("fs");
const assert = require("assert");

const server = fs.readFileSync("server.js", "utf8");
const page = fs.readFileSync("public/system-update.html", "utf8");

assert(server.includes('path.join(__dirname, "maintenance.on")'), "maintenance.on flag missing");
assert(server.includes('path.join(__dirname, "public", "system-update.html")'), "static page hook missing");
assert(server.includes('res.statusCode = 503'), "maintenance response must be 503");
assert(server.includes('res.setHeader("Retry-After", "120")'), "retry header missing");
assert(page.includes("System Update Jaari Hai"), "approved heading missing");
assert(page.includes("Aap ka tamam data bilkul mehfooz hai."), "data-safety copy missing");
assert(page.includes("Nayi entries temporarily band hain"), "entry-lock copy missing");
assert(page.includes("Dobara Check Karein"), "retry action missing");
assert(page.includes("WhatsApp Support"), "support action missing");
assert(page.includes('content="#0b6b45"'), "AgriBridge theme color missing");

console.log("PASS: cPanel File Manager maintenance flag and approved responsive screen");
