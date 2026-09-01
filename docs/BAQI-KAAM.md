# Baqi kaam — ek hi jagah

Aakhri dafa theek kiya: **1 September 2026** (sheham)

Ye file un sab kaamon ki hai jo shuru ho chuke hain magar poore nahi, ya
jin ka faisla ho chuka hai magar hath nahi laga. Har cheez ke saamne
saaf likha hai ke **kahan tak pahunchi** — "ho gaya" aur "chal raha hai"
ek cheez nahi.

---

## 1. Abhi ke abhi — Live par upload

| Cheez | Haalat |
|---|---|
| Migration 225 (`diesel_none_at` / `diesel_none_by`) | ✅ **Live par chal gayi** (1 Sep) |
| Live server par naya `.next` | ❌ **Baqi** — is liye `/admin/trust` par 404 aata hai |

Live par app ka code **kabhi upload hi nahi hua**. Migrations database par
chali gayi thin, magar server par purana build para hai — is liye naya
login, Trust ka safha, machinery ki tabdeeliyan aur poora tarjuma wahan
hai hi nahi.

**Do command, apne computer par:**

```
cd "/c/Users/Dx Home Films Lab 8K/Downloads/agribridge" && git pull origin claude/code-load-project-structure-fq91y9 && npm run build > build.log 2>&1; tail -5 build.log
```

```
cd "/c/Users/Dx Home Films Lab 8K/Downloads/agribridge" && ls -l .next/BUILD_ID && rm -f deploy.tar.gz && tar --exclude='.next/cache' -czf deploy.tar.gz .next && ls -lh deploy.tar.gz
```

Phir cPanel: **Setup Node.js App → Stop** → File Manager →
`domains/agribridge` → `deploy.tar.gz` Upload (overwrite) → right-click
**Extract** → **Start**.

### Upload ke baad Live par khud dekhni wali cheezein

- `alranatraders.pk/login` — naya safha nazar aaye
- `alranatraders.pk/admin/trust` — 404 na aaye
- Koi machinery booking → kaam mukammal → diesel ke do sawal
- **`WHATSAPP_OTP_TEMPLATE`** cPanel ke environment variables mein bhara ho
  (na ho to WhatsApp ka OTP chup chaap chhoot jayega aur hamesha SMS se jayega)
- **Supabase par email (SMTP)** chal raha ho, warna email wala OTP nahi aayega

---

## 1b. Testing ka intezar — fasal uthane wale (arhti)

**Ban chuka. Testing par hai. Live par NAHI.**

Poori testing ki fehrist alag file mein hai: **`docs/TESTING-FEHRIST.md`**
— wahan qadam ba qadam likha hai ke kya chala kar dekhna hai aur kya
ghalat hoga.

| Kya bana | Kahan |
|---|---|
| Uthane walon ki fehrist | `Machinery → Hisaab → Fasal Uthane Wale` |
| Booking par **Qadam 8** — tag, phir "fasal utha li" → bill | Booking ka safha |
| Uthane wale ka khata + adaigi | `/admin/machinery-rental/lifters/[id]` |
| **Arhti Board** — kis ke paas kitna, kitne din se, aur kis kisan ka | `Machinery → Reports → Arhti Board` |

**Migrations 226, 227, 228, 229, 230 — paanchon sirf testing par.**

Aap ke teen faisle jin par ye bana:
1. Uthane walon ki **apni fehrist** (`suppliers` mein nahi milayi)
2. Commission **fasal ki qeemat** par, aur **uthane wale ki jeb se** — kisan ki nahi
3. Kisan ka khata **saaf**, raqam arhti ke zimme

---

## 2. Feature #2 — Sidebar-Free Dashboards

**Faisla ho chuka hai (locked). Audit ho chuka hai. Banana baqi hai.**

Aap ka usool: *Master Admin = poori ERP navigation. Baqi sab = My Work
Dashboard. Koi permanent sidebar nahi. No permission = no card. Card →
focused workspace → Back to My Dashboard.*

### Jo pehle se maujood hai — naya kuch nahi banana

