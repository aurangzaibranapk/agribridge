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


## 5d. Mustaqil Asaasay (301) — Live par chal chuki (5 September)

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

## 5e. Khaton ki fehrist (302) — Live par chal chuki (5 September)

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

## 5h. Finance ka baqi poora naqsha (303–309) — Live par chal chuka (5 September)

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

### Live par kya hua — 5 September, dopahar (MUKAMMAL)

P0 tarteeb poori tarah chali:

**1. Backup verified.** `live-full-20260905.sql` — **3.5M**, 12:30 par
bana. (Pehli koshish mein `pg_dump` Git Bash ke raaste mein nahi tha;
PostgreSQL 18 ka bin folder PATH mein daal kar chala.)

**2. Pre-migration ginti.** products 265, stock ki qatarein 62,
movements 70, journal entries 14, journal lines 39,
**Dr = Cr = 244,502**, gl khate 45, POS bikri 2.

**3. Migrations 301 se 309 — isi tarteeb mein, sab kamyab.**

**4. Ginti dobara — bilkul wohi.**

| | Pehle | Baad |
|---|---|---|
| Products | 265 | 265 |
| Stock ki qatarein | 62 | 62 |
| Stock movements | 70 | 70 |
| Journal entries | 14 | 14 |
| Journal lines | 39 | 39 |
| **Debit = Credit** | **244,502** | **244,502** |
| GL khate | 45 | 58 |
| POS bikri | 2 | 2 |

Yani kisi purane adad ko haath nahi laga -- sirf 13 naye khate (11 asaason
ke, 2 cheque ke), 5 asaason ki qismein, 6 adaigi ki shartein, aur naye
safhon ke feature/ijazat/madad ke indraj jure.

**5. Build.** `✓ Compiled successfully`, 275 safhe. Naye safhe build mein
maujood: finance/accounts, assets (+[id], categories, depreciation),
budget, cheques, costing, periods, recurring, reports, terms.

### Ek cheez jo is deployment mein saamne aayi

Backup lete waqt connection string ka password screen par aa gaya (paste
ki hui line mein line-break tha, is liye `read` ne aadha hissa liya aur
baqi shell ne command samajh kar likh diya). **Password foran badal
diya gaya.** Aage ke liye tareeqa: URL clipboard mein rakh kar
`Get-Clipboard` se uthana -- wo screen par kabhi nahi aata.

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

---

## 5i. Rokay hue kaam — 5 September (dopahar ke baad)

Ye sab **Testing par chal chuka aur test ho chuka**. Live par abhi baqi
hai. Tarteeb wohi P0 wali: **backup verified → pre-migration ginti →
migrations → verification → build upload → smoke test**.

### Migrations jo Live par jani hain

| # | Kya karti hai |
|---|---|
| **312** | Vendor ko hisse se ZYADA diya hua naqad settlement ke safhe par ek alag khane mein (`zyada_diya`) — ledger se, kisi booking se nahi. |
| **313** | (a) Diesel ki qatar ab **mansookh** ho sakti hai (`cancelled`) — wajah ke sath, aur har hisaab se nikal jati hai magar safhe par nazar aati rehti hai. (b) Jo paisa vendor ne kisan se khud le kar **apne hisse mein rakh liya** (`vendor_settlement = 'kept'`) wo ab "vendor ko mil gaya" mein ginta hai, "ART ke paas jama" mein nahi. Us ne apne hisse se zyada rakh liya ho to wo farq apne khane mein: `vendor_ne_zyada_rakha`. |
| **314** | Khate ki poori pehchaan: `bank_name`, `account_title` (+ pehle se maujood `account_number`). |
| **315** | **AgriBridge Inbox** — `/admin/inbox` ko features + Master Command menu + `feature_help` mein daalti hai. Koi nayi table nahi, koi data nahi hilta. |

313 dono view (`v_machinery_vendor_booking_settlement` aur
`v_machinery_vendor_settlement`) **gira kar dobara banati hai** — khanon
ki tarteeb badalni thi aur `create or replace` wo hone nahi deta. 312 ka
`zyada_diya` khana 313 ke andar hi shaamil hai, is liye **312 pehle, phir
313** — ya sirf 313 (wo 312 ka kaam bhi kar deti hai). Live par 312 abhi
gayi hi nahi, is liye seedha 313 chalana kaafi hai.

### Rollback test (Testing par ho chuka)

- Diesel: bina wajah mansookhi **rukti hai**; `rejected` ka purana raasta
  **abhi bhi band hai**; wajah ke sath mansookhi **chalti hai**;
  `cancelled_at` khud lagta hai; mansookh qatar **dobara zinda nahi
  hoti**. Mansookhi ke baad us booking ka diesel `11,280 → 0`.
- Vendor: `kept` wali soorat — hissa 28,160, khud rakha 32,000 → **mila
  32,000, baqi 0, zyada rakha 3,840, ART ke paas jama 0**.
- Purana aam raasta (kisan ne ART ko naqad diya) aur `handed_over`
  (vendor ke haath mein hamara paisa) — **dono jyon ke tyon**.

### Live par jo DATA theek karna hai (migration ke baad)

