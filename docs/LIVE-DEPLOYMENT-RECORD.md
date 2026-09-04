# Live deployment record — 1 September 2026

Ye file **asal ginti** rakhti hai, kisi ki batai hui nahi. Har adad
Live database (`ktskwawkslaznkjjacni`) se seedha nikala gaya hai.

---

## 1. Qatarein — 1 September 2026, 19:15 UTC

Ye ginti **migration 226–242 chalne ke BAAD** ki hai. Us se pehle ki
ginti kisi ne mehfooz nahi ki thi.

| Table | Qatarein |
|---|---|
| farmers | **5** |
| profiles | **19** |
| machinery_bookings | **6** |
| machinery_bills | **3** |
| products | **206** |
| journal_lines | **16** |
| milk_entries | 0 |
| agri_orders | 0 |
| farmer_credit_ledger | 0 |
| grain_procurement_entries | 0 |

**Sifar yahan "dekh liya, khali hai" ka matlab rakhta hai** — "jaancha
nahi" ka nahi. Ye chaar tables waqai khali hain.

### Ek farq jo saamne aaya

Mujhe jo ginti bhej kar batai gayi thi, wo Live se mel nahi khati:

| Table | Batai gayi | Live par asal |
|---|---|---|
| farmers | 2 | **5** |
| machinery_bookings | 3 | **6** |
| machinery_bills | 2 | **3** |

profiles (19) aur chaaron sifar theek the. Baqi teen adad kisi purane
waqt ke lagte hain. **Milan ke liye upar wali ginti istemal hogi**, wo
nahi.

---

## 2. Migrations — kya chal chuki hain

| Kahan | Kaun si |
|---|---|
| **Live par chal chuki** | 225, **226 se 242** (1 September), aur **243 se 264** (2 September, ~12:50 UTC -- malik ne naya build pehle Start kar diya tha, is liye backup ki tasdeeq ke baghair, paanch batch mein) |
| **Live par NAHI chalin** | **265 se 277** -- 277 features/dashboards ke naam teenon zabanon mein (sirf naam, koi ijazat nahi); 276 staff_message_broadcasts (elaan ka audit) + messages ka help; 275 training guides (sirf data); 274 transaction-level SoD triggers (16 tables par; block wale qadam ruk sakte hain jahan ek hi banda banata aur manzoor karta hai -- malik ko pehle batana), finance.reversal feature (finance role ka reversal haq khatam, sirf Owner/Admin ya darkhwast), training guide; 272 role split (finance/hr/manager ki role ijazat, malik ka faisla; Live par lagte hi Finance Team ka submissions approve, Manager ka stock-count approve/cash-close create hat jayega -- malik ko pehle batana); 273 units + pack_sizes + products.unit_code backfill; 271 access_conflict_rules/findings/events/scans + fn_access_conflicts + baseline scan (kuch revoke nahi; Live par baseline report banegi); 265 Inventory menu saaf (sirf menu qatarein); 266 feature_help + 32 help; 267 my-work feature; 268 training_mode / ui_mode / training_modules / staff_training_progress / academy; 269 suggestions + suggestion_comments (Improvements Center); 270 access_requests + access_request_events (AI Access Request). **Naya build (367396f) in ke BAAD upload ho** -- warna My Work, Academy, Improvements, My Access, "?" help panel aur Work Coach ke naye tools tootenge. |
| Testing par | 226 se 277 tak sab |

**(Ho chuka.) 243–264 chalne se pehle build upload nahi hona chahiye tha.** Warna ye safhe tootenge: products ki fehrist, POS, product
ka form (naya aur edit), Maal Andar, Bill se Trade Rate, aur CRM mein
gahak mehfooz karna.

---

## 3. Backup — **NAHI liya gaya**

| Cheez | Haalat |
|---|---|
| `live-schema-20260831.sql` | **Maujood nahi** — main ne kabhi banai hi nahi |
| `live-data-20260831.sql` | **Maujood nahi** — main ne kabhi banai hi nahi |
| Restore drill | **NOT TESTED** (pehle se hi) |

