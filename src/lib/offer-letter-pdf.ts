import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface OfferLetterData {
  fullName: string;
  designation: string;
  proposedSalary: number | null;
  branchName: string | null;
  offerMessage: string | null;
  expiryDate: string | null;
}

// pdf-lib's StandardFonts only support WinAnsi encoding (basically
// Latin/English characters) - any Urdu/Arabic/other non-Latin script
// character throws a hard error and crashes PDF generation (and with
// it, the whole offer-sending action). This strips anything outside
// the safe printable ASCII range before it ever reaches pdf-lib, so a
// candidate's name or an admin's offer message typed partly in Urdu
// never breaks the PDF (and therefore never breaks the email).
function sanitizeForPdf(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

export async function generateOfferLetterPDF(data: OfferLetterData): Promise<Buffer> {
  const fullName = sanitizeForPdf(data.fullName) || data.fullName.replace(/[^\x20-\x7E]/g, "?");
  const designation = sanitizeForPdf(data.designation) || "Staff";
  const branchName = data.branchName ? sanitizeForPdf(data.branchName) : null;
  const offerMessage = data.offerMessage ? sanitizeForPdf(data.offerMessage) : null;

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.1, 0.12, 0.21);
  const gray = rgb(0.35, 0.4, 0.45);
  const black = rgb(0.1, 0.1, 0.1);

  let y = 780;

  // Header
  page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: navy });
  page.drawText("Al Rana Traders", { x: 40, y: 815, size: 18, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("Employment Offer Letter", { x: 40, y: 803, size: 9, font, color: rgb(0.7, 0.73, 0.78) });

  y = 750;
  page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 40, y, size: 10, font, color: gray });
  y -= 30;

  page.drawText(`Dear ${fullName},`, { x: 40, y, size: 12, font: boldFont, color: black });
  y -= 25;

  const introLines = [
    `We are pleased to offer you the position of ${designation} at Al Rana Traders.`,
    `Following the successful completion of our recruitment process, we believe that your`,
    `skills and experience will be a valuable addition to our team.`,
  ];
  for (const line of introLines) {
    page.drawText(line, { x: 40, y, size: 11, font, color: black });
    y -= 16;
  }
  y -= 20;

  // Offer details box
  page.drawRectangle({ x: 40, y: y - 130, width: 515, height: 130, color: rgb(0.97, 0.98, 0.97), borderColor: rgb(0.85, 0.87, 0.85), borderWidth: 1 });
  let boxY = y - 20;
  const details: [string, string][] = [
    ["Position", designation],
    ["Location", branchName ?? "-"],
    ["Monthly Salary", data.proposedSalary ? `Rs ${data.proposedSalary.toLocaleString()}` : "As discussed"],
    ["Employment Type", "Full-Time"],
    ["Offer Valid Until", data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : "As communicated by HR"],
  ];
  for (const [label, value] of details) {
    page.drawText(`${label}:`, { x: 55, y: boxY, size: 10, font: boldFont, color: gray });
    page.drawText(value, { x: 220, y: boxY, size: 10, font, color: black });
    boxY -= 20;
  }
  y = y - 150;

  if (offerMessage) {
    const msgLines = wrapText(offerMessage, 90);
    for (const line of msgLines) {
      page.drawText(line, { x: 40, y, size: 10, font, color: black });
      y -= 15;
    }
    y -= 10;
  }

  const closingLines = [
    "Kindly review the terms and conditions and confirm your acceptance via the link",
    "sent in your offer email.",
    "",
    "We look forward to welcoming you to Al Rana Traders.",
  ];
  for (const line of closingLines) {
    page.drawText(line, { x: 40, y, size: 11, font, color: black });
    y -= 16;
  }

  y -= 30;
  page.drawText("Regards,", { x: 40, y, size: 11, font, color: black });
  y -= 16;
  page.drawText("Human Resources Department", { x: 40, y, size: 11, font: boldFont, color: navy });
  y -= 14;
  page.drawText("Al Rana Traders", { x: 40, y, size: 10, font, color: gray });

  // Footer
  page.drawText("alranatraders.pk | job@alranatraders.pk", { x: 40, y: 30, size: 8, font, color: gray });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      lines.push(current.trim());
      current = word;
    } else {
      current += " " + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}