1. **Duplicate diesel** — MB-2026-00008 par 4 September ko 23 sekind ke
   faasle se do dafa 30 litre × Rs 376 darj hua. Ledger wali ghalti
   pehle hi reverse ho chuki (TXN-26-000009 → TXN-26-000021); qatar abhi
   `verified` pari hai. Malik ki ijazat mil chuki ("duplicate khatam kar
   do haan"). 313 ke baad **booking ke safhe par "mansookh karein"**
   se — hath se SQL ki zaroorat nahi.
   Us ke baad Farman Ali ka `art_diesel_advance` `33,930 → 22,650` par
   aa jayega, jo ledger (khata 1120) se **poora milta hai**.

2. **Shuruati balance** — charon khate (UBL, Alfalah, HBL, Cash in Hand)
   sifar par bane the, is liye Cash Book par Rs -22,650 likha aa raha
   tha. Naye build ke baad **Finance → Cash Book** par peela form aayega;
   har khate ka asal shuruati balance malik khud daalenge. Wo raqam Cash
   Book aur ledger **dono** mein jayegi ("Malik ka sarmaya" 3200 ke
   saamne).

3. **"Al Rana Traders (kisan dukan)"** — ye khata purane build se bana
   tha, is liye us ka shuruati balance sirf `opening_balance` ke khane
   mein baitha hai, ledger ko us ki khabar nahi. Naye build ke baad us ka
   milan karna hai: ya to us khane ko sifar kar ke form se dobara darj
   karein, ya us ke barabar ki ek journal entry banayein.

### Baqi (abhi bana nahi)

- **Role sirf poori profile wale bande ko** — malik ka kehna: "admin ka
  role hum kis ko dein, manager ka kis ko, jis jis ko dena hai us ki
  fully profile bani hui honi chahiye tab hi." Abhi Staff WhatsApp wale
  safhe par gyarah aise khate hain jo kisi bande ke nahi, sirf role ka
  naam hain (admin, Manager, HR Department, Finance Team…).
- Staff ka qarza (installments) — malik ke qawaid ka intezar.

---

## 5j. Live run — 5 September, sham (313, 314, 315)

P0 tarteeb poori chali: **backup verified → pre-migration ginti →
migrations → verification → build upload → smoke test.**

### Backup
`agribridge-backup-20260905-1554.sql` — **3.7M**, malik ki machine par.

Backup lene mein paanch chakkar lage aur wajah aakhir mein saaf hui:
**Git Bash mein terminal ka text select karte hi wo clipboard mein chala
jata hai** — aur clipboard wala connection URL mit jata hai. Har dafa
malik terminal se natija copy kar ke chat mein bhejte, aur agli dafa
`pg_dump` ko URL ki jagah terminal ka apna text milta (`lambai: 368`,
`missing "=" after "Dx"`).

Hal: clipboard ka raasta chhor diya. URL ab `~/pgurl.txt` mein ek dafa
mehfooz hai (`~/seturl.sh` se), aur `~/backup.sh` usi file se parhta
hai. Ab beech mein jo marzi copy ho, farq nahi paRta. **Ye file repo se
bahar hai (home folder mein), is liye kabhi commit nahi hogi.**

### Ginti — pehle aur baad mein

| | Pehle | Baad |
|---|---|---|
| journal_entries | 24 | 24 |
| journal_lines | 74 | 74 |
| **Dr / Cr** | **499,226 / 499,226** | **499,226 / 499,226** |
| machinery_bookings | 8 | 8 |
| machinery_bills | 9 | 9 |
| machinery_payments | 3 | 3 |
| machinery_fuel_logs | 3 | 3 |
| finance_accounts | 5 | 5 |
| finance_transactions | 6 | 6 |
| products | 266 | 266 |
| features | 197 | **198** (Inbox) |
| feature_help | 233 | **234** (Inbox) |

Koi karobari qatar nahi hili. Sirf wohi do adad barhe jo barhne the.

### Duplicate diesel — khatam (malik ki ijazat se)

`machinery_fuel_logs` ki qatar `16ae7f14` (MB-2026-00008, Rs 11,280,
4 September 14:00:23) ab `cancelled` hai, wajah ke sath. Qatar mitai
nahi gayi — safhe par kati hui nazar aayegi.

**Nateeja — dono kitabein mil gayin:**

| | Pehle | Ab |
|---|---|---|
| Safha (verified fuel logs) | 33,930 | **22,650** |
| Ledger (khata 1120) | 22,650 | **22,650** |

Yehi asal masla tha: journal to 5 September ki subah reverse ho chuka
tha, magar diesel ki qatar `verified` pari rahi — aur vendor ka safha
Rs 11,280 zyada kaat raha tha.

### Farman Ali ka hisaab — ab jaisa hona chahiye tha

| Khana | Raqam |
|---|---|
| Kul hissa | 136,796 |
| Vendor ko mila (us ne kisan se khud rakha) | **32,000** |
| Us mein se hamara commission jo us ke paas hai | **3,840** |
| ART ke paas jama (kisan ne hamein diya) | 24,000 |
| ART ka diesel (wapas aana hai) | 22,650 |

Rs 32,000 pehle "ART ke paas jama" mein likha aa raha tha — hamari
tijori mein, jahan wo tha hi nahi. Ab "vendor ko mil gaya" mein hai, aur
us ka hisse se zyada hissa apne alag khane mein.

### Ab baqi (naye build ke baad, safhe par)

1. **Shuruati balance** — charon khate abhi bhi sifar par hain. Finance →
   Cash Book par peela form aayega; har khate ka asal balance malik
   daalenge. Raqam Cash Book aur ledger dono mein jayegi.
2. **"Al Rana Traders (kisan dukan)"** — purane build se bana, is liye us
   ka shuruati balance sirf `opening_balance` ke khane mein baitha hai
   aur ledger ko khabar nahi. Us ka milan karna hai.

---

## 5k. Vendor ka diesel — asal ghalti (5 September, malik ki ijazat se)

Duplicate hatane ke baad malik ne kaha:

> "Maine to diesel sirf 1 baar diya hai. Ek baar vendor ne khud diesel
> daala hai... check karo kahin vendor ka diesel likha hai."

Aur wahi asal masla nikla. Poore system mein diesel ke sirf teen indraj
the, aur **teenon par `paid_by = company` likha tha** — yani teenon
"hamare khate se nikla". Vendor ka apna diesel kahin darj tha hi nahi.

Malik ne saaf kiya: **379 wala unka tha, 376 wala vendor ne khud liya**
(Ali Raza Qadi ki kattai ke waqt).

### Ek ghalti, do jagah ghalat adad

`MB-2026-00008` ka Rs 11,280 aise darj tha:

- "ART ne diya" → **cash box se Rs 11,280 nikla** likha gaya (nikla hi nahi tha)
- "vendor se wapas lena hai" → wohi raqam **Farman Ali ke zimme** charhi

Ye duplicate se bara masla tha: duplicate ek hi adad do dafa ginta tha,
ye ek adad **do alag jaghon par** ghalat daal raha tha.

### Kya kiya (mitaya kuch nahi)

1. **TXN-26-000025** — TXN-26-000008 ka reversal. Cash book bhi sath ulti
   (`journal_entry_sources` se maloom tha ke us entry ne kis qatar par
   daawa kiya tha).
2. Diesel ki purani qatar **`cancelled`**, poori wajah ke sath.
3. **Nayi qatar**: wohi 30 litre × 376, magar `paid_by = vendor`,
   `vendor_recoverable = false`, khata khali. Machine diesel par chali
   thi — us ka indraj rehna chahiye, magar sahi naam ke sath.

### Nateeja

| Khana | Pehle | Ab |
|---|---|---|
| **Dr / Cr** | 499,226 | **510,506 / 510,506** (barabar) |
| Safha: ART ka diesel | 22,650 | **11,370** |
| Ledger khata 1120 | 22,650 | **11,370** ✓ |
| Cash in Hand | −11,280 | **0** |
| Kul balance | −22,650 | **−9,340** |
| **Farman Ali ko abhi dena** | 0 | **Rs 8,790** |

Rs 8,790 = hamare paas jama 24,000 − ART ka diesel 11,370 − us ke paas
para hamara commission 3,840.

Baqi manfi (UBL −11,370) asal ghalti nahi — wo diesel waqai UBL se
nikla tha; UBL ka **shuruati balance** darj nahi, isi liye manfi dikhta
hai. Wo naye build ke form se theek hoga.

### Sabaq

Diesel ka form pehle se poochta hai ke kis ne diya (ART / vendor /
kisan), magar staff ne teenon dafa "ART" chuna. Us ek khane ka jawab
**do** kitabon mein jata hai — cash aur vendor ka khata — is liye us ka
ghalat hona sab se mehnga parta hai. Aage is khane par form mein ek
saaf jumla chahiye: *"ART ne paisa diya? Nahi to khata khali rahega aur
vendor se kuch wapas nahi liya jayega."*

---

## 5l. Rokay hua kaam — migration 316 (abhi Live par nahi)

Malik ka sawal: *"mere paas stock to zyada hai, yahan kam kyun bata raha
hai?"*

Grocery ka safha keh raha tha "146 mein se 2 par stock hai, Rs 7,442" --
aur wo adad **bilkul theek tha**, magar poori tasveer nahi thi:

| Kahan | Cheezein | Adad | Kharid ki qeemat |
|---|---|---|---|
| **Qism darj NAHI** | **52** | **2,288** | **Rs 91,545** |
| Cooking Oil & Ghee | 1 | 3 | Rs 7,200 |
| Cigarettes | 1 | 1 | Rs 242 |

Har qism ka safha sirf apni qism ka maal dikhata hai. Jis cheez par qism
likhi hi nahi (capstan, Rio, Lays, Rin, sunsilk...), wo **kisi bhi safhe
par nazar nahi aati**. Aur Product Setup ki qatar paanch adhoore pan
ginti thi -- rate, barcode, tasveer, miyaad, manzoori -- **qism un mein
thi hi nahi**, is liye kisi ne kabhi bataya nahi.

**316** `v_product_setup_counts` aur `v_product_setup_queue` mein
`category_missing` jorti hai (naye khane aakhir mein, kyunki
`create or replace` tarteeb badalne nahi deta). Koi data nahi hilta.

Sath mein safhon par:
- Qism ke safhe par peela paighaam + "Qism darj karein" ka button
- Product Setup mein naya khana **"Qism"**
- Us khane par **AI se qism ki tajweez** -- AI draft banata hai, banda
  nishan laga kar manzoor karta hai. "Pakka" par nishan pehle se,
  **"shayad" par nahi**. AI nayi qism nahi bana sakta (sirf maujooda
  fehrist se chunta hai), aur khud kuch mehfooz nahi karta. Har manzoor
  shuda qatar audit mein jati hai.

---

## 5m. Rokay hua kaam — migration 317 (AI ka khata)

Malik ka sawal (5 September): *"jo maine apne ERP mein itna AI involve
kiya hai, kya is ka mujhe bill aayega?"*

Us waqt is sawal ka **theek jawab dena mumkin hi nahi tha**. Sirf
`bridge_ai_activity_log` maujood tha aur wo bhi sirf chat panel ka --
bill reader, qism ki tajweez, tasveer, tasveer se maloomat nikalna: in
mein se koi bhi darj nahi hota tha. Chat ka adad **7** tha, magar asal
istemal us se zyada, aur kitna -- maloom nahi.

**317** `ai_usage_log` banati hai: har AI call ka indraj -- kis feature
se, kaunsa model, kamyab hui ya nahi, kitne token, kitni tasveerein,
kitna waqt. Sath `v_ai_usage_monthly` (mahine ka hisaab) aur safha
`/admin/ai-usage` (AI Command ke neeche, sirf Owner/Admin).

Do usool jaan boojh kar:

- **Ye safha paisa nahi ginta.** Qeemat Google tay karta hai, wo badalti
  rehti hai, aur har chaabi ke saamne alag hoti hai -- yahan rupya likh
  dena andaza hota. Sirf ISTEMAL likha jata hai; bill Google Cloud
  Console -> Billing par dekha jata hai.
- **Token Google ke `usageMetadata` se aate hain, andaze se nahi.** Na
  milein to NULL rehte hain aur safhe par alag se likha aata hai ke kitni
  qataron par ginti nahi mili -- "sifar token" aur "ginti nahi mili" ek
  cheez nahi.

Khata likhna kabhi kisi kaam ko **rokta nahi**: `recordAiUsage` khamoshi
se nakaam ho jata hai. Hisaab rakhne wali cheez ka asal kaam rok dena us
se bura hai ke hisaab na rakha jaye.

Abhi ye raaste khate mein aate hain: chat (Bridge AI), qism ki tajweez,
tasveer banana, aur wo sab jo `generateGeminiText` se guzarte hain
(daily report, naam ki tajweez, blog draft, chatbot, messages). Bill
reader aur tasveer se maloomat nikalne wale apne alag client hain -- wo
abhi baqi hain.

### Testing par rollback test

Qatarein banin, ghalat `kind` **ruki**, mahine ka hisaab theek: tasveer 1,
token 1,500 (sirf jahan ginti mili), aur `token_na_mile` = 2. Sab ulta
diya gaya.

---

## 5n. Rokay hua kaam — 318 aur 319 (supplier ke bill)

### 318 — Bill par tax aur discount ka apna khana

Malik ne asal bill (JX FSD-Jhang-Hamid Traders) par ye pakRa. Safha keh
raha tha: qatarein Rs 64,533.54 banti hain, bill par Rs 63,033.45 likha
hai, **Rs 1,500.09 ka farq -- shayad koi qatar nahi paRhi gayi.**

Magar bill par likha tha:

```
INVOICE TOTAL:   64,533.54
TOTAL DISCOUNT:   1,822.76
ADVANCE TAX:        322.67
GRAND TOTAL:     63,033.45
```

64,533.54 − 1,822.76 + 322.67 = **63,033.45** -- farq SIFAR. AI ne saari
qatarein theek paRhi thin; **discount aur tax ke khane hi nahi the**, aur
jis cheez ka khana na ho us ka adad kahin nahi ja sakta. Safha us kami ko
"qatar chhoot gayi" samajh raha tha.

Ab `supplier_bill_reads` par: `discount_amount`, `tax_amount`,
`tax_label`, `tax_rate`, `other_charges`. Sath `v_supplier_bill_milan`
-- milan ka hisaab ab ek hi jagah:

    qatarein − discount + tax + baqi kharche = bill ka total

**`tax_label` ki wajah:** bill par "ADVANCE TAX" likha hai, GST nahi. FBR
ke liye ye DO ALAG cheezein hain (236G/236H rok kar jama hota hai aur
aage adjust hota hai; sales tax ka raasta bilkul aur). Dono ko ek "tax"
ke khane mein daal dena aaj to chal jata, magar us din nahi chalta jis
din FBR ko dena ho. Is liye tax ke sath us ka NAAM bhi wohi rakha jata
hai jo bill par likha ho.

AI ka prompt bhi badla: ab `subTotal`, `discountTotal`, `taxAmount`,
`taxLabel`, `otherCharges` alag maangta hai, aur `billTotal` mein wo
raqam jo WAQAI deni hai (grand total).

### 319 — Bill se wholesale rate bhi

Malik: *"jab hum ye products add kar rahe hon, next page par in ke
wholesale rate update ki jagah honi chahiye."*

Ab tak bill se sirf KHARID ka rate charhta tha. Wholesale ke liye har
cheez alag se kholni parti thi -- 14 qataron wale bill par 14 dafa. Wohi
kaam jo koi nahi karta.

`supplier_bill_lines.wholesale_rate` juRa, aur
`fn_apply_bill_line_rate` ab `wholesale_price` bhi lagata hai --
**sirf jab qatar par likha ho** (`coalesce(v_line.wholesale_rate,
wholesale_price)`). Khali khana kuch nahi badalta; warna har bill purana
wholesale rate mita deta.

### Ek bug (migration nahi -- code)

Bill delete karne par browser BILL KE APNE SAFHE par khaRa reh jata tha,
aur wo safha ab maujood nahi -- seedha "404 This page could not be found"
khul jata tha. Kaam theek hota tha, magar nazar aane wali aakhri cheez ek
ghalti thi. Ab delete ke baad fehrist par bhej diya jata hai.

### Malik ka sawal: pehle se maujood stock aur paid bill

*"mere paas pehle se stock available hai, to kya main wo update kar sakta
hoon? Bill us ke already paid hain."*

**Haan.** `fn_apply_bill_line_rate` khol kar dekha: wo SIRF
`products.purchase_price` (aur ab `wholesale_price`) badalta hai aur
history likhta hai. **Stock ko haath nahi lagata aur koi adaigi nahi
banata.**

Dhyan sirf ek baat ka: usi safhe par **"Purchase banayein"**
(`createPurchaseFromBill`) alag button hai -- **wo** stock barhata hai
aur payable banata hai. Jo bill pehle se paid hai aur maal pehle se stock
mein hai, us par wo button nahi dabana -- warna stock do guna aur adaigi
jhooti.

---

## 5o. Rokay hua kaam — migration 320 (Kharabiyon ka khata)

Malik ka kehna (5 September):

> "Mujhe ERP system par koi aisa function laga dein: kahin bhi koi error
> aaye to mujhe pata chal jaye -- is cheez ka error hai, code mein ya
> kisi aur jagah, bill duplicating mein, POS, inventory, kahin bhi ho --
> mujhe ek page par pata chal jaye, taake developer ko asani se wo khatam
> kar sake."

Aaj tak kharabi ka pata chalne ka **ek hi raasta tha: koi banda
screenshot bheje.** Isi session mein us ki teen misalein saamne aayin,
aur teenon ek hi shakal ke the -- kharabi hui, aur us ka naam kisi jagah
likha nahi gaya:

| Kharabi | Asal wajah | Kahan likhi thi |
|---|---|---|
| "Kuch masla ho gaya" (Assistant) | Chaabi ke do naamon ka farq | Sirf server ke log mein |
| Machinery ki adaigi ruk gayi | `uq_machinery_payment_receipt` par duplicate | Kahin nahi |
| Tasveer ka 404 | Model ka naam maujood hi nahi tha | Sirf us waqt jab malik ne dekha |

**320** `error_log` banati hai, `v_error_summary` (jama shuda), aur safha
`/admin/errors` (Intezamia ke neeche, sirf Owner/Admin).

### Teen usool

1. **Khata likhna kabhi kaam nahi rokta.** `recordError` khamoshi se
   nakaam ho jata hai. Hisaab rakhne wali cheez ka asal kaam rok dena us
   se bura hai ke hisaab na rakha jaye.

2. **Ek jaisi kharabi ek qatar mein.** `fingerprint` un cheezon ko nikal
   deta hai jo har dafa badalti hain (uuid, `MR-2026-00001` jaise number,
   tareekh, adad). Warna ek hi masla chalees dafa "nayi kharabi" ban jata
   aur safha parhne ke qabil na rehta -- aur jo safha parha na jaye wo
   bhi utna hi bekaar hai jitna koi safha na hona.

3. **Hal shuda kharabi mitai nahi jati** -- nishan lagta hai, wajah ke
   sath (kam az kam teen harf, database par bhi rok hai). Mita dene se ye
   sawal kabhi jawab nahi paata ke ye masla pehle bhi aaya tha ya nahi.

### Abhi kaunse raaste khate mein aate hain

- **Kisi bhi admin safhe ka toot jana** -- `error.tsx` khud
  `/api/log-error` par khabar bhejta hai (`keepalive` ke sath, kyunki
  banda aksar usi lamhe safha band kar deta hai). Client par honay wali
  kharabi server ke log mein jati hi nahi thi.
- **Bridge AI ki nakaami**
- **Tasveer na banna** (model ka naam sath)
- **Machinery ka number na banna** -- wohi jagah jahan adaigi ruki thi

`/api/log-error` sirf login shuda bande se qabool karta hai -- khula
chhorna wo darwaza hai jahan se koi bhi khata bhar sakta hai.

### Testing par rollback test

Do alag raseed numbers wali ek jaisi kharabi **ek hi qatar** mein jama
hui (`kitni_dafa = 2`); bina wajah "hal ho gayi" **ruki**; wajah ke sath
chali; ghalat `severity` **ruki**. Sab ulta diya gaya.

---

## 5p. Live run — 5 September, raat (317 se 322 tak) — MIGRATIONS MUKAMMAL

Malik ne backup chala kar us ki tasdeeq chat mein bheji, aur usi ke baad
ye chhe migrations Live par chalayi gayin. **Ye tarteeb kabhi nahi
badlegi:** backup verified → ginti → migrations → ginti dobara → build
upload → smoke test.

### Backup (pehle, jaisa lazim hai)

```
agribridge-backup-20260905-2134.sql   —   3.8M   —   5 Sep 21:41
```

### Ginti — migrations se PEHLE

| Cheez | Adad |
|---|---|
| features | 198 |
| dashboard_features | 243 |
| feature_help | 234 |
| role_feature_permissions | 210 |
| products | 266 |
| journal_entries | 25 |
| supplier_bill_reads | 0 |
| supplier_bill_lines | 0 |
| `ai_usage_log` | maujood nahi |
| `error_log` | maujood nahi |

### Jo chalayi gayin

| # | Kya |
|---|---|
| 317 | `ai_usage_log`, `v_ai_usage_monthly`, safha `/admin/ai-usage` |
| 318 | Bill par discount / tax / baqi kharche ke khane, `v_supplier_bill_milan` |
| 319 | `supplier_bill_lines.wholesale_rate`, `fn_apply_bill_line_rate` naya |
| 320 | `error_log`, `v_error_summary`, safha `/admin/errors` |
| 321 | Safha `/admin/my-hr` (Mera HR) |
| 322 | Safhe `/admin/hr/leave/calendar` aur `/admin/hr/team/tree` |

### Ginti — migrations ke BAAD (tasdeeq)

| Cheez | Pehle | Baad | Farq |
|---|---|---|---|
| features | 198 | 203 | +5 (ai-usage, errors, my-hr, hr.leave-calendar, hr.org-tree) |
| dashboard_features | 243 | 248 | +5 |
| feature_help | 234 | 239 | +5 |
| role_feature_permissions | 210 | 214 | +4 |
| products | 266 | 266 | **koi tabdeeli nahi** |
| journal_entries | 25 | 25 | **koi tabdeeli nahi** |

Naye khane aur khate: `ai_usage_log` ✓, `error_log` ✓,
`v_ai_usage_monthly` ✓, `v_error_summary` ✓, `v_supplier_bill_milan` ✓,
`supplier_bill_lines.wholesale_rate` ✓, `supplier_bill_reads.tax_amount` ✓.

**Kisi karobari record ko haath nahi laga** — products aur journal
entries dono ka adad waisa ka waisa hai. Ye chheon migrations sirf naye
khane, naye khate aur naye safhe banati hain.

### Ab baqi kya hai

**Sirf build ka upload.** Live ka database naye code ke liye tayyar hai,
magar server par purana build chal raha hai — is liye naye safhe
(`/admin/errors`, `/admin/ai-usage`, `/admin/my-hr`, team ka calendar aur
darakht) upload se pehle **404** denge. Ye normal hai, aur upload ke baad
khud theek ho jata hai.

### Smoke test (upload ke baad, isi tarteeb se)

1. `/admin/errors` khulta hai (khali fehrist theek hai — abhi koi
   kharabi darj nahi hui).
2. `/admin/ai-usage` khulta hai aur saaf likhta hai ke wo paisa nahi
   ginta.
3. `/admin/my-hr` khulta hai, check-in ka khana nazar aata hai.
4. `/admin/hr/leave/calendar` khulta hai — Live par `leave_requests` = 0
   hai, is liye calendar khali hoga. **Ye kharabi nahi**: abhi kisi ne
   chhutti ki darkhwast di hi nahi.
5. `/admin/hr/team/tree` khulta hai — Live par `staff_details` = 0 hai,
   is liye darakht khali hoga aur safha khud likh dega ke kitne log
   darakht se bahar hain. **Ye bhi kharabi nahi**: HR record abhi kisi ka
   nahi bana. Jaise jaise staff ka record banega, darakht khud bharta
   jayega.
6. POS par ek test bill — ye dekhne ke liye ke purana kaam waisa ka waisa
   chal raha hai.

---

## 5q. Rokay hua kaam — 323 aur 324 (Load & Bill Services)

Malik ne 5 September ki raat mobile load aur bill payment ka poora naqsha
bheja, aur us ke baad ye bhi likha ke abhi apna wallet ya licence nahi
lena — **Phase 1 sirf "Load & Bill Control"**: maujooda retailer account
ka balance track ho, aur shaam ko us se milaya jaye.

Wohi bana hai.

### Char faisle jinho ne is module ki shakal tay ki

**1. AgriBridge load BHEJTA NAHI — DARJ karta hai.**
Malik ke bheje naqshe mein "Confirm & Process" ka button tha, jaise ERP
khud load kar dega. Aisa nahi ho sakta: load provider ki apni app se jata
hai aur retailer ko un ka API aam tor par milta nahi. Agar button ye dawa
karta aur asal mein load na jata, to banda samajhta ho gaya, customer se
paisa le leta, aur load jata hi nahi.

Is liye button **"Load ho gaya — darj karein"** hai, aur us ke saath
`provider_tid` ka khana — provider ki apni reference, jo staff us ki app
se copy karta hai. Jis qatar par TID na ho wo **nakaam nahi**, wo
**`saboot_baqi`** hai. Do alag baatein: ek ka matlab "hua hi nahi",
doosre ka "hua, magar saboot nahi laga".

**2. Service charge aur commission do alag cheezein hain.**

| | Kya | Kab aamdani banti hai |
|---|---|---|
| Service charge | customer se liya extra | usi waqt — 4050 |
| Commission | company baad mein deti hai | statement ki tasdeeq ke baad — 4055 |

Commission ka andaza (`commission_expected`) sirf DIKHAYA jata hai,
khate mein kabhi nahi jata. Malik ka apna jumla: *"agar commission
immediately confirm nahi hoti to system fake earning calculate na kare."*
Tab tak halat **`muntazir`** rehti hai — sifar nahi, khali nahi.

**3. Float asset hai, aur us ka balance journal se ginta hai.**
`load_accounts` mein `current_float` naam ka koi khana JAAN BOOJH KAR
nahi hai. Har account ka float 1190 ki un qataron se ginta hai jin par
`party_id = load_account` likha hai. Alag rakha hua balance ek din asal
qataron se hat jata hai aur phir do adad hote hain jin mein se koi nahi
jaanta kaun sa sach hai — wohi ghalti cash ke sath ho chuki hai.

**4. Bill jama karna aur bill ada karna ek lamha nahi.**
Provider band ho aur paisa raat ko jaye, to us dauran wo paisa hamare
paas hai magar hamara nahi — wo **2060** (bojh) par baithta hai, aur bill
ada hote hi float se utar jata hai. Us ko aamdani ya float ki kami
dikhana dono ghalat hain.

### Naye khate

| Code | Naam | Qism |
|---|---|---|
| 1190 | Provider Float (Load/Bill) | asset |
| 2060 | Bill jama shuda — abhi ada nahi | liability |
| 4050 | Load/Bill service charge (customer se) | income |
| 4055 | Load/Bill commission (company se) | income |
| 6105 | Float ka farq (kam / zyada) | expense |

### Ijazat ki taqseem — aur wo kyun aise hai

| Kaam | Kaun |
|---|---|
| Load/bill darj karna | POS wala staff |
| Float mein paisa daalna | Manager / Finance / Admin |
| Milan ka asal balance likhna | POS wala staff |
| Milan ka FARQ khate mein daalna | Manager / Finance / Admin |

Milan ka safha staff ko khulta hai (wo provider ki app ka balance likh
sakta hai) magar farq manzoor karne ka ikhtiyar us ke paas nahi. Agar
wohi banda farq bhi khud manzoor kar sakta, to farq ka matlab hi khatam
ho jata: jis se ginti mein ghalti hui wohi us ghalti ko "theek" keh deta.

### Ek asal bug jo test se pakRa gaya

`fn_load_float_balance` andar `fn_is_any_staff()` poochta hai. Safhe pehle
ye RPC **service client** se bula rahe the — aur service client ka koi
`auth.uid()` hota hi nahi, is liye har dafa inkaar milta aur float ka
khana khali rehta. Ab ye bulawa logged-in bande ke naam par jata hai
(function khud SECURITY DEFINER hai, is liye RLS rukawat nahi banti).

### Testing par rollback test — gyarah baatein

Float 0 → 50,000 daalne par 50,000 → Rs 1,000 load ke baad 49,000
(seedha journal se). Qatar ka number `LD-2026-00001` bana. Aur saat
rokein chalin: sifar raqam ka load **ruka**, sifar service charge
**ruka** (khali rakha jata hai), bina customer khata **ruka**, bina wajah
farq **ruka**, bina manzoori adjustment **ruka**, bina adad "tasdeeq"
**ruki**, manfi recharge **ruka**. Sab ulta diya gaya.

### Jo abhi NAHI bana (aur safha ye khud kehta hai)

Account banane ka form "Float aur account" par hai. Shuru ka float khali
chhora ja sakta hai (matlab "darj nahi hua", sifar nahi); likh dein to
wo ledger mein bhi jata hai (1190 debit / 3200 credit) -- sirf khane
mein nahi baithta. Finance ke khaton par yehi ghalti ho chuki hai, wahan
opening balance sirf khane mein para reh gaya tha aur do adad ban gaye.

- Provider ka statement import kar ke commission ki tasdeeq — is ke
  baghair commission hamesha `muntazir` rahegi.
- Slab wala commission ka qaida (abhi sirf fisad aur fixed).
- API integration (Phase 2 — malik ne khud kaha ke wo baad mein).

### Live par abhi NAHI chalayi gayin

**323 aur 324 dono Testing par hain, Live par nahi.** Live par jane se
pehle wohi tarteeb: backup verified → ginti → migrations → ginti dobara
→ build upload → smoke test.

---

## 5r. Rokay hua kaam — 325 (Categories ki safai)

Testing par 42 categories thin aur un mein kai ek hi cheez ke do do naam:

| Ek naam | Doosra naam |
|---|---|
| Cooking Oil & Ghee (5) | Ghee & Cooking Oil (4) |
| Soap & Detergent (4) | Soap, Detergent & Personal Care (22) |
| Spices & Masala (6) | Spices, Masale & Grocery Items (12) |
| Pesticide (0) | Pesticides (1) |
| Tea & Beverages (4) | Tea & Health Products (8) |

Ye sirf badsoorti nahi. Jab ek hi cheez do jagah baithi ho to dukan par
banda dono jagah dhoondhta hai, stock ki qeemat do hisson mein bat jati
hai, aur "is category mein kitna maal hai" ka jawab **hamesha kam aata
hai** -- bina kisi ko pata chale ke kam kyun hai.

### Do faisle

**Safha faisla nahi karta.** Wo sirf jodiyan saamne rakhta hai: ye do
naam bohot milte hain, aur har ek mein itna maal hai. Kaunsi kis mein
milani hai, malik tay karte hain. Milte julte naam ka matlab hamesha
"ek hi cheez" nahi hota -- *Poultry Feed* aur *Cattle/Dairy Feed* ke
aadhe lafz ek hain magar wo do alag cheezein hain, aur unhen mila dena
poultry ka stock hamesha ke liye cattle mein daal dega.

**Mili hui category ka nishan rehta hai.** Merge ke baad purani category
mit jati hai. Us ka record na ho to agle mahine ye sawal be-jawab reh
jata hai ke "Ghee & Cooking Oil kahan gayi -- kisi ne mita di, ya wo
kabhi thi hi nahi?" Is liye `category_merges` mein likha jata hai: kya
kis mein gaya, kitne product hile, kis ne kiya, aur kyun.

### Teen rokein (database mein, safhe par nahi)

1. Category apne aap mein nahi mil sakti.
2. Maa apni hi aulad mein nahi mil sakti -- warna darakht mein halqa
   (cycle) ban jata hai aur har fehrist jam jati.
3. Sirf Owner/Admin, aur **wajah ke baghair nahi** -- ye kaam ulta nahi
   hota.

### Testing par rollback test

Do product aur ek sub-category hili, purani category miti, nishan bana,
aur halqa ki jaanch ne sub-category ko maa ke neeche pakRa (yani rok lag
jati). Sab ulta diya gaya.

### Live par abhi NAHI chali

**325 Testing par hai, Live par nahi.**

---

## 5s. Rokay hua kaam — 326 (POS par discount)

POS mein discount ka koi khana tha hi nahi. Safhe par likha hua tha:
*"Discount ki qatar yahan nahi hai -- is nizam mein discount ka koi khana
hai hi nahi, aur 'Rs 0' likh dena us cheez ka wada hai jo hoti nahi."*

Wo us waqt theek tha. Magar dukan par discount **hota hai** -- "paanchas
rupay chhoR do" roz ki baat hai. Aur jab nizam mein us ka khana na ho to
banda rate gira deta hai, aur phir us cheez ka bikri ka rate hamesha ke
liye ghalat ho jata hai. Yani discount khatam nahi hota -- sirf **chup**
jata hai, aur nuqsan rate master mein baith jata hai.

### Bikri poori raqam par, discount alag khate mein

Aasan raasta ye hota ke bikri seedhi kam raqam par likh dete. Kitab
barabar rehti, kaam chalta -- magar ye sawal kabhi jawab na paata:
**"is mahine hum ne kitna discount diya?"**

```
Dr  cash / khata        950     (jo waqai aaya)
Dr  discount diya        50     (jo hum ne chhoRa)      4099
    Cr  dukan ki bikri  1,000   (jo maal ki qeemat thi) 4000
```

Khata **4099** contra-income hai (`is_contra`): aamdani ka khata magar
ulta chalta hai. Nafa nuqsan par wo bikri ke saath minus ho kar dikhta
hai, kisi kharche mein chhup kar nahi.

### Khane

| Khana | Matlab |
|---|---|
| `total_amount` | gahak ne jo dena hai (discount ke **baad**) — is ka matlab badla nahi, is liye har purana hisaab waisa hi chalta hai |
| `gross_amount` | discount se pehle ki raqam. Purane bill par NULL |
| `discount_amount` | jo chhoRa. **KHALI = discount diya hi nahi.** Sifar par rok hai |
| `discount_reason` | bina wajah discount nahi lagta |

Munafa **net** par ginta hai -- discount waqai munafa kam karta hai; use
gross par ginna har bill ko us se behtar dikhata jitna wo tha.

### Ek galti jo Testing par pakRi gayi

`create or replace function` ne purana 6-khanon wala function hataya
NAHI -- naye ke aakhri do khane (discount) ke default hain, is liye 6
khanon wala bulawa **dono** par utarta hai aur Postgres "function is not
unique" keh kar **bikri hi rok deta**. Yani purana function chhorna safai
ka masla nahi tha: use chhorte hi counter band ho jata.
Migration mein ab `drop function` pehle likha hua hai.

### Ijazat

Discount wohi de sakta hai jo rate badal sakta hai (`pos.edit`). Do alag
ijazatein banane se ek hi taqat do jagah tay hoti aur ek din wo alag ho
jatin -- rate girana aur discount dena, dono ka natija ek hai.

Rok teen jagah: safhe par (khana dikhta hi nahi), server par
(`posCheckout`), aur database mein (`create_pos_sale` + check
constraint).

### Testing par rollback test — aath baatein

Bina discount ka bill (gross aur discount dono khali) **bana**; wajah ke
saath discount **laga**; bina wajah **ruka**; sifar ka discount **ruka**;
bill se zyada **ruka**; bina gross ke **ruka**; `create_pos_sale` ka
sirf **ek** roop bacha; khata 4099 contra-income **hai**. Sab ulta diya
gaya.

### Live par abhi NAHI chali

**326 Testing par hai, Live par nahi.**

---

## 5t. Rokay hua kaam — 327 (Franchise dashboard aur menu ki safai)

Malik ka kehna: *"HR mein sirf HR se related hon, Finance se related
Finance, aur franchise ya branches ka ek alag dashboard banao -- us mein
shop aayengi, shop agreement, bill waghera."*

Adad us baat ki tasdeeq karte hain: **Finance par 54 safhe the**, aur un
mein se **13 ka Finance se koi taluq nahi tha** -- paanch machinery ke,
do doodh ke, shop ka kiraya, stock ki ginti, rate master, agri orders,
investors, submissions.

Aisa dashboard sirf bhara hua nahi hota -- wo **nakaara** ho jata hai.
Jis fehrist mein 54 naam hon, us mein banda dhoondhta nahi, apni yaad se
chalta hai; aur jo cheez us ki yaad mein nahi, wo us ke liye maujood hi
nahi rehti.

### Nayi ginti

| Dashboard | Pehle | Ab |
|---|---|---|
| Finance | 54 | **41** |
| Staff (HR) | 20 | **19** |
| Franchise aur Shops | — | **6** (naya) |
| Stock aur Godam | 13 | **27** (neeche dekhein) |

Franchise par: Dukanein, Shaakhein, Shaakh ki jagah, Dukan ka kiraya aur
bill, Shop ka udhaar, aur Shop ko maal bhejna.

### Hatane ka usool

**Hatane se pehle dekha gaya ke wo cheez apne ghar par maujood hai.**
Kisi safhe ko dashboard se hatana us ka raasta band kar dena hai (ijazat
rehti hai, magar jo menu mein na ho us tak koi pahunchta nahi). Har us
feature ki jaanch hui jise Finance se hataya -- machinery wale paanchon
machinery par pehle se the, doodh wale doodh par, waghera. **Ek bhi aisa
nahi hataya gaya jo hatane ke baad kahin nazar na aata.**

Aur ek cheez do jagah bhi ho sakti hai: `branch-credit` Finance par bhi
hai aur Franchise par bhi -- Finance ke liye wo "lena baqi" hai,
Franchise ke liye "is shop ka haal".

### SATTARAH SAFHE JO BANE HUE THE MAGAR KISI MENU PAR NAHI THE

Safai karte waqt ye jaancha gaya ke koi feature aisa to nahi jo kisi bhi
dashboard par na ho. **Sattarah nikle.** Un mein rozana ke kaam ke safhe
the:

```
/admin/products/setup-queue   naye product ki qatar
/admin/products/labels        barcode ke labels
/admin/products/bill-rates    bill se rate charhana
/admin/products/images        tasveerein
/admin/brands  /admin/categories  /admin/companies
... aur baqi
```

Ye sab ban chuke the, ijazat bhi thi, magar **menu mein kahin nahi the**.
Un tak pahunchne ka ek hi raasta tha: kisi ko raasta yaad ho aur wo pata
bar mein likh de. **Bane hue safhe ka menu mein na hona us safhe ka na
hona hi hai** -- farq sirf itna hai ke mehnat zaya ho chuki hoti hai.

Chaudah ko Inventory par **section ke saath** rakha gaya ("Maal ka
record" aur "Rate, barcode aur tasveer") -- seedhi qatar mein daal dene
se Inventory bhi wohi bhari hui fehrist ban jata jis se Finance ko abhi
bachaya.

Baqi teen (my-access, my-work, my-attendance) har bande ko waise hi
khulte hain -- wo code ki ALWAYS fehrist mein hain.

**Jaanch ka natija: ab be-ghar safhe = 0.**

### Counter ke teen khane (POS ka naqsha)

Malik ke bheje karyana naqshe ke mutabiq POS ke upar teen khane:
**Products | Mobile Load | Bill Payment**.

Ye teen ALAG SAFHE hain, ek safhe ke teen tab nahi -- jaan boojh kar. Ek
hi safhe par teenon daalne ka matlab hota ke bikri ka poora checkout aur
load/bill ka darj karna ek hi component mein rehte. Wo checkout is nizam
ka sab se hassas raasta hai (stock ghatta hai, khata barhta hai, ledger
banti hai) aur us ke aas paas ka har badlav khatra hai. Dekhne wale ke
liye farq koi nahi -- teen khane, ek click -- magar kharabi ki soorat
mein ek kaam doosre ko nahi le doobta.

Load/Bill ka khana sirf usay dikhta hai jise wo safha khulta hai.

### Live par abhi NAHI chali

**327 Testing par hai, Live par nahi.**

---

## 5u. Live run — 6 September (328): har bank ka apna khata

Malik ne Bank Reconcile ka safha dikha kar poocha: *"ye kaise khatam hoga
farq?"* Safhe par Rs 26,515 ka farq tha aur chaaron bank ke saamne Rs 0.

Safha khud apni majboori likh raha tha: *"har bank ka alag nahi — kyunki
ledger mein teenon banks ek hi khate (1010) mein jate hain."* Yani kisi
EK bank ko us ke apne statement se milana **mumkin hi nahi tha**. Farq
kabhi khatam na hota, chahe kitni mehnat hoti — sawal hi ghalat poocha ja
raha tha.

### Backup

```
agribridge-backup-20260906-1120.sql   —   3.9M   —   6 Sep 11:25
```

### Jo mila

| Entry | Raqam | Asal jagah | Kahan thi |
|---|---|---|---|
| TXN-26-000026 | 7,165 | Alfalah | 1010 |
| TXN-26-000029 | 350 | HBL | 1010 |
| TXN-26-000027 | 521 | CBA Account | **9999 Suspense** |
| TXN-26-000007 | 19,000 | **Cash** | 1010 |
| — | 2,030 | Al Rana Traders | **ledger mein tha hi nahi** |

Rs 19,000 ka machinery advance bank par likha gaya tha; malik ne tasdeeq
ki ke wo **cash** tha. Us ka cash book wala indraj bhi kabhi bana hi nahi
tha — yani golak ka adad Rs 19,000 kam bata raha tha.

### DATABASE NE MERA PEHLA RAASTA ROK DIYA — AUR THEEK ROKA

Pehli koshish mein maine `update journal_lines set account_code = ...`
likha: qatar utha kar doosre khate par rakh dena. Live ne mana kar diya:

```
Post ho chuki entry badli nahi ja sakti. Reversal entry banayein.
```

Ye rok 106 mein lagi thi, is jumle ke sath: *"raqam chupke se badal dena
delete se bhi zyada khatarnak hai: trial balance phir bhi barabar rehta
hai, is liye kisi ko pata hi nahi chalta."*

Agar wo update chal jata to ledger theek dikhta, magar us mein ye nishan
kahin na hota ke qatarein hili thin. **Poori migration wapas ho gayi aur
Live par ek harf nahi badla.** Phir wohi kaam durustagi ki entry se hua —
purani qatarein apni jagah, nayi un ke sath.

### Natija — har khate ka farq sifar

| Khata | Code | Cash book | Ledger | Farq |
|---|---|---|---|---|
| Cash in Hand | 1000 | 34,000 | 34,000 | **0** |
| UBL | 1010 | 0 | 0 | **0** |
| Bank Alfalah | 1011 | 7,165 | 7,165 | **0** |
| HBL | 1012 | 350 | 350 | **0** |
| Al Rana Traders | 1013 | 2,030 | 2,030 | **0** |
| CBA Account | 1014 | 521 | 521 | **0** |

Trial Balance barabar (573,978 = 573,978). Suspense **551 → 30**.

### Code: "1010" ab ek khata nahi, ek QATAR (1010–1019)

Paanch jagah `"1010"` ko *the bank* maan kar likha hua tha — Money Trail,
handover, reports, bank reconcile, crop-lifters. **Sirf naye khate bana
dene se wo paanch jagahein naye bank ginna band kar detin**: paisa kitab
mein hota magar Money Trail par nazar na aata. Ab har aisi jagah `BANK_CODES`
parhti hai.

Aur `bookBankLine` ab qatar **usi bank** ke khate par daalta hai jis ki
statement se wo aayi — pehle har bank ki har qatar 1010 mein girti thi.

Bank Reconcile ke safhe par ab har account ka apna adad hai: bank ke
mutabiq, hamare khaton ke mutabiq, aur farq. Jis account ka GL khata darj
na ho wahan **"GL khata nahi"** likha aata hai — sifar nahi.

### Jo abhi baqi hai

Suspense mein Rs 30 hain: POS ki do adaigiyan (easypaisa Rs 20, QR Rs 10)
jin ke liye `payment_method_account_map` mein koi khata darj nahi. Ye
malik ke batane par theek hoga — kaunsa paisa kis khate mein aata hai.

---

# 6 September — Live par rukka hua kaam

Malik ke "system par aa gaya" kehne par ye poori fehrist ek sath jayegi.
Tarteeb P0 rule ke mutabiq: **backup verified → pre-migration ginti →
migrations → verification → naya build upload → smoke test**.

## Live par chalni baqi migrations (chhe)

Chhon **testing DB par chal chuki hain**. Live par abhi 328 tak hai.

| # | File | Kya karti hai |
|---|---|---|
| 329 | `329_machinery_menu_chhota.sql` | Machinery ke bahut se tage khatam — ek hi form |
| 330 | `330_har_adaigi_ka_apna_khata.sql` | Cash / QR / easypaisa / JazzCash / bank / Kisan Card — har adaigi ka apna khata. Suspense ke Rs 30 isi se saaf honge |
| 332 | `332_ek_hi_cba_account.sql` | Load & Bill ka float alag khate par nahi — wohi CBA account (1014) |
| 333 | `333_kharid_ledger_ki_nigrani.sql` | Kharid aur supplier adaigi ab `v_ledger_unposted` mein; `v_supplier_payable_vs_ledger` |
| 331 | `331_shaam_ka_hisaab.sql` | Shaam ka Hisaab ka safha — menu, ijazat, madad |
| 334 | `334_team_ka_darakht_ohde_aur_tasveer.sql` | Team ka darakht: sab log nazar aayein, ohde ki seerhi, apni tasveer |

331 pehle **rok kar rakhi thi** — wo menu mein ek qatar daalti hai aur us
ka safha bana nahi tha. Menu se aisi jagah le jana jahan kuch hai hi
nahi, us se bura hai ke qatar hi na ho. **Ab safha ban chuka hai**
(`/admin/shaam-ka-hisaab`), is liye 331 bhi is baar jayegi.

## Live ka data theek karna — malik ki ijazat ke baghair NAHI

### Kharid PO-1788537423737 (Rs 112,048) ledger mein hai hi nahi

Maal godam mein hai, `suppliers.current_payable` bhi theek hai — magar
journal entry kabhi bani hi nahi:

| Khata | Abhi | Hona chahiye |
|---|---|---|
| 1200 Stock | **Rs −28** | ~Rs 99,000 |
| 2000 Supplier ko dena | 104,796 (sirf machinery vendor) | +112,048 |

Code theek ho chuka hai (`postGoodsReceived`), magar **jo kharid us se
pehle ho chuki wo apne aap ledger mein nahi jayegi**. Us ke liye ek
durustagi ki entry chahiye:

```
Dr 1200 Stock            112,048
   Cr 2000 Supplier ko dena        112,048
```

Ye Live ka maali record badalti hai. **Malik ke saaf kehne par hi
banegi**, aur us se pehle backup ki tasdeeq.

## cPanel par Cron Job (code se nahi lagta)

Roz ka milaan 29 August ke baad se chala hi nahi. cPanel → Cron Jobs →
rozana raat 11 baje:

```
curl -s "https://alranatraders.pk/api/cron/daily-reconcile?token=<CRON_SECRET>"
```

Ye cron chal raha hota to Rs 112,048 wali kharid `all_posted` jaanch par
usi din surkh nazar aa jati.

## Product rates — malik ke haath ka kaam

`/admin/products/bill-rates` par: **supreme** ek hi naam ke neeche chaar
alag pack size hain (bill par rate 171 / 330 / 902 / 1757, product par
saved rate Rs 18). Isi tarah Lays (19 aur 28 dono), Rio, candi, lifeboy,
pizzo, Lux, vital.

## 334 bhi is baar jayegi — Team ka darakht

Testing par chal chuki hai. Ye teen kaam karti hai:

1. `fn_hr_staff_directory` ka INNER JOIN → **LEFT JOIN**. Live par
   `staff_details` mein **zero** qatarein hain aur 19 active profiles —
   isi wajah se darakht bilkul khali tha.
2. `org_positions` — ohde ki seerhi: Board of Director → CEO → Director
   → Admin → Assistant Admin → Manager → ...
3. `fn_set_my_photo` — har banda apni tasveer khud laga sake, aur **sirf**
   tasveer (tankhwah/afsar nahi).

Migration ke baad Live par ye khud theek ho jayega — koi data nahi bharna
parta. Malik ko sirf har bande ka **ohda aur afsar** chunna hoga
(`/admin/hr/team/tree` → "Badlein").


---

# 6 September — Live par chal gayi (chhe migrations)

Backup ki tasdeeq pehle: `agribridge-backup-20260906-1405.sql`, **4.0M**.

**329, 330, 331, 332, 333, 334** — tarteeb se, har ek ke baad ginti.

## Ginti ka milan

| | Pehle | Ab | |
|---|---|---|---|
| Journal entries | 32 | 33 | +1 (Suspense wali durustagi) |
| Journal lines | 94 | 97 | |
| Trial Balance | 573,978 = 573,978 | 574,008 = 574,008 | barabar |
| **Suspense (9999)** | **Rs 30** | **Rs 0** | saaf |
| Finance khate | 6 | 10 | +JazzCash, Easypaisa, QR, Kisan Card |
| Bina khate ke tareeqe | **6** | **0** | |
| GL khate | 69 | 72 | |
| Features | 207 | 208 | +Shaam ka Hisaab |
| Ohde (org_positions) | — | 10 | |
| Sales / Products / Staff | 3 / 265 / 19 | 3 / 265 / 19 | **koi data nahi hila** |

## 330 pehli koshish mein RUK GAYI — aur theek ruki

```
null value in column "opening_balance" of relation "finance_accounts"
violates not-null constraint
```

Repo ki file `null` likh rahi thi, jab ke us khane par `NOT NULL` ki rok
hai. File ke apne comment mein ye baat pehle se likhi thi — sirf SQL us
comment se mel nahi khati thi. Testing par jo waqai chala tha wo `0` tha;
file kabhi us ke sath nahi lagayi gayi thi.

**Live ne mana kar diya aur poori migration wapas ho gayi — ek harf nahi
badla.** File theek kar ke dobara chalayi.

Chaaron naye khate `opening_balance = 0` par hain aur **un ka koi opening
journal entry nahi** — yani ye koi dawa nahi karta ke un mein sifar hai.
Un mein abhi kitna para hai, wo pehle shaam ke milan par darj hoga.

## 333 ne foran wo cheez pakri jo pehle nazar hi nahi aati thi

```
purchases              1 qatar    Rs 112,048   <- ledger tak nahi pahunchi
finance_transactions   1 qatar    Rs  19,000
```

## Ab bhi baqi

1. **Rs 112,048 ki durustagi wali entry** — `Dr 1200 / Cr 2000`. Code
   aage ke liye theek ho chuka, magar purani kharid apne aap ledger mein
   nahi jayegi. **Malik ke saaf kehne par hi.**
2. **cPanel par cron** — roz ka milaan 29 August se band hai.
3. **Darakht par ohda aur afsar** — 334 ke baad 19 log nazar aayenge,
   magar har bande ka ohda malik ko chunna hoga.
4. **335 (ginti ki tarteeb)** — testing par pass, safha ban chuka hai.
   Agle round mein Live par jayegi.


## 335 bhi chal gayi — aur us mein ek kharabi PAKRI GAYI

335 Live par chalte hi `v_stock_count_due` dekha, aur jo dikha wo ghalat
tha:

| Godam | Pehle (110 ka nishan) | 335 ke baad |
|---|---|---|
| Central Warehouse | **surkh** (kabhi gina nahi) | waqt par |
| Kisan Karyana - Godam | **surkh** | waqt par |
| Kisan Dukan - Godam | **surkh** | waqt par |

Teenon godam, jin ki ginti **kabhi hui hi nahi**, surkh se seedha "waqt
par" ho gaye. Yani jo nishan 110 ne lagaya tha wo chup chaap **bujh gaya
tha**.

**Wajah:** view mein `coalesce(s.shuru_se, current_date)` likha tha. Jis
godam ki tarteeb darj na ho, us ka "shuru" har roz AAJ ban jata — aur
agla moqa hamesha "aaj se 30 din baad". Aisa godam **kabhi late nazar hi
nahi aata**.

**Fix (335b):** `coalesce(s.shuru_se, w.created_at::date)` — godam BANNE
ki tareekh. Ab:

| Godam | Bana | Pehla moqa | Haalat |
|---|---|---|---|
| Kisan Karyana - Godam | 26-Jul | 25-Aug | **12 din late** |
| Central Warehouse | 09-Aug | 08-Sep | waqt par |
| Kisan Dukan - Godam | 23-Aug | 22-Sep | waqt par |

Ye 110 se zyada durust hai (wahan teenon 9999 din late the), aur narm
bhi nahi: jo waqai apni pehli 30-din wali muddat guzar chuka hai, wohi
surkh hai.

Ye wohi qism ki ghalti thi jis se ye project bar bar bachta aaya hai --
nishan chup chaap bujh jana. Pakri gayi kyunki migration chalane ke baad
ginti dobara ki gayi thi, jaisa P0 rule kehta hai.


---

# 6 September (shaam) — Cash Book aur ledger ka farq

## Kaise pakra gaya

Malik ne kaha: *"jo abhi maine load kia hai wo mere Easypaisa account
mein shift karein."* Ledger mein wo durustagi ho gayi
(**TXN-26-000039**) aur ginti bhi theek nikli:

```
1016 Easypaisa      Rs 1,020
2040 Wallet ka bojh Rs     0
Trial Balance       729,570 = 729,570
```

`load_transactions` ki qatar bhi ledger se mila di gayi
(`LD-2026-00001` ab `payment_method = bank`, khata Easypaisa).

**Magar us ke baad Finance ka safha khola to adad phir bhi ghalat the.**

## Asal masla: paise ke DO register the, aur do raaste sirf EK mein jate the

| Khata | Finance ka safha | Ledger |
|---|---|---|
| Bank Alfalah | 7,165 | **5,165** |
| CBA Account | 521 | **1,521** |
| Easypaisa | 0 | **1,020** |
| QR (merchant) | 0 | **10** |

`finance_accounts.current_balance` **sirf** `finance_transactions` se
nikalta hai (127 ka usool, aur us par database ka taala bhi hai). Do
raaste ledger mein qatar daalte the aur Cash Book ko chhoR dete the:

1. `transferAccountBalance` — khate se khate mein raqam
2. `createLoadTransaction` — load / bill ki qatar

Teesra: 328 aur 330 ki durustagi ki entries, jo seedha ledger par chali
thin.

**Ye khamosh ghalti thi.** Trial Balance hamesha barabar rehta tha, koi
report shikayat nahi karti thi — aur malik wohi safha parhte hain jis par
ghalat adad tha.

## Kya theek hua

* **Code:** `src/lib/ledger/cash-book.ts` — ab har wo raasta jo paisa
  hilata hai, Cash Book mein bhi qatar daalta hai: load/bill, us ki
  wapsi, float recharge, bill settle, khate ka transfer, commission,
  naqad udhaar.
* **338:** purana farq gin kar barabar (raqam haath se nahi likhi gayi),
  aur `v_cash_book_ledger_farq` — jahan farq ho wahan qatar nazar aaye.
  Khali hona hi theek hai.

## 20 migrations Live par chal gayin (7 September)

Malik ne backup liya (`agribridge-backup-20260907-0952.sql`, 4.1M) aur
"system par aa gaya" kaha. P0 tarteeb ke mutabiq: backup tasdeeq →
pre-migration ginti → migrations → verification ginti.

| # | Kya karti hai | Testing | Live |
|---|---|---|---|
| 338 | Cash Book aur ledger ka milan + farq wala view | ✅ (0 farq) | ✅ |
| 339 | Customer ka khata: `fn_customer_ledger`, `fn_customer_baqi`, help | ✅ | ✅ |
| 340 | Wade ki tareekh har tabdeeli nahi rokti | ✅ | ✅ |
| 341 | Membership ka darja aur udhaar ka taala | ✅ | ✅ |
| 342 | Vendor ko do dafa zyada gaya paisa wapas | ✅ | ✅ (neeche dekhein — asal bug Live par hi pakri gayi) |
| 343 | Ohda TEMPLATE bane, taala nahi + `fn_apply_role_template` | ✅ (har ohde ki ginti waisi hi rahi) | ✅ (Admin Assistant 98→94, Manager 98→125 — koi safha band nahi hua) |
| 344 | Sales staff ka template malik ki fehrist par (20 → 9, view+create) | ✅ | ✅ |
| 345 | Dukan ka code khud bane (01, 02…) | ✅ | ✅ (teen dukanein 01/02/03 ban gayin) |
| 346 | Ek bande ke ek feature ki EK hi pakki qatar (unique taala) | ✅ (index bana) | ✅ |
| 347 | Rozana ka kharcha: banda, khata, tareekh + manzoori ka taala | ✅ | ✅ |
| 348 | Kharche ki qism bandhi hui nahi + `fn_bande_ka_saara_lenden` | ✅ (paanch jaanch pass) | ✅ |
| 349 | Mazdoori, advance ka khud-ba-khud adjust, bande ka ek khata | ✅ (malik ka apna misaal ledger par chala kar dekha) | ✅ |
| 350 | Do taraf ki raqam manzoori se katti hai (`party_settlements`) | ✅ | ✅ |
| 351 | Manzoori ka waqt (SLA) aur us ka seedha (escalation) | ✅ (teen umar ki qatarein chala kar dekhi gayin) | ✅ |
| 352 | Khulasa rukh dekhe, khate ki qism nahi (ulta balance chhupta tha) | ✅ | ✅ |
| 353 | Live push: realtime ki ijazat + publication | ✅ (saaton table publication mein, replica identity full) | ✅ |
| 354 | Purani ijazat (`allowed_pages`) nayi fehrist mein | ✅ (har bande ka har purana safha khula raha — 0 band) | ✅ (413 qatarein bani, koi safha band nahi hua) |
| 355 | Naya signup khudbakhud staff nahi banta (default `sales_staff` → `customer`) | ✅ | ✅ |
| 356 | `supplier_payment_requests` par RLS policy (pehle darwaza band tha) | ✅ (policy lagi, `pg_policies` se tasdeeq) | ✅ |
| 357 | Load & Bill ka udhaar kisan ko bhi (`load_transactions.farmer_id`) | ✅ | ✅ |

### 342 ne Live par ek asal, nayi kharabi pakri — batch insert ka masla

342 pehli koshish mein **rukk gayi** (Testing par nahi hoti thi, kyunki
wahan MB-2026-00004 ka teen-dafa-adaigi wala haal kabhi bana hi nahi
tha). Ek hi `INSERT ... SELECT` mein do "wapas" (reversal) qatarein ek
sath daalne par `fn_apply_finance_transaction` ka incremental update
doosri qatar par pehli ka naya `current_balance` nahi parh raha tha —
`fn_guard_finance_balance` ne Rs 30,000 ka farq pakar kar poori
migration rok di. Migration file khud theek ki gayi (ab har qatar apne
alag `INSERT` statement mein, ek PL/pgSQL loop ke andar) aur dobara
chalayi — is baar saaf. Verification: "Cash in Hand" ka
`current_balance` aur `fn_finance_account_true_balance` dono -28,000
par barabar, `amount_paid_to_vendor` = 24,750 (booking ka sahi hissa).

### Pre/post migration ginti — sab reconcile hui

| Table | Pehle | Baad | Farq ki wajah |
|---|---|---|---|
| journal_entries | 43 | 44 | +1 (342 ki durustagi wali entry) |
| journal_lines | 121 | 124 | +3 (usi entry ki qatarein) |
| finance_transactions | 17 | 23 | +6 (338 ka milan + 342 ka wapas) |
| role_feature_permissions | 226 | 222 | -11 (344, sales_staff) +4 (347) +3 (350) |
| user_feature_permissions | 0 | 413 | 343 + 354 ki naql |
| v_cash_book_ledger_farq | — | 0 | saaf |
| customers, farmers, profiles, load_transactions, supplier_payment_requests | — | — | koi farq nahi |

### 343 aur 346 ki tarteeb — ye ulti nahi ho sakti

343 **pehle** chalti hai. Wo har bande ki mojooda ijazat us ke apne
khate mein NAQAL karti hai, aur us ke baad hi view se ohde wala hissa
nikalti hai. Ulti tarteeb mein ek lamhe ke liye har bande ki ijazat
sifar ho jati — gyarah logon ka menu khali, aur kaam ruk jata.

346 usi table par unique taala lagati hai, is liye wo 343 ke **baad**
hi maani rakhti hai.

Build in dono ke **baad** upload hona hai. Build pehle chala jaye to
`/admin/staff-access` ka "Template lagayein" `fn_apply_role_template`
na milne par kaam nahi karega (safha khulta rahega, sirf wo dabao
kharabi dega).

Live par 338 chalne se pehle aur baad mein ye ginti leni hai:

```sql
select * from v_cash_book_ledger_farq;   -- baad mein KHALI honi chahiye
```

## Naye khane isi round mein

* **Load par commission** — `commission_confirmed` ka khana database
  mein tha magar us tak koi raasta nahi tha. Malik: *"service charges to
  nahi liye, lekin hamein 15 rupay ka commission mila hai — wo kahan darj
  nahi hua?"* Ab qatar ke saamne raqam likh kar "Mil gayi", aur ye
  poochha jata hai ke wo kis khate mein aayi.
* **Naqad udhaar aur wapsi** — `/admin/load-bill` ka teesra khana. Ye
  bikri nahi (koi maal nahi gaya), sirf 1100 par party ke sath. Har dafa
  teen jagah ek sath hilti hain: ledger, Cash Book, aur gahak ka balance.
* **Gahak ka khata** — `/admin/crm/<id>/statement`. Supplier, kisan,
  dealer, buyer, driver, investor sab ka statement pehle se tha; gahak ka
  nahi.

## Ab bhi baqi (pehle wali fehrist ke ilawa)

5. **Rs 15 ki commission** — khana ban chuka hai, magar malik ko batana
   hai ke wo Rs 15 **kis khate** mein aaye (CBA float mein, ya kahin
   aur). Us ke bagair darj nahi ki ja sakti — andaza lagana wohi ghalti
   hoti jo mahine baad company ki statement se milan par nikalti hai.

6. **Anwar ki dukan** — us ka `shop_id` abhi khali hai. Wo Main Branch
   Mahabali par aa chuka hai (pehle ek `blocked` shaakh par tha jis ke
   neeche koi dukan hi nahi thi -- isi liye Users ke safhe par Shop ka
   khana khali reh jata tha). Do karyana dukanein maujood hain; kaunsi
   us ki hai, ye malik hi bata sakte hain.

7. **Rs 5 lakh ki udhaar ki hadd** — `branch_credit_accounts` ki wo
   qatar `Kisan Karyana Mahabali` (blocked shaakh) par lagi hui hai, jo
   malik mitana chahte hain. Shaakh mitane se wo hadd bhi chupchaap mit
   jayegi. Malik se poochha ja chuka hai: hadd Main Branch Mahabali par
   le jayein ya khatam karein. Jawab ke baghair shaakh nahi miti.

8. **Company Expenses par qism ka purana taala** — Live par
   `company_expense_requests.category` sirf SAAT naam qubool karta hai
   (inventory_purchase, rent, salary, utility_bill, supplier_payment,
   maintenance, other). Safha us se ZYADA qismein dikhata hai — `fuel`,
   `transport`, `tea_food`, `stationery`, `cleaning`. In mein se koi
   chun kar bill bhejne par qatar database par ruk jati thi.

   Abhi tak kisi ne mehsoos nahi kiya kyunki Live par ek bhi kharcha
   darj hi nahi hua (ginti 0). Migration 348 ye taala shakal wale taale
   se badal deti hai. Ye Live par 347 ke saath hi jayegi.

### 349 ki jaanch — malik ka apna misaal, Testing ke ledger par

Malik ne jo tarteeb likhi thi, wo qatarein daal kar chala kar dekhi gayi
(sab wapas le li gayin, koi qatar Testing par baqi nahi):

| Qadam | Nateeja | Chahiye tha |
|---|---|---|
| Din 1: Rs 3,000 advance | advance 3,000 · dena 0 | 3,000 / 0 |
| Din 2: Rs 2,000 mazdoori | advance 1,000 · dena 0 | 1,000 / 0 |
| Din 3: Rs 1,500 mazdoori | advance 0 · dena 500 | 0 / 500 |

Aur us ke saath khaad ka Rs 10,000 udhaar daal kar dekha gaya ke khulasa
DONO alag dikhata hai — `1150 lena 10,000` aur `2015 dena 500` — na ke
"7,000 net". Chup chaap set-off nahi hota; wo malik ki apni shart thi.

## P0 — `profiles` par badalne ka koi RLS qanoon hi nahi

6 September ko malik ne likha: *"Anwar ko maine karyana par lagaya hai
to kahin save ka button nahi, jahan hum save kar dein."*

Button maujood tha (dropdown badalte hi form jama ho jata tha). Magar
Live par dekha to `shop_id` phir bhi KHALI tha, aur safhe par koi ghalti
bhi nazar nahi aayi.

Wajah `profiles` ki ijazat mein hai. Us par RLS chalu hai aur SIRF EK
qanoon likha hua hai:

```
own_profile — SELECT — (auth.uid() = id OR fn_is_any_staff())
```

Parhne ka qanoon hai, BADALNE ka koi nahi. RLS ke peeche update NAKAAM
nahi hota — wo kisi qatar par lagta hi nahi. Nateeja: `error` khali,
`success: true`, aur database mein kuch nahi badla.

Ye ek jagah ki baat nahi thi. Isi tarah chup chaap nakaam ho rahe the:

| Kaam | Kahan |
|---|---|
| Bande ki dukan | `assignUserShop` |
| Bande ki shaakh | `assignUserBranch` |
| Bande ka department/role | `updateUserRole` |
| Doosre department | `updateUserExtraRoles` |
| Account chaalu / band | `toggleUserActive` |

Yani Users ka poora safha dekhne mein chalta tha aur amal mein kuch
nahi karta tha.

**Hal (code mein, migration nahi):** `lib/profile-write.ts` — ye
likhaiyan service client se hoti hain (ye kaam pehle hi Owner/Admin tak
mehdood hain) AUR `.select("id")` se tasdeeq hoti hai ke waqai qatar
badli. Sifar par saaf ghalti wapas jati hai.

Sath ek aur kami: `ShopSelector` dukan ka NAAM nahi, sirf QISM dikhata
tha — is liye ek hi shaakh ke neeche do "Karyana" bilkul ek jaise nazar
aate the. Ab naam pehle, qism baad mein. Aur dono selector ab "mehfooz"
ka nishan dikhate hain.

Anwar ki dukan Live par set kar di gayi (Kisaan Karyana Mahabali,
KKM001) — malik ke kehne par.

## Do safhe jo bana kar HATAYE gaye — malik ka usool

Malik (6 September): *"Agar already bana hai to theek hai, kuch miss hai
to upgrade kar do. Pehle bane ko update karo, behtar karo. Ek hi kaam
baar baar naye tag naye naam ke sath nahi hone chahiye."*

Ye baat theek meri ghalti par thi. Do safhe aise bane jo pehle se
maujood kaam ke doosre naam the:

| Bana | Pehle se kya tha | Ab |
|---|---|---|
| `/admin/verification` | "Approval Inbox" (`/admin/submissions`) aur Command Center ka Approval department | Mit gaya. Qatarein Approval Inbox ke andar. |
| `/admin/mazdoori` | Shop par "Paisa & Khata" ka tag | Mit gaya. Form aur qatarein Paisa & Khata ke andar. |

Dono ke `features` / `role_feature_permissions` / `feature_help` ki
qatarein bhi Testing par hata di gayin. Live par ye kabhi gaye hi nahi
the (338 se aage ki koi migration Live par nahi chali), is liye wahan
kuch mitane ki zaroorat nahi.

Migration 349 aur 351 ki files se wo hissay nikal diye gaye hain, taake
Live par jaate waqt wo feature bane hi na.

**View aur function apni jagah hain** — `v_manzoori_ki_qatar` aur
`fn_manzoori_ka_khulasa`. Unhen ab Approval Inbox aur Command Center
DONO parhte hain, ek hi jagah se (`lib/manzoori-qatar.ts`), taake ek
hisaab do jagah alag alag na lage.

### 353 — live push ke baghair ye do cheezein chal hi nahi sakti thin

Live par ye migration chalne se PEHLE koi bhi "Live" ka nishan jhoota
hoga. Do baatein Live par bhi wohi hain jo Testing par thin (dekhi ja
chuki hain):

1. **`supabase_realtime` publication khali hai** — ek bhi table us mein
   nahi. Yani koi tabdeeli kabhi bahar bheji hi nahi jati.

2. **Teen tables par SELECT ka koi RLS qanoon nahi** —
   `company_expense_requests`, `finance_transactions`,
   `whatsapp_submissions`. App ka kaam is se ruka nahi (wo service
   client se parhe jate hain), magar Realtime bande ki APNI ijazat par
   chalta hai.

`REPLICA IDENTITY FULL` bhi lagti hai: us ke baghair UPDATE ki khabar
nahi aati — aur manzoori ek UPDATE hai.

**Live par chalne ke baad ye tasdeeq karein:**

```sql
select c.relname, c.relreplident,
       (select count(*) from pg_policies p
         where p.tablename = c.relname and p.schemaname = 'public' and p.cmd = 'SELECT') as select_policies
  from pg_publication_rel pr
  join pg_publication p on p.oid = pr.prpubid
  join pg_class c on c.oid = pr.prrelid
 where p.pubname = 'supabase_realtime'
 order by c.relname;
```

Saat qatarein aani chahiyen, har ek par `relreplident = f` aur
`select_policies = 1`.

### Live par safhon ki safai — koi migration nahi chahiye

Jo teen safhe hataye/more gaye (`verification`, `mazdoori`,
`company-expenses`) un ke `features` waali qatarein Live par kabhi gayi
hi nahi thin — 338 se aage ki koi migration Live par nahi chali. Is liye
wahan kuch mitane ki zaroorat nahi; naya build hi kaafi hai.

### 354 — is ke baghair 343 log ko bahar kar deti

Ye baat Live ke apne adad se naapi gayi hai. **343 akeli chalti to:**

| Banda | Purane safhe | Jo BAND ho jate |
|---|---|---|
| Admin Assistant | 98 | **82** |
| Manager | 98 | **77** |
| Finance Team | 22 | 7 |
| HR Department | 14 | 7 |
| Warehouse Team | 12 | 3 |

Wajah: middleware purani fehrist (`allowed_pages`) SIRF us waqt parhta
hai jab nayi bilkul khali ho. 343 sab ko qatarein de deti hai, is liye
purana raasta khud band ho jata hai — aur us mein jo zyada safhe the wo
gum ho jate.

**Is liye 343 aur 354 ek sath jani hain. 354 ke baghair 343 Live par na
chalayein.**

354 ke baad Testing par ginti: har bande ka har purana safha khula —
**ek bhi band nahi.**

### Purana khana girane wali migration — BAAD mein

`profiles.allowed_pages` aur `role_page_permissions` jaan boojh kar nahi
girayi gayin. Deploy ki tarteeb migrations pehle, build baad mein hai —
yani thori der purana build naye schema par chalta hai, aur purana
middleware har request par `allowed_pages` maangta hai.

Abhi girate to us thori der mein har bande ka har safha toot jata, login
samet.

**Naya build Live par chalne aur smoke test pass hone ke BAAD** ye
migration bhejni hai:

```sql
alter table public.profiles drop column if exists allowed_pages;
drop table if exists public.role_page_permissions;
```

Abhi ye likhi nahi gayi — malik ke build accept karne ke baad banegi.

---

## Code fix (koi naya migration nahi) — POS khata, party linkage, dealer sale

Malik: *"/admin/khata ko ledger se jorh do."*

Peechha karte hue asal maali bug mila — `/admin/khata` (dealer) mein
nahi, **POS ki apni khata-bikri** mein. Chaar cheezein theek hui hain,
sab code mein (`src/actions/pos.ts`, `src/actions/pos-returns.ts`,
`src/app/admin/reports/sales/page.tsx`), **koi DB migration nahi**:

1. Dealer ki bikri ab company ke journal mein POST hi nahi hoti
   (`postSaleToLedger` `sale.dealer_id` par seedha wapas). Wajah:
   `create_pos_sale` dealer ki bikri par COGS/stock kabhi nahi
   banati thi, phir bhi poori raqam "Dukan ki Bikri" mein charh jati —
   bina lagat ke, company ka nafa hamesha ghalat.

2. POS khata-bikri (1100) ab `partyType: "customer", partyId:
   crm_customer_id` ke sath jati hai — pehle bina linkage ke jati thi,
   is liye `fn_customer_ledger` par kabhi nazar nahi aati thi.

3. `customers.current_balance` ab POS khata-bikri par BARHTA hai
   (`postSaleToLedger` ke aakhir mein) aur khata-wapsi par GHATTA hai
   (`postReturnToLedger`) — pehle ye khana kisi POS action se hilta hi
   nahi tha, is liye credit-limit ki jaanch (`checkCredit`) hamesha
   purana (aksar sifar) adad dekh rahi hoti.

4. `reports/sales/page.tsx` ka "Kul lena hai" / "hadd 80%" card ab
   `customers.current_balance` se parhta hai, `khata_accounts` se nahi
   — us table mein wasooli ka koi raasta nahi tha, sirf barhta jata.

**Live par is waqt sifar hai:** 0 dealer, 0 POS khata-bikri, 0 khata
wapsi. Is liye ye chaaron fix kisi purane hisaab ko nahi chhedte — sirf
agli bikri se sahi chalna shuru hota hai. Testing par party-linkage
manual test se dikhaya gaya (qatar bana kar, ulti karke saaf ki gayi):

```
journal_lines: 1100 debit 3000, party_type='customer', party_id=<id>
customers.current_balance: 0 -> 3000
```

Dealer ka apna khata (`/admin/khata`, `khata_accounts` jahan `dealer_id`
bhara ho) jaan boojh kar company ke journal se ALAG rakha gaya —
dealer apna maal khud khareedta hai aur apne gahak ko apni marzi se
bechta hai; ye us ka apna karobar hai, company ka nahi. Us safhe ka
poora peechha `docs/DUPLICATE-SAFAI.md` mein hai.

## Nav mein 7 gumshuda safhe (koi migration nahi)

Malik: *"phir jo baqi rehte hain wo karo."* Poori `/admin/**` (265
safhe) ko nav config se milaya — 7 safhe kabhi kisi menu ya kisi doosre
safhe se link nahi thay, sirf owner/admin URL se khol sakte thay.
Poora peechha aur fehrist `docs/DUPLICATE-SAFAI.md` mein.

## Poore ERP ki review (6 September) — 355 aur 356 mile

Malik: *"sary erp ka review kro is ko ok kro."* Poori codebase ka
file-by-file review mumkin nahi (bahut bara hai), is liye jo mumkin tha
wo kiya: Supabase security advisor (Testing par 358 lint) parha, aur
har ERROR/WARN ko wajah dekh kar chaana — zyada tar is project ke apne
tay-shuda tareeqe (SECURITY DEFINER functions/views) the, jhoothi
alarm. Do asal masle mile jo malik ne khud nahi poochhe thay:

### 355 — Naya signup khudbakhud staff ban sakta tha

`fn_handle_new_user()` (har naye login banne par chalta hai) agar
`role` metadata mein na milta (ya na-pehchana role milta) to seedha
`'sales_staff'` bana deta tha — matlab **koi bhi bahar wala bandaa**,
sirf public anon key se seedha Supabase Auth API par jaa kar (app ke
apne form se guzre baghair), staff ban sakta tha. Ab tak app ke andar
har jagah (registration, farmer login, HR, vendor portal) sahi role
khud se bhejti hai, is liye abhi tak koi nuqsan nahi hua — magar
darwaza khula tha. Ab default `'sales_staff'` ki jagah `'customer'`
(bilkul ijazat wala nahi) hai.

### 356 — supplier_payment_requests ka darwaza khula hi nahi tha

Ulta masla: RLS chalu thi magar policy ek bhi nahi — matlab
`/admin/finance/queue` ka supplier-payment-request wala hissa
(banana, dekhna, approve/reject) **kabhi kaam hi nahi kar saka**, khud
owner ke liye bhi. Table mein isi liye zero qatarein hain. Ab
`company_expense_requests` jaisi hi policy lagi hai (staff parh sakte
hain, finance/HQ likh sakte hain).

**Dono Testing par lagi aur tasdeeq hui hain.** Live par abhi NAHI —
backup ki tasdeeq ka intezar hai, neeche ki "chalni baqi" fehrist mein
shamil.

**Jo review mein nahi ho saka, saaf keh diya jaye:** 358 mein se
baaqi ~350 lint (zyada tar `function_search_path_mutable`,
`security_definer_view`, aur staff-only functions ka anon-executable
hona) ek ek karke check nahi kiye gaye — wo is project ka jaan-boojh
kar chuna gaya tareeqa hain (SECURITY DEFINER + andar `fn_is_any_staff`
jaisi jaanch), aur pehle bhi isi tarah verify ho chuka hai. Agar malik
chahen to in ka bhi ek-ek karke gehra review ho sakta hai, magar wo
alag, lamba kaam hoga.

## Ab tak ka poora hisaab — ye meri chalti hui fehrist hai (7 September, sham)

Malik: *"apni purani memory update kr, us men baqi Jo kam hn wo krin
tmhara task hg."* Yani ye fehrist ab ek dafa ka kaam nahi — har dafa
kaam karte waqt ye pehle parhna hai, aur har dafa kuch nayi cheez
milte ya poori hote hi yahan update karna hai.

### Database — sab kuch Live par ho chuka

Migrations 338–360, **sab Live par chal chuki hain aur verify ho chuki
hain.** (338–357: "20 migrations Live par chal gayin" wale hisse mein;
358 Stock/Suspense ka Rs 28, 359 Purchase review edit-tracking, 360
WhatsApp adhoora farmer na bane — teenon isi sitting mein, 4.4M wale
backup ki chhatri ke neeche.) **Koi migration ab pending nahi.**

### Code — naya build Live se aage nikal chuka, upload chal raha hai

Malik ne pichla build (khata/credit wala, commit `d3cd4aa` tak) chala
liya tha. Us ke baad se ye sab push ho chuka hai aur **abhi build ho
kar upload ho raha hai** (7 September sham, malik khud terminal par
hai):

| Commit | Kya hai |
|---|---|
| `076885e` | Load & Bill stage 3 — "Payment Receive" apna tab, Service Charge Cash/Khata ke baad, PartyStrip mein "Available Credit" |
| `02ff9c2` | Farmer Details Documents — camera se seedha khenchna + crop (`ImageCropField`) |
| `7a93f85` | Agri Order (New): "Partner Details" sirf bahar wale supplier ke liye |
| `d0c40f4` | Purchase review: items dikhna/edit, kis ne approve/reject kiya (migration 359) |
| `0ae8979` | Propose Product: image upload + naya category likh sakte hain |
| `7042dab` | Farmer registration email fail fix (admin.createUser) + WhatsApp OTP button |
| `aff921a` | Login OTP cooldown live ginta hai |
| `062f0f3` | WhatsApp adhoora farmer nahi banta (migration 360) |
| `319a293`, `4f1dcd1` | Mera Kaam: department cards grid, "Sab Theek" sirf nishan, ek waqt mein ek hi department khula |
| `de1f10f` | Isi fehrist ke purane update |

**Dhyan rahe:** "10 se zyada permission par sidebar khud aati hai"
(`sidebar-free.ts`) pehle se bana hua hai, Live ka
`platform_settings.sidebar_free_dashboards` **enabled** hai. Rule
`>10` hai (barabar nahi) — Anwar theek 10 par "sirf cards" mein aata
hai, chhoti sidebar mein nahi.

**Scope badla (7 September, malik ke alfaz): "developer ko mana kar
diya hua hai, email or WhatsApp OTP sab ap he karo."** Front
website/registration (`src/app/register/**`, `src/app/login/**`) ka
email/WhatsApp-OTP hissa ab mera hai — baqi front website abhi bhi
developer ka hai jab tak malik kuch aur na kahein.

### Anwar ki permission (staff-access se khud theek ki gayi)

20 se 10 par (sales_staff template) — malik ne khud `/admin/staff-access`
se kiya. **Khula sawal:** `my-department` ("My Team — Head" ki ijazat)
ab bhi Anwar ke paas hai, kyunke template lagane se jo pehle se hai wo
chhua nahi jata. Rakhna hai ya hatana — malik ka faisla baqi hai.

### Malik ke apne khule kaam (mere control se bahar)

- **WhatsApp OTP template** — Meta Business Manager mein Authentication
  category ka template chahiye (naam `WHATSAPP_OTP_TEMPLATE` env mein
  jayega). Malik dekh rahe hain ke pehle se koi manzoor shuda hai ya
  naya banana hai.
- **SendPK / BulkSMS.com.pk** — account ban chuka hai, API Docs abhi
  dekhne baqi hain. Mil jaye to `src/lib/sms.ts` mein integration
  likha jayega (abhi stub hai, "SMS provider not configured yet").

### Baad ke liye taiyar, jaan boojh kar abhi nahi banaya

- `allowed_pages`/`role_page_permissions` girane wali migration —
  SQL taiyar hai, naya build ka smoke test pass hone ke baad banegi.
- 358 security lint mein se ~350 abhi tak deep-review nahi hue (malik
  chahen to alag kaam).
- Load & Bill: Bill Payment tab ka bill-specific fields ka gehra
  review; sidebar "Customer Ledger" ko Unified Khata ka filtered view
  banana (malik ka apna future item).

**Agla review jab bhi ho, is fehrist ko yahin se aage barhana hai.**

---

## Rokay hue kaam — 8 September (Budget/Vet, Kharche tasdeeq, POS Counter/Shift, Stock Count tasdeeq)

Ye sab **Testing par chal chuka hai** (`hwaiuwxqldxsoukkfefn`), migration
361 se 370 tak — koi bhi Live par abhi tak NAHI gayi (tasdeeq shuda,
`schema_migrations` mein 361–370 sirf Testing par hain). Owner poore
waqt system par active the (browser se khud test karte rahe), is liye
command hold rahi — ab yahan likh di gayi hai taake "system par aa
gaya" kehte hi poori fehrist ek sath ban sake.

### Migrations jo Live par jani hain (361–370, isi tarteeb mein)

| # | Kya karti hai |
|---|---|
| **361** | Budget ab branch ke hisaab se bhi likha ja sakta hai. |
| **362** | Budget Shop (business unit) tak — Karyana/Agri Inputs/Vets/Milk/Grain. |
| **363** | "Vets" naya business type — Karyana/Agri Inputs/Dairy/Grain ke barabar. |
| **364** | Kharche: Branch Manager sirf apni branch ki TASDEEQ karta hai (naya action `verify`), final MANZOORI Finance/Owner/Admin karte hain. `company_expense_requests.verified_by/verified_at`, status mein `verified` juRa, SoD rule (requested_by/verified_by). |
| **365** | `audit_logs.action_type` check constraint mein `verify` shamil. |
| **366** | POS Counter + Shift ka poora schema: `pos_counters`, `pos_counter_staff`, `pos_shifts`, `pos_shift_counters`; `pos_sales.counter_id/shift_id`; `create_pos_sale` mein optional `p_counter_id` (purana raasta jaisa tha waisa hi rehta hai). |
| **367** | 'pos-counters' feature/dashboard/ijazat/madad register. |
| **368** | **Bug fix** — 366 ne naye tables par RLS lagai magar GRANT dena bhool gaya; is se POS seedha khulta tha, counter/shift poochta hi nahi tha (owner ne khud pakRa, screenshot ke sath). Ab `grant select,insert,update,delete` lag chuki. |
| **369** | 'reports.pos-shifts' feature register (Shift Report ka safha). |
| **370** | Stock Count: Kharche wala tareeqa yahan bhi. Manager apni branch ki ginti TASDEEQ karta hai (naya `verify`), Finance/Owner FINAL post karte hain. **Asal bug mila aur theek kiya**: `postCount` mein koi permission check hi nahi tha — kisi bhi logged-in bande ko rok nahi sakti thi, chahe 272 mein manager ka 'approve' role-table se hata diya gaya ho (wo faisla sirf kaghaz par tha). Ab `requireAction("stock-count","approve")` lagi. |

### Code (isi ke sath jana hai — commits, purane se naye)

| Commit | Kya hai |
|---|---|
| `ea10cea` | Budget ab branch ke hisaab se (361 ke sath) |
| `52ccb05` | Budget Shop tak (362 ke sath) |
| `16a8d8a` | Branch P&L par Budget \| Used \| Available |
| `486fe6d` | "Vet" naya business type (363 ke sath) |
| `40cc3c2` | Branch Dashboard — "Branches" ki fehrist se seedha |
| `cdace81` | Kharche: Branch Manager tasdeeq, final manzoori alag (364 ke sath) |
| `8ef233c` | Branch Dashboard: Quick Links (Milk/Grain/Machinery/Sales/Inventory/Purchase/Finance/HR) — sirf Branch Dashboard ke andar, sidebar nahi badli |
| `ffbb990`, `1b0e50b`, `6a7e499` | POS Counter + Shift: schema, management page, /admin/pos par Smart Opening (366–367 ke sath) |
| `f70f883` | Fix: POS Counter tables ka missing GRANT (368) |
| `2e13ce1` | POS Shift: khud-batata cash summary + professional Open/Close design (Waseela reference se, apna design) |
| `0a6b275` | POS Shift Report (369) + cash-figure ka bug fix — `cash_paid` khud "cash" nahi tha, ab `pos_sale_payment_details` se asal cash aata hai |
| `b4f9e30` | Sales Report: har shop ka alag hisaab + shop-level filter |
| `582a1bc` | POS: `requireAction("pos","create")` gate — dealer sale is se mustasna |
| `58b57a3` | Stock Count: Branch Manager tasdeeq (370) |

### Testing rigor — jo ho chuka

- Kharche verify→manzoor: owner ne khud test kiya, PASS.
- POS Counter/Shift: owner ne khud browser se kholne/band karne ka
  poora chakkar chalaya; do asal bug isi se pakre gaye (GRANT wala,
  aur cash-figure wala) — dono theek.
- Stock Count verify→post: `set role authenticated` se JWT
  impersonation ke zariye simulate kiya (jaisa Kharche/POS mein hua
  tha) — manager (apni branch, khud nahi) verify kar saka; khud apni
  ginti verify karna DB trigger + app dono se rukta hai; Finance ne
  verified ginti post ki; financial-record delete-guard (`fn_stock_count_guard`)
  bhi confirm hua ke test qatar mitane nahi deta — theek yehi chahiye
  tha.
- `npx tsc --noEmit`: 71 (baseline se koi izafa nahi). `npm run build`:
  kamyab.

### Migration 371 bhi isi fehrist mein (8 September, raat)

Task 3 (cash-custody) mukammal ho gaya — Testing par test ho chuka,
Live par abhi nahi gayi. Do raaste, malik ke apne alfaz se: pehle
"manager lagate hain to uski branch ki hadd tak verify" (6 September),
phir "sale staff wo cash khud bank sy deposit krwa k slip upload kr
day ... Jis KO finance verify kr k ... outstanding khatam kr day" (8
September, raat).

- `cash_handovers` ab `to_account_id` (bank khata) aur
  `deposit_slip_url` bhi le sakta hai — `to_profile_id` (banda) ki
  jagah, kabhi dono nahi (DB check constraint).
- `sendCash`/`receiveCash` mein pehli dafa `requireAction("cash-handover")`
  laga — is se pehle koi check hi nahi tha, kisi ko bhi seedha call
  kiya ja sakta tha.
- **Asal bug mila**: `role_feature_permissions` update karna staff tak
  khud nahi pahunchta — `fn_apply_role_template` sirf UN features ke
  liye row banata hai jin ka us bande ke paas ABHI EK BHI row nahi;
  purana row (chahe adhoora/stale ho) chhua nahi jata. Is wajah se
  Kharche/Stock-Count ka `verify` bhi kuch managers tak nahi pahuncha
  tha — migration 371 mein teen targeted resync UPDATE/INSERT se theek
  kiya (sirf manager/finance/sales_staff, sirf 3 mutasir features —
  kisi doosri jagah ki manual customization nahi chhui, jaise warehouse
  role ka stock-count 'approve' jo jaan boojh kar diya gaya tha).
- Shift Close ki modal mein ab "Manager/Finance ko bhejein" YA "Bank
  Jama" ka toggle. Bank wale raaste mein `PaymentSlipUpload` (maujooda
  component) se slip lazmi hai.