Repo mein `schema.sql` naam ki ek file hai magar wo **khali hai (0
bytes)**, pehle commit se. Us ka backup se koi taalluq nahi.

### Kyun nahi liya ja saka

`pg_dump` ke liye Live database ka connection string chahiye. Wo string
is chat mein kabhi nahi aani chahiye (ye is project ka tay shuda usool
hai). Is machine ke paas wo string hai hi nahi, is liye yahan se dump
banana mumkin nahi.

### Kis tarah banegi — malik ki apni machine par

Supabase Dashboard → **Project Settings → Database → Connection string**
(wahan se copy karein, chat mein na dalein), phir apni machine par:

```
pg_dump "<connection string>" --schema-only --no-owner --no-privileges -f live-schema-20260901.sql
```

```
pg_dump "<connection string>" --data-only --no-owner --no-privileges -f live-data-20260901.sql
```

Phir dono files ka size dekh lein:

```
ls -lh live-schema-20260901.sql live-data-20260901.sql
```

**Schema wali file kam az kam kuch sau KB honi chahiye** (is nizam mein
240 se zyada tables, views aur functions hain). Data wali abhi chhoti
rahegi — Live par asal data thoRa hai.

Agar `pg_dump` na ho to Supabase Dashboard → **Database → Backups** se
bhi liya ja sakta hai.

---

## 4. Ginti -- 2 September 2026, 243–264 ke BAAD

| Table | 1 Sep | 2 Sep (baad) |
|---|---|---|
| farmers | 5 | **6** |
| profiles | 19 | 19 |
| machinery_bookings | 6 | **7** |
| machinery_bills | 3 | 3 |
| products | 206 | 206 |
| journal_lines | 16 | 16 |
| milk_entries / agri_orders / farmer_credit_ledger / grain_procurement_entries | 0 | 0 |

Koi adad kam nahi hua. farmers aur bookings 1 Sep ke baad asal kaam se
barhe. Naye: 7 tables, 11 views, 8 functions, 6 menu items -- sab
maujood. 206 mein se **177 products par barcode nahi** (Barcode Label
safha isi ke liye hai).

## 4b. Ye ginti dobara kab dekhni hai

243–263 chalne ke **foran baad** wohi das tables dobara ginein aur upar
wali fehrist se milayein. Kisi bhi adad ka **kam** hona rukne ki wajah
hai — un migrations mein koi cheez mitane wali nahi hai, is liye ginti
sirf barh sakti hai, ghat nahi sakti.

---

## 5. Deployment — 4 September 2026, MUKAMMAL

Malik apne system par the; poori tarteeb un ke saath chali. **P0 rule ki
har shart poori hui, usi tarteeb mein.**

**Backup (verified).** Live ka apna `pg_dump`, PostgreSQL 17.11 se (Live
17.6 hai -- 18 jaan boojh kar istemal nahi kiya: 18 ka bana dump PG 17
par wapas na daala ja sake to wo backup nahi rehta):

| File | Size |
|---|---|
| `live-schema-20260904.sql` | 1.2 MB |
| `live-data-20260904.sql` | 1.5 MB |
| `live-full-20260904.sql` | 2.6 MB |

Yahan ek baat pakRi gayi jo likhni zaroori hai: **3 September ka data
dump adhoora tha.** Us din schema 1.2M, data 314K aur full 2.6M tha --
1.2 + 0.3 kabhi 2.6 nahi banta. 4 September ke adad aapas mein milte
hain (1.2 + 1.5 ≈ 2.6). Aage se backup ki tasdeeq mein sirf "file bani"
kaafi nahi -- **schema + data ka jama full ke qareeb hona chahiye**,
warna backup hai magar poora nahi.

**Ginti (pehle → baad).** Kuch zaya nahi hua:

| Cheez | Pehle | Baad |
|---|---|---|
| Staff | 19 | 19 |
| Kisan | 7 | 7 |
| Products | 205 | 205 |
| Dukanein / Shaakhein | 8 / 5 | 8 / 5 |
| Machinery bookings | 8 | 8 |
| Finance qatarein | 3 | 3 |
| Role ki ijazat | 183 | 183 |
| POS / Kharid / Stock / Doodh | 0 | 0 |
| Tables | 262 | **278** |
| Views | 76 | **78** |
| feature_help (rm) | — | **183** |
| Help baqi | — | **0** |

