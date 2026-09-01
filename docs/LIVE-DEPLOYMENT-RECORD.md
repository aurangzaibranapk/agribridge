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
| **Live par chal chuki** | 225, aur **226 se 242** (1 September, malik ke saaf hukm par) |
| **Live par NAHI chalin** | **243, 244, 245, 246, 247** |
| Testing par | 226 se 247 tak sab |

**243–247 chalne se pehle abhi ka build Live par upload nahi hona
chahiye.** Warna ye safhe tootenge: products ki fehrist, POS, product
ka form (naya aur edit), Maal Andar, aur CRM mein gahak mehfooz karna.

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

## 4. Ye ginti dobara kab dekhni hai

243–247 chalne ke **foran baad** wohi das tables dobara ginein aur upar
wali fehrist se milayein. Kisi bhi adad ka **kam** hona rukne ki wajah
hai — un migrations mein koi cheez mitane wali nahi hai, is liye ginti
sirf barh sakti hai, ghat nahi sakti.
