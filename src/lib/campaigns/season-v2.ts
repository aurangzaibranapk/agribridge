/**
 * Season Booking v2 -- pure functions (test ke liye): product filter,
 * farms + custom products validation, export (CSV/XLSX) aur import parsing.
 * Abhi sirf Gandum (wheat) -- har jagah.
 */
import { LINE_KINDS, type LineKind } from "./booking";

export const SEASON_CROP = "wheat" as const;
export const SEASON_CROP_LABEL = "Gandum (Wheat)";
export const UNITS = ["bag", "kg", "litre", "bottle", "packet", "other"] as const;

export interface CampaignProductRow { id: string; name: string; pack_size: string | null; unit: string | null; category_name: string | null; line_kind: LineKind | null }

const CROP_WORDS: Record<string, RegExp> = { wheat: /\b(wheat|gandum|gehun)\b|گندم/i };

/** Beej tab sirf campaign ki fasal (gandum) ke beej; khaad/spray sab agri. */
export function productsForKind(all: CampaignProductRow[], kind: LineKind, crop: string): CampaignProductRow[] {
  const cropRe = CROP_WORDS[crop] ?? new RegExp(`\\b${crop.replace(/[^a-z]/gi, "")}\\b`, "i");
  return all
    .filter((p) => p.line_kind === kind)
    .filter((p) => kind !== "seed" || cropRe.test(`${p.name} ${p.category_name ?? ""}`))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function searchProducts(list: CampaignProductRow[], q: string): CampaignProductRow[] {
  const t = q.trim().toLowerCase();
  if (!t) return list;
  return list.filter((p) => `${p.name} ${p.pack_size ?? ""}`.toLowerCase().includes(t));
}

export interface FarmInput { farmId?: string | null; name: string; acres: number | string; village?: string; lat?: number | string | null; lng?: number | string | null; src?: string | null; accuracy?: number | string | null }
export interface CleanFarm { farmId: string | null; name: string; acres: number; village: string | null; lat: number | null; lng: number | null; src?: "gps" | "manual_pin"; accuracy?: number | null }
export interface LineInput { kind: string; productId?: string | null; customName?: string | null; quantity: number | string; unit?: string }
export interface CleanLineV2 { kind: LineKind; productId: string | null; customName: string | null; quantity: number; unit: string }

/** Pakistan ke andar? (lat 23.5–37.5, lng 60.5–77.5) */
export function isPkCoord(lat: number, lng: number): boolean {
  return lat >= 23.5 && lat <= 37.5 && lng >= 60.5 && lng <= 77.5;
}

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function validateSeasonBooking(
  input: { crop?: string; farms: FarmInput[]; lines: LineInput[]; notes?: string },
  ctx: { catalog: Map<string, LineKind>; allowedCrops?: string[] }
): { ok: true; crop: string; farms: CleanFarm[]; acres: number; lines: CleanLineV2[]; notes: string | null } | { ok: false; error: string } {
  const crop = input.crop || SEASON_CROP;
  if (!(ctx.allowedCrops ?? [SEASON_CROP]).includes(crop) || crop !== SEASON_CROP) return { ok: false, error: "Abhi sirf Gandum ki booking ho sakti hai." };

  const farms: CleanFarm[] = [];
  for (const f of input.farms ?? []) {
    const name = String(f.name ?? "").trim().slice(0, 80);
    const acres = num(f.acres);
    if (!name && acres == null) continue;
    if (!name) return { ok: false, error: "Har farm ka naam likhein." };
    if (acres == null || acres <= 0 || acres > 10000) return { ok: false, error: `${name}: rakba (acre) sahi likhein.` };
    const lat = num(f.lat), lng = num(f.lng);
    if ((lat == null) !== (lng == null)) return { ok: false, error: `${name}: location pin adhoori hai.` };
    if (lat != null && lng != null && !isPkCoord(lat, lng)) return { ok: false, error: `${name}: pin Pakistan ke bahar hai.` };
    farms.push({ farmId: f.farmId || null, name, acres: Math.round(acres * 100) / 100, village: String(f.village ?? "").trim().slice(0, 80) || null, lat, lng,
      ...(lat != null ? { src: f.src === "gps" ? "gps" as const : "manual_pin" as const, accuracy: f.src === "gps" ? num(f.accuracy) : null } : {}) });
  }
  if (!farms.length) return { ok: false, error: "Kam az kam ek farm aur us ka rakba likhein." };
  if (new Set(farms.map((f) => f.name.toLowerCase())).size !== farms.length) return { ok: false, error: "Do farms ka naam ek jaisa hai." };

  const merged = new Map<string, CleanLineV2>();
  for (const l of input.lines ?? []) {
    const productId = l.productId || null;
    const customName = String(l.customName ?? "").trim().replace(/\s+/g, " ").slice(0, 120) || null;
    if (!productId && !customName && (l.quantity === "" || l.quantity == null)) continue;
    if (!LINE_KINDS.includes(l.kind as LineKind)) return { ok: false, error: "Line ki qisam ghalat hai." };
    const kind = l.kind as LineKind;
    if (productId) {
      const k = ctx.catalog.get(productId);
      if (!k) return { ok: false, error: "Product catalog se chunein ya apni product likhein." };
      if (k !== kind) return { ok: false, error: "Product ghalat khane (beej/khaad/spray) mein hai." };
    } else if (!customName || customName.length < 2) return { ok: false, error: "Product chunein ya apni product ka naam likhein." };
    const q = num(l.quantity);
    if (q == null || q <= 0 || q > 100000) return { ok: false, error: "Miqdar sahi likhein." };
    const unit = (UNITS as readonly string[]).includes(String(l.unit)) ? String(l.unit) : "bag";
    const key = `${kind}|${productId ?? "c:" + customName!.toLowerCase()}|${unit}`;
    const prev = merged.get(key);
    if (prev) prev.quantity += q;
    else merged.set(key, { kind, productId, customName: productId ? null : customName, quantity: q, unit });
  }
  if (!merged.size) return { ok: false, error: "Kam az kam ek product (beej, khaad ya spray) likhein." };
  const acres = Math.round(farms.reduce((s, f) => s + f.acres, 0) * 100) / 100;
  if (acres > 10000) return { ok: false, error: "Kul rakba 10,000 acre se zyada nahi ho sakta." };
  return { ok: true, crop, farms, acres, lines: [...merged.values()], notes: String(input.notes ?? "").trim().slice(0, 1000) || null };
}

/* ───────────────────────── Export ───────────────────────── */

export interface ExportFarm { name: string; village: string | null; acres: number; lat: number | null; lng: number | null }
export interface ExportLine { kind: LineKind; product: string; custom: boolean; quantity: number; unit: string; status: string }
export interface ExportBooking { farmerCode: string | null; farmerName: string; phone: string | null; village: string | null; bookingAcres: number; status: string; submittedAt: string; farms: ExportFarm[]; lines: ExportLine[] }

export const SUMMARY_HEADERS = ["Farmer Code", "Farmer Name", "Phone", "Village", "Crop", "Farms", "Farm Count", "Total Acres", "Latitude", "Longitude", "Map Link", "Seed", "Fertilizer", "Pesticide", "Custom Products", "Line Count", "Status", "Submitted (PKT)"];
export const LINE_HEADERS = ["Farmer Code", "Farmer Name", "Phone", "Village", "Farm(s)", "Total Acres", "Latitude", "Longitude", "Category", "Product", "Custom Product", "Quantity", "Unit", "Line Status"];
const KIND_EN: Record<LineKind, string> = { seed: "Seed", fertilizer: "Fertilizer", pesticide: "Pesticide" };

export function pktStamp(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16).replace("T", " ");
}
const fmtQ = (l: ExportLine) => `${l.product} — ${l.quantity} ${l.unit}`;
const firstPin = (b: ExportBooking) => b.farms.find((f) => f.lat != null && f.lng != null) ?? null;

