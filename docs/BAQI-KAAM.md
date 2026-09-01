# Baqi kaam — ek hi jagah

Aakhri dafa theek kiya: **1 September 2026**

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

## 3. Tarjuma (Urdu / English / Roman)

**Kul 346+ files ho chukin. Takreeban 200 baqi, ~460 jumle.**

| Ho chuka | Jumle |
|---|---|
| Vendor portal | 119 |
| Kisan portal | 139 |
| Login / register / password | 66 + naya login safha |
| Shared components (sidebar, khata, reports, batwa, table) | 71 |

| Baqi | Andaza |
|---|---|
| Public website — `src/app/(site)/*` aur `src/components/site` | ~193 |
| `/admin/trust` | 38 |
| Chhote admin safhon ki lambi qatar | ~150 |
| Dealer / Buyer / Expert / Job-offer portal | ~80 |

**Jaan boojh kar chhora hua:** `urdu-agreement-template.tsx` (qanooni
kaghaz, ek hi zaban mein hona chahiye) aur `art-logo.tsx` (logo ka
aria-label).

Karobar ke naam `src/lib/i18n/glossary.ts` mein darj hain:
**ایگری بریج** · **الرانا ٹریڈرز** · **اے آر ٹی**

---

## 4. Score engine (Feature #1) — Live shadow mein

**Sab chal raha hai. Kuch toota nahi.** Magar teen cheezein khuli hain:

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

## 5. Chhote kaam

| Kaam | Kyun |
|---|---|
| PWA icon `public/icons/icon-192.png` maujood nahi (404) | Phone par "Add to Home Screen" ka icon khali aata hai. Phase 17 ka hissa |
| Booking ke safhe par upar wala `○ Payment` chip adaigi ke qadam tak na le jaye | Chhota, magar roz kaam aata |
| Login par SMS ka apna button | Filhal "Code nahi mila? Dobara bhejein" khud raasta badal deta hai (WhatsApp → SMS). Alag button chahiye to bataayein |
| PR #1 ka matn purana hai | Bina poochhe nahi badla jayega |

---

## 6. Jo abhi banaye hi nahi gaye

- **Vehicle Expense** — meter ki tasveer + petrol + mileage ka milan
- **Milk Verification** — claim banam asal naap

---

## 7. Aage ka naqsha (aap ka apna)

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

## 8. Do usool jo is project mein bar bar kaam aaye

**Sifar aur "hisaab nahi rakha jata" ek cheez nahi.** Sifar kehta hai
"dekh liya, kuch nahi hua". Jis cheez ka indraj hi nahi hota, us ke
saamne Rs 0 likhna jhoot hai — wahan saaf likhein ke track nahi hoti.

**Ijazat wali rok ke peeche khali jawab ko asal adad na samjhein.** RLS
ya staff-gated view kisi bande ke haath mein sifar qatarein laata hai.
Us "kuch nahi mila" ko "qeemat sifar hai" samajh lena is project mein
teen dafa ghalat adad de chuka hai. Aise sawal ka jawab
`SECURITY DEFINER` function se lein, aur "mila nahi" ke liye NULL rakhen,
sifar nahi.