- Outstanding "baqi hai" banner (POS page par, Counter-picker par bhi)
  — Manager/Finance ko bheja gaya cash SEND par clear hota hai (jaisa
  pehle tha); bank deposit SIRF Finance ki tasdeeq (verify) par clear
  hota hai — malik ke alfaz ke mutabiq jaan boojh kar alag rakha gaya.
- `npx tsc --noEmit`: 71 (baseline). `npm run build`: kamyab. DB
  check-constraint aur delete-guard dono SQL se simulate kar ke confirm
  kiye.

### Migration 372 (8 September, raat) — Purchases

Manager apni branch ki purchase verify kar sakta hai (naya
`review_status='verified'`); Owner/Admin final manzoor/wapas/radd
karte hain, tasdeeq ke baghair bhi. `reviewPurchase` mein pehli dafa
`requireAction("purchases","approve")` — is se pehle sirf hardcoded
role-array tha, `role_feature_permissions` mein 'purchases' feature ke
liye koi row hi nahi thi. Resubmit par purani tasdeeq bhi saaf hoti
hai. Testing par SoD trigger (`trg_sod_self_approval`) aur dono naye
CHECK constraints confirm ho chuke.

### Migration 373 (8 September, raat) — POS Collection Outstanding & Bank Deposit Verification

