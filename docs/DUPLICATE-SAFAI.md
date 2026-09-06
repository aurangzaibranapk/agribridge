# Doubling ki safai — pehle kya tha, ab kya hai

Malik (6 September):

> *"Ek hi kaam baar baar naye tag naye naam ke sath nahi hone chahiye...
> aaj tumhara kaam hai ke tum saare ERP ko check karoge, jahan jahan koi
> bhi [nakal] hai un ko ek ek kar ke hataoge bhi, aur us ki ek list
> taiyar karoge ke pehle kya tha aur ab kya kiya hai."*

Ye wohi list hai.

---

## A. Safhe jo MIT gaye — ek kaam ke do naam

| Safha | Kya karta tha | Pehle se kya maujood tha | Ab |
|---|---|---|---|
| `/admin/verification`<br>"Manzoori ki Qatar" | Sab pending qatarein ek jagah | **Approval Inbox** (`/admin/submissions`) + Command Center ka Approval department | **Mit gaya.** Qatarein Approval Inbox ke andar — do hisson mein: "Safhon se aayi qatarein" aur "WhatsApp se aayi parchiyan". |
| `/admin/mazdoori`<br>"Mazdoori / Daily Work" | Kaam darj karna, advance adjust | Shop par **Paisa & Khata** ka tag | **Mit gaya.** Form aur qatarein Paisa & Khata ke andar (paanch khaanon mein se ek). |
| `/admin/company-expenses`<br>"Company Expenses" | `company_expense_requests` par bill + manzoori | **Paisa & Khata** (`/admin/kharche`) — WOHI table, magar us mein banda, khata, tareekh, mazdoori aur ledger ka raasta bhi | **Mor diya gaya** Paisa & Khata par. Mitaya nahi — purane link aur bookmark isi par aate hain. |

Teenon ke `features` / `role_feature_permissions` / `feature_help` ki
qatarein bhi hata di gayin — warna sidebar par aisa naam para rehta jo
kahin le jata hi nahi.

---

## B. Menu mein EK HI safha kai dafa

Ye woh nahi jo alag safhe the — ye ek hi safha do-teen department ke
neeche dobara likha hua tha.

| Safha | Kitni dafa | Kahan se hataya | Kahan raha |
|---|---|---|---|
| `/admin/agri-orders` | **3×** | Purchases, Finance | **Sales** |
| `/admin/command-center` | 2× | Finance | Ooper wala Dashboard link |
| `/admin/cash-close` | 2× | Finance (doosri qatar) | Finance |
| `/admin/stock-count` | 2× | Finance | **Inventory** |
| `/admin/ai-suggestions` | 2× | Administration | **Purchases** |
| `/admin/reports/inventory` | 2× — aur **do alag naam** ("Inventory Reports" / "Inventory Report") | Inventory | **Reports** |

Menu **136 se 127** item par aa gaya.

---

## C. Naam jo aapas mein BADLE hue the

Do safhe apne apne naam se ghalat kaam batate the:

| Safha | Naam pehle | Wo waqai karta kya hai | Naam ab |
|---|---|---|---|
| `/admin/audit-trail` | "Kis Ne Kya Kiya" | Reversal aur **purani tareekh** ki entriyon par nazar (ledger ki wo do jagahen jahan haath ki safai chhup sakti hai) | **"Reversal aur Purani Tareekh"** |
| `/admin/activity-logs` | "Activity Logs" (Roman: "Audit log") | **Kis ne kya kiya** — `audit_logs` se | **"Kis Ne Kya Kiya"** |

Yani "Kis ne kya kiya" ka naam us safhe par laga hua tha jo ye batata hi
nahi. Ab har naam apne safhe par hai.

---

## D. Malik ka purana hukm jo reh gaya tha

| Safha | Malik ne kya kaha | Ab |
|---|---|---|
| `/admin/my-attendance` | *"My HR mein staff ko apna sab kuch aana chahiye. Alag se My Attendance, My Wallet waghera kuch bhi nahi aana chahiye."* | Menu se **hat gaya**. Safha maujood hai aur Mera HR se khulta hai. |

---

## A2. Code ke andar ki nakal (safha nahi, magar wohi kharabi)

| Kya | Kyun nakal thi | Ab |
|---|---|---|
| `src/actions/company-expenses.ts` | Wohi table (`company_expense_requests`) jis par `actions/kharche.ts` chalti hai. Safha mor jane ke baad is ko koi bulata hi nahi tha. | **Mit gayi** |
| `postExpenseApproved()` (`lib/ledger/rules.ts`) | Kharche ki journal ka doosra raasta. Paisa & Khata apni journal khud banati hai — kyunke wahan QISM tay karti hai ke kaunsa khata hilega, aur wo faisla is poster ke bas ka nahi tha. | **Mit gaya** (jagah par wajah likhi hai) |