**Migrations 265–288 -- sab chal gayin.** 265 MCP se; 266–288 malik ki
apni machine se `psql` ke zariye, seedha repo ki file se:

```
export PGCLIENTENCODING=UTF8
for f in $(ls supabase/migrations | awk -F_ '$1>=266 && $1<=288' | sort -n); do
  echo "=== $f"
  psql "$LIVEURL" -v ON_ERROR_STOP=1 -q -1 -f "supabase/migrations/$f" || { echo ">>> RUK GAYA: $f"; break; }
done
```

Ye tareeqa jaan boojh kar chuna gaya. Pehle main har migration ki SQL
haath se dobara likh kar bhej raha tha -- 240 KB. **Us mein ek harf ki
ghalti bhi asal database mein ja sakti thi.** File seedha chalane mein
likhai ka koi mauqa hi nahi rehta. `ON_ERROR_STOP=1` aur `-1` (har file
apne transaction mein) se ghalti par wo file poori wapas hoti aur loop
wahin ruk jata -- aage ki file nahi chalti.

`psql` migration ka register khud nahi likhta, is liye
`supabase_migrations.schema_migrations` mein 23 qatarein baad mein
daali gayin.

**Nateeje jo chalte waqt nazar aaye:** 274 ne 13 tables par khud-manzoori
ki rok lagayi (`fn_sod_attach_triggers = 13`); 271/272 ka access
conflict scan chala. Baqi sab paighaam NOTICE the (`drop ... if exists`),
ghalti ek bhi nahi.

**Build aur upload.** `npm run build` → `deploy.tar.gz` → cPanel Stop →
upload (overwrite) → Extract → Start. `BRIDGE_AI_GEMINI_API_KEY` pehle
se laga hua tha.

**Smoke test (paanch safhe, sab theek):** `/admin/command-center` (naye
chaar card aur nafa nuqsan ka table), `/admin/access-requests`
(**Conflicts 2 -- sifar nahi**, yani 279 ke GRANT kaam kar rahe hain),
Conflicts tab (scan aur SoD ke qawaid), "? Samjhein" ka panel (183 mein
se ek), aur Bridge AI ka jawab.

**Jo scan ne pehli hi dafa pakRa (bug nahi, asal karobari baat):**
Finance Team ke paas `finance.banks[create/edit]` aur
`bank-reconcile[edit]` **dono** hain -- yani jo bank entry banata hai
wohi usay bank se mila kar theek keh deta hai. Doosra: Finance Team ke
paas hassas features zaroorat se zyada hain. Ye sirf raye hai; kuch khud
nahi hataya gaya. Faisla malik ka, aur qawaid Rules se badle ja sakte
hain.

**Nishan:** `live-2026-09-04` tag us commit par lag chuka hai jo Live par
gaya. Wapas jane ka raasta ab maujood hai -- is se pehle repo mein ek bhi
tag nahi tha.

**Do cheezein jo abhi adhoori hain** (kaam nahi rokta, magar likh dena
zaroori hai):
1. Command Center ke jumle sirf Roman mein hain -- zaban EN par ho tab
   bhi Roman dikhte hain.
2. AI ke jawab mein safhe ka naam nahi, kachcha raasta (`/admin/...`)
   aata hai. Malik ka apna usool ye tha ke aam staff ko raasta nahi,
   naam dikhna chahiye.

**Staff ko batana hai:** 272 ne Finance se `submissions` ka approve aur
Manager se `stock-count` approve / `cash-close` create hata diya; 274 ke
baad jis ne record banaya wo khud us ko manzoor, tasdeeq ya receive nahi
kar sakta (Owner/Admin par ye rok nahi).

---

## 5b. Doosra deployment — 4 September 2026, raat (289-290) — MUKAMMAL

Pehle deployment ke baad malik ne Live par kaam karte hue kai cheezein
pakRin. Un ki durusti ka ye doosra chakkar tha. **289 aur 290 dono Live
par chal chuki hain (tasdeeq shuda: `purchases.supplier_bill_no` aur
`work_handoffs` maujood).**

