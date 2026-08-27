import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface SlipData {
  slipNumber: string;
  sellerName: string;
  sellerType: string;
  sellerPhone: string | null;
  amount: number;
  paymentMethod: string | null;
  notes: string | null;
  date: string;
}

export async function generateGrainPaymentSlipPdf(data: SlipData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 500]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.45, 0.45, 0.45);
  const navy = rgb(0.05, 0.3, 0.2);
  const brand = rgb(0.1, 0.5, 0.3);

  let y = 460;
  page.drawText("Al Rana Traders - AgriBridge", { x: 40, y, size: 18, font: boldFont, color: navy });
  y -= 20;
  page.drawText("Grain Procurement - Payment Slip", { x: 40, y, size: 11, font, color: gray });

  page.drawText(data.slipNumber, { x: 400, y: 460, size: 11, font: boldFont, color: black });
  page.drawText(data.date, { x: 400, y: 444, size: 10, font, color: gray });

  y = 410;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 30;

  page.drawText(data.sellerType, { x: 40, y, size: 9, font, color: gray });
  y -= 16;
  page.drawText(data.sellerName, { x: 40, y, size: 14, font: boldFont, color: black });
  if (data.sellerPhone) {
    y -= 16;
    page.drawText(`Phone: ${data.sellerPhone}`, { x: 40, y, size: 10, font, color: gray });
  }

  y -= 40;
  page.drawRectangle({ x: 40, y: y - 60, width: 515, height: 60, color: rgb(0.96, 0.98, 0.97), borderColor: rgb(0.8, 0.88, 0.82), borderWidth: 1 });
  page.drawText("Payment Amount", { x: 55, y: y - 20, size: 10, font, color: gray });
  page.drawText(`Rs ${data.amount.toLocaleString()}`, { x: 55, y: y - 42, size: 20, font: boldFont, color: brand });
  page.drawText("Method", { x: 350, y: y - 20, size: 10, font, color: gray });
  page.drawText((data.paymentMethod ?? "cash").replace(/_/g, " ").toUpperCase(), { x: 350, y: y - 42, size: 12, font: boldFont, color: black });

  y -= 90;
  if (data.notes) {
    page.drawText("Notes:", { x: 40, y, size: 9, font: boldFont, color: gray });
    y -= 14;
    page.drawText(data.notes.slice(0, 100), { x: 40, y, size: 9, font, color: black });
    y -= 20;
  }

  page.drawText("This is a computer-generated payment slip from the AgriBridge system.", { x: 40, y: 60, size: 8, font, color: gray });
  page.drawLine({ start: { x: 40, y: 45 }, end: { x: 555, y: 45 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
  page.drawText("Software by ZR Technologies", { x: 40, y: 28, size: 9, font: boldFont, color: gray });
  page.drawText("0312-6513294", { x: 470, y: 28, size: 9, font, color: gray });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}