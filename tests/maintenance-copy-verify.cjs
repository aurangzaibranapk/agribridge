// verify.mjs ko asal mein chala kar dekhta hai ke maintenance safhe ki dono
// copies (Node: public/system-update.html, Apache: ab-maintenance/index.html)
// barabar hon to VERIFIED, aur farq ho to release ruk jaye.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const assert = require("assert");
const { spawnSync } = require("child_process");

const verify = path.resolve("scripts/verify-cpanel-runtime.mjs");
const page = fs.readFileSync("public/system-update.html");

function stage(apacheCopy) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ab-maint-"));
  const files = { "public/system-update.html": page, "ab-maintenance/index.html": apacheCopy, ".next/BUILD_ID": Buffer.from("test") };
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  const manifest = { version: 1, commit: "test", buildId: "test", routes: [], files: Object.entries(files).map(([p, b]) => ({ path: p, bytes: b.length, sha256: crypto.createHash("sha256").update(b).digest("hex") })) };
  fs.mkdirSync(path.join(dir, ".release"));
  fs.writeFileSync(path.join(dir, ".release/manifest.json"), JSON.stringify(manifest));
  return dir;
}
const run = (dir, env = {}) => spawnSync(process.execPath, [verify, dir], { encoding: "utf8", env: { ...process.env, ...env } });

const good = stage(page);
let r = run(good);
assert.strictEqual(r.status, 0, r.stderr);
assert(/VERIFIED .*maintenance page copies identical/.test(r.stdout), r.stdout);

const bad = stage(Buffer.from("<html>purana safha</html>"));
r = run(bad);
assert.notStrictEqual(r.status, 0, "different copies must fail");
assert(/Maintenance page copies differ/.test(r.stderr), r.stderr);

// AB_DOCROOT: purani docroot copy par sirf warning, release nahi rukti
const docroot = fs.mkdtempSync(path.join(os.tmpdir(), "ab-docroot-"));
fs.mkdirSync(path.join(docroot, "ab-maintenance"));
fs.writeFileSync(path.join(docroot, "ab-maintenance/index.html"), "old");
r = run(good, { AB_DOCROOT: docroot });
assert.strictEqual(r.status, 0, r.stderr);
assert(/WARNING: .*purani hai/.test(r.stderr), r.stderr);
fs.writeFileSync(path.join(docroot, "ab-maintenance/index.html"), page);
r = run(good, { AB_DOCROOT: docroot });
assert(/document-root copy up to date/.test(r.stdout), r.stdout);

for (const d of [good, bad, docroot]) fs.rmSync(d, { recursive: true, force: true });
console.log("PASS: verify.mjs blocks a release when the Apache and Node maintenance pages differ");
