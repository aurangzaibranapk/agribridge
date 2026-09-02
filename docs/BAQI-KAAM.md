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
| Migration 226–242 | ✅ **Live par chal gayin** (1 Sep) |
| Migration **243–254** | ❌ **Baqi** — in ke baghair naya build Live par nahi charhna chahiye (tafseel `LIVE-DEPLOYMENT-RECORD.md` mein) |
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
- **`GEMINI_API_KEY`** cPanel ke environment variables mein bhara ho — Maal
  Andar mein dabbe ki tasveer aur "Bill se Trade Rate" mein bill ki
  tasveer, dono isi se parhi jati hain. Na ho to safhe khulte hain magar
  khane khali aate hain (aur safha khud ye baat likh kar bata deta hai)

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

## 1c. Testing ka intezar — HR Hazri ka nizam (migration 231-236)

Poora nizam ban gaya hai, **sirf testing database par**. Live par
aap ki haan ke baghair kuch nahi jayega.

Testing ki qadam ba qadam fehrist: `docs/HR-HAZRI-TESTING.md`

**Kya bana:**

| Safha | Kya karta hai |
|---|---|
| `/admin/hr/attendance` | Mahine ka calendar. Din par click — waqt, der, kahan se, aur "kya kya badla". Wahin se darkhwast aur (afsar ko) hazri lagana. |
| `/admin/hr/attendance/board` | Aaj ka board + "dhyan chahiye" ke chaar adad. |
| `/admin/hr/corrections` | Afsar ke paas aayi darkhwastein — purana aur naya sath sath. |
| `/admin/hr/team` | Kaun kis ko report karta hai (darakht ki shakl mein). |
| `/admin/hr/settings` | Kaam ka waqt, hafte ki chhutti, Eid ki chhutti, mahine ka taala. |
| `/admin/my-attendance` | Check-in/out + is mahine ka apna hisaab + apni darkhwastein. |

**Teen puraani ghaltiyan jo isi kaam mein pakRi gayin:**

1. **Hazri chupke se badal jati thi.** `markAttendance` seedha upsert
   karta tha — purani qeemat, badalne wala, aur wajah teenon gayab.
   Ab har tabdeeli `attendance_audit` mein girti hai (trigger se, code
   se nahi), aur mitane ka koi raasta kisi ke paas nahi.

2. **Check-out do dafa dabane par do din ki dihari chaRh jati thi.**
   Ab check-out ek hi dafa lagta hai.

3. **'hr' role ko apne hi module mein kuch nazar nahi aata tha.**
   `profiles` ki policy `fn_is_staff()` par thi, jo sirf 4 roles jaanta
   hai — `hr` un mein hai hi nahi. Yani HR ka banda staff ki fehrist
   kholta to khali milti — na ghalti, na paighaam. Ab `fn_is_any_staff()`
   par hai. (Tankhwah phir bhi har kisi ko nazar nahi aati: manager ke
   liye alag darwaza hai jis mein tankhwah ka khana hai hi nahi.)

**Chhutti (Leave) bhi usi zanjeer par le aayi gayi (237):** ab faisla
sirf apni reporting team ka, comment manzoori par bhi lazmi, "wapas
bhejein" ka teesra raasta, aur aadha din. Pehle koi bhi manager kisi
ki bhi chhutti manzoor kar sakta tha aur us bande ke apne afsar ko
khabar bhi na hoti; aur chhutti ki wajah (jis mein bimari likhi hoti
hai) har staff parh sakta tha.

**Tankhwah ka form ab hazri dikhata hai:** mulazim aur mahina chunte
hi us mahine ke adad form par aa jate hain — kaam ke din, hazir,
chhutti, ghair hazir, "record nahi", der. Rok pehle se thi, magar rok
tab lagti thi jab banda form bhar chuka hota tha; ab adad pehle nazar
aate hain.

**Aazmaishi muddat aur saalana chhutti (238-239):** naya banda 3 mahine
aazmaish par; us ke baad muddat baRhayein, pakka karein, ya alag karein
— teenon par comment lazmi. Pakka hone par 20 din saalana chhutti;
aazmaish ke dauran tankhwah wali koi chhutti nahi (bila tankhwah phir
bhi mil sakti hai). Saare adad `/admin/hr/settings` se badalte hain.

**Bachi hui chhutti agle saal nahi jati — 31 December ko khatam ho
jati hai** (malik ka usool). Us ka saya ye tha ke kisi ke 8 din
khamoshi se khatam ho jate aur usay pata bhi na chalta; is liye 240
mein us ka nishan laga diya: bande ko apne safhe par, aur HR ko board
par saal ke aakhri teen mahinon mein fehrist ke sath.

Sab se ahem usool: **tareekh guzarne se koi pakka nahi hota.** Faisla
na ho to banda aazmaish par hi rehta hai aur board par laal "faisla
baqi hai" likha aata hai. Us ka ulta bhi: muddat kul 6 mahine se aage
nahi baRh sakti — us ke baad faisla karna hi paRta hai.

**Jo jaan boojh kar abhi nahi bana:** biometric machine ka raasta,
offline sync wali app, overtime ka usool.
Wajahein `docs/HR-HAZRI-TESTING.md` ke section 8 mein likhi hain.

