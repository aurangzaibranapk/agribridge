# Testing ki fehrist — ek hi jagah

Banayi: **1 September 2026**

Ye wo sab kuch hai jo testing par chala kar dekhna hai. Tarteeb ahem hai:
neeche wale qadam upar walon par khare hain.

Har khane mein **jo hona chahiye** likha hai, aur us ke saath **kya
ghalat hoga** — kyunke aksar kharabi "kuch nahi hua" ki shakl mein aati
hai, aur us par nazar nahi jati.

---

## 0. Shuru karne se pehle

Dev server chal raha ho to **Ctrl+C**, phir:

```
cd "/c/Users/Dx Home Films Lab 8K/Downloads/agribridge" && git pull origin claude/code-load-project-structure-fq91y9 && npm run dev
```

**Ye TESTING database par chalta hai** (`hwaiuwxqldxsoukkfefn`) — aap ki
apni machine par app khulti hai, magar data testing wala hota hai. Live
ke kisan ko koi WhatsApp nahi jayega.

> **ZTEST se shuru hone wale kisan aur bookings mitane nahi hain.** Wo
> jaan boojh kar wahan pare hain — un se hi purane kaam dobara parkhe
> jate hain.

---

## 1. Login ka safha — `localhost:3000/login`

| Dekhna | Hona chahiye |
|---|---|
| Poora card | Ek hi screen mein aa jaye, neeche khisakna na pare |
| Do patti | **Kisan / Customer** aur **Admin / Staff / Vendor** |
| Mobile ka khana | `+92` alag, phir number |
| Us ke neeche | **WhatsApp** aur **SMS** ke do chhote khane, aur un ke neeche darmiyan mein: *"WhatsApp par code na aaye to SMS chunein"* |
| **YA** | Goliya, aur us ke neeche **Email (User ID)** ka khana |
| Neeche | **Google** aur **Facebook** saath saath, phir *"Member nahi hain? Register karein"* |
| Daayen taraf | Do baaton wala card |
| Sab se neeche | Chaar ki patti |

**Chala kar dekhein:**

1. Apna mobile likhein, **SMS** chunein, **OTP bhejein** → code SMS par aana chahiye
2. Code aane ke baad **"Code nahi mila? Dobara bhejein"** → is dafa **doosre raaste se** jana chahiye (SMS gaya tha to ab WhatsApp)
3. Email ka khana bharein aur bhejein → agar wo email registered nahi hai to saaf jawab: *"Ye email registered nahi hai. Pehle register karein."*

**Ghalat hoga agar:** email par koi bhi naya khata ban jaye. Wahan naya
khata banna hi nahi chahiye.

---

## 2. Safhe ki chaurai — har admin safha

Ye ek kharabi thi jo aap ne pakri thi: booking ke safhe par **raqam ke
adad nazar hi nahi aa rahe the**, safha daayen se kat raha tha.

**Dekhein:** koi bhi booking kholein. Har lakeer ke saamne ki raqam
(`Balance`, `Farman Ali ko dena`) **nazar aani chahiye**, aur poora safha
daayen-bayen **khisakna nahi chahiye**.

Chauri table (jaise Arhti Board) **apne dabbe ke andar** khisakni
chahiye — poora safha nahi.

---

## 3. Machinery — jo pichhle hafte badla

### 3.1 Diesel ke do sawal

Koi booking → **Qadam 4 (Kaam)** → kaam mukammal karein.

| Sawal | Jawab |
|---|---|
| *Kya hum khud diesel dalwa kar aaye the?* | Haan → litre, rate aur khata poochha jayega |
| *Kisan ne diesel dala?* | Haan → litre aur rate (khata nahi — wo paisa hamare paas se guzra hi nahi) |

**Dono ka jawab "Nahi" dein** → wo bhi darj hona chahiye. Baad mein us
booking par likha aana chahiye ke **diesel dala hi nahi gaya** — na ke
khali jagah.

> **Diesel ka alag qadam ab hai hi nahi.** Wo jaan boojh kar hataya gaya:
> bar bar wohi sawal saamne aata tha.

### 3.2 Parali / Kutra — kanal mein

Nayi booking → raqba **acre + kanal** dono mein → **Dono** chunein →
Sabit Parali aur Kutra dono ke saamne **do do khane** (acre aur kanal)
aane chahiyen.

**Dekhein:** upar wala jor aur neeche wala jor **milna chahiye**. Misal:
upar 5 acre 7 kanal = 5.875, to neeche bhi 5.875 hi banna chahiye.

### 3.3 Kattai ki jagah pin karna

- Kaam wale form mein **Location capture karein**
- Bookings ki fehrist par bhi: jahan jagah darj hai wahan **nazar aaye**, jahan nahi wahan **pin karne ka button**

### 3.4 Kisan ka khata aur adaigi

**All Bookings** → sabz link **"Farmer Se Lena: Rs …"** par click → kisan
ka khata khulta hai.

Wahan **"Jin par abhi baqi hai"** → **Adaigi darj karein** → khana
**wahin niche khulta hai** (booking ke safhe par nahi jana parta).

**Chala kar dekhein:** Rs 10,000 baqi par sirf **Rs 5,000** darj karein →

- upar wala baqi **foran Rs 5,000 ho jana chahiye**
- khana **band ho jana chahiye** aur "darj ho gaya" ka paighaam aaye

**Ghalat hoga agar:** darj karne ke baad bhi wahi purana baqi dikhta rahe
— us soorat mein banda samajhta hai ke gaya hi nahi, aur dobara daba deta
hai.

---

## 4. Fasal uthane wale (arhti) — naya kaam

