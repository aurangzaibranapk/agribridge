# Phase: AgriBridge Integration Hub

Malik ka naqsha (5 September):

> "One AgriBridge — har jagah se kaam aaye, ek jagah record bane."
> "Staff ko ye bhi na sochna paRe ke module kaunsa hai. Woh sirf kahe
> 'Farmer ko gandum ka plan chahiye' — AgriBridge usko sahi workflow tak
> le jaye."

Ye document us naqshe ka **sach** likhta hai: kya pehle se bana hua hai,
kya adhoora hai, aur kya waqai nahi hai. Ye farq likhna zaroori tha —
warna banaya hua kaam dobara banaya jata, aur wo mehnat ka sab se bara
zaya hai.

---

## 1. Pehle se BANA hua (dobara nahi banana)

| Naqshe mein | AgriBridge mein pehle se | Kahan |
|---|---|---|
| Owner Command Center | **Bana hua.** Milk, Grain, Machinery, Retail, approvals — har adad USI kitab se jo us department ka apna safha dikhata hai. Jo cheez data se na nikle wo "—" rehti hai. | `/admin/command-center`, `src/lib/command-center.ts` |
| Role dashboards | **Bana hua.** Har bande ko sirf apne cards; 1–10 ijazat par sirf cards, 10 se zyada par dynamic sidebar. | `/admin/my-work`, `src/lib/access/my-work.ts`, `sidebar-free.ts` |
| "Aaj kya baqi hai" | **Bana hua.** ~20 ginti, har ek ke sath safha; ginti na mile to NULL (sifar nahi). | `src/lib/access/needs-attention.ts` |
| Department workspaces | **Bana hua.** 14 dashboards: Milk, Grain, Machinery, Sales, Inventory, Purchase, Finance, Fleet, HR, Website, AI, Admin, Reports, Master. | `dashboards` + `dashboard_features` |
| Approvals + Audit | **Bana hua.** Maker-checker (274), period lock, reversal-only correction, `audit_logs`. | `src/lib/audit.ts`, migrations 272–274, 305 |
| Customer Records (360) | **Bana hua.** Farmer 360, Dealer/Buyer/Supplier, vendor portal. | `/admin/farmers/[id]`, `/vendor` |
| WhatsApp | **Bana hua (aik taraf).** Bahar jane wale paighaam, staff ki pehchaan, staff submissions. | `whatsapp-client.ts`, `/api/webhooks/whatsapp` |
| Excel / Sheets | **Bana hua.** Import/export, supplier bill reader (AI). | `/admin/products/import`, `/admin/products/bill-rates` |
| AI samajh | **Bana hua.** Bridge AI Work Coach — SYSTEM_MAP, `explain_page`, `open_page`, `start_guide`, draft banata hai magar khud darj nahi karta. | `/api/bridge-ai` |
| Custom Apps | **Yehi department workspaces hain.** Alag "app" banane ki zaroorat nahi. | — |

**Nateeja:** naqshe ka lagbhag 70% pehle se maujood hai. Us ko dobara
banana faida nahi deta.

---

## 2. Jo WAQAI nahi tha — ek darwaza

Bahar se aane wala kaam aaj **chhe alag jaghon** par girta hai:

| Kaam | Table | Safha |
|---|---|---|
| WhatsApp par staff ka bheja hua | `whatsapp_submissions` | `/admin/submissions` |
| AI ka banaya hua draft | `bridge_ai_action_requests` | `/admin/bridge-ai/action-requests` |
| Website ka rabta form | `contact_messages` | `/admin/contact-messages` |
| Marketplace ka order | `agri_orders` | `/admin/agri-orders` |
| Ijazat ki darkhwast | `access_requests` | `/admin/access-requests` |
| Behtari ki tajweez | `suggestions` | `/admin/improvements` |

Har ek apna safha khulne ka **intezar** karta hai. Jo safha kisi ne aaj
nahi khola, us mein para kaam kisi ko nazar nahi aaya — aur "kisi ko
nazar nahi aaya" is project ka sab se mehnga masla hai.

`needs-attention` ginti to deta hai ("das manzoori ke muntazir hain"),
magar ginti ye nahi batati ke kaam **KYA** hai. Us ke liye qatar chahiye.

### Qadam 1 — AgriBridge Inbox ✅ (bana diya)

`/admin/inbox` — `src/lib/access/inbox.ts`, migration **315**.

- **Ek bhi nayi table nahi.** Qatarein wohi hain jo pehle se apni apni
  jagah pari hain.
- Har qatar par: kis channel se, kis ne bheja, kya chahiye, kab aaya —
  aur click par **wohi safha** jahan us ka kaam hota hai.
- Faisla, manzoori aur audit wahin ke wahin. Inbox se kuch manzoor ya rad
  **nahi** hota. Ye sirf dikhata aur pahunchata hai.
- Ijazat ki rok wohi purani: qatar sirf usay dikhti hai jis par us ka
  safha khulta ho (`filterInbox` + `loadNav`).
- **Khali aur "parha nahi ja saka" alag likhe jate hain.** Koi channel
  nakaam ho to us ke saamne "—" aur upar peela paighaam — sifar nahi.
  (Is project mein wo ghalti teen dafa ghalat adad de chuki hai.)

---

## 3. Aage ke qadam (tarteeb se)

### Qadam 2 — Inbox par "AI ne kya samjha"
Har qatar ke sath ek line: AI ka andaza ke ye kis workflow ka kaam hai,
aur seedha us form ka link jis mein khane pehle se bhare hon.
*Sharat:* AI sirf **draft** banayega — darj karna insaan ke haath, jaisa
abhi hai.

### Qadam 3 — WhatsApp ka doosra rukh (andar aana)
Aaj WhatsApp se paighaam BAHAR jate hain aur staff ka bheja hua andar
aata hai. Kisan ka seedha paighaam ("mujhe 12 acre gandum ka credit plan
chahiye") abhi kisi qatar mein nahi girta. Ye Inbox ka saatwan source
banega.

### Qadam 4 — Integration Center
Ek safha jahan har channel ki **halat** dikhe: WhatsApp ki chaabi lagi
hai ya nahi, AI ki chaabi, email ke mailbox (jo `docs/EMAIL-MAILBOXES.md`
mein hain), Supabase. Aaj ye sab alag alag jagah se pata chalta hai, aur
kuch to sirf nakaam hone par.

### Qadam 5 — Workflow rules
"Supplier bill aaya → AI parhe → draft purchase → manzoori → GRN → stock
→ payable" — ye zanjeer **pehle se chalti hai**, magar har kaRi code
mein likhi hai. Rules table par lane se malik khud tarteeb badal sakenge.
Ye sab se bara kaam hai aur **sab se aakhir mein** hona chahiye — us se
pehle baqi char qadam ka tajruba chahiye.

---

## 4. Do usool jo is poore phase par lagte hain

1. **Koi module dobara nahi banega.** Har naya darwaza maujooda workflow
   par jayega. Do jagah do qaide rakhne se kisi din do alag adad nikal
   aate hain, aur phir ye sawal khatam nahi hota ke sach kaunsa hai.

2. **AI samjhe, insaan faisla kare.** Paisa, stock aur ijazat ko chhoone
   wala har aakhri qadam wahi purana manzoori ka raasta se guzrega.
   AI draft banata hai — darj nahi karta.