| Cheez | Kahan |
|---|---|
| Permission engine (department, branch scope, ek bande ke kai department) | `src/lib/effective-permissions.ts` |
| Menu database se, code se nahi | `src/lib/access/nav.ts`, `registry.ts` |
| "Mera Kaam" ka cards wala safha | `src/app/admin/my-work/page.tsx` |
| `No permission = No card` | pehle se sach hai (`loadNav`) |
| Staff login karte hi wahin pahunchta hai | `homePageForRole()` |
| Card par pending ginti | `pendingByDepartment()` |
| Score chip ke liye tayyar function | `fn_score_for()` |
| Vendor dashboard — pehle se sidebar-free | `src/app/vendor/page.tsx` |

### Jo missing hai

1. **Sidebar sab ko dikhti hai.** `src/app/admin/layout.tsx` har admin safhe
   par `<Sidebar>` lagata hai — malik ho ya staff. Master Admin exception
   laga hi nahi.
2. **Compact top nav** (`← My Dashboard | POS | Notifications | Profile`)
   hai hi nahi.
3. **Cards department ke darje par hain** (Milk, Finance, Machinery).
   Naqsha feature ke darje par chahta hai (POS, Orders, Customers,
   Returns, Stock View, My Cash, My Performance).
4. **Score chip** kisi dashboard ke header mein nahi.
5. **Farmer portal ki apni sidebar hai** — `src/components/portal/sidebar.tsx`.
6. **Dealer / Buyer / Expert** ka koi layout hi nahi.

### Migration — sirf **ek**

`features` table mein `description` ka khana nahi hai (dashboards ke paas
hai, features ke paas nahi). "POS — *Sales & Billing*" wala doosra jumla
likhne ke liye yehi chahiye. **Naya permission table nahi banana.**

---

## 3. Tarjuma (Urdu / English / Roman) — **MUKAMMAL**

**Ho gaya.** Ab teenon zabanon mein wo sab kuch hai jo screen par nazar
aata hai — public website, kisan ka portal, dealer/buyer/expert ke
portal, naukri ka offer, Trust ka safha, arhti ka poora hissa, aur admin
ke saare chhote safhe.

Aakhri hisse mein **445 jumle, 221 files**.

### Jo jaan boojh kar tarjuma NAHI hue

| Kya | Kyun |
|---|---|
| **Nishan aur ikaiyan** — FAT, SNF %, LR, PO #, IBAN, URL, L/acre | Ye alfaz nahi, nishan hain. Kaghaz par, machine par aur bank ki parchi par bhi yehi likhe hote hain — tarjuma kar dene se banda unhen apne hi kaghaz par na pehchane |
| **Bankon aur walleton ke naam** — JazzCash, Easypaisa, SadaPay, NayaPay | Wo un ki apni app par usi tarah likhe hain |
| **Khanon ke namoone** — `PK__ ____ ____`, `XXXXX-XXXXXXX-X` | Ye shakl hain, jumla nahi |
| **Karobar ke naam, email, website** | Naam tarjuma nahi hote |
| `urdu-agreement-template.tsx` | Qanooni muahida — ek hi zaban mein rehna chahiye. English mode mein aadha angrezi muahida qanooni tor par bekar hota |
| `art-logo.tsx` | Logo ka wordmark hota hai |

### Chaar kharabiyan jo sirf poori build ne pakrin

`tsc` in mein se ek bhi nahi pakarta:

1. **`get-language` (jo `next/headers` parhta hai) teen client safhon par chala gaya tha** — ek dafa `art-logo` ke raaste, ek dafa `timeline.tsx` ke. Ye TypeScript ki ghalti nahi, Next ka usool hai — aur wo sirf build par toot-ta hai. Ab poore import ke jaal par jaanch chala kar dekha (relative import bhi shamil): client ke raaste par ek bhi nahi bacha.
2. Ek file mein `t` pehle se **ek theme ka naam** tha (`t.accent`, `t.text`) — wahan tarjume wala `tr` hai.
3. Ek **lambe import** ({ … } kai lakeeron par) ke **beech** import gir gaya.
4. Do dafa `lang` ki lakeer **nested function** ke andar giri, component ke top par nahi — yani component ke paas zaban thi hi nahi.

## 4. Score engine (Feature #1) — Live shadow mein

