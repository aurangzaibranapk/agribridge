import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface RentAgreementData {
  branchName: string;
  branchAddress: string | null;
  landlordName: string;
  landlordContact: string | null;
  landlordCnic: string | null;
  monthlyRent: number;
  dueDay: number;
  startDate: string;
  endDate: string | null;
}

export async function generateRentAgreementPDF(data: RentAgreementData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.1, 0.12, 0.21);
  const gray = rgb(0.35, 0.4, 0.45);
  const black = rgb(0.1, 0.1, 0.1);

  page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: navy });
  page.drawText("Al Rana Traders", { x: 40, y: 815, size: 18, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("Shop Rent Agreement", { x: 40, y: 803, size: 9, font, color: rgb(0.7, 0.73, 0.78) });

  let y = 750;
  page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 40, y, size: 10, font, color: gray });
  y -= 30;

  const introLines = [
    "This Rent Agreement is made between the Landlord and Al Rana Traders",
    "(the Tenant), for the shop/branch premises detailed below, on the",
    "following terms and conditions:",
  ];
  for (const line of introLines) {
    page.drawText(line, { x: 40, y, size: 11, font, color: black });
    y -= 16;
  }
  y -= 20;

  page.drawRectangle({ x: 40, y: y - 170, width: 515, height: 170, color: rgb(0.97, 0.98, 0.97), borderColor: rgb(0.85, 0.87, 0.85), borderWidth: 1 });
  let boxY = y - 20;
  const details: [string, string][] = [
    ["Shop / Branch", data.branchName],
    ["Address", data.branchAddress ?? "-"],
    ["Landlord Name", data.landlordName],
    ["Landlord Contact", data.landlordContact ?? "-"],
    ["Landlord CNIC", data.landlordCnic ?? "-"],
    ["Monthly Rent", `Rs ${data.monthlyRent.toLocaleString()}`],
    ["Rent Due Date", `${data.dueDay} of every month`],
    ["Agreement Start", new Date(data.startDate).toLocaleDateString()],
    ["Agreement End", data.endDate ? new Date(data.endDate).toLocaleDateString() : "Ongoing / As renewed"],
  ];
  for (const [label, value] of details) {
    page.drawText(`${label}:`, { x: 55, y: boxY, size: 10, font: boldFont, color: gray });
    page.drawText(value, { x: 220, y: boxY, size: 10, font, color: black });
    boxY -= 17;
  }
  y = y - 190;

  const termsHeader = "Terms & Conditions:";
  page.drawText(termsHeader, { x: 40, y, size: 12, font: boldFont, color: black });
  y -= 20;

  const terms = [
    `1. Monthly rent of Rs ${data.monthlyRent.toLocaleString()} is payable by the ${data.dueDay}${ordinalSuffix(data.dueDay)} of each month.`,
    "2. The Tenant will use the premises solely for lawful business operations.",
    "3. Any structural changes require prior written consent from the Landlord.",
    "4. Either party may terminate this agreement with prior written notice as",
    "   mutually agreed upon separately.",
    "5. The premises will be maintained in good condition throughout the tenancy.",
  ];
  for (const line of terms) {
    page.drawText(line, { x: 40, y, size: 10, font, color: black });
    y -= 15;
  }

  y -= 40;
  page.drawText("_____________________", { x: 40, y, size: 11, font, color: black });
  page.drawText("_____________________", { x: 320, y, size: 11, font, color: black });
  y -= 14;
  page.drawText("Landlord Signature", { x: 40, y, size: 9, font, color: gray });
  page.drawText("Al Rana Traders (Tenant)", { x: 320, y, size: 9, font, color: gray });

  page.drawText("alranatraders.pk | job@alranatraders.pk", { x: 40, y: 30, size: 8, font, color: gray });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function ordinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}