export function buildExportSheets(bookings: ExportBooking[]): { summary: (string | number)[][]; lines: (string | number)[][] } {
  const sorted = [...bookings].sort((a, b) => a.farmerName.localeCompare(b.farmerName));
  const summary: (string | number)[][] = [SUMMARY_HEADERS];
  const lines: (string | number)[][] = [LINE_HEADERS];
  for (const b of sorted) {
    const pin = firstPin(b);
    const farmsTxt = b.farms.map((f) => `${f.name} (${f.acres} ac)`).join("; ");
    const by = (k: LineKind) => b.lines.filter((l) => l.kind === k && !l.custom).map(fmtQ).join("; ");
    summary.push([
      b.farmerCode ?? "", b.farmerName, b.phone ?? "", b.village ?? "", SEASON_CROP_LABEL, farmsTxt, b.farms.length, b.bookingAcres,
      pin?.lat ?? "", pin?.lng ?? "", pin ? `https://maps.google.com/?q=${pin.lat},${pin.lng}` : "",
      by("seed"), by("fertilizer"), by("pesticide"),
      b.lines.filter((l) => l.custom).map((l) => `${KIND_EN[l.kind]}: ${fmtQ(l)}`).join("; "),
      b.lines.length, b.status, pktStamp(b.submittedAt),
    ]);
    for (const l of b.lines) {
      lines.push([b.farmerCode ?? "", b.farmerName, b.phone ?? "", b.village ?? "", farmsTxt, b.bookingAcres, pin?.lat ?? "", pin?.lng ?? "",
        KIND_EN[l.kind], l.custom ? "" : l.product, l.custom ? l.product : "", l.quantity, l.unit, l.status]);
    }
  }
  return { summary, lines };
}