**Backup pehle wala kaam NAHI karega.** Wo 19:00-19:21 ka hai, aur us
ke BAAD Live par bohat kuch hua: migrations 265-288, 265 products, ek
supplier, ek purchase, aur 66 stock ki harkatein. Us purane backup par
wapas jane ka matlab raat ka saara kaam kho dena hai. **Naya backup
lazmi.**

**Migrations:**
- **289** — `purchases.supplier_bill_no` aur us par unique index. Ek
  supplier ka ek bill sirf ek dafa. Ye us ghalti ki rok hai jo aaj
  hui: ek sheet teen dafa charhi, teen purchase banin, supplier ka
  dena Rs 315,914 ho gaya jab ke asal ek tihai tha.
- **290** — `work_handoffs`: kaam ek safhe se doosre par jane ka
  record, us ka notification trigger, aur `v_my_handoffs`.

**Code mein kya jayega (saat commit):**
1. Command Center ki zaban (en/rm/ur), AI ke jawab mein safhe ka naam,
   notification ki ghanti (click par khulti hai, bina parhi pehle)
2. Missing Rate par naam badalna + AI ki naam ki tajweez
3. Nakaam bill hatana (Owner/Admin/Manager)
4. Ek chabi ke do naam khatam: `GEMINI_API_KEY` na mile to code khud
   `BRIDGE_AI_GEMINI_API_KEY` uthha leta hai. **Is ke baad Live par wo
   doosra variable alag se lagane ki zaroorat nahi rahegi.**
5. Ek bill ek purchase (289 ke sath)
6. Sheet se kharid par adaigi ke sawal (poora diya / kuch diya /
   udhaar, kitne din, kab dena hai)
7. Kaam ka haath badalna (290 ke sath): sabz patti, sidebar, dashboard
   aur ghanti

**Live par ek adhoora record:** `PO-1788537423737` ke `credit_days`
aur `due_date` khali hain (wo purchase naye code se pehle bani).
Us ka matlab ye hai ke wo raqam "Bill aur Dena" par kabhi due nahi
dikhegi. Malik se poochh kar bharni hai.

**Nishan:** deploy ke baad `live-2026-09-04b` tag lagana hai.

---

## 5c. Teesra deployment — 4-5 September, raat (291-299)

**Backup:** `live-full-20260905.sql` — 3.3M, malik ki apni machine par,
migrations se PEHLE. (P0 usool: backup ki tasdeeq ke baghair koi migration
Live par nahi.)

**Ginti migrations se pehle aur baad — bilkul barabar:**
products 265, maal 2293, stock ki harkatein 66, purchases 1, godam 3,
dukanein 2, profiles 19.

### Live par chal chuki migrations

| # | Kya | Halat |
|---|---|---|
| 291 | `shops.status` (chal rahi / band / roki gayi) + mitane par taala | ✅ |
| 292 | Dukanon ke safhe ki madad | ✅ |
| 293 | Cheez ka maujooda hawala rate, rate ki tareekh, aur khabar | ✅ |
| 294 | `products` par likhne ki ijazat mein `owner` shamil | ✅ |
| 295 | Ek ek cheez ki wapsi, asal bill se + kharab maal ka alag godam | ✅ |
| 296 | Tasveer ka source + AI ke masode | ✅ |
| 297 | Tasveeron ka feature, ijazat aur madad | ✅ |
| 298 | **`pos_sales` par staff ki ijazat** — neeche dekhein | ✅ |
| 299 | Maali gosharay ke feature, ijazat, menu aur madad | ✅ |

### 298 — wo kharabi jo chhupi hui thi

Malik ne Rs 20 ki bikri ki, phir wapsi karne gaye: "koi bikri nahi mili".
Bikri maujood thi.

`pos_sales` aur `pos_sale_items` par RLS lagi hui thi magar policy sirf
DEALER ke liye. Dukan ke staff, manager, admin ya khud malik ke liye koi
policy thi hi nahi -- aur RLS ka usool ye hai ke jis ke liye policy na ho
us ke liye jawab KHALI hota hai, ghalti nahi.

