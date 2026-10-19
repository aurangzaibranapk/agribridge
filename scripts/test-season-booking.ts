// Season Booking v2 -- pure function tests (koi DB nahi).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  productsForKind, searchProducts, validateSeasonBooking, buildExportSheets, toCsv, toXlsx, crc32, parseCsv, mapImportRows,
  checkImportRow, normalizePhone, isPkCoord, importTemplateRows, SUMMARY_HEADERS, LINE_HEADERS, type CampaignProductRow, type ExportBooking,
} from "../src/lib/campaigns/season-v2";
import { readXlsxFirstSheet } from "../src/lib/campaigns/xlsx-read";
import { project, unproject, fitView } from "../src/lib/maps/mercator";
import type { LineKind } from "../src/lib/campaigns/booking";

let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; };
const P = (id: string, name: string, line_kind: LineKind | null, category_name = ""): CampaignProductRow => ({ id, name, pack_size: null, unit: null, category_name, line_kind });
const catalog = [P("w", "Wheat Seed (Certified)", "seed", "Field Crop Seeds"), P("m", "Maize Seed (Hybrid)", "seed", "Field Crop Seeds"), P("r", "Rice Seed (Basmati 515)", "seed"),
  P("t", "Tomato Seed", "seed", "Vegetable Seeds"), P("d", "Sona DAP", "fertilizer"), P("u", "Engro Urea", "fertilizer"), P("a", "Atrazine 50% WP", "pesticide"), P("x", "Ariel", null)];

t("beej tab sirf gandum ka beej", () => assert.deepEqual(productsForKind(catalog, "seed", "wheat").map((p) => p.id), ["w"]));
t("khaad/spray sirf apni qisam, detergent kabhi nahi", () => {
  assert.deepEqual(productsForKind(catalog, "fertilizer", "wheat").map((p) => p.id), ["u", "d"]);
  assert.deepEqual(productsForKind(catalog, "pesticide", "wheat").map((p) => p.id), ["a"]);
  assert.ok(!["fertilizer", "pesticide", "seed"].some((k) => productsForKind(catalog, k as LineKind, "wheat").some((p) => p.name === "Ariel")));
});
t("gandum Urdu/Roman naam bhi", () => assert.equal(productsForKind([P("g", "Gandum Beej Akbar", "seed"), P("g2", "گندم بیج", "seed")], "seed", "wheat").length, 2));
t("search", () => { assert.deepEqual(searchProducts(catalog, " urea ").map((p) => p.id), ["u"]); assert.equal(searchProducts(catalog, "").length, catalog.length); });

