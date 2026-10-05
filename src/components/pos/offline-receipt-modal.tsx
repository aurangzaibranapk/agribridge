"use client";

import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/form";

export interface OfflineReceiptData {
  receiptNo: string;
  createdAt: string;
  sellerName: string;
  customerName: string;
  paymentMode: string;
  total: number;
  cashPaid: number;
  khataAmount: number;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
}

export function OfflineReceiptModal({ receipt, onClose }: { receipt: OfflineReceiptData; onClose: () => void }) {
  const date = new Date(receipt.createdAt).toLocaleString("en-PK", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:static print:block print:bg-transparent print:p-0">
      <style>{`@media print { @page { size: 80mm auto; margin:0; } html,body { width:80mm; margin:0!important; padding:0!important; background:#fff; } body * { visibility:hidden; } #offline-receipt-print, #offline-receipt-print * { visibility:visible; } #offline-receipt-print { position:absolute; left:0; top:0; width:74mm!important; max-width:74mm!important; margin:0!important; padding:2mm!important; box-sizing:border-box; overflow:hidden; color:#000!important; } #offline-receipt-print .offline-watermark img { display:block!important; } } .offline-watermark { position:absolute; inset:0; z-index:0; pointer-events:none; opacity:.18; background-image:linear-gradient(45deg,transparent 49.5%,rgba(242,139,36,.18) 49.8%,rgba(242,139,36,.18) 50.2%,transparent 50.5%),linear-gradient(-45deg,transparent 49.5%,rgba(242,139,36,.18) 49.8%,rgba(242,139,36,.18) 50.2%,transparent 50.5%); background-size:180px 180px; } .offline-watermark img { position:absolute; left:50%; top:50%; width:82%; transform:translate(-50%,-50%); opacity:.62; } #offline-receipt-print { position:relative; overflow:hidden; } #offline-receipt-print > *:not(.offline-watermark) { position:relative; z-index:1; }`}</style>
      <div id="offline-receipt-print" className="w-full max-w-sm rounded-card bg-white p-5 font-mono text-black shadow-xl print:w-[74mm] print:max-w-[74mm] print:rounded-none print:p-[2mm] print:shadow-none">
        <div className="offline-watermark" aria-hidden="true"><img src="/branding/kisan-watermark.svg" alt="" /></div>
        <div className="mb-3 flex items-center justify-between print:hidden">
          <h3 className="font-display text-base font-semibold">Offline Receipt</h3>
          <button onClick={onClose} className="text-surface-400" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold uppercase">{receipt.sellerName}</p>
          <p className="text-xs">{date}</p>
          <p className="mt-1 text-xs font-bold">TEMP: {receipt.receiptNo}</p>
          <p className="text-[10px] font-bold">OFFLINE — SYNC PENDING</p>
        </div>
        <div className="my-3 border-t-2 border-dashed border-black" />
        <div className="space-y-1 text-xs">
          <p>Customer: {receipt.customerName}</p>
          <p>Payment: {receipt.paymentMode}</p>
        </div>
        <div className="my-3 border-t-2 border-dashed border-black" />
        <table className="w-full text-xs">
          <thead><tr className="border-b border-black"><td>Item</td><td className="text-center">Qty</td><td className="text-right">Rate</td><td className="text-right">Total</td></tr></thead>
          <tbody>{receipt.items.map((item, i) => <tr key={i} className="align-top"><td className="py-1 pr-1">{item.name}</td><td className="py-1 text-center">{item.quantity}</td><td className="py-1 text-right">{item.unitPrice.toLocaleString()}</td><td className="py-1 text-right">{item.subtotal.toLocaleString()}</td></tr>)}</tbody>
        </table>
        <div className="my-3 border-t-2 border-dashed border-black" />
        <div className="space-y-1 text-xs"><p className="flex justify-between font-bold"><span>Total</span><span>Rs {receipt.total.toLocaleString()}</span></p>{receipt.cashPaid > 0 && <p className="flex justify-between"><span>Cash Paid</span><span>Rs {receipt.cashPaid.toLocaleString()}</span></p>}{receipt.khataAmount > 0 && <p className="flex justify-between"><span>Khata</span><span>Rs {receipt.khataAmount.toLocaleString()}</span></p>}</div>
        <div className="my-3 border-t-2 border-dashed border-black" />
        <p className="text-center text-xs">Official sale number sync ke baad milega.</p>
        <div className="mt-4 print:hidden"><Button className="w-full" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print Slip</Button></div>
      </div>
    </div>
  );
}