Bikri is liye ho rahi thi ke `create_pos_sale` SECURITY DEFINER hai. Yani
LIKHNA chal raha tha aur PARHNA band tha. Ye mahinon chhup sakta tha:
Command Center par adad aate rehte (wo doosre raaste se aata hai) aur har
wo safha jo seedha bikri parhta khali nazar aata.

**Sabaq:** jab bhi koi fehrist khali dikhe, pehla sawal ye hona chahiye
ke us table par is bande ke liye policy hai bhi ya nahi.

### Code jo isi build mein gaya

1. Dukanon ke chaar control (badalna, band, rok, mitana) + mitane par
   database ka taala
2. POS ka naya naqsha: tasveer wale khane, ek line ki toolbar, cart ki
   qatar se tafseel (khulte hi cheezein chhoti, band karte hi wapas
   poori chauRai), gahak ki teen qismein
3. Lagat aur rate ki dono rokein SERVER par (safhe par nahi)
4. Cheez ka maujooda rate maal wusool hote hi, rate ki tareekh, aur
   khabar (manager ko tafseel, counter wale ko sirf naya bikri ka rate)
5. Ek ek cheez ki wapsi, asal bill ke rate par
6. Cheezon ki tasveerein AI se -- masoda, phir manzoori
7. Maali gosharay: Trial Balance, Nafa Nuqsan, Balance Sheet, poora
   Journal, haath se journal entry, aur Finance ka markaz

### Live ke ledger ki tasdeeq (5 September)

Debit 212,464 = Credit 212,464. Asaasay 107,126 = zimme 96,550 + is saal
ka nafa 10,576. Yani Balance Sheet Live par barabar hai.

### Abhi bhi baqi

- Post-dated cheques, recurring journals, budgets, period closing, item
  costing run
- Chart of Accounts ka safha, payment terms, cheque book, accounting
  periods, khate milana
- Cash Flow, Working Capital, Budget vs Actual, Farmer/Supplier/Dealer ka
  lena-dena, shaakh shaakh ka nafa nuqsan
- POS mein discount ka koi khana nahi (is liye "Discount Rs 0" ki qatar
  jaan boojh kar nahi lagayi)
- AI se tasveer BANNE ka hissa Live par chala kar dekha nahi gaya --
  chabi is machine par nahi thi. Nakaami par safha asal ghalti likhta
  hai; model ka naam `GEMINI_IMAGE_MODEL` se badla ja sakta hai
- `PO-1788537423737` ke `credit_days` aur `due_date` khali
- Live par kisi cheez par barcode nahi
- 250 cheezon ki tasveer nahi (12 naam wali -- un ki ASAL tasveer haath
  se charhani chahiye)

---


## 5d. Mustaqil Asaasay (301) — Testing par chal chuki, **Live par baqi**

Malik ka group 4 (Fixed Assets) ab bana hua hai: register, qismein,
depreciation ka hisaab aur ledger, farokht/kharij, dobara qeemat, aur
har asaase ka apna ledger.

### Testing par kya chala (301)

`asset_categories`, `fixed_assets`, `fixed_asset_counter`,
`asset_depreciation_runs`, `asset_depreciation_lines`,
`asset_disposals`, `asset_revaluations`; do views
(`v_fixed_assets`, `v_fixed_asset_ledger`); teen functions
(`fn_next_asset_code`, `fn_asset_dep_compute`,
`fn_asset_dep_mark_posted`); gyarah naye khate (1300–1340, 1390, 3300,
4095, 6200, 6210, 6220) aur `gl_accounts.is_contra`.

### Rollback test ka natija (Testing, 5 September)

Seedha khat: 3 mahine Rs 6,000 (chahiye tha 6,000). Ghatti hui qeemat:
Rs 2,000 (chahiye tha 2,000). Post ke baad jama shuda ghisai 6,000,
cursor Aug-2026. Usi mahine ka dobara hisaab **roka gaya**. Jama shuda
ghisai qeemat se upar le jane ki koshish **roki gayi**. Post ho chuka
run mitane ki koshish **roki gayi**. Agle mahine sirf ek mahine ki
ghisai (Rs 2,000). Kitabi qeemat 114,000 (chahiye thi 114,000). Poora
test rollback hua -- Testing par koi qatar nahi bachi.

