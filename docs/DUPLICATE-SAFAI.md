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

## E. Jo abhi BAQI hai — malik ka faisla chahiye

Ye nakalein hain, magar in ka hal safha mitane se nahi hota. Chup chaap
mitane se kaam ruk jata, is liye yahan likhi ja rahi hain.

### 1. Ijazat ke DO alag nizam ek sath chal rahe hain

| Safha | Nizam | Haal |
|---|---|---|
| `/admin/permissions` — "Ek Banday ki Ijazat" | Purana: `profiles.allowed_pages` | **Zinda hai** — Live par Manager par 98 safhe, Admin Assistant par 98, Finance par 22 |
| `/admin/staff-access` — "Staff ki Ijazat" | Naya: `user_feature_permissions` (343 ke baad wahid darwaza) | Naya |

Dono safhe ek hi sawal ka jawab dete hain: "is bande ko kya khulta hai".
Magar do alag khaanon mein likhte hain, aur middleware dono parhta hai.

**Ye migration ka kaam hai, safha mitane ka nahi:** purani `allowed_pages`
ko nayi fehrist mein badalna parega, phir purana safha hat sakta hai.
Abhi mita dene se Manager ki 98 safhon wali ijazat ka koi darwaza nahi
rahega.

### 2. Teen dashboard

| Safha | Kis ke liye |
|---|---|
| `/admin/command-center` | Malik — department, pending, alerts |
| `/admin/master-dashboard` | Bank, inventory, receivables ka poora hisaab |
| `/admin/business-dashboard` | **Menu mein hai hi nahi** — bikri, stock, doodh, khata |

Pehle do ka farq waajib hai (khulasa vs tafseel). Teesra menu mein nahi
hai aur pehle do se kuch alag nahi kehta — malik bataayein to hata diya
jaye.

### 3. Udhaar aur khaate ke chhe safhe

`/admin/khata` · `/admin/staff-khata` · `/admin/branch-credit` ·
`/admin/credit-requests` · `/admin/farmer-credit` · `/admin/farmer-loans`

Har ek ka apna asal kaam hai (customer, staff, shaakh, kisan), magar
naam se ye farq nazar nahi aata. **Bande ka ek khata**
(`/admin/khata/banda/...`) in mein se aksar ka jawab pehle hi de deta
hai. Malik chahen to in ko us ke neeche laaya ja sakta hai.

### 4. Menu mein na aane wale 101 safhe

Un mein se aksar waajib hain (kisi safhe ke andar ke safhe — `new`,
`[id]`, sub-tabs). Magar kuch aise bhi hain jo kabhi menu mein aaye hi
nahi. Malik chahen to un ki alag fehrist bana kar dekhi ja sakti hai.
