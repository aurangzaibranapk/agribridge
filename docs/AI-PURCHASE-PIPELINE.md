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
| 1 | …magar us se **Purchase ka draft** bane | ✅ **Ban gaya (254)** | Bill ke safhe par "Purchase banayein": purchase (pending) + items + batch, rate bhi charhta hai. Stock aur dena Receive par |
| 2 | AI product matching, "95% match / confirm" | ✅ **Ban gaya (H)** | `lib/product-match.ts`: lafz + harf ka score, pack ka adad alag ho to kataoti. Bill: bilkul wohi → apne aap; milta julta (≥80%, doosre se saaf aage) → lagta hai magar "andaza NN%" ke nishan ke sath, Save = tasdeeq, bina tasdeeq rate nahi charhta. Sheet: milta julta product ho to qatar rukti hai, banda naam tay karta hai. AI order: wohi score |
| 3 | Naya product → Pending Products queue | ✅ Bana hua | `/admin/products/propose` + `/admin/products/pending` + `pending-edits`. **Bill se seedha propose hona baqi** |
| 4 | Bill review: tasveer bayen, AI ka data daayen, ✓/⚠ | 🟡 Adha | Bill-rates ka safha yehi karta hai (qatar + raw_text + photo). **Har khane par confidence ka nishan baqi** |
| 4 | Approve / Send Back / Reject + comment | ✅ **Ban gaya (259)** | `purchases.review_status` (submitted / sent_back / approved / rejected); AI aur sheet ke draft manzoori ke liye jate hain; Owner/Admin manzoor / wapas (wajah lazmi) / radd; banane wala jawab de kar dobara bhejta hai; `purchase_comments` kabhi mitta nahi; bina manzoori receive ka taala DB par |
| 5 | Two-stage GRN: invoice 50, aaye 48, damaged 1, short 1, photo | ✅ **Ban gaya (256)** | Receive par har line: theek aaya / toota / kam (jorh = invoice, DB rok), tasveer, note. Stock mein sirf theek aaya; dena bhi utne ka. `v_purchase_discrepancies` |
| 6 | Vendor ledger (kharid, adaigi, baqi) | ✅ Bana hua | `fn_supplier_true_payable` (139), `supplier_payments`, `supplier_payment_requests`, `/admin/purchases/bills` |
| 7 | Payment terms: paid / partial / credit, due date | ✅ **Ban gaya (255)** | `purchases.payment_terms/credit_days/due_date`; abhi diya hua `supplier_payments` mein (ek hi darwaza); `v_supplier_due_calendar`; finance aur supplier-bills par "agle 7 din" |
| 8 | Ek payment sab jagah reflect ho | ✅ Bana hua | Supplier payment → ledger + cash book (127) + money trail. Do jagah nahi likhna paRta |
| 9 | Product Setup Queue ("Products Need Attention") | ✅ **Ban gaya (258)** | `/admin/products/setup-queue` — rate, barcode, tasveer, miyaad, manzoori ek fehrist mein; ek form se rate + barcode + manzoori (Owner/Admin). Rate Baqi (252) waise hi chalta hai |
| 10 | AI product setup (label ki photo se khane) | ✅ Bana hua | Maal Andar (243) — dabbe ki tasveer se naam, MRP, dates. AI sale price final nahi karta |
| 11 | Readiness gate: 🔴 NOT SALE READY | ✅ Bana hua (252) | Sale rate missing → bikta nahi. **Barcode-missing ko gate mein daalna: malik ka faisla** (karyana mein bahut cheezon par barcode nahi hota) |
| 12 | "Products Need Attention" ginti ka dashboard | ✅ **Ban gaya (258)** | Setup queue ke upar chhe khane (`v_product_setup_counts`), har khana filter bhi hai; Maal Andar ke khule chakkar bhi ginte hain |
| 13 | Internal barcode banana + label print | ❌ Baqi | Scanner + check digit hai (243); **apna barcode banana aur chhaapna nahi** |
| 14 | Batch-level expiry, FEFO | ✅ **Ban gaya (257)** | Har raaste ka maal apna batch banata hai (purchase, sheet, Maal Andar). `products.expiry_date` sirf dikhane ke liye: qareeb batch ki miyaad, trigger rakhta hai. FEFO: POS pehle se, transfers/dispatch ab (`stock-movement.ts`) |
| 15 | Warehouse product card (stock, reserved, batches) | 🟡 Adha | `/admin/inventory`, `/admin/inventory/report`. **Reserved aur nearest-expiry ek card par baqi** |
| 16 | Shop stock request (grid, qty +/−) | ✅ Bana hua | `/admin/pos/ordering` — agri_orders; Sales → Finance → Manager → dispatch → GRN ki poori chain (PR #1) |
| 17 | AI se shop order ("DAP 20, Urea 30 mangwa do") | ✅ **Ban gaya (260)** | Bridge AI tool `draft_shop_order`: shop aur product naam se milte hain (na mile / do milen / rate baqi → draft nahi, wapas sawal); `agri_orders` mein **draft**; action-requests par manzoor → submitted (Sales → Finance → Manager chain), radd → cancelled. AI rate nahi banata, thok rate product ka |
| 18 | Warehouse: approve & pick → packed → dispatched → in transit | ✅ Bana hua | `createDispatch` stock nikalta hai; lene wale ki inventory mein GRN par jata hai — raaste ka maal kisi ke stock mein nahi ginta |
| 19 | Shop receive: expected 60, mila 59, damaged 1 | 🟡 Adha | Agri-orders ka GRN hai. **Short/damage ka alag hisaab baqi** |
| 20 | Role ke hisaab se sirf apna kaam | ✅ Bana hua | Feature permissions, `loadNav`, "Mera Kaam" (250) |
| 21 | AI Command Center ("kaunse products ka rate missing hai?") | 🟡 Adha | Bridge AI sawal ka jawab deta hai. **Purchase/stock ke naye tools baqi** |
| 22 | AI orchestrator → permission → draft → human approval → audit | ✅ Usool laga hua | Bridge AI action-requests, `logAudit`, RLS |
| 23 | AI Reorder ("1.3 din ka stock baqi, 60 bhejo") | ❌ Baqi | Sale velocity ka koi hisaab abhi nahi |

**Ginti:** 23 mein se **19 bane hue**, **4 adhe**, **0 baqi**.

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
| **A** | ~~Bill → Purchase draft~~ | ✅ **Ho gaya (254)** | — |
| **B** | ~~Payment terms~~ | ✅ **Ho gaya (255)** | — |
| **C** | ~~GRN mein short/damage/photo~~ | ✅ **Ho gaya (256)** | — |
| **D** | ~~Batch-level expiry~~ | ✅ **Ho gaya (257)** | — |
| **E** | ~~Product Setup Queue~~ | ✅ **Ho gaya (258)** | — |
| **F** | ~~Send-back + comment~~ | ✅ **Ho gaya (259)** | — |
| **G** | ~~AI order draft~~ | ✅ **Ho gaya (260)** | — |
| **H** | ~~Fuzzy product matching~~ | ✅ **Ho gaya** (koi migration nahi) | — |
| **I** | Internal barcode + label print | #13 | 1 din |
| **J** | AI Reorder (sale velocity) | #23 — sab se aakhir, kyunke bikri ka data pehle jama hona chahiye | 2 din |

A se E tak — pipeline ka **reerh ki haddi** — chaar paanch din ka kaam. A se H tak ho chuke.

C ka ek faisla naqshe se alag hai: toota hua maal stock mein daal kar
`damaged_out` NAHI likha jata. Us ka paisa hum de hi nahi rahe (dena
sirf theek aaye maal ka banta hai), to wo hamara nuqsan nahi — supplier
ka hai. Loss report mein wo adad aata to jhoot hota. Toota aur kam
`purchase_items.damaged_qty / short_qty` mein rehta hai aur
`v_purchase_discrepancies` se nazar aata hai.

---

## Jo is naqshe se NAHI badlega

- Stock sirf `stock_movements` se (129). Naqshe ka koi hissa seedha
  ginti nahi likhega.
- Supplier ka dena sirf `purchases` (received) se (139). "Supplier se
  aaya" ka matlab hamesha purchase.
- AI kabhi manzoor nahi karta, kabhi stock nahi bhejta, kabhi adaigi
  nahi karta. Draft, milaan, tajweez, kami pakaRna — bas.
- Jo adad maloom nahi wo NULL/khali rehta hai, sifar nahi.