### Ek cheez jo saath theek karni paRi

`gl_accounts` mein `is_contra` ka khana pehle nahi tha. Jama shuda
depreciation ulte rukh ka khata hai: hai asaason ke sath, magar asaason
ko GHATATA hai. Balance sheet is ke baghair us raqam ko asaason mein
JAMA kar deti -- yani har asaase ki ghisai do dafa gini jati aur asaasay
utne hi bare nazar aate. Ab `balanceSheet` aise khate ka baqi minus
karti hai aur safhe par bhi wo (bracket) mein nazar aata hai.

## 5e. Khaton ki fehrist (302) — Testing par chal chuki, **Live par baqi**

`gl_accounts` pehle din se maujood tha magar us ka koi safha nahi tha:
naya khata banane ke liye SQL likhni parti thi. Ab
`/admin/finance/accounts` par poori fehrist hai, har khate ka baqi us
Trial Balance se jo gosharay banata hai (alag ginti nahi).

Do rokein database mein lagi hain (`fn_gl_account_guard`):

- Jis khate mein entry ja chuki, us ki QISM ya RUKH nahi badalta. Warna
  pichhle saal ka har goshara chup chaap badal jata aur kisi ko pata
  nahi chalta.
- Jis khate mein raqam pari ho wo BAND nahi hota -- band khate ka paisa
  kisi goshare mein nazar nahi aata, hota wahin hai.

Aur khate ka code ab chaar hindson ka hona lazmi hai.

Rollback test (Testing): qism badalna roka, raqam wala khata band karna
roka, khali khata band hua, naam badalna chala, teen hindson ka code
roka. Poora test rollback.

## 5f. Ek chaabi do jagah — bees safhon ka unwan ghalat tha

Malik ne 5 September ko screenshot bheja: Machinery ki "Advance
Tasdeeq" par unwan "AgriBridge Academy" likha aa raha tha.

