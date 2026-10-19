const fs = require("fs");
const assert = require("assert");

const server = fs.readFileSync("server.js", "utf8");
const page = fs.readFileSync("public/system-update.html", "utf8");
const pack = fs.readFileSync("scripts/package-cpanel.sh", "utf8");
const verify = fs.readFileSync("scripts/verify-cpanel-runtime.mjs", "utf8");
const htaccess = fs.readFileSync("docs/deploy/maintenance/htaccess-snippet.conf", "utf8");

// server.js (Node chal raha ho) -- purana rasta qaim rahe
assert(server.includes('path.join(__dirname, "maintenance.on")'), "maintenance.on flag missing");
assert(server.includes('path.join(__dirname, "public", "system-update.html")'), "static page hook missing");
assert(server.includes("res.statusCode = 503"), "maintenance response must be 503");
assert(server.includes('res.setHeader("Retry-After", "120")'), "retry header missing");

// Approved design B (Harvest Aurora), 19 Oct 2026
assert(page.includes("Hum system ko behtar bana rahe hain"), "approved headline missing");
assert(page.includes("Aap ka tamam data bilkul mehfooz hai"), "data-safety copy missing");
assert(page.includes("+92 333 1116727") && page.includes("https://wa.me/923331116727"), "WhatsApp/phone missing");
assert(page.includes("tel:+923331116727") && page.includes("mailto:info@alranatraders.pk"), "call/email missing");
assert(/en:\{/.test(page) && /ro:\{/.test(page) && /ur:\{/.test(page), "EN/Roman/Urdu strings missing");
assert(page.includes('root.dir = l==="ur"?"rtl":"ltr"'), "Urdu must switch to RTL");
assert(page.includes("prefers-color-scheme:dark"), "dark mode missing");
assert(page.includes("prefers-reduced-motion:reduce"), "reduced-motion support missing");
assert(page.includes('method:"HEAD"') && page.includes("location.reload()"), "auto check + reload missing");
assert(page.includes("PERIOD=30"), "30 second check missing");
assert(page.includes('http-equiv="refresh" content="30"'), "noscript refresh missing");
assert(page.includes('name="robots" content="noindex,nofollow"'), "noindex missing");

// Self-contained: Node band ho to bhi chale -- koi bahar ki file load na ho
const loads = page.match(/\b(?:src|href)\s*=\s*"[^"]*"/g) || [];
const external = loads.filter((a) => !/="(?:data:|#|tel:|mailto:|https:\/\/wa\.me\/)/.test(a));
assert.deepStrictEqual(external, [], "page must not load external/relative files: " + external.join(", "));
assert(!/@import|url\((?!["']?data:|#|%23)/.test(page), "CSS must not load external files");
assert(!/fetch\("http/.test(page), "only same-origin check allowed");
assert(Buffer.byteLength(page) < 150 * 1024, "page must stay under 150 KB");

// Packaging + verify: Apache copy == Node copy
assert(pack.includes('cp public/system-update.html "$package_dir/ab-maintenance/index.html"'), "package must copy page to ab-maintenance/index.html");
assert(/tar -czf .* ab-maintenance\n/.test(pack), "archive must include ab-maintenance");
assert(pack.includes("node tests/maintenance-copy-verify.cjs"), "copy-verify test not wired into release");
assert(verify.includes("Maintenance page copies differ"), "verify must check identical copies");

// .htaccess snippet guards
assert(htaccess.includes("RewriteRule ^ - [R=503,L]"), "flag rule must answer 503");
assert(htaccess.includes("ab-maintenance/deploy-in-progress.flag -f"), "flag file condition missing");
assert(htaccess.includes("!^/\\.well-known/"), "/.well-known must pass (assetlinks, AutoSSL)");
assert(htaccess.includes("!^/ab-maintenance/"), "page itself must pass");
for (const code of ["403", "404", "500", "502", "503"]) {
  assert(htaccess.includes(`ErrorDocument ${code} /ab-maintenance/index.html`), `ErrorDocument ${code} missing`);
}
assert(htaccess.includes('Retry-After "300"'), "Retry-After for 503 missing");
assert(!/PASSENGER CONFIGURATION BEGIN/.test(htaccess.replace(/^#.*$/gm, "")), "snippet must not contain the cPanel Passenger block");

console.log("PASS: maintenance page B (self-contained, 3 languages, auto-check) + Apache/Node copies + htaccess guards");
