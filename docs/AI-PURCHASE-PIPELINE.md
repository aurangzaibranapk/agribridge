# AI Purchase & Inventory Control — malik ka naqsha, aur AgriBridge ki asal haalat

Malik ne 2 September ko 23 hisson ka naqsha diya: bill ki photo se
purchase ka draft, product ka milaan, manzoori, GRN, supplier ka dena,
product ki tayyari, warehouse se dukan tak stock ki request. Ye dastavez
us naqshe ko **jo pehle se bana hua hai** us ke saamne rakhti hai — taake
wahi cheez do dafa na bane, aur kaam ki tarteeb tay ho.

Malik ke naqshe ke chaar usool, jo is project mein **pehle se qanoon**
hain:

| Malik ka usool | AgriBridge mein kahan |
|---|---|
| AI sirf draft banaye, faisla insaan kare | Bill reader (248) product nahi chunta; barcode AI se nahi parhwaya jata; POS ka thok rate gahak par likha hai, bill par nahi chuna jata |
| AI seedha database mein na likhe | Bridge AI action-requests ke zariye chalta hai; stock sirf `stock_movements` se (129); supplier ka dena sirf `purchases` (received) se (139) |
| Approval ≠ warehouse stock | `purchases`: `pending` → `received`. Receive dabne tak na stock barhta hai na dena |
| Rate na ho to POS par na jaye | `sale_rate_pending` + POS par rok + database par trigger (252) |

---

## Naqshe ka har hissa — bana hua, adhoora, ya baqi

