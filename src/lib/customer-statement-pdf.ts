import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type StatementRow = {
  entry_date: string;
  entry_number: string;
  tafseel: string | null;
  debit: number | string;
  credit: number | string;
};

export async function generateCustomerStatementPdf(input: {
  customerName: string;
  fromDate?: string | null;
  toDate?: string | null;
  openingBalance: number;
  closingBalance: number;
  rows: StatementRow[];
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(pageSize);
  let y = 790;

  const money = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
  const period = `${input.fromDate || "Beginning"} to ${input.toDate || "Today"}`;

  function header() {
    page.drawRectangle({ x: 0, y: 766, width: 595.28, height: 76, color: rgb(0.04, 0.37, 0.22) });
    page.drawText("AL RANA TRADERS", { x: 34, y: 806, size: 19, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Customer Khata Statement", { x: 34, y: 784, size: 11, font: regular, color: rgb(0.88, 1, 0.92) });
    page.drawText(input.customerName, { x: 34, y: 744, size: 15, font: bold, color: rgb(0.08, 0.12, 0.1) });
    page.drawText(`Statement period: ${period}`, { x: 34, y: 726, size: 9, font: regular, color: rgb(0.35, 0.38, 0.36) });
    page.drawText(`Opening: ${money(input.openingBalance)}`, { x: 34, y: 704, size: 10, font: bold });
    page.drawText(`Closing: ${money(input.closingBalance)}`, { x: 390, y: 704, size: 10, font: bold });
    page.drawRectangle({ x: 30, y: 674, width: 535, height: 22, color: rgb(0.94, 0.97, 0.95) });
    ["Date", "Entry", "Detail", "Debit", "Credit", "Balance"].forEach((label, index) => {
      const xs = [36, 100, 180, 405, 463, 520];
      page.drawText(label, { x: xs[index], y: 681, size: 8, font: bold, color: rgb(0.16, 0.25, 0.2) });
    });
    y = 660;
  }

  function newPage() {
    page = pdf.addPage(pageSize);
    y = 800;
    page.drawText(`Al Rana Traders - ${input.customerName}`, { x: 34, y: 810, size: 9, font: bold });
  }

  header();
  let balance = input.openingBalance;
  for (const row of input.rows) {
    if (y < 54) newPage();
    const debit = Number(row.debit || 0);
    const credit = Number(row.credit || 0);
    balance += debit - credit;
    const detail = String(row.tafseel || "").replace(/[^\x20-\x7E]/g, " ").slice(0, 39);
    const cells = [
      String(row.entry_date).slice(0, 10),
      String(row.entry_number).slice(0, 13),
      detail,
      debit ? Math.round(debit).toLocaleString("en-PK") : "-",
      credit ? Math.round(credit).toLocaleString("en-PK") : "-",
      Math.round(balance).toLocaleString("en-PK"),
    ];
    const xs = [36, 100, 180, 410, 468, 524];
    cells.forEach((cell, index) => page.drawText(cell, { x: xs[index], y, size: 7.4, font: regular }));
    page.drawLine({ start: { x: 32, y: y - 5 }, end: { x: 563, y: y - 5 }, thickness: 0.35, color: rgb(0.85, 0.87, 0.86) });
    y -= 18;
  }

  page.drawText("Al Rana Traders | Chak Mahabali | 0312-6513294 | alranatraders.pk", {
    x: 90,
    y: 24,
    size: 8,
    font: regular,
    color: rgb(0.35, 0.38, 0.36),
  });
  return Buffer.from(await pdf.save());
}
