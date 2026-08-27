import jsPDF from "jspdf";
import "jspdf-autotable";

interface Transaction {
  created_at: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  runningBalance: number;
}

interface BankData {
  name: string;
  account_number?: string;
  logo_url?: string;
  opening_balance: number;
}

interface Summary {
  openingBalance: number;
  closingBalance: number;
  totalCredit: number;
  totalDebit: number;
  startDate: string;
  endDate: string;
}

export async function generateBankStatementPDF(
  bank: BankData,
  transactions: Transaction[],
  summary: Summary
): Promise<Blob> {
  const doc = new jsPDF() as any;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 10;

  // Header with logo
  if (bank.logo_url) {
    try {
      const img = await fetch(bank.logo_url).then((res) => res.blob());
      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onload = () => {
          const imgData = reader.result as string;
          doc.addImage(imgData, "PNG", 10, yPosition, 20, 15);
          resolve(null);
        };
        reader.readAsDataURL(img);
      });
    } catch (err) {
      console.warn("Could not load bank logo:", err);
    }
  }

  // Bank title
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text(bank.name, pageWidth / 2, yPosition + 8, { align: "center" });
  yPosition += 20;

  // Bank details
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  if (bank.account_number) {
    doc.text(`Account: ${bank.account_number}`, 10, yPosition);
    yPosition += 5;
  }

  doc.text(
    `Statement Period: ${summary.startDate} to ${summary.endDate}`,
    10,
    yPosition
  );
  yPosition += 8;

  // Summary boxes
  const boxWidth = (pageWidth - 30) / 3;
  const boxHeight = 18;
  const boxY = yPosition;

  // Opening Balance
  doc.setDrawColor(200, 200, 200);
  doc.rect(10, boxY, boxWidth, boxHeight);
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  doc.text("Opening Balance", 10 + 2, boxY + 5);
  doc.setFont(undefined, "normal");
  doc.text(
    `Rs ${summary.openingBalance.toLocaleString("en-PK")}`,
    10 + 2,
    boxY + 12
  );

  // Total Credit
  doc.rect(10 + boxWidth + 5, boxY, boxWidth, boxHeight);
  doc.setFont(undefined, "bold");
  doc.text("Total Credit", 10 + boxWidth + 7, boxY + 5);
  doc.setFont(undefined, "normal");
  doc.text(
    `Rs ${summary.totalCredit.toLocaleString("en-PK")}`,
    10 + boxWidth + 7,
    boxY + 12
  );

  // Closing Balance
  doc.rect(10 + 2 * (boxWidth + 5), boxY, boxWidth, boxHeight);
  doc.setFont(undefined, "bold");
  doc.text("Closing Balance", 10 + 2 * (boxWidth + 5) + 2, boxY + 5);
  doc.setFont(undefined, "normal");
  doc.text(
    `Rs ${summary.closingBalance.toLocaleString("en-PK")}`,
    10 + 2 * (boxWidth + 5) + 2,
    boxY + 12
  );

  yPosition += boxHeight + 8;

  // Transactions table
  const tableData = transactions.map((txn) => [
    new Date(txn.created_at).toLocaleDateString("en-PK"),
    txn.description.substring(0, 30),
    txn.type === "income"
      ? `Rs ${txn.amount.toLocaleString("en-PK")}`
      : "",
    txn.type === "expense"
      ? `Rs ${txn.amount.toLocaleString("en-PK")}`
      : "",
    `Rs ${txn.runningBalance.toLocaleString("en-PK")}`,
  ]);

  doc.autoTable({
    head: [["Date", "Description", "Credit", "Debit", "Balance"]],
    body: tableData,
    startY: yPosition,
    columnStyles: {
      0: { halign: "center", cellWidth: 25 },
      1: { halign: "left", cellWidth: 60 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", cellWidth: 30 },
    },
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [40, 120, 50], textColor: 255, fontStyle: "bold" },
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(8);
  doc.setFont(undefined, "italic");
  doc.text(
    `Generated on ${new Date().toLocaleString("en-PK")}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  return doc.output("blob");
}