Malik ka naya, mukammal spec (20+ sections): POS cash sale != company
ka bank receipt. Jab tak staff bank mein jama na karaye aur Finance us
ki slip tasdeeq na kare, wo raqam "POS Collection Outstanding" mein
khari rehti hai. Ye migration 371 ke shift-tied ad-hoc bank-deposit
hisse (`cash_handovers.to_account_id`) ko replace karti hai — poora,
standalone nizam:

- Naya `pos_collection_deposits` table. **Outstanding kahin store nahi
  hota** (double-settle ka khatra mitane ke liye, malik ka apna
  usool) — hamesha live compute: (POS cash sales − cash returns) −
  (sirf APPROVED deposits). Sirf CASH — digital tareeqe alag.
- Submit → Pending → Finance Approve (Outstanding minus, yehi
  settlement point) ya Reject (Outstanding waisa hi, dobara jama kara
  sakte hain).
- Notifications: maujooda nizam (`src/lib/notifications.ts`) reuse —
  Finance + submitter ki branch ka Manager (sirf usi branch, naya
  `notifyBranchManagers`) + Admin/Assistant Admin + CEO (naya
  `notifyPositionHolders`, ohde se — role se nahi, 334 ka design).
- `/admin/my-collection` (staff), `/admin/finance/pos-deposits`
  (Finance).
