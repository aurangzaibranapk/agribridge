import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface WalletStatementRow {
  typeLabel: string;
  direction: string;
  amount: number;
  notes: string | null;
  date: string;
  balanceAfter: number;
}

export interface WalletStatementData {
  farmerName: string;
  farmerCode: string;
  farmerPhone: string | null;
  currentBalance: number;
  rows: WalletStatementRow[];
}

export async function generateWalletStatementPdf(data: WalletStatementData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.45, 0.45, 0.45);
  const navy = rgb(0.05, 0.3, 0.2);
  const green = rgb(0.1, 0.5, 0.3);
  const red = rgb(0.7, 0.2, 0.2);

  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 40;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 50;

  function drawHeader() {
    page.drawText("Al Rana Traders - AgriBridge", { x: marginX, y, size: 16, font: boldFont, color: navy });
    y -= 18;
    page.drawText("Wallet Statement", { x: marginX, y, size: 10, font, color: gray });
    y -= 20;
    page.drawText(`${data.farmerName} (${data.farmerCode})${data.farmerPhone ? " - " + data.farmerPhone : ""}`, { x: marginX, y, size: 10, font, color: black });
    y -= 15;
    page.drawText(`Current Balance: Rs ${data.currentBalance.toLocaleString()}`, { x: marginX, y, size: 11, font: boldFont, color: data.currentBalance >= 0 ? green : red });
    y -= 20;

    const cols = [
      { label: "Date", x: marginX },
      { label: "Tafseel", x: marginX + 70 },
      { label: "Amount", x: marginX + 340 },
      { label: "Balance", x: marginX + 440 },
    ];
    cols.forEach((c) => page.drawText(c.label, { x: c.x, y, size: 9, font: boldFont, color: gray }));
    y -= 6;
    page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
    y -= 14;
  }

  drawHeader();

  for (const row of data.rows) {
    if (y < 60) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 50;
      drawHeader();
    }
    page.drawText(new Date(row.date).toLocaleDateString(), { x: marginX, y, size: 8, font, color: black });
    page.drawText(row.typeLabel.slice(0, 40), { x: marginX + 70, y, size: 8, font, color: black });
    page.drawText(`${row.direction === "credit" ? "+" : "-"}Rs ${row.amount.toLocaleString()}`, {
      x: marginX + 340,
      y,
      size: 8,
      font,
      color: row.direction === "credit" ? green : red,
    });
    page.drawText(`Rs ${row.balanceAfter.toLocaleString()}`, { x: marginX + 440, y, size: 8, font, color: black });
    y -= 16;
  }

  page.drawText("Software by ZR Technologies", { x: marginX, y: 30, size: 8, font: boldFont, color: gray });
  page.drawText("0312-6513294", { x: pageWidth - marginX - 60, y: 30, size: 8, font, color: gray });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}