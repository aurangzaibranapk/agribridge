-- =====================================================================
-- AgriBridge — Migration 275: Training guide baqi chhe modules ke liye (274 ka tatimma)
-- =====================================================================
-- Har module ke qadam ab asal button par roshan hote hain (data-guide):
-- pos-checkout, shop-order-submit, return-submit, cash-close-submit,
-- supplier-pay, finance-add-txn, permissions-save, milk-verify,
-- booking-create, transfer-request. target null = safhe ka link roshan.
-- =====================================================================

update training_modules set guide = '[
  {"path":"/admin/pos","target":"[data-guide=\"pos-checkout\"]","text":"Scan ya naam se cheez cart mein daalein, cash ya khata chunein, phir ye Checkout dabayein."},
  {"path":"/admin/products/setup?f=rate","target":null,"text":"Cheez POS par na mile to ya rate baqi hai (yahan) ya stock nahi. Bina sale rate ke cheez bikti nahi."},
  {"path":"/admin/pos/ordering/new","target":"[data-guide=\"shop-order-submit\"]","text":"Godam se maal mangwana ho to order yahan banayein aur ye button dabayein."},
  {"path":"/admin/purchases/grn","target":null,"text":"Aaya hua maal yahan receive karein: theek / toota / kam."},
  {"path":"/admin/agri-returns/new","target":"[data-guide=\"return-submit\"]","text":"Wapas bhejna ho to yahan return banayein; HQ receive kare tab stock aur khata hilte hain."},
  {"path":"/admin/cash-close","target":"[data-guide=\"cash-close-submit\"]","text":"Raat ko cash ginein aur ye button dabayein -- farq khud dikhega. (Ginne wala aur close karne wala alag: SoD.)"}
]'::jsonb where key = 'sales';

update training_modules set guide = '[
  {"path":"/admin/purchases/bills","target":null,"text":"Supplier ka dena: received maal, adaigi, baqi -- teenon adad sath. Due date yahin."},
  {"path":"/admin/suppliers","target":null,"text":"Supplier chunein, statement kholein."},
  {"path":"/admin/suppliers","target":"[data-guide=\"supplier-pay\"]","text":"Statement ke andar adaigi likhein aur Save dabayein; dena khud dobara banta hai."},
  {"path":"/admin/finance","target":"[data-guide=\"finance-add-txn\"]","text":"Cash book ki entry yahan: qisam, raqam, wajah -- phir ye button."},
  {"path":"/admin/crm","target":null,"text":"Gahak ka khata yahan."},
  {"path":"/admin/cash-close","target":null,"text":"Raat ki ginti ka farq yahan dekhein. Sifar aur \"hisaab nahi\" ek cheez nahi."}
]'::jsonb where key = 'finance';

update training_modules set guide = '[
  {"path":"/admin/users","target":null,"text":"Users aur unka role yahan."},
  {"path":"/admin/permissions","target":"[data-guide=\"permissions-save\"]","text":"Har feature par kya kar sakta hai (view/create/approve...) aur kitna data -- chun kar ye Save dabayein."},
  {"path":"/admin/access-requests","target":null,"text":"Staff ki ijazat ki darkhwastein yahan manzoor/radd; Takraao tab par SoD ki report."},
  {"path":"/admin/departments","target":null,"text":"Menu department se banta hai -- yahan."},
  {"path":"/admin/platform/help","target":null,"text":"Har safhe ki maloomat yahan likhein -- \"?\" panel aur Work Coach wahi batate hain."},
  {"path":"/admin/academy/team","target":null,"text":"Team ki training ki halat."}
]'::jsonb where key = 'admin_office';

update training_modules set guide = '[
  {"path":"/admin/milk-collection/collect","target":null,"text":"Roz ka doodh: kisan chunein, litre aur FAT likhein, mehfooz karein. Offline bhi chalta hai, baad mein sync."},
  {"path":"/admin/milk-collection/chiller","target":null,"text":"Chiller par FAT aur miqdar."},
  {"path":"/admin/milk-collection/verify","target":"[data-guide=\"milk-verify\"]","text":"Entry tasdeeq karein -- ye button. Jis ne entry ki wo verify nahi kar sakta (SoD)."},
  {"path":"/admin/milk-collection/routes","target":null,"text":"Dispatch aur route ki kami yahan."}
]'::jsonb where key = 'dairy';

update training_modules set guide = '[
  {"path":"/admin/machinery-rental/booking/new","target":"[data-guide=\"booking-create\"]","text":"Kisan, machine, zameen aur rate bhar kar ye button -- booking ban jati hai."},
  {"path":"/admin/machinery-rental/dashboard","target":null,"text":"Kaam ki qatarein aur dispatch yahan se."},
  {"path":"/admin/machinery-rental/list","target":null,"text":"Booking kholein: bill aur wusooli us ke andar."}
]'::jsonb where key = 'machinery';

update training_modules set guide = '[
  {"path":"/admin/my-work","target":null,"text":"\"Aaj kya baqi hai\" -- pehle lal wale. Har qatar par click se kaam ke safhe par."},
  {"path":"/admin/purchases","target":"[data-guide=\"purchase-review\"]","text":"Purchase ki manzoori: Jaanch dabayein -- manzoor, wapas ya radd. Jis ne banayi wo khud manzoor nahi kar sakta."},
  {"path":"/admin/agri-orders","target":null,"text":"Shop orders ki manzoori yahan."},
  {"path":"/admin/stock-transfers","target":"[data-guide=\"transfer-request\"]","text":"Shop ko maal bhejne ki darkhwast yahan se."},
  {"path":"/admin/academy/team","target":null,"text":"Team ki training ki halat -- kaun kahan hai."}
]'::jsonb where key = 'manager';