- Duplicate-settlement guard, SoD (khud tasdeeq nahi), delete/mutation
  guard — teenon DB se test kiye (approve dobara chalane se 0 rows).

**Ye sirf Phase 1 hai** (core money-safety + submit/verify/reject
lifecycle). **Abhi baqi**:
1. Dashboard ki gehrai (Finance ke filters: branch/shop/staff/bank/
   tareekh/status; "Today's Approved", "Rejected/Needs Correction"
   summary cards).
2. Notification click → seedha us record par (abhi list page tak hi
   jata hai, khaas record highlight/open nahi hota).
3. Multi-branch manager (ek profile ka sirf ek `branch_id` hota hai —
   koi manager do branches ka na ho sakta abhi).
4. **Ek zaroori note jo malik ko batana hai**: POS cash sale hote hi
   `finance_transactions` (poorana, alag mechanism — journal_lines/GL
   se juda nahi) "Cash in Hand" khud foran barha deta hai
   (`create_pos_sale`). Ye naya Outstanding nizam is se ALAG, PARALLEL
   hisaab hai — dono ek doosre ko update nahi karte. Approval par jo
   ledger entry jati hai (Cash in Hand → Bank transfer,
   `finance_transactions` ke zariye) sahi hai, magar "Cash Book ek hi
   jagah se" (127) ka poora reconciliation is Outstanding se abhi
   nahi juda — ye ek gehra, pehle se maujood architecture sawal hai
   jo is Phase mein chhua nahi gaya.