/** CSV injection se bachao: =,+,-,@ se shuru hone wale text ke aage '. */
function safeCell(v: string | number): string | number {
  if (typeof v === "number") return v;
  return /^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) ? `'${v}` : v;
}

export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(safeCell(v));
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

/* Minimal XLSX writer (no dependency): ZIP "store" + inline strings. */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf: Uint8Array): number { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder(); const parts: Uint8Array[] = []; const central: Uint8Array[] = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name); const crc = crc32(f.data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + f.data.length;
  }
  const cSize = central.reduce((s, p) => s + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cSize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0)); let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
const xmlEsc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function colName(i: number): string { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function sheetXml(rows: (string | number)[][]): string {
  const widths = (rows[0] ?? []).map((_, c) => Math.min(60, Math.max(10, ...rows.map((r) => String(r[c] ?? "").length + 2))));
  const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const ref = `${colName(ci)}${ri + 1}`; const st = ri === 0 ? ' s="1"' : "";
    return typeof v === "number" && Number.isFinite(v) ? `<c r="${ref}"${st}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xmlEsc(String(safeCell(v)))}</t></is></c>`;
  }).join("")}</row>`).join("");
  const last = `${colName(Math.max(0, (rows[0]?.length ?? 1) - 1))}${Math.max(1, rows.length)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
}
export function toXlsx(sheets: { name: string; rows: (string | number)[][] }[]): Uint8Array {
  const enc = new TextEncoder(); const f = (name: string, s: string) => ({ name, data: enc.encode(s) });
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  return zipStore([
    f("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`),
    f("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    f("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${ns}><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
    f("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    f("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B6B3A"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
    ...sheets.map((s, i) => f(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows))),
  ]);
}

/* ───────────────────────── Import ───────────────────────── */

export const IMPORT_HEADERS = ["Phone", "Farmer Name", "Village", "Farm Name", "Acres", "Latitude", "Longitude", "Category", "Product", "Quantity", "Unit"];
export function importTemplateRows(): (string | number)[][] {
  return [IMPORT_HEADERS, ["03001234567", "Muhammad Aslam", "Chak 12", "Dera Wala", 12, 31.4187, 73.0791, "Seed", "Wheat Seed (Certified)", 12, "bag"],
    ["03001234567", "Muhammad Aslam", "Chak 12", "Dera Wala", 12, 31.4187, 73.0791, "Fertilizer", "Sona DAP", 12, "bag"]];
}

/** RFC-4180 CSV parser (quotes, BOM, CRLF). */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, ""); const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function normalizePhone(raw: unknown): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("92") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return /^3\d{9}$/.test(d) ? d : null;
}

