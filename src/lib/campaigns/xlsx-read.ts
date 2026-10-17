/** Server-only: XLSX (Google Sheets / Excel) ki pehli sheet ko text table mein parhna. Koi dependency nahi. */
import { inflateRawSync } from "node:zlib";

function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("XLSX file kharab hai.");
  const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("XLSX file kharab hai.");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), loff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString("utf8");
    const dStart = loff + 30 + buf.readUInt16LE(loff + 26) + buf.readUInt16LE(loff + 28);
    const raw = buf.subarray(dStart, dStart + csize);
    if (raw.length > 20_000_000) throw new Error("File bohat bari hai.");
    out.set(name, method === 0 ? Buffer.from(raw) : inflateRawSync(raw));
    p += 46 + nlen + elen + clen;
  }
  return out;
}
const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&");
const texts = (frag: string) => [...frag.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unxml(m[1])).join("");
function colIdx(ref: string): number { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

export function readXlsxFirstSheet(buf: Buffer): string[][] {
  const files = unzip(buf);
  const shared = [...(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const wb = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const rid = /<sheet [^>]*r:id="([^"]+)"/.exec(wb)?.[1];
  const target = rid ? new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels)?.[1] : null;
  const path = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`) : "xl/worksheets/sheet1.xml";
  const xml = files.get(path)?.toString("utf8") ?? files.get("xl/worksheets/sheet1.xml")?.toString("utf8");
  if (!xml) throw new Error("Sheet nahi mili.");
  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], inner = cm[2] ?? ""; const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]; const t = /t="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      const val = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? texts(inner) : v != null ? unxml(v) : "";
      row[ref ? colIdx(ref) : row.length] = val;
    }
    rows.push(Array.from(row, (c) => c ?? ""));
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}