### Milk — branch-scope bug theek hui (8 September, raat, code-only — koi migration nahi)

Milk collection ka verify stage pehle se bana hua tha (purani session,
migration 101/104/274) — theek se, sirf EK asal bug ke saath: manager
"apni branch tak" (`data_scope='own_branch'`) tasdeeq karne wala tha,
magar `verifyMilkEntries` aur `/admin/milk-collection/verify` ki query
dono mein ye rok kahin lagu nahi hoti thi — koi bhi manager KISI BHI
branch ki priced entries dekh/verify/reject kar sakta tha. Ab
`requireAction`ka `caller.branchId`/`scope` dono jagah check hota hai.
Koi migration nahi — sirf `src/actions/milk-chiller.ts` aur
`verify/page.tsx` mein code fix. `tsc`/`build` clean.

### Orders — jaanch mukammal, ek asal bug mila aur theek hua (8 September, raat, code-only)

"Orders" asal mein CHAAR alag features hain, ek nahi: `agri-orders`
(branch/HQ B2B — fertilizer/seed), `agri-returns`, `bridge-orders` +
`dealer-orders` (kisan se dealer marketplace), `produce-orders` (kisan
ki fasal ka buyer ko becha jana).

- **`agri-orders`**: is mein 3-marhala tasdeeq (`sales_verified` →
  `finance_verified` → `approved`) **pehle se bana hua hai** — apna
  raasta (`getOrderPermissions()`) hai, `requireAction` nahi, magar
  kaam karta hai aur SoD bhi lagi hui hai (274). Kuch banana baqi nahi.