### Teen LOCKED faisle — **teenon lag chuke hain** ✅

| Aap ka faisla | Haalat | Kahan |
|---|---|---|
| Score Building = `30 din + 3 verified events`. Us se pehle `New / Score Building`, **`0 / Low` nahi** | ✅ Laga | `fn_recalc_score()` — 220 |
| Rolling 12 mahine: `0–3m 100%` · `4–6m 70%` · `7–9m 40%` · `10–12m 20%` · `12m+ expire` | ✅ Laga | `fn_score_decay()` — 202 |
| **Unresolved outstanding age se expire na ho** — jab tak raqam baqi hai, waqia poore wazan par | ✅ Laga | `never_decays`, aur ginti `decay_from` (hal hone wale din) se |
| Visibility: apna / team / finance scope / master admin — **DB par, sirf UI hiding nahi** | ✅ Laga | `fn_score_visible()` + 4 tables par RLS |

**Likhne ki koi policy hai hi nahi — jaan boojh kar.** Score haath se na
barhaya ja sakta hai na ghataya; sirf engine likhta hai. "Apna score
theek karo" ka darwaza hota to poora nizam usi din bekar ho jata.

### Live par abhi kya haal hai

| Cheez | Adad |
|---|---|
| Migrations 199–225 Live par | ✅ chal chukin |
| Cron: queue tick har 5 minute | ✅ khud chal raha |
| Cron: roz 3 baje (UTC) daily run | ✅ khud chal raha |
| Nakaam runs / atki hui qatarein | **0 / 0** |
| Subjects | 9 — **sab `score_building`** |

9 ke 9 `score_building` par hain kyunke `30 din + 3 waqiat` abhi poore
nahi hue. **Ye kharabi nahi.** Aur wahan **sifar nahi likha jata** —
"Hisaab ban raha hai" likha jata hai.

### Teen cheezein khuli hain:

### 4 September ko dekhna hai

Live par bill `72c20237` ka due date **2026-09-04** hai. Us ke baad
adaigi na hui to `overdue` aur `bill_unpaid` waqia banna chahiye, aur
kisan ke snapshot mein `overdue` ka risk flag aana chahiye. **Ye Live par
pehla asal manfi waqia hoga** — us din khud dekha jayega.

### Khule risk — jaan boojh kar khule rakhe gaye

1. **Restore drill NOT TESTED.** Backup se wapas laane ki mashq kabhi ki
   hi nahi gayi. Jab tak wo na ho, ise PASS nahi likha jayega.
2. **Backup ki jaanch ka output nahi mila.** Aap ne backup bana liya tha,
   magar us ki jaanch ka nateeja nahi aaya — is liye wo "verified" nahi.

### Jo jaan boojh kar band hai

- **P3 farmer-facing gauge LOCKED** — kisi kisan, gahak, vendor ya staff
  ko apna darja nahi dikhta. Ye aap ka faisla hai.
- `/admin/trust` sirf Owner / Master Admin ko khulta hai.
- Score par **koi khud kar faisla nahi** — na qarz, na credit, na vendor,
  na staff, na farmer.

---

## 5. Login ka safha — manzoor shuda naqsha

**Aap ki bheji hui tasveer ke mutabiq ban chuka hai** (1 Sep). Safha:
`src/app/login/page.tsx` + `login-form.tsx`.

| Aap ka lock | Haalat |
|---|---|
| Mobile Number = User ID | ✅ |
| Email = User ID alternative | ✅ **ab usi safhe par** — pehle chhote link ke peeche chhupa tha |
| Primary OTP → WhatsApp | ✅ |
| WhatsApp na aaye → SMS | ✅ **ab banda khud chun sakta hai**, aur "Dobara bhejein" raasta badal deta hai |
| Google Login | ✅ neeche, aur ab dono taraf |
| Facebook Login | ✅ |
| New user → Register | ✅ |
| Farmer/Customer aur Admin/Staff/Vendor ke flow alag | ✅ |
| Existing Farmer ID / 360 duplicate na ho | ✅ |
| Naqshe ki shakl: +92 ka khana, "YA" goliya, raaste ke do card, bhejne ka nishan, dhaal wala jumla, daayen taraf teen baaton ka card, neeche chaar ki patti | ✅ |
| X ka nishan, login par khud hat jaye | ✅ |

