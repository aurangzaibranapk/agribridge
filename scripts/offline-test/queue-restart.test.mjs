import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const DIR = process.argv[2];
const PORT = 8099;

// Asli origin chahiye -- IndexedDB file:// par nahi chalti, aur "app
// band kar ke dobara kholna" bhi tabhi asal lagta hai jab origin wohi
// rahe.
const server = http.createServer((req, res) => {
  const f = path.join(DIR, req.url === "/" ? "page.html" : req.url.slice(1));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : "text/html" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

const results = [];
const check = (n, test, tawaqqo, waqai, pass) =>
  results.push({ n, test, tawaqqo, waqai: String(waqai), natija: pass ? "PASS" : "FAIL" });

// Ek hi "phone" -- yani ek hi disk par baithi hui profile. Context band
// kar ke dobara kholna app band kar ke kholne ke barabar hai; profile
// disk par rehti hai, bilkul phone restart ki tarah.
const profile = path.join(DIR, "phone-profile");
fs.rmSync(profile, { recursive: true, force: true });

// ---------- 1. KHET MEIN: internet band, entry + tasveer ----------
let ctx = await chromium.launchPersistentContext(profile, {
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
let page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/`);
await ctx.setOffline(true);

const saved = await page.evaluate(async () => {
  // 2 MB ki "tasveer" -- phone ki asal tasveer isi qism ki hoti hai.
  const big = new Blob([new Uint8Array(2 * 1024 * 1024)], { type: "image/jpeg" });
  const id = await window.Q.enqueue({
    actionType: "machinery.work",
    entityType: "machinery_work_records",
    payload: { booking_id: "BK-1", actual_area_acres: 5, is_final: true },
    evidence: [{ blob: big, slot: "completion_photo" }],
  });
  const q = await window.Q.allActions();
  const shots = await window.Q.evidenceFor(id);
  return { id, count: q.length, status: q[0].sync_status, shots: shots.length, size: shots[0]?.blob.size ?? 0,
           device: q[0].device_id };
});
check("1", "Internet band -- entry mehfooz", "1 qatar, pending", `${saved.count} qatar, ${saved.status}`,
  saved.count === 1 && saved.status === "pending");
check("2", "Tasveer bhi mehfooz (2 MB)", "1 tasveer, 2097152 b", `${saved.shots} tasveer, ${saved.size} b`,
  saved.shots === 1 && saved.size === 2 * 1024 * 1024);

// ---------- 2. APP BAND -> PHONE RESTART ----------
await ctx.close();
await new Promise((r) => setTimeout(r, 300));

ctx = await chromium.launchPersistentContext(profile, {
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});
page = await ctx.newPage();
// Safha pehle khulta hai (asal app service worker ke cache se khulta
// hai), phir signal jata hai -- wohi tarteeb jo khet mein hoti hai.
await page.goto(`http://localhost:${PORT}/`);
await ctx.setOffline(true);

const after = await page.evaluate(async () => {
  const q = await window.Q.allActions();
  const shots = q.length ? await window.Q.evidenceFor(q[0].client_action_id) : [];
  return { count: q.length, id: q[0]?.client_action_id, status: q[0]?.sync_status,
           shots: shots.length, size: shots[0]?.blob.size ?? 0, device: q[0]?.device_id,
           payload: q[0]?.payload };
});
check("3", "App band + restart ke baad entry", "wohi 1 qatar", `${after.count} qatar`, after.count === 1);
check("4", "Chaabi wohi hai", saved.id.slice(0, 8), (after.id ?? "").slice(0, 8), after.id === saved.id);
check("5", "Tasveer restart ke baad bhi", "2097152 b", `${after.size} b`, after.size === 2 * 1024 * 1024);
check("6", "Device ka nishan wohi", saved.device.slice(0, 8), (after.device ?? "").slice(0, 8),
  after.device === saved.device);
check("7", "Payload salamat", "5 acre", `${after.payload?.actual_area_acres} acre`,
  after.payload?.actual_area_acres === 5);

// ---------- 3. INTERNET AAYA -> SYNC ----------
await ctx.setOffline(false);
const synced = await page.evaluate(async () => {
  // Nakli server: har koshish ginta hai, aur wohi chaabi dobara aaye to
  // "pehle hi aa chuki" kehta hai -- bilkul jaise asal server ka
  // unique index karta hai.
  const seen = new Set();
  window.__hits = [];
  const send = async (a) => {
    window.__hits.push(a.client_action_id);
    if (seen.has(a.client_action_id)) return { duplicate: true };
    seen.add(a.client_action_id);
    return { ok: true };
  };
  const q = await window.Q.allActions();
  for (const a of q) {
    await window.Q.markSyncing(a.client_action_id);
    const shots = await window.Q.evidenceFor(a.client_action_id);
    const r = await send(a, shots);
    if (r.ok || r.duplicate) await window.Q.markSynced(a.client_action_id);
  }
  const left = await window.Q.allActions();
  const leftShots = await window.Q.evidenceFor(window.__hits[0]);
  return { hits: window.__hits.length, unique: new Set(window.__hits).size,
           left: left.length, leftShots: leftShots.length };
});
check("8", "Sync ke baad qatar khali", "0", synced.left, synced.left === 0);
check("9", "Tasveer bhi hat gayi", "0", synced.leftShots, synced.leftShots === 0);
check("10", "Server tak ek hi dafa", "1 alag chaabi", `${synced.unique} alag (${synced.hits} koshish)`,
  synced.unique === 1);

// ---------- 4. DOBARA SYNC -- kuch na jaye ----------
const again = await page.evaluate(async () => {
  window.__hits2 = [];
  const q = await window.Q.allActions();
  for (const a of q) window.__hits2.push(a.client_action_id);
  return { hits: window.__hits2.length, count: q.length };
});
check("11", "Dobara sync par kuch na jaye", "0 koshish", `${again.hits} koshish`, again.hits === 0);

await ctx.close();
server.close();

const pass = results.filter((r) => r.natija === "PASS").length;
console.log(JSON.stringify({ results, jor: `${pass} / ${results.length}` }, null, 1));
process.exit(pass === results.length ? 0 : 1);
