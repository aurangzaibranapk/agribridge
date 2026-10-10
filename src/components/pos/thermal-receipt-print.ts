/**
 * POS sale receipt (receipt-modal.tsx) wali thermal print CSS -- 80mm
 * kaghaz, sirf receipt chhapti hai, sab kuch pakka siyah, aur halka
 * Kisan watermark. Yahan us ka hu-ba-hu nuskha hai jo kisi bhi id par
 * lag sakta hai, taake doosri slips (jaise Cash Handover Slip) bilkul
 * POS receipt jaisi dikhein aur chhapein.
 *
 * receipt-modal.tsx ko jaan boojh kar nahi chheda gaya -- wo apni CSS
 * khud rakhta hai; ye file sirf nayi slips ke liye hai.
 *
 * Farq sirf ek: full page (modal nahi) par receipt ko print ke waqt
 * `position: absolute; top: 0; left: 0` diya jata hai, warna chhupe hue
 * sidebar/topbar ki jagah ki wajah se receipt kaghaz par neeche khisak
 * jati hai.
 */
export function thermalReceiptCss(id: string, opts: { pageMode?: boolean } = {}): string {
  const sel = `#${id}`;
  const position = opts.pageMode
    ? `position: absolute !important; left: 0 !important; top: 0 !important;`
    : `position: relative !important; left: auto !important; top: auto !important;`;
  return `
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body {
            width: 80mm;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff;
          }
          body * { visibility: hidden; }
          ${sel}, ${sel} * { visibility: visible; }
          ${sel} {
            ${position}
            width: 74mm !important;
            max-width: 74mm !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-sizing: border-box;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          ${sel} tr,
          ${sel} .receipt-totals,
          ${sel} .receipt-balances,
          ${sel} .receipt-footer {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          ${sel}, ${sel} * { color: #000 !important; }
          ${sel} .receipt-rule { border-top-width: 1.5px !important; border-color: #000 !important; }
          ${sel} .receipt-watermark { opacity: 0.18 !important; }
          ${sel} .receipt-watermark img { display: block !important; }
        }
        ${sel} { position: relative; overflow: hidden; }
        ${sel} > *:not(.receipt-watermark) { position: relative; z-index: 1; }
        ${sel} .receipt-watermark {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: 0.28;
          background-image:
            linear-gradient(45deg, transparent 49.5%, rgba(242,139,36,0.18) 49.8%, rgba(242,139,36,0.18) 50.2%, transparent 50.5%),
            linear-gradient(-45deg, transparent 49.5%, rgba(242,139,36,0.18) 49.8%, rgba(242,139,36,0.18) 50.2%, transparent 50.5%);
          background-size: 180px 180px, 180px 180px;
          background-position: center, center;
          background-repeat: repeat;
        }
        ${sel} .receipt-watermark img {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 82%;
          max-width: 300px;
          transform: translate(-50%, -50%);
          opacity: 0.62;
        }
  `;
}