### Do cheezein jo sirf shakl ki nahi thin

**1. Email ka khana chhupa hua tha — aur wo ek asal kharabi thi.** Gahak
usay dhoondta hi nahi tha aur apna number upar wale khane mein likh deta.
Wo khana sirf `farmers` mein dekhta hai — to gahak **naya kisan** ban
jata, aur "ek number ek kisan" (124) ulta pad jata: ek hi bande ke do
record, do alag hisaab.

Email wala raasta **naya khata nahi banata** (`shouldCreateUser: false`).
Ye aap ka pehle ka tay shuda usool hai — "email lagi hi nahi to pehle
register karo". Khata yahan ban jata to us bande ka koi kisan record hi
na hota: portal khulta magar andar kuch na hota.

**2. WhatsApp/SMS ka chunav ek chhupi kharabi ka hal hai.** Pehle nizam
hamesha WhatsApp aazmata aur **nakaam** hone par SMS bhejta. Ek soorat
chhoot jati thi: WhatsApp **"chala gaya" magar bande tak pahuncha nahi**
— wahan nakaami hoti hi nahi, is liye SMS kabhi chalta hi nahi tha aur
banda phansa reh jata.

### Live par is safhe ki do zaroortein

- **`WHATSAPP_OTP_TEMPLATE`** cPanel ke environment variables mein bhara ho
- **Supabase par email (SMTP)** chal raha ho, warna email wala OTP nahi aayega

---

## 6. Chhote kaam

| Kaam | Kyun |
|---|---|
| ~~Safha daayen se kat raha tha~~ | **Theek ho gaya** — admin aur portal dono ke layout par `min-w-0` laga. Chauri table ab apne dabbe mein khisakti hai, poora safha nahi |
| PWA icon `public/icons/icon-192.png` maujood nahi (404) | Phone par "Add to Home Screen" ka icon khali aata hai. Phase 17 ka hissa |
| Booking ke safhe par upar wala `○ Payment` chip adaigi ke qadam tak na le jaye | Chhota, magar roz kaam aata |
| PR #1 ka matn purana hai | Bina poochhe nahi badla jayega |

---

## 7. Jo abhi banaye hi nahi gaye

- **Vehicle Expense** — meter ki tasveer + petrol + mileage ka milan
- **Milk Verification** — claim banam asal naap

---

## 8. Aage ka naqsha (aap ka apna)

Phase 16 Delivery & Logistics ke baad **17 se 20 tak aap ki apni
development** hai:

| Phase | Kya |
|---|---|
| 17 | Mobile / PWA |
| 18 | SaaS (multi-tenant) |
| 19 | Security aur Audit hardening |
| 20 | Scale / national marketplace |

Do baatein aaj ke faislon par asar daalti hain:

- **18 (multi-tenant)** — aaj ka har naya table aur view ek hi karobar
  maan kar likha ja raha hai. Jahan aasani se ho sake, wahan tenant ka
  khana rakhna baad ki takleef bachata hai.
- **19 (security)** — RLS aur `SECURITY DEFINER` ke faisle abhi se soch
  kar karein. `fn_reset_test_financials` jaisa har raasta `is_live` ke
  taale ke peeche hona chahiye.

---

## 9. Do usool jo is project mein bar bar kaam aaye

**Sifar aur "hisaab nahi rakha jata" ek cheez nahi.** Sifar kehta hai
"dekh liya, kuch nahi hua". Jis cheez ka indraj hi nahi hota, us ke
saamne Rs 0 likhna jhoot hai — wahan saaf likhein ke track nahi hoti.

**Ijazat wali rok ke peeche khali jawab ko asal adad na samjhein.** RLS
ya staff-gated view kisi bande ke haath mein sifar qatarein laata hai.
Us "kuch nahi mila" ko "qeemat sifar hai" samajh lena is project mein
teen dafa ghalat adad de chuka hai. Aise sawal ka jawab
`SECURITY DEFINER` function se lein, aur "mila nahi" ke liye NULL rakhen,
sifar nahi.