const cat = new Map<string, LineKind>([["w", "seed"], ["d", "fertilizer"], ["a", "pesticide"]]);
const farm = { name: "Dera", acres: "12", village: "Chak 12", lat: 31.42, lng: 73.08 };
t("valid booking: farms jama, lines merge", () => {
  const v = validateSeasonBooking({ farms: [farm, { name: "Khoh", acres: "8.5" }], lines: [{ kind: "seed", productId: "w", quantity: "10", unit: "bag" }, { kind: "seed", productId: "w", quantity: 2, unit: "bag" }, { kind: "fertilizer", customName: "  Sarsabz   Nitrophos ", quantity: 5, unit: "bag" }] }, { catalog: cat });
  assert.ok(v.ok); if (!v.ok) return;
  assert.equal(v.acres, 20.5); assert.equal(v.farms.length, 2); assert.equal(v.lines.length, 2);
  assert.equal(v.lines[0].quantity, 12); assert.equal(v.lines[1].customName, "Sarsabz Nitrophos"); assert.equal(v.lines[1].productId, null);
  assert.equal(v.farms[1].lat, null);
});
t("sirf gandum", () => {
  const v = validateSeasonBooking({ crop: "rice", farms: [farm], lines: [{ kind: "seed", productId: "w", quantity: 1 }] }, { catalog: cat });
  assert.ok(!v.ok && /Gandum/.test(v.error));
  const v2 = validateSeasonBooking({ crop: "rice", farms: [farm], lines: [{ kind: "seed", productId: "w", quantity: 1 }] }, { catalog: cat, allowedCrops: ["wheat", "rice"] });
  assert.ok(!v2.ok, "allowed_crops mein ho tab bhi abhi sirf wheat");
});
t("ghalat inputs", () => {
  const bad = (farms: any[], lines: any[]) => { const v = validateSeasonBooking({ farms, lines }, { catalog: cat }); assert.ok(!v.ok); return (v as any).error as string; };
  const L = [{ kind: "seed", productId: "w", quantity: 1 }];
  assert.match(bad([], L), /farm/);
  assert.match(bad([{ name: "", acres: 5 }], L), /naam/);
  assert.match(bad([{ name: "A", acres: 0 }], L), /rakba/);
  assert.match(bad([{ name: "A", acres: 1, lat: 31 }], L), /adhoori/);
  assert.match(bad([{ name: "A", acres: 1, lat: 51.5, lng: -0.1 }], L), /bahar/);
  assert.match(bad([{ name: "A", acres: 1 }, { name: "a", acres: 2 }], L), /ek jaisa/);
  assert.match(bad([farm], []), /ek product/);
  assert.match(bad([farm], [{ kind: "seed", productId: "zz", quantity: 1 }]), /catalog/);
  assert.match(bad([farm], [{ kind: "seed", productId: "d", quantity: 1 }]), /khane/);
  assert.match(bad([farm], [{ kind: "seed", customName: "x", quantity: 1 }]), /naam/);
  assert.match(bad([farm], [{ kind: "seed", productId: "w", quantity: -1 }]), /Miqdar/);
  assert.match(bad([farm], [{ kind: "grocery", productId: "w", quantity: 1 }]), /qisam/);
});
t("unit allow-list", () => { const v = validateSeasonBooking({ farms: [farm], lines: [{ kind: "seed", productId: "w", quantity: 1, unit: "<script>" }] }, { catalog: cat }); assert.ok(v.ok && v.lines[0].unit === "bag"); });
t("pk coords", () => { assert.ok(isPkCoord(31.4, 73.1)); assert.ok(!isPkCoord(0, 0)); });