Do jagah expense post karne ka matlab hota ke ek din dono alag khaton
mein daalne lagein, aur kisi ko pata bhi na chale.

---

## E. Malik ke kehne par — ijazat ke do nizam ek kiye gaye

Malik: *"Haan dono karo, migration bhi banao, aur business dashboard hata
do jo double hai."*

### Ijazat: do nizam -> ek

| Safha | Kahan likhta tha | Kya deta tha | Ab |
|---|---|---|---|
| `/admin/permissions` — "Ek Banday ki Ijazat" | `profiles.allowed_pages` | sirf "safha khulta hai" | **Mor diya** `/admin/staff-access` par |
| `/admin/staff-access` — "Staff ki Ijazat" | `user_feature_permissions` | safha AUR us par kaam | Naam ab **"Ek Banday ki Ijazat"** — wohi jo malik pehchante hain |

**Migration 354** ne purani ijazat nayi fehrist mein naqal ki.

#### Wo khatra jo 354 ne roka

343 har bande ki OHDE wali ijazat us ke khate mein naqal karti hai. Us
ke baad purana raasta khud band ho jata hai — kyunke middleware purani
fehrist SIRF us waqt parhta hai jab nayi bilkul khali ho.

Live ke adad naape gaye. **343 akeli chalti to:**

| Banda | Purane safhe | Jo BAND ho jate |
|---|---|---|
| Admin Assistant | 98 | **82** |
| Manager | 98 | **77** |
| Finance Team | 22 | 7 |
| HR Department | 14 | 7 |
| Warehouse Team | 12 | 3 |

Aur un mein se HAR route ka feature maujood tha — wo sirf us ohde ke
template mein nahi tha. Yani ye ijazat waqai di gayi thi.

354 ke baad Testing par jaanch: **har bande ka har purana safha khula
hai, ek bhi band nahi.**

#### Sirf "dekhna" kyun

Purana nizam kaam ki baat karta hi nahi tha — wo sirf darwaza kholta
tha. Is liye naqal bhi wohi kehti hai. Us mein "banana" ya "badalna" bhi
daal dena 82 safhon par ek sath, bina kisi ke kahe, ijazat barhana hota
— aur malik ka usool us ke ulat hai.

Jahan ohde ka template pehle se kaam deta hai (343 se), wo qatar apni
jagah rehti hai.

#### Purana khana abhi giraya NAHI gaya — jaan boojh kar

Deploy ki tarteeb pehle migrations hai, phir build. Yani thori der
purana build naye schema par chalta hai, aur purana middleware har
request par `allowed_pages` maangta hai. Abhi girate to us thori der
mein har bande ka har safha toot jata — login samet.

`allowed_pages` aur `role_page_permissions` girane wali migration naya
build Live par chalne ke BAAD jayegi.

### Teesra dashboard hata diya

`/admin/business-dashboard` — menu mein tha hi nahi, aur Command Center
/ Master Dashboard se kuch alag kehta bhi nahi tha. **Mit gaya.**

Magar us se pehle ek cheez theek karni pari: `/admin` (yani login ke
baad ka pehla safha) SEEDHA usi par bhejta tha. Ab wo `homePageForRole`
se poochta hai — Malik/Admin ko Command Center, baqi sab ko "Mera Kaam".
Yani menu, middleware aur ye safha, teenon ab ek hi function se poochte
hain.

---

## F. Jo abhi BAQI hai — malik ka faisla chahiye

Ye nakalein hain, magar in ka hal safha mitane se nahi hota. Chup chaap
mitane se kaam ruk jata, is liye yahan likhi ja rahi hain.

### 1. Udhaar aur khaate ke chhe safhe

`/admin/khata` · `/admin/staff-khata` · `/admin/branch-credit` ·
`/admin/credit-requests` · `/admin/farmer-credit` · `/admin/farmer-loans`

Har ek ka apna asal kaam hai (customer, staff, shaakh, kisan), magar
naam se ye farq nazar nahi aata. **Bande ka ek khata**
(`/admin/khata/banda/...`) in mein se aksar ka jawab pehle hi de deta
hai. Malik chahen to in ko us ke neeche laaya ja sakta hai.

### 2. Menu mein na aane wale safhe

Un mein se aksar waajib hain (kisi safhe ke andar ke safhe — `new`,
`[id]`, sub-tabs). Magar kuch aise bhi hain jo kabhi menu mein aaye hi
nahi. Malik chahen to un ki alag fehrist bana kar dekhi ja sakti hai.