---

## 2. Feature #2 — Sidebar-Free Dashboards — **ban gaya** (250)

**Faisla locked tha, audit ho chuka tha. Ab staff wala hissa ban chuka hai.**

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

### Chha gaps mein se paanch band ho gaye

| Gap | Haalat | Kahan |
|---|---|---|
| 1. Sidebar sab ko dikhti thi | ✅ Ab Master Admin ke ilawa kisi ko nahi | `admin/layout.tsx` + `lib/access/sidebar-free.ts` |
| 2. Compact top nav nahi thi | ✅ Ban gayi (`← Mera Kaam · POS · bell · profile`) | `components/layout/compact-nav.tsx` |
| 3. Cards department ke darje par the | ✅ Ab har card ek KAAM hai; department sirf sarkhi | `admin/my-work/page.tsx` |
| 4. Score chip kahin nahi tha | ✅ "Mera Kaam" ke header mein — apna score | `admin/my-work/page.tsx` |
| 6. Dealer / Buyer / Expert ka layout nahi tha | ✅ Teenon maujood hain, aur teenon pehle se sidebar-free | `app/dealer|buyer|expert/layout.tsx` |
| **5. Farmer portal ki apni sidebar** | ❌ **Jaan boojh kar nahi chheRi** | `components/portal/sidebar.tsx` |

**Gap 5 kyun nahi kiya gaya.** Malik ka usool staff ke baare mein tha:
*Master Admin = poori ERP navigation, baqi sab = My Work Dashboard.*
Kisan ka portal staff ka ERP nahi hai, aur wahan "Mera Kaam" jaisa koi
safha hai bhi nahi — us ki sidebar hi us ka poora raasta hai. Usay
hatane ka matlab kisan ke liye NAYA ghar banana hota, aur wo naqsha
malik se poochhe baghair banana theek nahi. **Ye ek sawal khula hai.**

### Sidebar wapas laani ho to — ek line

Faisla database mein rakha hai, code mein nahi. Agar counter par kuch
ulajh jaye to poora build wapas karne ki zaroorat nahi:

```sql
update platform_settings
   set value = '{"enabled": false}'::jsonb
 where key = 'sidebar_free_dashboards';
```

Aur setting na mile, connection na bane, ya value kharab ho — teenon
soorat mein **sidebar khud ba khud reh jati hai**. Wajah wohi hai jo
`loadNav` ke fallback ki thi: navigation ka ghayab ho jana poora daftar
rok deta hai, aur us waqt wajah dhoondna bohot mushkil hota hai.

### Migration — sirf **ek** (250)

`features.description` (+ `_en`, `_ur`) — card ka doosra jumla. Roz
chalne wale gyarah safhon ke jumle bhar diye gaye; baqi khali hain, aur
wahan card par sirf naam aata hai. Khali jagah bharne ke liye kuch bana
kar likhna us se bura hota — ghalat jumla bande ko ghalat safhe par
bhejta hai. **Naya permission table nahi bana.**

---

## 3. Tarjuma (Urdu / English / Roman) — **MUKAMMAL**

**Ho gaya.** Ab teenon zabanon mein wo sab kuch hai jo screen par nazar
aata hai — public website, kisan ka portal, dealer/buyer/expert ke
portal, naukri ka offer, Trust ka safha, arhti ka poora hissa, aur admin
ke saare chhote safhe.

Aakhri hisse mein **445 jumle, 221 files**.

Us ke baad jo naye safhe bane, wo bhi teenon zabanon mein aa chuke hain:
**Maal Andar**, **Products CSV se charhayein**, **Bill se Trade Rate**,
aur POS ka thok wala hissa (dict: `products-flow.ts`). Un mein "trade
rate", "barcode", "CSV" aur "MRP" jaan boojh kar waise ke waise hain —
ye chhape hue lafz hain, tarjuma inhen pehchanne se rok deta hai.

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
- **`GEMINI_API_KEY`** cPanel ke environment variables mein bhara ho — Maal
  Andar mein dabbe ki tasveer aur "Bill se Trade Rate" mein bill ki
  tasveer, dono isi se parhi jati hain. Na ho to safhe khulte hain magar
  khane khali aate hain (aur safha khud ye baat likh kar bata deta hai)

---

## 6. Chhote kaam

| Kaam | Kyun |
|---|---|
| ~~Safha daayen se kat raha tha~~ | **Theek ho gaya** — admin aur portal dono ke layout par `min-w-0` laga. Chauri table ab apne dabbe mein khisakti hai, poora safha nahi |
| PWA icon `public/icons/icon-192.png` maujood nahi (404) | Phone par "Add to Home Screen" ka icon khali aata hai. Phase 17 ka hissa |
| Booking ke safhe par upar wala `○ Payment` chip adaigi ke qadam tak na le jaye | Chhota, magar roz kaam aata |
| PR #1 ka matn purana hai | Bina poochhe nahi badla jayega |
| ~~`src/app/admin/products/page.tsx]` (0 byte, naam mein `]`)~~ | **Hata diya gaya** — pehli commit ki typo thi, kisi safhe ka hissa nahi thi |

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