const B: ExportBooking[] = [
  { farmerCode: "FRM-2", farmerName: "Zafar", phone: "03456509826", village: "Chak 9", bookingAcres: 25, status: "submitted", submittedAt: "2026-10-17T06:00:00Z",
    farms: [{ name: "Dera", village: null, acres: 25, lat: null, lng: null }], lines: [{ kind: "fertilizer", product: "Sona DAP", custom: false, quantity: 50, unit: "bag", status: "pending" }] },
  { farmerCode: "FRM-1", farmerName: "Aslam, \"Bhai\"", phone: "03001234567", village: "Chak 12", bookingAcres: 20, status: "submitted", submittedAt: "2026-10-17T05:00:00Z",
    farms: [{ name: "A", village: null, acres: 12, lat: 31.42, lng: 73.08 }, { name: "B", village: null, acres: 8, lat: null, lng: null }],
    lines: [{ kind: "seed", product: "Wheat Seed (Certified)", custom: false, quantity: 20, unit: "bag", status: "pending" }, { kind: "pesticide", product: "=HYPERLINK(\"x\")", custom: true, quantity: 2, unit: "litre", status: "pending" }] },
];
t("export sheets: summary har kisan ek qatar, lines har product", () => {
  const { summary, lines } = buildExportSheets(B);
  assert.deepEqual(summary[0], SUMMARY_HEADERS); assert.deepEqual(lines[0], LINE_HEADERS);
  assert.equal(summary.length, 3); assert.equal(lines.length, 4);
  const r = summary[1]; const h = (k: string) => r[SUMMARY_HEADERS.indexOf(k)];
  assert.equal(h("Farmer Name"), "Aslam, \"Bhai\""); assert.equal(h("Farms"), "A (12 ac); B (8 ac)"); assert.equal(h("Total Acres"), 20);
  assert.equal(h("Latitude"), 31.42); assert.equal(h("Map Link"), "https://maps.google.com/?q=31.42,73.08");
  assert.equal(h("Seed"), "Wheat Seed (Certified) — 20 bag"); assert.match(String(h("Custom Products")), /^Pesticide: /);
  assert.equal(h("Submitted (PKT)"), "2026-10-17 10:00"); assert.equal(h("Crop"), "Gandum (Wheat)");
  const custom = lines.slice(1).find((l) => l[10] !== "")!; assert.equal(custom[9], ""); assert.equal(custom[8], "Pesticide");
  assert.equal(summary[2][SUMMARY_HEADERS.indexOf("Latitude")], "", "pin nahi to khali");
});
t("CSV: UTF-8 BOM, quotes, injection guard, Urdu", () => {
  const csv = toCsv([["Name", "Product"], ["Aslam, \"Bhai\"", "=cmd()"], ["گندم", "-5"], ["x", -5]]);
  assert.ok(csv.startsWith("\uFEFF")); assert.ok(csv.includes('"Aslam, ""Bhai"""')); assert.ok(csv.includes("'=cmd()")); assert.ok(csv.includes("گندم,-5"));
  assert.deepEqual(parseCsv(csv)[1], ["Aslam, \"Bhai\"", "'=cmd()"]);
});
t("crc32", () => assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926));
t("XLSX: 2 sheets, round-trip, Urdu, injection guard", () => {
  const { summary, lines } = buildExportSheets(B);
  const buf = Buffer.from(toXlsx([{ name: "Summary per farmer", rows: summary }, { name: "Demand lines", rows: lines }]));
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  const s = buf.toString("utf8");
  assert.ok(s.includes('name="Summary per farmer"') && s.includes('name="Demand lines"')); assert.ok(s.includes('state="frozen"')); assert.ok(s.includes("<autoFilter"));
  const back = readXlsxFirstSheet(buf);
  assert.deepEqual(back[0], SUMMARY_HEADERS); assert.equal(back[1][1], "Aslam, \"Bhai\""); assert.equal(back[1][7], "20");
  const urdu = readXlsxFirstSheet(Buffer.from(toXlsx([{ name: "x", rows: [["گندم", 1], ["=evil", 2]] }])));
  assert.deepEqual(urdu, [["گندم", "1"], ["'=evil", "2"]]);
});
t("XLSX reader: Google Sheets jaisi file (deflate, sharedStrings, rel target, khali qatar)", () => {
  const rows = readXlsxFirstSheet(readFileSync("tests/fixtures/season-import-gsheets.xlsx"));
  assert.equal(rows.length, 3); assert.equal(rows[0][0], "Phone"); assert.equal(rows[1][1], "Muhammad Aslam"); assert.equal(rows[2][1], "گندم والا");
  const m = mapImportRows(rows); assert.deepEqual(m.missingHeaders, []); assert.equal(m.rows[0].acres, 12.5); assert.equal(m.rows[1].phone, "3001234567"); assert.equal(m.rows[1].unit, "bag");
  assert.throws(() => readXlsxFirstSheet(Buffer.from("not a zip")), /kharab/);
});
t("phone normalize", () => {
  assert.equal(normalizePhone("0300-1234567"), "3001234567"); assert.equal(normalizePhone("+92 300 1234567"), "3001234567");
  assert.equal(normalizePhone("3001234567"), "3001234567"); assert.equal(normalizePhone("12345"), null); assert.equal(normalizePhone(""), null);
});
t("import: template headers map, aliases, missing headers", () => {
  const { rows, missingHeaders } = mapImportRows(importTemplateRows().map((r) => r.map(String)));
  assert.deepEqual(missingHeaders, []); assert.equal(rows.length, 2); assert.equal(rows[0].phone, "3001234567"); assert.equal(rows[0].kind, "seed"); assert.equal(rows[1].kind, "fertilizer");
  assert.equal(rows[0].rowNo, 2); assert.equal(rows[0].lat, 31.4187);
  const a = mapImportRows([["Mobile", "Rakba", "Qisam", "Product", "Qty", "Unit"], ["03001234567", "1,200", "Spray", "Korum", "3", "LITRE"]]);
  assert.deepEqual(a.missingHeaders, []); assert.equal(a.rows[0].acres, 1200); assert.equal(a.rows[0].kind, "pesticide"); assert.equal(a.rows[0].unit, "litre");
  assert.deepEqual(mapImportRows([["Name", "Product"]]).missingHeaders, ["phone", "acres", "category", "quantity"]);
});
t("import row checks", () => {
  const ctx = { farmerByPhone: new Map([["3001234567", "F1"]]), productByName: new Map<string, { id: string; kind: LineKind }>([["wheat seed (certified)", { id: "w", kind: "seed" }], ["maize seed (hybrid)", { id: "m", kind: "seed" }], ["sona dap", { id: "d", kind: "fertilizer" }]]), crop: "wheat" };
  const row = (o: Partial<Record<string, string>>) => mapImportRows([["Phone", "Acres", "Latitude", "Longitude", "Category", "Product", "Quantity"], [o.phone ?? "03001234567", o.acres ?? "10", o.lat ?? "31.4", o.lng ?? "73.1", o.cat ?? "Seed", o.product ?? "Wheat Seed (Certified)", o.qty ?? "10"]]).rows[0];
  const ok = checkImportRow(row({}), ctx); assert.equal(ok.result, "ok"); assert.equal(ok.productId, "w"); assert.equal(ok.farmerId, "F1");
  assert.deepEqual(checkImportRow(row({ lat: "", lng: "" }), ctx).messages, ["Pin nahi"]);
  assert.equal(checkImportRow(row({ product: "Akbar-19" }), ctx).result, "warning");
  assert.match(checkImportRow(row({ product: "Maize Seed (Hybrid)" }), ctx).messages.join(), /gandum/);
  assert.match(checkImportRow(row({ cat: "Fertilizer" }), ctx).messages.join(), /category ghalat/);
  assert.match(checkImportRow(row({ phone: "0300" }), ctx).messages.join(), /Phone/);
  assert.match(checkImportRow(row({ phone: "03119999999" }), ctx).messages.join(), /nahi/);
  assert.match(checkImportRow(row({ lat: "51" , lng: "0" }), ctx).messages.join(), /Location/);
  assert.match(checkImportRow(row({ cat: "Grocery" }), ctx).messages.join(), /Category/);
  assert.equal(checkImportRow(row({ qty: "0", acres: "-1" }), ctx).result, "error");
});
t("mercator round-trip + fit", () => {
  const p = project(31.42, 73.08, 12); const u = unproject(p.x, p.y, 12);
  assert.ok(Math.abs(u.lat - 31.42) < 1e-9 && Math.abs(u.lng - 73.08) < 1e-9);
  assert.equal(fitView([], 600, 300).zoom, 10); assert.equal(fitView([{ lat: 31, lng: 73 }], 600, 300).zoom, 15);
  const f = fitView([{ lat: 31.4, lng: 73.0 }, { lat: 31.5, lng: 73.2 }], 600, 300);
  assert.ok(f.zoom >= 9 && f.zoom <= 12 && Math.abs(f.center.lat - 31.45) < 0.01);
});
console.log(`season-booking unit: ${n} tests theek`);
{
  const v = validateSeasonBooking({ farms: [{ name: "A", acres: 1, lat: 31.4, lng: 73, src: "gps", accuracy: 9 }, { name: "B", acres: 1, lat: 31.5, lng: 73, src: "hack" }, { name: "C", acres: 1 }], lines: [{ kind: "seed", productId: "w", quantity: 1 }] }, { catalog: cat });
  assert.ok(v.ok); if (v.ok) { assert.equal(v.farms[0].src, "gps"); assert.equal(v.farms[0].accuracy, 9); assert.equal(v.farms[1].src, "manual_pin"); assert.equal(v.farms[1].accuracy, null); assert.equal(v.farms[2].src, undefined); }
  console.log("pin source/accuracy: theek");
}