- **`agri-returns`**: pehle se `requireAction` istemal karta hai.
- **`bridge-orders` + `produce-orders`**: **asal bug mila** —
  `adminVerifyOrder`, `adminMarkDelivered`, `recordOrderAdvancePayment`
  (bridge) aur `adminVerifyProduceOrder`, `adminMarkProduceDelivered`
  (produce) mein koi permission check hi nahi tha. RLS ki wajah se
  bahar wale nahi kar sakte the, magar HR/warehouse/milk_collection/
  procurement jaisi departments (jin ka marketplace se koi taalluq
  nahi) bhi kar sakti thin — `recordOrderAdvancePayment` to
  `finance_transactions` mein qatar bhi daalta hai. Ab
  owner/super_admin/admin/manager/finance/sales_staff tak mehdood.
  Koi migration nahi — sirf code. `tsc`/`build` clean.

### Shop 360 — Business Position, Phase 1 (8 September, raat, migration 374 — Testing par)

Malik ka poora spec (21 sections): "Maine is shop mein total kitna
paisa lagaya tha, aaj mera paisa kis kis jagah pada hai, kitna
kama/chala gaya, aur koi difference hai to woh kahan gaya?" — Phase-wise
banana confirm hua:

1. Paisa Kahan Hai + Aaj ki Sale + Recovery + Expense (ye, abhi)
2. Cash Control + Stock Position + FIFO Cost Value
3. Investment / Capital / Owner Withdrawal
4. Aaj Ka Milaan / Full Reconciliation
5. Drill-downs, alerts, Branch consolidation, UI polish

