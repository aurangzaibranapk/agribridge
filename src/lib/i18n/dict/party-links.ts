/**
 * 622 Party links — customer + supplier ek banda. EN / Roman / Urdu.
 * `pl_` prefix; do kharche keys `kh_udhaar_*`.
 */
export const partyLinksDict = {
  pl_title: { en: "Party Links (Customer + Supplier)", rm: "Party Links (Customer + Supplier)", ur: "پارٹی لنکس (کسٹمر + سپلائر)" },
  pl_desc: {
    en: "Mark a customer and a supplier as the same person. Nothing is auto-deducted — netting only through an approved settlement.",
    rm: "Aik customer aur aik supplier ko aik hi banda mark karein. Kuch khud nahi katta — kaatna sirf manzoor shuda settlement se.",
    ur: "ایک کسٹمر اور ایک سپلائر کو ایک ہی بندہ مارک کریں۔ کچھ خود نہیں کٹتا — کاٹنا صرف منظور شدہ سیٹلمنٹ سے۔",
  },
  pl_customer: { en: "Customer", rm: "Customer", ur: "کسٹمر" },
  pl_supplier: { en: "Supplier", rm: "Supplier", ur: "سپلائر" },
  pl_note: { en: "Note (optional)", rm: "Note (ikhtiyari)", ur: "نوٹ (اختیاری)" },
  pl_choose: { en: "— Choose —", rm: "— Chunein —", ur: "— چنیں —" },
  pl_link_btn: { en: "Link them", rm: "Link karein", ur: "لنک کریں" },
  pl_unlink_btn: { en: "Remove link", rm: "Link band karein", ur: "لنک بند کریں" },
  pl_active_links: { en: "Active links", rm: "Fa'aal links", ur: "فعال لنکس" },
  pl_none: { en: "No links yet.", rm: "Abhi koi link nahi.", ur: "ابھی کوئی لنک نہیں۔" },
  pl_they_owe: { en: "They owe us (1100)", rm: "Unhon ne dena (1100)", ur: "انہوں نے دینا (1100)" },
  pl_we_owe: { en: "We owe them (2000)", rm: "Hum ne dena (2000)", ur: "ہم نے دینا (2000)" },
  pl_net: { en: "Net", rm: "Net", ur: "نیٹ" },
  pl_net_they: { en: "party owes us", rm: "party ne dena", ur: "پارٹی نے دینا" },
  pl_net_we: { en: "we owe party", rm: "hum ne dena", ur: "ہم نے دینا" },
  pl_net_even: { en: "settled", rm: "barabar", ur: "برابر" },
  pl_only_finance: { en: "Only Owner/Admin/Finance can manage party links.", rm: "Party links sirf Owner/Admin/Finance sambhal sakte hain.", ur: "پارٹی لنکس صرف اونر/ایڈمن/فنانس سنبھال سکتے ہیں۔" },
  pl_settle_title: { en: "Net a linked party (Dr 2000 supplier / Cr 1100 customer)", rm: "Linked party ka hisaab kaatein (Dr 2000 supplier / Cr 1100 customer)", ur: "لنکڈ پارٹی کا حساب کاٹیں (Dr 2000 سپلائر / Cr 1100 کسٹمر)" },
  pl_settle_hint: {
    en: "Maker-checker: a different Finance/Admin must approve. Amount cannot exceed the smaller of the two balances.",
    rm: "Maker-checker: koi DOOSRA Finance/Admin manzoor karega. Raqam dono baqi mein se chhoti se zyada nahi ho sakti.",
    ur: "میکر چیکر: کوئی دوسرا فنانس/ایڈمن منظور کرے گا۔ رقم دونوں بقایا میں سے چھوٹی سے زیادہ نہیں ہو سکتی۔",
  },
  pl_linked_party: { en: "Linked party", rm: "Linked party", ur: "لنکڈ پارٹی" },
  pl_amount: { en: "Amount (Rs)", rm: "Raqam (Rs)", ur: "رقم (روپے)" },
  pl_reason: { en: "Reason (required)", rm: "Wajah (lazmi)", ur: "وجہ (لازمی)" },
  pl_request_btn: { en: "Request adjustment", rm: "Adjustment maangein", ur: "ایڈجسٹمنٹ مانگیں" },
  pl_limit: { en: "Max now", rm: "Abhi hadd", ur: "ابھی حد" },
  pl_gl_rows_note: {
    en: "Also includes ledger entries on 2000/1120 for this supplier (payments from Recovery, supplier bills from Kharche, settlements).",
    rm: "Is mein is supplier ke 2000/1120 ledger entries bhi shamil hain (Recovery se payment, Kharche se supplier bill, settlements).",
    ur: "اس میں اس سپلائر کی 2000/1120 لیجر انٹریز بھی شامل ہیں (ریکوری سے پیمنٹ، خرچے سے سپلائر بل، سیٹلمنٹس)۔",
  },
  kh_udhaar_bill_title: { en: "Bill on credit — no cash moves", rm: "Udhaar par bill — cash nahi hilega", ur: "ادھار پر بل — کیش نہیں ہلے گا" },
  kh_udhaar_bill_hint: {
    en: "Posts Dr expense (diesel → 6010) / Cr 2000 on this supplier after approval. Pay later via \"Payment Send Karein\" with 2000.",
    rm: "Manzoori ke baad Dr kharcha (diesel → 6010) / Cr 2000 is supplier par. Adaigi baad mein \"Payment Send Karein\" se 2000 ke sath.",
    ur: "منظوری کے بعد Dr خرچہ (ڈیزل → 6010) / Cr 2000 اس سپلائر پر۔ ادائیگی بعد میں \"Payment Send Karein\" سے 2000 کے ساتھ۔",
  },
} as const;
