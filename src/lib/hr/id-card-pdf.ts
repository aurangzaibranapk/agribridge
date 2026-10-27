import { jsPDF } from "jspdf";
import type { IdCardFields } from "@/lib/hr/id-card-profile";

const THEMES: Record<string, { bg: [number, number, number]; accent: [number, number, number]; text: [number, number, number]; sub: [number, number, number] }> = {
  blue: { bg: [29, 78, 216], accent: [59, 130, 246], text: [255, 255, 255], sub: [219, 234, 254] },
  navy: { bg: [15, 23, 42], accent: [245, 158, 11], text: [255, 255, 255], sub: [203, 213, 225] },
  green: { bg: [21, 128, 61], accent: [74, 222, 128], text: [255, 255, 255], sub: [220, 252, 231] },
  white: { bg: [255, 255, 255], accent: [30, 41, 59], text: [15, 23, 42], sub: [100, 116, 139] },
  red: { bg: [185, 28, 28], accent: [248, 113, 113], text: [255, 255, 255], sub: [254, 226, 226] },
};

function theme(design: string) {
  return THEMES[design] ?? THEMES.blue;
}

function show(value: string | null, emptyLabel: string) {
  return value ?? emptyLabel;
}

/** Do rukh, A4 landscape, taake print aur WhatsApp/email ke liye file ban sake. */
export function buildIdCardPdf(card: IdCardFields, design: string, emptyLabel: string, photoDataUrl: string | null): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const t = theme(design);
  drawFront(doc, 18, 40, t, card, photoDataUrl);
  drawBack(doc, 120, 40, t, card, emptyLabel);
  doc.setTextColor(80);
  doc.setFontSize(9);
  doc.text("AgriBridge staff ID card — cut along the boxes. Front left, back right.", 18, 28);
  return new Uint8Array(doc.output("arraybuffer"));
}

function drawFront(
  doc: jsPDF,
  x: number,
  y: number,
  t: (typeof THEMES)["blue"],
  card: IdCardFields,
  photoDataUrl: string | null,
) {
  const w = 85.6;
  const h = 54;
  doc.setFillColor(...t.bg);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  doc.setFillColor(...t.accent);
  doc.rect(x, y, w, 2.2, "F");
  doc.setTextColor(...t.sub);
  doc.setFontSize(7);
  doc.text("AGRIBRIDGE", x + w / 2, y + 8, { align: "center" });
  if (photoDataUrl) {
    try {
      const format = photoDataUrl.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(photoDataUrl, format, x + w / 2 - 8, y + 11, 16, 16);
    } catch {
      drawAvatar(doc, x + w / 2, y + 19, t);
    }
  } else {
    drawAvatar(doc, x + w / 2, y + 19, t);
  }
  doc.setTextColor(...t.text);
  doc.setFontSize(11);
  doc.text(card.fullName, x + w / 2, y + 34, { align: "center", maxWidth: w - 8 });
  doc.setTextColor(...t.sub);
  doc.setFontSize(8);
  doc.text(card.designation || "", x + w / 2, y + 40, { align: "center", maxWidth: w - 8 });
  if (card.branchName) doc.text(card.branchName, x + w / 2, y + 46, { align: "center", maxWidth: w - 8 });
  if (card.employeeCode) doc.text(`ID: ${card.employeeCode}`, x + w / 2, y + 50, { align: "center" });
}

function drawAvatar(doc: jsPDF, cx: number, cy: number, t: (typeof THEMES)["blue"]) {
  doc.setDrawColor(...t.sub);
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, 8, "S");
  doc.setFillColor(...t.sub);
  doc.circle(cx, cy - 1.5, 2.2, "F");
  doc.ellipse(cx, cy + 4.2, 4, 2.4, "F");
}

function drawBack(
  doc: jsPDF,
  x: number,
  y: number,
  t: (typeof THEMES)["blue"],
  card: IdCardFields,
  emptyLabel: string,
) {
  const w = 85.6;
  const h = 54;
  doc.setFillColor(...t.bg);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  doc.setFillColor(...t.accent);
  doc.rect(x, y, w, 2.2, "F");
  doc.setTextColor(...t.text);
  doc.setFontSize(8);
  const rows = [
    `CNIC: ${show(card.cnic, emptyLabel)}`,
    `Phone: ${show(card.phone, emptyLabel)}`,
    `Blood group: ${show(card.bloodGroup, emptyLabel)}`,
    `Emergency: ${show([card.emergencyName, card.emergencyPhone].filter(Boolean).join(" ") || null, emptyLabel)}`,
  ];
  rows.forEach((row, index) => {
    doc.text(row, x + 5, y + 12 + index * 7, { maxWidth: w - 10 });
  });
  doc.setTextColor(...t.sub);
  doc.setFontSize(6.5);
  doc.text("If found, please return to AgriBridge.", x + 5, y + 46, { maxWidth: w - 10 });
}

export function downloadIdCardPdf(filename: string, bytes: Uint8Array) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