const HEADER_ALIASES: Record<string, string> = {
  phone: "phone", mobile: "phone", "phone number": "phone", "farmer name": "name", name: "name", kisan: "name", village: "village", gaon: "village",
  "farm name": "farm", farm: "farm", "farm(s)": "farm", acres: "acres", acre: "acres", rakba: "acres", "total acres": "acres", latitude: "lat", lat: "lat", longitude: "lng", lng: "lng", long: "lng",
  category: "category", qisam: "category", product: "product", "custom product": "custom", quantity: "quantity", qty: "quantity", miqdar: "quantity", unit: "unit",
};
export interface ImportRow { rowNo: number; phone: string | null; name: string; village: string; farm: string; acres: number | null; lat: number | null; lng: number | null; kind: LineKind | null; product: string; quantity: number | null; unit: string; raw: Record<string, string> }

export function mapImportRows(table: string[][]): { rows: ImportRow[]; missingHeaders: string[] } {
  const [head = [], ...body] = table;
  const keys = head.map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null);
  const missing = ["phone", "acres", "category", "quantity"].filter((k) => !keys.includes(k));
  if (!keys.includes("product") && !keys.includes("custom")) missing.push("product");
  const kindOf = (v: string): LineKind | null => {
    const t = v.trim().toLowerCase();
    if (/^(seed|seeds|beej)/.test(t)) return "seed"; if (/^(fert|khaad|khad)/.test(t)) return "fertilizer"; if (/^(pest|spray|insect|herb|fung)/.test(t)) return "pesticide"; return null;
  };
  const rows = body.map((r, i) => {
    const o: Record<string, string> = {}; keys.forEach((k, c) => { if (k && o[k] == null) o[k] = String(r[c] ?? "").trim(); });
    const raw: Record<string, string> = {}; head.forEach((h, c) => { raw[h.trim()] = String(r[c] ?? "").trim(); });
    return { rowNo: i + 2, phone: normalizePhone(o.phone), name: o.name ?? "", village: o.village ?? "", farm: o.farm ?? "", acres: num(o.acres), lat: num(o.lat), lng: num(o.lng),
      kind: kindOf(o.category ?? ""), product: (o.product || o.custom || "").replace(/\s+/g, " "), quantity: num(o.quantity), unit: (UNITS as readonly string[]).includes((o.unit ?? "").toLowerCase()) ? o.unit.toLowerCase() : "bag", raw };
  });
  return { rows, missingHeaders: missing };
}

export interface ImportCheck { result: "ok" | "warning" | "error"; messages: string[]; farmerId: string | null; productId: string | null }
export function checkImportRow(r: ImportRow, ctx: { farmerByPhone: Map<string, string>; productByName: Map<string, { id: string; kind: LineKind }>; crop: string }): ImportCheck {
  const err: string[] = [], warn: string[] = [];
  if (!r.phone) err.push("Phone ghalat");
  const farmerId = r.phone ? ctx.farmerByPhone.get(r.phone) ?? null : null;
  if (r.phone && !farmerId) err.push("Kisan system mein nahi");
  if (r.acres == null || r.acres <= 0 || r.acres > 10000) err.push("Acre ghalat");
  if (!r.kind) err.push("Category ghalat (Seed/Fertilizer/Pesticide)");
  if (!r.product) err.push("Product khali");
  if (r.quantity == null || r.quantity <= 0 || r.quantity > 100000) err.push("Miqdar ghalat");
  if ((r.lat == null) !== (r.lng == null) || (r.lat != null && r.lng != null && !isPkCoord(r.lat, r.lng))) err.push("Location ghalat");
  else if (r.lat == null) warn.push("Pin nahi");
  let productId: string | null = null;
  const hit = r.product ? ctx.productByName.get(r.product.toLowerCase()) : undefined;
  if (hit && r.kind && hit.kind !== r.kind) err.push("Product ki category ghalat");
  else if (hit) {
    if (r.kind === "seed" && !(CROP_WORDS[ctx.crop] ?? /./).test(r.product)) err.push("Sirf gandum ka beej");
    productId = hit.id;
  } else if (r.product) warn.push("Nayi product → review");
  return { result: err.length ? "error" : warn.length ? "warning" : "ok", messages: [...err, ...warn], farmerId, productId };
}
