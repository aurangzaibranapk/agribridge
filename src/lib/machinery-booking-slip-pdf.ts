import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface MachinerySlipData {
  slipNumber: string;
  farmerName: string;
  farmerPhone: string | null;
  vendorName: string;
  machineLabel: string;
  bookingDate: string;
  quantityLabel: string;
  rateAmount: number;
  totalAmount: number;
  /**
   * Kisan ko di gayi riayat (194).
   *
   * Ye lakeer chhupa kar sirf kam raqam likh dena kisan se ye baat
   * chheen leta hai ke us par ehsaan hua -- aur wo Rs 30,000 parh kar
   * neeche Rs 28,000 dekhta hai aur farq ka koi jawab nahi paata.
   */
  discountAmount?: number;
  amountReceived: number;
  locationAddress: string | null;
}

export async function generateMachineryBookingSlipPdf(data: MachinerySlipData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 520]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.45, 0.45, 0.45);
  const navy = rgb(0.05, 0.3, 0.2);
  const brand = rgb(0.1, 0.5, 0.3);

  let y = 480;
  page.drawText("Al Rana Traders - AgriBridge", { x: 40, y, size: 18, font: boldFont, color: navy });
  y -= 20;
  page.drawText("Machinery Rental - Booking Slip", { x: 40, y, size: 11, font, color: gray });

  page.drawText(data.slipNumber, { x: 400, y: 480, size: 11, font: boldFont, color: black });
  page.drawText(data.bookingDate, { x: 400, y: 464, size: 10, font, color: gray });

  y = 430;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 30;

  page.drawText("Farmer", { x: 40, y, size: 9, font, color: gray });
  y -= 16;
  page.drawText(data.farmerName, { x: 40, y, size: 14, font: boldFont, color: black });
  if (data.farmerPhone) {
    y -= 16;
    page.drawText(`Phone: ${data.farmerPhone}`, { x: 40, y, size: 10, font, color: gray });
  }

  y -= 30;
  page.drawText("Vendor / Machine", { x: 40, y, size: 9, font, color: gray });
  y -= 16;
  page.drawText(`${data.vendorName} - ${data.machineLabel}`, { x: 40, y, size: 11, font: boldFont, color: black });

  y -= 20;
  if (data.locationAddress) {
    page.drawText(`Location: ${data.locationAddress}`, { x: 40, y, size: 9, font, color: gray });
    y -= 20;
  }

  y -= 20;
  page.drawRectangle({ x: 40, y: y - 90, width: 515, height: 90, color: rgb(0.96, 0.98, 0.97), borderColor: rgb(0.8, 0.88, 0.82), borderWidth: 1 });
  page.drawText(data.quantityLabel, { x: 55, y: y - 20, size: 10, font, color: gray });
  page.drawText(`Rate: Rs ${data.rateAmount.toLocaleString()}`, { x: 300, y: y - 20, size: 10, font, color: gray });
  const riayat = data.discountAmount ?? 0;
  const denaHai = Math.round((data.totalAmount - riayat) * 100) / 100;
  if (riayat > 0) {
    page.drawText(`Riayat: - Rs ${riayat.toLocaleString()}`, { x: 300, y: y - 33, size: 9, font, color: gray });
  }
  page.drawText(riayat > 0 ? "Bill (riayat ke baad)" : "Total Amount", { x: 55, y: y - 45, size: 10, font, color: gray });
  page.drawText(`Rs ${denaHai.toLocaleString()}`, { x: 55, y: y - 68, size: 20, font: boldFont, color: brand });
  page.drawText("Received So Far", { x: 300, y: y - 45, size: 10, font, color: gray });
  page.drawText(`Rs ${data.amountReceived.toLocaleString()}`, { x: 300, y: y - 68, size: 14, font: boldFont, color: black });

  page.drawText("This is a computer-generated booking slip from the AgriBridge system.", { x: 40, y: 60, size: 8, font, color: gray });
  page.drawLine({ start: { x: 40, y: 45 }, end: { x: 555, y: 45 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
  page.drawText("Software by ZR Technologies", { x: 40, y: 28, size: 9, font: boldFont, color: gray });
  page.drawText("0312-6513294", { x: 470, y: 28, size: 9, font, color: gray });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}