**Audit pehle (malik ke apne usool se) — 4 parallel audits, poori tasveer:**

- **Shop P&L 90% pehle se bana hua hai** (`/admin/reports/pnl?branch_id=`)
  — Revenue/COGS/Gross Profit/Expenses/Net Profit/Budget, seedha reuse.
  "Kisan Card" pehle se ek payment method/account hai (naya nahi).
  Per-shift cash expected/counted/difference pehle se hai (366) — sirf
  shop/din tak jorna baqi (Phase 2).
- **Customer khata ke TEEN alag numbers the** (`khata_accounts`,
  `customers.current_balance`, ledger) — code mein khud likha hua
  risk tha. **Malik ka faisla: ledger (`journal_lines` account 1100)
  hi asal sach — baqi do sirf cache/display, kabhi authority nahi.**
  Mismatch ho to "Needs Attention" mein flag karna hai (Phase 5).
- **Supplier payable abhi shop tak nahi** (purchases reliably shop-linked
  nahi) — **malik ka faisla: shortcut nahi lena, "—" dikhana jab tak
  purchase-to-shop linkage na ho.**
- **Investment/Capital/Owner Withdrawal per-shop bilkul nahi hai**
  (`ownerCapital`/`ownerDrawings` account codes bane hain magar kabhi
  istemal nahi hote) — Phase 3 mein naya banega.
- **Stock Value abhi FIFO cost se nahi, current price se hai** (Phase 1
  mein wahi purana tareeqa reuse kiya, saaf label ke sath; Phase 2 mein
  FIFO cost aayega).
- `position()` function (Master Dashboard) branch tak hi jata hai, shop
  tak nahi — shop ke liye parallel hisaab likha (`shopWhereIsMyMoney`),
  `position()` chhua nahi.

**Phase 1 ka code:**

- Naya `src/lib/pos/shop-360.ts` — `shopWhereIsMyMoney()` (stock value,
  lifetime cash/bank/digital by payment method, branch-level receivable
  ledger se, payable "—") aur `shopTodayFlow()` (din ki sale/recovery/
  expense, sab shop-tagged data se — koi naya finance table nahi).
- Naya safha `/admin/shop-360` (feature key `shop-360`, dashboard
  `sales`) — sales_staff apni shop tak (`own_shop`), manager apni
  branch ki shops (`own_branch`), finance sab (`all`), Owner/Admin
  unrestricted.
- Migration 374: feature/dashboard_features/role_feature_permissions/
  feature_help, aur maujooda profiles ke liye `user_feature_permissions`
  resync (naya feature_key, `fn_apply_role_template` khali jagah hi
  bharta hai).
- **Ek asal hadd, chhupai nahi ja rahi**: customer udhaar/wasooli DO
  raaston se darj hoti hai — `customer-udhaar.ts` (Load & Bill, sirf
  BRANCH tak, shop tag nahi karta) aur kharche.ts ka
  "customer_se_wasooli" qism (Paisa & Khata, shop tak). Is liye Aaj ki
  Recovery is safhe par SIRF Paisa & Khata wali ginti hai — Load & Bill
  se ki gayi wasooli shamil nahi (safhe par likha hua hai).
- **Dead code mila (theek nahi kiya, bas note)**: `applyScope()` mein
  `own_shop` scope `caller.branchId` se shop column filter karta hai —
  ghalat hota (branch_id shop_id se kabhi match nahi karega), magar ye
  function **kahin bulaya hi nahi jata** — koi live asar nahi.
- `tsc` (71, purana jitne hi) aur `build` clean. Testing par SQL se
  warehouse→shop, expense→shop, aur branch-receivable ke joins verify
  kiye — sab structurally theek (data abhi kam hai, is liye numbers
  chhote/khali hain, magar query khud sahi hai).
- **Live par abhi NAHI gayi** — migration 374 sirf Testing par.

### Shop 360 — Owner ki checklist se DO cheezein pakri gayin (8 September, raat)

Malik ne browser smoke-test se pehle apna checklist bheja (scope
isolation, `applyScope` bug abhi theek karo). Dono check kiye:

1. **Asal bug (theek ho gaya)**: `page.tsx` mein Manager ke liye
   `?shop_id=` URL parameter ki **koi validation nahi thi** — `canPick`
   list sirf UI dropdown ke liye thi, jo shop_id asal mein load hota
   wo query se seedha aata tha. Koi bhi Manager URL mein **doosri
   branch ki kisi bhi shop ki id** daal kar us ka poora maali data
   dekh sakta tha (spec ka "Test 7: bina ijazat URL access"). Ab
   Manager ka `shop_id` sirf us ki apni branch ki shops (`pickableShops`)
   mein se hi chuna ja sakta hai — bahar ki id mile to khud us ki
   pehli shop par wapas girta hai. Unrestricted (Owner/Admin/Finance)
   ke liye khula rehta hai, jaan boojh kar (un ka scope "all" hi hai).
2. **`applyScope()` ka `own_shop` bug** (373 mein note kiya tha,
   "kahin bulaya nahi jata" is liye be-asar) — ab theek kar diya, malik
   ke kehne par: `Caller` mein naya `shopId` field (`requireAction` se
   profile ka `shop_id` bhi aata hai ab), `applyScope`'s `own_shop`
   branch ab `caller.shopId` se filter karta hai, `caller.branchId` se
   nahi. Koi doosri jagah asar nahi paRa (function abhi bhi kahin
   bulaya nahi jata, sirf ab agar future mein bulaya jaye to sahi
   kaam karega).
3. Testing par SQL se Manager ki `pickableShops` fehrist verify ki
   (Mahabali branch → sirf Mahabali ki 2 shops, doosri branch ki
   "Kisan Karyan 157" shops bahar) — is se confirm hua ke fix sahi
   set par lagu hoti hai.
4. **Browser mein khud test nahi ho saka** — is session mein koi
   `.env`/Supabase keys nahi hain aur na hi staff accounts ke passwords,
   is liye Playwright se real login karke asal safha khud nahi khol
   saka. Ye hamesha malik apne browser se khud karte hain (jaisa POS
   Counter/Shift aur Stock Count mein pehle bhi hua) — malik ki
   checklist (scope, labels, date filter, totals match) ab bhi khule
   hain, unko dekhna baqi hai.
- `tsc` (71) aur `build` clean is fix ke baad bhi.

### Bill AI-reading — discount/tax save-path ka gap theek hua (8 September, raat, code-only)

Live par bill-rates ka ek asal safha khola (JX0098807, Hamid Traders)
to discrepancy banner Rs 1,500.09 ka farq dikha raha tha jab ke saari
qatarein theek lag rahi thin. Wajah: AI Gemini se discount/tax/other
charges theek parh leta hai (318 ke columns Live par bhi maujood hain),
magar `saveBillReading` (supplier-bill-rates.ts) ye teen cheezein
`supplier_bill_reads` mein likhta hi nahi tha — khamoshi se gir jati
thin. Aur discrepancy warning bhi qataron ke raw jorh ko seedha bill
total se milata tha, discount/tax ko netting kiye baghair.

- `src/actions/supplier-bill-rates.ts` — `head` accumulator ab
  `discountTotal`/`taxAmount`/`taxLabel`/`otherCharges` bhi le kar
  save karta hai.
- `page.tsx` + `bill-client.tsx` — ye chaar khane ab `BillClient` tak
  pahunchte hain; mismatch ab `linesTotal − discount + tax + other
  charges` ko bill total se milata hai, raw jorh ko nahi.
- Koi migration nahi (318 ke columns pehle se hain, sirf khali reh
  rahe the) — sirf code. `tsc` (71, purane jitne hi) aur `build` clean.
- **JX0098807 khud abhi bhi purana hai** (ye bill fix se PEHLE parha
  gaya tha) — us ka discount/tax NULL hi rahega jab tak koi is bill ko
  dobara AI se na parhwaye. Us bill ki apni lines theek hain, sirf
  discrepancy banner cosmetic tha.

### My Work — Today's Tasks/Recent Activity ki apni scroll (8 September, raat, code-only)

Malik: "kabhi page scroll na karni paRe." Ye do fehristein (Today's Tasks,
Recent Activity) ab apni seemit height tak mehdood hain — zyada items
hon to sirf usi dabbe ke andar scroll ho, poora `/admin/my-work` safha
nahi (department panel par ye pattern pehle se 7 September ko laga tha).
Quick Actions/Create Order/Add Farmer ka "isi page ke andar khulna"
pehle se `InPageWorkspace` (7 September) se ho raha hai — koi tabdeeli
nahi chahiye thi, malik ne khud confirm kiya. `tsc`/`build` clean.

### Paisa & Khata — shop ka apna payment-method hisaab (8 September, raat, code-only)

Anwar (Sales Staff) ka "Paisa & Khata" safha khola to "Is waqt khaton
mein" **poori company ka combined balance** dikha raha tha (Cash in
Hand Rs −28,000 samet) — safha khud likhta hai "ye khate poori company
ke hain, har dukan ke apne nahi" (jaan boojh kar, 6 September). Malik
ka aitraaz theek tha: shop par baithe staff ko sirf **apni shop** ka,
**payment-method ke hisaab se** (Cash/Easypaisa/JazzCash/Bank), chuni
hui date-range ka hisaab chahiye — company ka total nahi, aur branch ka
bhi nahi (malik ne khud confirm kiya: ek branch mein 1 se zyada shop
ho sakti hain).

- Naya `src/lib/pos/shop-payment-methods.ts` — `pos_sales.shop_id` +
  date range se `pos_sale_payment_details` (payment-method ke hisaab
  se sale), minus isi shop ke **manzoor-shuda** `company_expense_requests`
  (`paid_from_account_id` → `payment_method_account_map` se method
  tak). Koi naya migration nahi — `company_expense_requests.shop_id`
  pehle se maujood hai aur `kharchaDarj` pehle se bharta hai.
- `/admin/kharche` par shop-scoped staff (jin ka `profiles.shop_id` set
  hai) ko naya section (date filter + table) dikhta hai; company-wide
  "Is waqt khaton mein" strip un se chhup jati hai (`showCompanyBalances`
  prop) — magar account-dropdown (`khaate`) waisa hi rehta hai, wo
  form ke liye chahiye.
- `tsc` (71) aur `build` clean.

**Ek zaroori rukawat mili, Testing par:** Anwar ka `profiles.shop_id`
abhi **NULL** hai. `create_pos_sale` (purana raasta) `pos_sales.shop_id`
usi waqt ke logged-in staff ke `profiles.shop_id` se leta hai — shop_id
na ho to sale bhi kisi shop se nahi juRti (Testing par maujood teen
purani sales isi wajah se `shop_id = NULL` hain). **Is feature ka kaam
karna is par mabni hai ke har shop wale staff ka `profiles.shop_id`
`Admin → Users` (shop-selector) se bhara ho.** Jo sale is assign hone se
PEHLE ho chuki, wo hamesha `shop_id = NULL` rahegi (peechhe jaa kar theek
nahi ho sakti) — sirf assign hone ke BAAD ki sales is hisaab mein aayengi.

### Abhi baqi (isi "4 kaam" ki fehrist se)

1. Verify→approve pattern baqi modules mein: POS Return, Machinery.
   (Kharche, Stock Count, Purchases mukammal; Milk ka verify pehle se
   tha, branch-scope bug theek ho gaya; Orders ki jaanch mukammal, ek
   permission bug theek hua.) POS Return ka structure baqi se alag hai
   (manager PIN se atomic authorize + foran stock/ledger post — verify
   stage add karna matlab DB function ko "create pending" + "post on
   approve" mein split karna, bara structural kaam).
2. Owner ke asal spec ke Test 7–10 (bina ijazat URL/API access ki
   koshish, return ka shift ke saath link, branch consolidation bina
   dohra ginte, poora audit trace) — abhi sirf SQL simulation se, browser
   se nahi.
3. Bank Deposit ka Money Trail/reports review abhi nahi hua — naya
   `bank_deposit_pending` party sirf 1030 ke andar hai, purane "Cash
   raaste mein" ke reports isay dekhte hain ya nahi, ek nazar chahiye.