Wajah: saari dictionaries ek hi object mein girti hain, is liye ek hi
chaabi do jagah likhi ho to BAAD wali pehli ko kha jati hai. Aisi 20
chaabiyan thin -- yani bees jagah safhe par kisi doosre safhe ka jumla
nazar aa raha tha (cash-close par "Owner Command Center", doodh ki
rawangi par "Master Dashboard", machinery reminders par "Doodh jama
karne ki report", waghera).

Sab theek kar di gayin, aur `npm run check:i18n` ab is ki jaanch karta
hai -- takraao aur gum chaabi dono par. Ye jaanch build se pehle
chalani chahiye.

## 5g. Machinery: bill ka jumla ulta tha

Booking par "1.25 acre kaam poora" likha hota, aur neeche bill ke
qadam par "Pehle asal kaam darj karein" -- banda wahin ruk jata.

Asal baat ye thi ke kaam DARJ tha magar us ki TASDEEQ baqi thi (vendor
ka dawa). Rok theek thi, jumla ghalat tha. Ab dono halaton ka apna
jumla hai, aur tasdeeq wale mein Kaam ke Dawe ka safha bhi likha hai.
Live par MB-2026-00006 aur MB-2026-00005 dono isi halat mein hain.

## 5h. Finance ka baqi poora naqsha (303–309) — Testing par chal chuka, **Live par baqi**

Malik ka hukm (5 September, raat): *"finance k jitna baqi kam hy wo
sara krin ... sobha tk sb final hona chiaye phir sb k backup krin gy or
live build bhi krin gy"*. Us ke baad ka kaam:

**303 — Kaam ke dawe par naap ka farq.** Do qism ('dono') wali booking
par raqba theek karne ka koi raasta hi nahi tha: database ki rok aati
thi kyunki sabit/kutra ka batwara purana reh jata tha. Ab batware ke
khane wahin hain aur jaanch database se PEHLE hoti hai, us zaban mein
jo safhe par nazar aa rahi hai. `v_machinery_work_claims` mein teen
khane jure.

**304 — Maali reports** (`/admin/finance/reports`): cash flow (seedha
tareeqa), chalta sarmaya, khaton ka opening/harkat/closing, aaya-gaya,
kis se lena kis ko dena, aur shaakh shaakh ka nafa nuqsan. Sab
`journal_lines` se.

**305 — Hisaab ke arse.** Har mahina khula ya band; band arse mein entry
DATABASE se rukti hai. Mahina band karne se pehle Trial Balance barabar
hona zaroori. Saal band karne par nafa nuqsan ke khate ek entry se
sarmaye (3200) mein.

**306 — Budget** (saalana adad per khata) aur us ke saamne asal kharcha.

**307 — Cheque.** Diye aur mile hue, cheque book, aur do naye khate:
1180 (cheque mile hue) aur 2050 (cheque diye hue). Cheque milte hi
bande ka khata saaf, magar raqam BANK mein nahi — wo guzarne par jati
hai. Bounce par pehli entry ulti.

**308 — Adaigi ki shartein + har mahine wali entry.** Shart supplier par
lagti hai aur naye purchase par khud utar aati hai (Live par abhi ek
purchase bina due_date ke para hai — wo isi kami ki misal hai). Har
mahine wali entry ka khaka ek dafa, entry har mahine EK DABAO par.

**309 — Cheez ki lagat** (ausat kharid rate vs aaj ka rate) aur khaton
ki fehrist par "baqi doosre khate mein le jayein".

### Rollback test (Testing) — sab paas

- 305: band mahine mein entry roki, khule mahine mein chali, band mahine
  ki tareekh badalna roka, dobara kholne par chhoti wajah roki.
- 307: ek number do dafa roka, ulti tareekh roki, guzra hua cheque
  mitana roka, guzre hue ko wapas "intezar" mein le jana roka, bina
  wajah bounce roka.
- 302: entry wale khate ki qism badalna roka, raqam wala khata band
  karna roka, khali khata band hua, naam badalna chala, teen hindson ka
  code roka.
- 301: seedhi ghisai 3 mahine 6,000; ghatti hui qeemat 2,000; dobara
  chalana roka; hadd toRna roka; kitabi qeemat 114,000.

### Ek baat jo malik ko tay karni hai

308 mein default adaigi ki shart **"Haath ke haath (0 din)"** rakhi gayi
hai. Iska matlab: jis supplier par shart nahi lagi, us ke naye bill ki
tareekh usi din ki banegi. Ye jaan boojh kar hai — bina tareekh wala
bill kisi fehrist mein nazar hi nahi aata. Agar aam shart 15 ya 30 din
honi chahiye to `/admin/finance/terms` par badal di jaye.

### Live par chalane ki tarteeb (P0 rule)

Backup verified (file ka size chat mein) -> pre-migration ginti ->
301, 302, 303, 304, 305, 306, 307, 308, 309 (isi tarteeb mein) ->
ginti dobara -> naya build upload -> smoke test.

### Pre-migration ginti (Live, 5 September raat)

products 265, stock ki qatarein 62, movements 70, journal entries 14,
journal lines 39, **Dr = Cr = 244,502**, gl khate 45 (sab chaar hindson
ke), supplier 1, bina due_date wale purchase 1.

Live par abhi **kuch nahi** chala.

---


## 6. Purani fehrist — 4 September se pehle ka intezar (record ke liye)

 (ho chuke)

Malik ka usool: system par na hon to command **hold**. Wo kahein
"system par aa gaya", tab ye poori fehrist ek sath jayegi.

**P0 rule (malik, 2 September):** Backup verified → pre-migration
record → migrations 265→287 → verification → naya build upload → smoke
test → Live accepted. **Backup confirm hone se pehle 265–288 Live par
NAHI chalengi.**

**271 ke liye alag shart (malik, 2 Sep):** Live se pehle Testing par
Department Head ka manual test PASS hona lazmi (qadam `docs/GUIDED-ERP.md`
8a mein). Bina us ke 271 Live par nahi. Priority 1 ki halat: Code Complete /
Testing Almost Complete, Live Accepted nahi.

**Us waqt jo bhejna hai, isi tarteeb mein:**

1. **Backup** — do `pg_dump` command (schema + data). Connection string
   wo khud Supabase Dashboard se lenge; wo string chat mein kabhi nahi
   aani.
2. **Rukna** — dono file ke size aayen (backup verified), phir
   pre-migration ginti (section 4 wali), phir main **265–288 Live par
   chalaoon** aur ginti dobara milaoon. (243–264 ho chuki hain.)
3. **Build + package** — sirf migrations ke BAAD; do command, branch
   `claude/code-load-project-structure-fq91y9` se.
4. **cPanel** — Stop → upload (overwrite) → Extract → Start.
5. **Upload ke baad aath cheezein dekhna** — login ka safha, /admin/trust,
   zaban badalna, machinery booking ka qadam 8, /admin/hr/attendance,
   /admin/hr/settings, /admin/products/intake, /admin/pos ka "Thok"
   button. Aur do nazuk kaam: /admin/hr par tankhwah darj karna, aur
   /admin/hr/leave par chhutti maangna.
6. **Sidebar** — migration 250 ke baad staff ko sidebar nahi milegi;
   un ka ghar "Mera Kaam" hoga aur upar ek chhoti patti. Owner/Admin ko
   sab kuch waise ka waisa milta rahega. Ek staff ke login se ye khud
   dekh lein. Wapas laani ho to ek SQL line kafi hai (BAQI-KAAM section
   2 mein likhi hai) -- naya build nahi chahiye.
7. **Naye safhe (265-288)** — /admin/products/setup, /admin/products/masters
   (Units aur Pack Sizes ke naye tab), /admin/inventory/receiving,
   /admin/my-work, /admin/academy, /admin/improvements,
   /admin/access-requests (Takraao tab), /admin/my-access. Har safhe par
   upar daayen "? Samjhein" chalna chahiye.
8. **278-287 kya karti hain** — 278 PostgREST ka schema cache dobara
   parhwati hai; 279 un 58 tables/views par GRANT deti hai jin ki kami
   se Access Requests ke adad sifar aa rahe the (aur views par
   `security_invoker` lagati hai, taake view bhi us bande ke RLS ke
   mutabiq chale jo poochh raha hai); 280 `v_shop_replenishment` banati
   hai; 281–288 sirf `feature_help` ki qatarein hain — 183 mein se 183
   feature ka help. Kisi mein koi cheez mitane wali nahi.

9. **272 ka asar staff par (pehle bata dein)** — Finance Team se
   submissions ka approve/reject aur cash-handover create hat jayega
   (cash close ab finance ke paas), HR se staff-khata create, Manager se
   stock-count approve aur cash-close create.
10. **274 ka asar (pehle bata dein)** — jis ne record banaya wohi manzoor,
   tasdeeq ya receive nahi kar sakta (purchase review, supplier adaigi,
   stock count post, cash handover receive, POS return, doodh verify,
   order verify/approve, kharcha, machinery). Owner/Admin par rok nahi.
   Kisi jagah ye rok mushkil ho to us rule ko /admin/access-requests →
   Takraao → Qawaid se `warn` kar dein.
11. **Reversal** — finance role ab entry ulta nahi kar sakta; sirf
    Owner/Admin ya jise `finance.reversal` ki ijazat di jaye.
12. **Live par `BRIDGE_AI_GEMINI_API_KEY`** — cPanel → Setup Node.js App →
    Environment variables. Bina us ke Work Coach, bill reader aur guide ka
    AI hissa nahi chalega.
13. **Purana safha** — /admin/products/bill-rates. Supplier ke bill ki ek
   photo laga kar dekhein ke qatarein parhi jati hain ya nahi. Ye AI
   par chalta hai, is liye **GEMINI_API_KEY** Live par laga hona
   chahiye — bina us ke safha khulta hai magar qatarein khali aati
   hain (aur safha khud ye baat likh kar bata deta hai).

Is fehrist mein jo bhi naya kaam hota rahe, wo yahin juRta rahe — taake
un ke aane par ek bhi qadam chhoot na jaye.
