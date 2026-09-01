# `claude/live-safe-build` — ye branch kya hai

Ye branch **sirf Live server ke liye** hai, us waqt tak jab tak
migration **226 se 240** Live database par nahi chal jatin.

Asal kaam `claude/code-load-project-structure-fq91y9` par hai. Wahan
sab kuch poora hai. Ye branch us ka wo hissa hai jo **aaj ke Live
database par chal sakta hai**.

---

## Kyun banana paRi

Live par ye pandrah migration chali hi nahi. Yani wahan ye tables aur
functions **maujood hi nahi**:

```
crop_lifters, booking_crop_lifts, hr_work_schedules, hr_holidays,
attendance_audit, attendance_corrections, attendance_month_locks,
hr_leave_policy, staff_probation_reviews
fn_farmer_due_breakdown, fn_attendance_month_summary,
fn_leave_entitlement, fn_hr_can_decide_for, fn_hr_staff_directory
```

Naya code un se sawal poochta hai. Aur jawab na milne par **jaan boojh
kar rukta hai** — kyunke is project ka usool yehi hai: "parha nahi ja
saka" ko "sab theek hai" nahi samjha jata.

Testing par wo rok theek hai. **Live par wo teen chalte hue kaam band
kar deti:**

| Kaam | Live par kya hota |
|---|---|
| Tankhwah darj karna (`/admin/hr`) | Ruk jati — "hazri parhi nahi ja saki" |
| Chhutti maangna (`/admin/hr/leave`) | Darkhwast na jati |
| Chhutti par faisla | Manzoor/na-manzoor na hota |

Is liye is branch par un chaar files ko **pehle wali haalat** par
wapas kiya gaya hai:

```
src/actions/hr.ts
src/actions/leave.ts
src/app/admin/hr/hr-client.tsx
src/app/admin/my-attendance/page.tsx
```

Aur booking ke safhe se **qadam 8 (fasal uthane wala)** band hai —
kyunke `crop_lifters` wahan hai hi nahi, aur aisa qadam dikhana jo
dabane par kuch na kare, us se bura kuch nahi.

---

## Is branch mein KYA hai (yehi Live par jayega)

- **Naya login ka safha** — manzoor shuda naqshe par
- **Poora tarjuma** — Urdu / English / Roman, poori website aur poora
  admin panel
- `/admin/trust` — Trust & Performance ke safhe (abhi 404 aata hai)
- Machinery: kisan ka khata, wahin se adaigi, diesel ke do sawal
- Safha daayen se katne wali kharabi ka ilaj
- Admin par error boundary — ab "Application error" ki jagah **asal
  wajah aur digest** safhe par likhe aate hain

## Is branch mein KYA NAHI hai

- Fasal uthane wale (arhti) ka poora nizam
- HR hazri ka calendar, correction, team, board
- Aazmaishi muddat aur saalana chhutti

Ye teenon **testing par mukammal hain**. Live par tab aayenge jab aap
kahenge — us waqt main pehle migrations chalaoon ga, phir asal branch
se build hoga aur **ye branch ki zaroorat hi nahi rahegi**.

---

## Ek baat jo maloom honi chahiye

Naye safhon ke **raaste** (routes) is build mein bhi mojood hain —
mesalan `/admin/hr/attendance`. Magar wo Live ke **menu mein nahi
aayenge**, kyunke menu database ke `features` table se banta hai aur
wahan ye darj hi nahi. Yani koi ghalti se un tak nahi pahunchega.

Agar koi jaan boojh kar wo URL type kare, to usay ab **saaf wajah**
nazar aayegi (khali "Application error" nahi) — kyunke error boundary
lag chuki hai.

---

## Do command (apne computer par)

```
cd "/c/Users/Dx Home Films Lab 8K/Downloads/agribridge" && git fetch origin && git checkout claude/live-safe-build && git pull origin claude/live-safe-build && npm run build > build.log 2>&1; tail -5 build.log
```

```
cd "/c/Users/Dx Home Films Lab 8K/Downloads/agribridge" && ls -l .next/BUILD_ID && rm -f deploy.tar.gz && tar --exclude='.next/cache' -czf deploy.tar.gz .next && ls -lh deploy.tar.gz
```

Phir cPanel: **Setup Node.js App → Stop** → File Manager →
`domains/agribridge` → `deploy.tar.gz` Upload (overwrite) → right-click
**Extract** → **Start**.

### Upload ke baad Live par khud dekhein

- `alranatraders.pk/login` — naya safha
- `alranatraders.pk/admin/trust` — 404 na aaye
- Zaban badal kar dekhein — Urdu / English / Roman
- Koi machinery booking kholein — safha theek chale, qadam 8 na dikhe
- `/admin/hr` par tankhwah darj karke dekhein — **rukni nahi chahiye**
- `/admin/hr/leave` par chhutti maang kar dekhein — **jani chahiye**

### Do env jo cPanel mein hone chahiyen

- `WHATSAPP_OTP_TEMPLATE` — na ho to WhatsApp ka OTP chup chaap chhoot
  jayega aur hamesha SMS se jayega
- Supabase par email (SMTP) — warna email wala OTP nahi aayega

---

## Testing par wapas jane ke liye

```
git checkout claude/code-load-project-structure-fq91y9
```