| # | Malik ka hissa | Haalat | Kahan / kya baqi |
|---|---|---|---|
| 1 | Bill upload (photo/PDF/kai safhe) → AI parhe | ✅ **Bana hua** | `/admin/products/bill-rates` (248, 251). Photo, PDF, kai file, sheet — chaaron |
| 1 | …magar us se **Purchase ka draft** bane | ❌ **Baqi** — sab se ahem gap | Aaj bill reader sirf **trade rate** charhata hai. Purchase alag, haath se banti hai (`/admin/purchases/new`) |
| 2 | AI product matching, "95% match / confirm" | 🟡 Adha | Bill ki qatar par naam se apne aap milaan (sirf poora naam), banda chunta hai. **Fuzzy score aur "confirm" ka button baqi** |
| 3 | Naya product → Pending Products queue | ✅ Bana hua | `/admin/products/propose` + `/admin/products/pending` + `pending-edits`. **Bill se seedha propose hona baqi** |
| 4 | Bill review: tasveer bayen, AI ka data daayen, ✓/⚠ | 🟡 Adha | Bill-rates ka safha yehi karta hai (qatar + raw_text + photo). **Har khane par confidence ka nishan baqi** |
| 4 | Approve / Send Back / Reject + comment | ❌ Baqi purchase ke liye | `purchases` mein sirf pending/received/cancelled. **Send-back aur comment baqi** |
| 5 | Two-stage GRN: invoice 50, aaye 48, damaged 1, short 1, photo | 🟡 Adha | `receivePurchase` **sab ya kuch nahi** — poori invoice qty aati hai. **Short/damage/photo baqi**. (Machinery aur agri-orders mein GRN pehle se do-marhala hai) |
| 6 | Vendor ledger (kharid, adaigi, baqi) | ✅ Bana hua | `fn_supplier_true_payable` (139), `supplier_payments`, `supplier_payment_requests`, `/admin/purchases/bills` |
| 7 | Payment terms: paid / partial / credit, due date | ❌ Baqi | `purchases` par due date ya terms ka khana nahi |
| 8 | Ek payment sab jagah reflect ho | ✅ Bana hua | Supplier payment → ledger + cash book (127) + money trail. Do jagah nahi likhna paRta |
| 9 | Product Setup Queue ("Products Need Attention") | 🟡 Adha | `/admin/products/rates-baqi` sirf **rate** ki qatar hai. **Barcode/image/expiry/approval ek jagah baqi** |
| 10 | AI product setup (label ki photo se khane) | ✅ Bana hua | Maal Andar (243) — dabbe ki tasveer se naam, MRP, dates. AI sale price final nahi karta |
| 11 | Readiness gate: 🔴 NOT SALE READY | ✅ Bana hua (252) | Sale rate missing → bikta nahi. **Barcode-missing ko gate mein daalna: malik ka faisla** (karyana mein bahut cheezon par barcode nahi hota) |
| 12 | "Products Need Attention" ginti ka dashboard | ❌ Baqi | #9 ke sath banega |
| 13 | Internal barcode banana + label print | ❌ Baqi | Scanner + check digit hai (243); **apna barcode banana aur chhaapna nahi** |
| 14 | Batch-level expiry, FEFO | 🟡 Adha | `stock_batches` mein expiry hai (purchase ke raaste). **Magar `products.expiry_date` bhi hai aur sheet/intake usi ko likhte hain.** FEFO baqi |
| 15 | Warehouse product card (stock, reserved, batches) | 🟡 Adha | `/admin/inventory`, `/admin/inventory/report`. **Reserved aur nearest-expiry ek card par baqi** |
| 16 | Shop stock request (grid, qty +/−) | ✅ Bana hua | `/admin/pos/ordering` — agri_orders; Sales → Finance → Manager → dispatch → GRN ki poori chain (PR #1) |
| 17 | AI se shop order ("DAP 20, Urea 30 mangwa do") | ❌ Baqi | Bridge AI hai, magar **order-draft ka tool nahi** |
| 18 | Warehouse: approve & pick → packed → dispatched → in transit | ✅ Bana hua | `createDispatch` stock nikalta hai; lene wale ki inventory mein GRN par jata hai — raaste ka maal kisi ke stock mein nahi ginta |
| 19 | Shop receive: expected 60, mila 59, damaged 1 | 🟡 Adha | Agri-orders ka GRN hai. **Short/damage ka alag hisaab baqi** |
| 20 | Role ke hisaab se sirf apna kaam | ✅ Bana hua | Feature permissions, `loadNav`, "Mera Kaam" (250) |
| 21 | AI Command Center ("kaunse products ka rate missing hai?") | 🟡 Adha | Bridge AI sawal ka jawab deta hai. **Purchase/stock ke naye tools baqi** |
| 22 | AI orchestrator → permission → draft → human approval → audit | ✅ Usool laga hua | Bridge AI action-requests, `logAudit`, RLS |
| 23 | AI Reorder ("1.3 din ka stock baqi, 60 bhejo") | ❌ Baqi | Sale velocity ka koi hisaab abhi nahi |

**Ginti:** 23 mein se **10 bane hue**, **8 adhe**, **5 baqi**.

---

## Do baatein jo naqshe mein durust karni chahiyein

**1. Expiry product par nahi, batch par.** Malik ka point #14 bilkul
sahi hai — aur AgriBridge is waqt **dono jagah** likhta hai.
`stock_batches.expiry_date` sahi jagah hai; `products.expiry_date` us
waqt ka hai jab ek product ka ek hi batch hota tha. Sheet-import aur
Maal Andar abhi product wala likhte hain. Jab tak ek product ke do
batch na aayein, ye kaam chalta hai; **doosra batch aate hi ye ghalat
jawab dega** (nayi expiry purani par likh jayegi). Ye pipeline ka pehla
structural kaam hai.

**2. Barcode-missing ko "not sale ready" na banayein — karyana ke liye.**
Naqsha #11 kehta hai barcode na ho to bikri band. Karyana mein khuli
cheezein (daal, chawal, masala tol kar) aur chhote local products par
barcode hota hi nahi. Un par rok lagana counter rok deta hai. Tajweez:
**sale rate** lazmi (252 mein laga hua), **barcode ikhtiyari** —
magar "barcode nahi" ki fehrist Product Setup Queue mein nazar aaye.
Malik faisla karein.

---

## Kaam ki tarteeb (tajweez)

Usool: jo cheez **aaj ke karyana go-live ko rokti nahi**, wo pehle na
ho. Go-live ke liye jo hai wo kaafi hai — sheet se products, shuru ka
stock, POS, rate baqi ki fehrist.

| Qadam | Kaam | Kyun pehle | Andaza |
|---|---|---|---|
| **A** | **Bill → Purchase draft.** Bill-rates ke safhe par teesra button: "Purchase banayein". Wohi parhi hui qatarein, wohi milaan — magar natija `purchases` (pending) ho, trade rate ke sath. | Naqshe ka sab se bara gap, aur sab kuch (reader, matching, purchases, payable) pehle se maujood — sirf jorna hai | 1 din |
| **B** | **Payment terms** purchase par: paid / partial / credit, due date. Finance dashboard par "agle 7 din ki adaigi". | #7 — chhota, aur vendor ledger pehle se hai | Aadha din |
| **C** | **GRN mein short/damage/photo.** Receive par "invoice 50, aaye 48". Short → purchase adjust; damaged → `damaged_out` harkat. | #5 — aaj receive sab-ya-kuch-nahi hai; asal duniya mein kabhi nahi hota | 1 din |
| **D** | **Batch-level expiry** ko sheet aur Maal Andar mein bhi. `products.expiry_date` sirf dikhane ke liye (nearest batch). | #14 — doosra batch aate hi zaroori | 1 din |
| **E** | **Product Setup Queue** — ek safha: rate baqi, barcode nahi, tasveer nahi, expiry dekhni hai, manzoori baqi. Ginti upar. | #9, #12 — rates-baqi ko barha kar | Aadha din |
| **F** | **Send-back + comment** purchase approval par | #4 | Aadha din |
| **G** | **AI order draft** — Bridge AI ka tool: "Mahabali ke liye DAP 20" → agri_orders draft | #17 — ordering chain pehle se hai | 1 din |
| **H** | Fuzzy product matching (score + confirm) | #2 | Aadha din |
| **I** | Internal barcode + label print | #13 | 1 din |
| **J** | AI Reorder (sale velocity) | #23 — sab se aakhir, kyunke bikri ka data pehle jama hona chahiye | 2 din |

A se E tak — pipeline ka **reerh ki haddi** — chaar paanch din ka kaam.

---

## Jo is naqshe se NAHI badlega

- Stock sirf `stock_movements` se (129). Naqshe ka koi hissa seedha
  ginti nahi likhega.
- Supplier ka dena sirf `purchases` (received) se (139). "Supplier se
  aaya" ka matlab hamesha purchase.
- AI kabhi manzoor nahi karta, kabhi stock nahi bhejta, kabhi adaigi
  nahi karta. Draft, milaan, tajweez, kami pakaRna — bas.
- Jo adad maloom nahi wo NULL/khali rehta hai, sifar nahi.
