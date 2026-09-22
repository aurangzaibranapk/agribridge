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

  // Idare ka nishan. Ye wohi hexagon hai jo website aur parchi par lagta
  // hai (components/brand/art-logo). pdf-lib SVG nahi parhti, is liye
  // yahan wahi shakl khud khinchni parti hai -- aur gradient bhi nahi
  // hota, is liye sona ek hi rang mein aata hai. Baqi naap wohi hain,
  // taake dono nishan ek doosre se ajnabi na lagen.
  const gold = rgb(0.788, 0.635, 0.153);
  const darkGreen = rgb(0.051, 0.157, 0.094);
  const leafGreen = rgb(0.290, 0.471, 0.337);
  drawArtMark(page, 40, 452, 34, { gold, darkGreen, leafGreen });

  let y = 480;
  page.drawText("Al Rana Traders", { x: 84, y, size: 18, font: boldFont, color: navy });
  y -= 15;
  page.drawText("ART AGRIBRIDGE", { x: 84, y, size: 8, font: boldFont, color: gold });
  y -= 14;
  page.drawText("Machinery Rental - Booking Slip", { x: 84, y, size: 10, font, color: gray });

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

/**
 * ART ka hexagon nishan, PDF par.
 *
 * pdf-lib ke paas SVG parhne ka koi raasta nahi -- wo sirf apni khud ki
 * shakleain khinchti hai. Is liye wohi chhe konon wali shakl aur us ke
 * andar gandum ka sitta yahan haath se bana hai.
 *
 * Do cheezein jaan boojh kar chhoRi gayi hain: sone ka gradient (pdf-lib
 * mein hota hi nahi -- ek hi rang aata hai) aur baali ke dane ka halka
 * jhukao. Door se dono nishan ek hi lagte hain, aur kisan ke haath mein
 * jane wale kaghaz par yehi kaafi hai.
 *
 * (x, y) nishan ka NEECHE-BAAYAN kona hai, `size` us ki chauRai.
 */
function drawArtMark(
  page: import("pdf-lib").PDFPage,
  x: number,
  y: number,
  size: number,
  c: { gold: import("pdf-lib").RGB; darkGreen: import("pdf-lib").RGB; leafGreen: import("pdf-lib").RGB }
) {
  // SVG 220x260 ki jagah, magar PDF mein y upar ko barhta hai -- is
  // liye har nuqte ka y ulta karna parta hai.
  const k = size / 220;
  const px = (sx: number) => x + sx * k;
  const py = (sy: number) => y + (190 - sy) * k;

  const hex = (pts: Array<[number, number]>) =>
    pts.map(([sx, sy], i) => `${i === 0 ? "M" : "L"} ${px(sx)} ${py(sy)}`).join(" ") + " Z";

  page.drawSvgPath(hex([[110, 10], [190, 55], [190, 145], [110, 190], [30, 145], [30, 55]]), {
    x: 0, y: 0, borderColor: c.gold, borderWidth: Math.max(0.8, 4 * k),
  });
  page.drawSvgPath(hex([[110, 22], [178, 60], [178, 140], [110, 178], [42, 140], [42, 60]]), {
    x: 0, y: 0, color: c.darkGreen, borderColor: c.gold, borderWidth: Math.max(0.4, 1.5 * k),
  });

  // Sitte ki dandi
  page.drawLine({
    start: { x: px(110), y: py(150) },
    end: { x: px(110), y: py(80) },
    thickness: Math.max(0.8, 4 * k),
    color: c.gold,
  });

  // Dane -- dono taraf teen teen, aur ek sab se upar
  const dana = (sx: number, sy: number, r: number) =>
    page.drawEllipse({ x: px(sx), y: py(sy), xScale: r * k, yScale: r * 1.6 * k, color: c.gold });
  for (const [dy, r] of [[125, 9], [106, 8.4], [88, 7.5]] as const) {
    dana(101, dy, r);
    dana(119, dy, r);
  }
  dana(110, 70, 6.9);

  // Neeche do patte
  page.drawSvgPath(`M ${px(110)} ${py(150)} Q ${px(86)} ${py(144)} ${px(82)} ${py(126)} Q ${px(100)} ${py(126)} ${px(110)} ${py(138)} Z`, {
    x: 0, y: 0, color: c.leafGreen,
  });
  page.drawSvgPath(`M ${px(110)} ${py(150)} Q ${px(134)} ${py(144)} ${px(138)} ${py(126)} Q ${px(120)} ${py(126)} ${px(110)} ${py(138)} Z`, {
    x: 0, y: 0, color: c.leafGreen,
  });
}
