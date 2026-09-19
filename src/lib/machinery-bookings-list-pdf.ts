import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Machinery bookings ki poori fehrist -- PDF.
 *
 * Ye file KHALI thi. Sifar bytes. Do jagah se bulai jati thi (email wala
 * amal aur /api/machinery/bookings-list-pdf) aur dono jagah chalte waqt
 * toot'ti thi -- "is not a module". Yani manager ka "list email karein"
 * aur "PDF download karein" dono kaam kabhi hue hi nahi.
 *
 * Bulane walon ne jo shakal maangi hui thi wohi rakhi gayi hai; unhein
 * chherna nahi paRa.
 */
export interface MachineryBookingRow {
  bookingNumber: string;
  bookingDate: string;
  farmerName: string;
  farmerPhone: string | null;
  machineLabel: string;
  totalAmount: number;
  amountReceived: number;
  status: string;
}

// A4 laita hua. Nau khane khare safhe par nahi ate -- ya to naam kat
// jate hain ya adad ek doosre par charh jate hain.
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 30;

const COLUMNS: Array<{ title: string; width: number; align?: "right" }> = [
  { title: "Booking", width: 78 },
  { title: "Tareekh", width: 70 },
  { title: "Kisan", width: 140 },
  { title: "Mobile", width: 88 },
  { title: "Machine", width: 140 },
  { title: "Kul", width: 78, align: "right" },
  { title: "Mila", width: 78, align: "right" },
  { title: "Baqi", width: 78, align: "right" },
  { title: "Haalat", width: 80 },
];

const STATUS_LABEL: Record<string, string> = {
  new: "Nayi",
  advance_paid: "Advance",
  rate_sent: "Rate bheja",
  confirmed: "Confirm",
  scheduled: "Rawana",
  in_progress: "Kaam jari",
  work_done: "Kaam mukammal",
  billed: "Bill bana",
  payment_pending: "Paisa baqi",
  closed: "Band",
  cancelled: "Cancel",
};

/**
 * Helvetica sirf Latin harf likh sakta hai. Kisan ka naam Urdu mein darj
 * ho -- aur wo aksar hota hai -- to pdf-lib poora PDF banane se inkar kar
 * deta hai, yani EK naam ki wajah se saari fehrist zaya.
 *
 * Is liye jo harf ye font nahi jaanta wo nishan ban jata hai. Adhoora
 * naam poori fehrist khone se behtar hai, aur Booking number sath hi
 * likha hota hai -- us se banda pehchana ja sakta hai.
 */
function safe(text: string | null | undefined): string {
  return String(text ?? "").replace(/[^\x20-\x7E]/g, "?");
}

function money(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Khane se lamba matn kaat kar teen nuqte -- warna wo agle khane par charh jata hai. */
function fit(text: string, font: PDFFont, size: number, width: number): string {
  let out = text;
  if (font.widthOfTextAtSize(out, size) <= width) return out;
  while (out.length > 1 && font.widthOfTextAtSize(out + "...", size) > width) out = out.slice(0, -1);
  return out + "...";
}

export async function generateMachineryBookingsListPdf(rows: MachineryBookingRow[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.45, 0.45, 0.45);
  const navy = rgb(0.05, 0.3, 0.2);
  const line = rgb(0.85, 0.85, 0.85);
  const stripe = rgb(0.97, 0.98, 0.97);
  const red = rgb(0.72, 0.16, 0.16);

  const printedOn = new Date().toLocaleString();
  let page: PDFPage | null = null;
  let y = 0;
  let pageNo = 0;

  function newPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNo += 1;

    page.drawText("Al Rana Traders - AgriBridge", { x: MARGIN, y: PAGE_HEIGHT - 42, size: 15, font: bold, color: navy });
    page.drawText("Machinery Bookings", { x: MARGIN, y: PAGE_HEIGHT - 58, size: 10, font, color: gray });
    page.drawText(`Bana: ${printedOn}`, { x: PAGE_WIDTH - MARGIN - 200, y: PAGE_HEIGHT - 42, size: 9, font, color: gray });
    page.drawText(`Safha ${pageNo}`, { x: PAGE_WIDTH - MARGIN - 200, y: PAGE_HEIGHT - 56, size: 9, font, color: gray });

    y = PAGE_HEIGHT - 82;

    // Har safhe par unwan dobara. Fehrist lambi hoti hai aur doosre safhe
    // par pahunch kar ye yaad nahi rehta ke kaun sa khana kya hai.
    let x = MARGIN;
    for (const col of COLUMNS) {
      const tx = col.align === "right" ? x + col.width - bold.widthOfTextAtSize(col.title, 9) : x;
      page.drawText(col.title, { x: tx, y, size: 9, font: bold, color: gray });
      x += col.width;
    }
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: line });
    y -= 16;
  }

  newPage();

  let totalSum = 0;
  let receivedSum = 0;

  for (const [i, row] of rows.entries()) {
    if (y < MARGIN + 60) newPage();
    const p = page!;

    if (i % 2 === 1) {
      p.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_WIDTH - MARGIN * 2, height: 15, color: stripe });
    }

    const balance = row.totalAmount - row.amountReceived;
    totalSum += row.totalAmount;
    receivedSum += row.amountReceived;

    const cells: Array<{ text: string; bold?: boolean; color?: ReturnType<typeof rgb> }> = [
      { text: safe(row.bookingNumber), bold: true },
      { text: safe(row.bookingDate) },
      { text: safe(row.farmerName) },
      { text: safe(row.farmerPhone ?? "-") },
      { text: safe(row.machineLabel || "-") },
      { text: money(row.totalAmount) },
      { text: money(row.amountReceived) },
      // Baqi paisa laal hai. Poori fehrist ka maqsad hi yahi khana hai;
      // baqi sab us tak pahunchne ka raasta hai.
      { text: money(balance), bold: balance > 0, color: balance > 0 ? red : black },
      { text: safe(STATUS_LABEL[row.status] ?? row.status) },
    ];

    let x = MARGIN;
    cells.forEach((cell, ci) => {
      const col = COLUMNS[ci];
      const f = cell.bold ? bold : font;
      const text = fit(cell.text, f, 9, col.width - 6);
      const tx = col.align === "right" ? x + col.width - 6 - f.widthOfTextAtSize(text, 9) : x;
      p.drawText(text, { x: tx, y, size: 9, font: f, color: cell.color ?? black });
      x += col.width;
    });

    y -= 15;
  }

  if (rows.length === 0) {
    page!.drawText("Koi booking nahi.", { x: MARGIN, y, size: 10, font, color: gray });
    y -= 15;
  }

  // Jorh. Ye hamesha aakhri safhe par aata hai, aur agar jagah na bache to
  // apne liye naya safha le leta hai -- adhoora jorh na dikhne se bhi bura
  // hai.
  if (y < MARGIN + 50) newPage();
  const p = page!;
  y -= 6;
  p.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: line });
  y -= 16;

  const balanceSum = totalSum - receivedSum;
  const summary = [
    { title: "Bookings", value: String(rows.length) },
    { title: "Kul", value: `Rs ${money(totalSum)}` },
    { title: "Mila", value: `Rs ${money(receivedSum)}` },
    { title: "Baqi", value: `Rs ${money(balanceSum)}` },
  ];

  let sx = MARGIN;
  for (const s of summary) {
    p.drawText(s.title, { x: sx, y, size: 9, font, color: gray });
    p.drawText(s.value, { x: sx, y: y - 14, size: 12, font: bold, color: s.title === "Baqi" && balanceSum > 0 ? red : black });
    sx += 150;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