Ye poora naya hai. **Isi tarteeb se** chalayein.

### Qadam 1 — Arhti daalein

`Machinery → Hisaab → Fasal Uthane Wale` → **Naya uthane wala**

Naam, phone, aur **commission ka rate** (misal: `2`).

> Rate **fasal ki qeemat** ka fisad hai — kattai ke bill ka nahi.

**Dekhein:** wohi phone dobara daal kar doosra banda banane ki koshish
karein → **rukna chahiye**: *"Is phone number par pehle se ek uthane wala
darj hai."*

### Qadam 2 — Booking par lagayein

Aisi booking kholein jis par:
- kisan ne kaha ho **"fasal aap ko bechunga"**, aur
- **bill ban chuka ho**

Wahan **Qadam 8 — Fasal Uthane Wala** aana chahiye.

> Ye qadam sirf usi booking par aata hai. Baqi bookings par ye sawal
> bemaani hai, is liye nazar hi nahi aata.

Arhti chunein → **Lagayein**.

Ab us khane mein **kisan ka baqi is waqt** dikhna chahiye:
- Kattai ka bill
- Purana baqi (khaad / udhaar)

### Qadam 3 — "Fasal utha li" → bill

**Fasal utha li — bill banayein** → **sirf ek adad likhein: fasal kitne
ki gayi.**

Likhte hi neeche khud ba khud banna chahiye:

```
Fasal ki qeemat                      Rs 10,00,000
− Kattai ka bill                     Rs    28,125
− Kisan ka purana baqi               Rs    15,000
Kisan ko dena                        Rs  9,56,875

Hamara commission (2%)               Rs    20,000
Arhti ne hamein dena                 Rs    63,125
```

**Ye teen baatein dekhein:**

1. **Commission fasal ki qeemat mein se NAHI katta** — kisan ko us se kam
   nahi milta. Wo arhti ki apni jeb se hai.
2. **Kattai aur purana baqi do dafa nahi kat-te.** Machinery ka bill khud
   bhi kisan ke khate mein hota hai — us ka hisaab alag rakha gaya hai.
3. Qeemat kisan ke qarze **se kam** likhein → bill **banna nahi chahiye**,
   aur wajah saaf likhi honi chahiye.

### Qadam 4 — Kisan ka khata saaf

Usi kisan ka khata kholein → kattai ka baqi ab **saaf** hona chahiye.

### Qadam 5 — Arhti Board

`Machinery → Reports → Arhti Board`

| Dekhna | Hona chahiye |
|---|---|
| Sab se upar | **Arhtiyon ke paas hamara paisa** — Rs 63,125 |
| Us ke neeche | Sab se purani raqam **kitne din** se khari hai |
| Pehli fehrist | Kis arhti ke paas kitna — kattai, purana, commission, diya, khara hai, kab se |
| Doosri fehrist | **Kis kisan ka paisa kis ke paas gaya** — kisan, booking, arhti |

> Doosri fehrist isliye hai ke kisan ka khata to saaf ho chuka hota hai.
> Agar kahin ye likha na ho ke wo raqam kahan gayi, to teen mahine baad
> koi nahi bata sakta ke wo paisa tha kis ka, aur gaya kahan.

### Qadam 6 — Arhti se paisa lena

Arhti ka khata kholein → **Adaigi darj karein** → thora sa (poora nahi)
darj karein → baqi kam ho jana chahiye.

**Dekhein:** baqi **se zyada** raqam darj karein → rukna nahi chahiye,
magar batana chahiye ke itna zyada hai aur wo un ke khate mein jama
rahega.

**Aur ye bhi:** jis arhti ke zimme abhi baqi khara ho, usay **band karne
ki koshish** karein → **rukna chahiye**. Warna wo hisaab nazron se ghayab
ho jata hai, aur ghayab hua baqi wapas nahi aata.

---

## 5. Jo cheezein sirf Live par dekhni hain

Ye testing par nahi dikhtin — Live par upload ke baad dekhni parengi:

| Cheez | Kahan |
|---|---|
| `WHATSAPP_OTP_TEMPLATE` bhara ho | cPanel → Setup Node.js App → Environment variables. Na ho to WhatsApp par OTP kabhi nahi jayega, hamesha SMS se jayega |
| Supabase ka email (SMTP) chal raha ho | Warna email wala OTP nahi aayega |
| `/admin/business-dashboard` | Live par is par **"Application error"** aaya tha. Wo safha kisi deploy mein badla nahi tha, is liye us ki wajah abhi maloom nahi. Aaye to **F12 → Console** wali laal lakeer ki tasveer chahiye |

---

## 6. Migrations — testing par hain, Live par nahi

| # | Kya |
|---|---|
| 226 | Uthane walon ki fehrist, booking par tag, `lifter_collected` wala raasta |
| 227 | Bill ke khane, aur `fn_farmer_due_breakdown` |
| 228 | Fehrist menu mein |
| 229 | Kis kisan ka paisa kis ke paas — ka nazara |
| 230 | Arhti Board menu mein |

**Paanchon sirf testing par chal chuki hain. Live par ek bhi nahi.**
Testing mukammal hone ke baad aap ke kehne par Live par jayengi.

---

## 7. Kuch ghalat lage to

Mujhe ye teen cheezein bhej dein:

1. **Kaun sa safha** aur **kya kiya tha**
2. Screen ki tasveer
3. Agar "Application error" jaisa kuch aaye — **F12 → Console** wali laal lakeer

Andaza lagane se waqt zaya hota hai; wo laal lakeer asal wajah likhti
hai.
