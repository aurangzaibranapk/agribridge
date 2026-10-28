import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { encodeQr } from "@/lib/qr/qr-encode";
import { fmtDate, PAY_METHODS } from "./salary-offer";
import { SLIP_COMPANY, type SlipData } from "./slip-data";

/** WinAnsi se bahar ke harf (Urdu waghera) pdf-lib ko gira dete hain -- unhein hata do. */
export function pdfSafe(t: string | null | undefined): string {
  return String(t ?? "").replace(/[\u2013\u2014]/g, "-").replace(/\u2192/g, "->").replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "").replace(/\s+/g, " ").trim();
}
const fmt = (x: number) => (Number.isFinite(x) ? Math.round(x).toLocaleString("en-US") : "-");

const GREEN = rgb(0.082, 0.502, 0.239); // #15803d
const DARK = rgb(0.059, 0.239, 0.165); // #0f3d2a
const GRAY = rgb(0.42, 0.447, 0.502);
const LINE = rgb(0.898, 0.906, 0.922);
const RED = rgb(0.725, 0.11, 0.11);

/** 691: A4 salary slip PDF -- wahi shakl jo screen par (mockup 5), asli QR ke saath. */
export async function salarySlipPdf(slip: SlipData, verifyHref: string | null, verifyLabel: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Salary Slip ${slip.slipNo ?? ""} ${slip.month}`);
  const page = doc.addPage([595.28, 841.89]);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const b = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, M = 36;
  const T = (p: PDFPage, s: string, x: number, y: number, size = 9.5, font: PDFFont = f, color = rgb(0.07, 0.09, 0.15)) => p.drawText(pdfSafe(s), { x, y, size, font, color });
  const TR = (p: PDFPage, s: string, xr: number, y: number, size = 9.5, font: PDFFont = f, color = rgb(0.07, 0.09, 0.15)) => {
    const t = pdfSafe(s); p.drawText(t, { x: xr - font.widthOfTextAtSize(t, size), y, size, font, color });
  };
  let y = 841.89 - 40;
  page.drawRectangle({ x: M, y: y - 44, width: 48, height: 48, color: DARK });
  T(page, "AB", M + 12, y - 26, 16, b, rgb(1, 1, 1));
  T(page, SLIP_COMPANY.name, M + 60, y - 14, 18, b, DARK);
  T(page, SLIP_COMPANY.tagline, M + 60, y - 30, 8.5, f, GRAY);
  TR(page, "SALARY SLIP", W - M, y - 10, 13, b);
  TR(page, "Tankhwah Parchi", W - M, y - 23, 9.5);
  TR(page, `Slip # ${slip.slipNo ?? slip.lineId.slice(0, 8).toUpperCase()}`, W - M, y - 35, 8.5, f, GRAY);
  TR(page, `Mahina: ${slip.month}`, W - M, y - 46, 8.5, f, GRAY);
  y -= 56;
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 3, color: GREEN });
  y -= 16;

  const cw = (W - 2 * M);
  const info: [string, string, string, string][] = [
    ["Naam", slip.staff.name, "Walid ka naam", slip.staff.father ?? "-"],
    ["CNIC", slip.staff.cnic ?? "-", "Ohda", slip.staff.designation ?? "-"],
    ["Shoba", slip.staff.department ?? "-", "Joining", fmtDate(slip.staff.joining)],
    ["Bank", slip.staff.bank ?? "-", "Account", slip.staff.account ?? "-"],
    ["Kaam ke din", slip.workDays, "Employee ID", slip.staff.employeeCode ?? "-"],
  ];
  const rowH = 17;
  const cols = [0, 0.18, 0.5, 0.68, 1].map((p) => M + p * cw);
  const grid = (rows: string[][], top: number, boldFirstValue = false) => {
    rows.forEach((r, i) => {
      const yy = top - (i + 1) * rowH;
      page.drawRectangle({ x: M, y: yy, width: cw, height: rowH, borderColor: LINE, borderWidth: 0.75 });
      for (let c = 1; c < 4; c++) page.drawLine({ start: { x: cols[c], y: yy }, end: { x: cols[c], y: yy + rowH }, color: LINE, thickness: 0.75 });
      r.forEach((s, c) => T(page, s, cols[c] + 5, yy + 5.5, 9, c === 1 && boldFirstValue && i === 0 ? b : f, c % 2 === 0 ? GRAY : rgb(0.07, 0.09, 0.15)));
    });
    return top - rows.length * rowH;
  };
  y = grid(info, y, true) - 14;

  const half = (cw - 14) / 2;
  const table = (x: number, title: string, rows: { label: string; amount: number }[], total: [string, number], color: typeof GREEN, bg: ReturnType<typeof rgb>, minRows: number) => {
    let yy = y;
    page.drawRectangle({ x, y: yy - rowH, width: half, height: rowH, color: bg, borderColor: LINE, borderWidth: 0.75 });
    T(page, title, x + 5, yy - rowH + 5.5, 9, b, color); TR(page, "Rs", x + half - 5, yy - rowH + 5.5, 9, b, color);
    yy -= rowH;
    const all = [...rows.map((r) => [r.label, fmt(r.amount)]), ...Array.from({ length: Math.max(0, minRows - rows.length) }, () => ["", ""])];
    for (const [l, a] of all) {
      yy -= rowH;
      page.drawRectangle({ x, y: yy, width: half, height: rowH, borderColor: LINE, borderWidth: 0.75 });
      T(page, l, x + 5, yy + 5.5, 9); TR(page, a, x + half - 5, yy + 5.5, 9);
    }
    yy -= rowH;
    page.drawRectangle({ x, y: yy, width: half, height: rowH, borderColor: LINE, borderWidth: 0.75 });
    T(page, total[0], x + 5, yy + 5.5, 9, b); TR(page, fmt(total[1]), x + half - 5, yy + 5.5, 9, b);
    return yy;
  };
  const m = Math.max(slip.earnings.length, slip.deductions.length);
  const y1 = table(M, "Kamai (Earnings)", slip.earnings, ["Gross", slip.gross], GREEN, rgb(0.941, 0.992, 0.957), m);
  table(M + half + 14, "Katauti (Deductions)", slip.deductions, ["Kul katauti", slip.totalDeductions], RED, rgb(0.996, 0.949, 0.949), m);
  y = y1 - 14;

  page.drawRectangle({ x: M, y: y - 46, width: cw, height: 46, color: GREEN });
  T(page, "NET SALARY (Saafi tankhwah)", M + 14, y - 18, 8.5, f, rgb(0.9, 0.97, 0.92));
  T(page, slip.netWords, M + 14, y - 33, 9.5, f, rgb(1, 1, 1));
  TR(page, `Rs ${fmt(slip.net)}`, W - M - 14, y - 30, 20, b, rgb(1, 1, 1));
  y -= 60;
  const method = slip.payMethod ? PAY_METHODS[slip.payMethod] ?? slip.payMethod : slip.payAccount;
  y = grid([["Ada ki tareekh", slip.paidAt ? fmtDate(slip.paidAt) : "Abhi ada nahi", "Tareeqa", [method, slip.payRef ? `Ref ${slip.payRef}` : null].filter(Boolean).join(" | ") || "-"]], y);

  // QR, mohar, dastakhat
  const qy = y - 60 - 84;
  if (verifyHref) {
    const q = encodeQr(verifyHref);
    const size = 84, unit = size / q.size;
    page.drawRectangle({ x: M - 2, y: qy - 2, width: size + 4, height: size + 4, borderColor: DARK, borderWidth: 1.5, color: rgb(1, 1, 1) });
    q.modules.forEach((row, r) => row.forEach((d, c) => { if (d) page.drawRectangle({ x: M + c * unit, y: qy + size - (r + 1) * unit, width: unit, height: unit, color: DARK }); }));
  }
  T(page, `Tasdeeq: ${slip.verifyCode ?? "-"}`, M, qy - 14, 8, f, GRAY);
  T(page, verifyLabel, M, qy - 24, 8, f, GRAY);
  page.drawCircle({ x: W / 2, y: qy + 42, size: 44, borderColor: rgb(0.525, 0.937, 0.675), borderWidth: 1.5, borderDashArray: [4, 3] });
  T(page, "Mohar (Stamp)", W / 2 - 27, qy + 39, 8.5, f, GREEN);
  page.drawLine({ start: { x: W - M - 150, y: qy + 20 }, end: { x: W - M, y: qy + 20 }, thickness: 0.8 });
  TR(page, "Mujaz dastakhat", W - M - 32, qy + 8, 8.5);
  TR(page, `HR / Accounts - ${SLIP_COMPANY.name}`, W - M, qy - 3, 8.5);
  const foot = "Ye computer se bani parchi hai. QR scan kar ke asal hone ki tasdeeq karein.";
  T(page, foot, (W - f.widthOfTextAtSize(foot, 7.5)) / 2, qy - 60, 7.5, f, rgb(0.61, 0.64, 0.69));
  return doc.save();
}
