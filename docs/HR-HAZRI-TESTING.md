# HR Hazri Nizam — testing ki fehrist

**Sab kuch TESTING database par hai** (`hwaiuwxqldxsoukkfefn`). Live par
kuch nahi gaya. Aap ki haan ke baghair jayega bhi nahi.

Migration 231 se 236 tak.

---

## 0. Pehle ye teen cheezein set karein (warna baqi sab adhoora lagega)

1. **Chhutti aur Waqt** (`/admin/hr/settings`)
   - Kaam ka waqt: 9:00 se 17:00 (ya jo aap ka asal waqt hai)
   - Der ki chhoot: 15 minute
   - Hafte ki chhutti: Itwaar par nishan (ya Juma, jo aap ka usool hai)
   - Ek do chhutti ke din daalein (mesalan Eid)

2. **Team aur Reporting** (`/admin/hr/team`)
   - Har mulazim ka **afsar** chunein.
   - Jab tak kisi ka afsar darj nahi, us ki har darkhwast HR ke paas
     jayegi — safhe par ye baat likhi hui aayegi.

3. **Hazri Calendar** (`/admin/hr/attendance`)
   - Mulazim chunein, mahina chunein. Har din ka ek khana.

---

## 1. Calendar — har din ka jawab

| Dekhne wali cheez | Kya hona chahiye |
|---|---|
| Itwaar | "Hafte ki chhutti" — ghair hazir **nahi** |
| Eid wala din | Chhutti ka naam khud likha aayega |
| Jis din check-in hua | Waqt, aur der hui to kitni |
| Jis din check-in hua magar check-out nahi (aur din guzar gaya) | "Check-out nahi hua" |
| Jis din kuch bhi nahi | "Record hi nahi" — **"Ghair hazir" nahi** |
| Aane wale din | "Abhi nahi" |

**Ye farq sab se ahem hai:** "Record hi nahi" aur "Ghair hazir" do alag
khane hain, do alag rang. Pehla kehta hai *dekha hi nahi gaya*, doosra
kehta hai *dekh kar ghair hazir likha gaya*. Report mein bhi dono alag
ginte hain.

---

## 2. Darkhwast ka raasta (staff → afsar)

1. Apne login se `/admin/hr/attendance` kholein — apna hi naam chuna
   hua aayega.
2. Kisi guzre din par click karein → **"Theek karwane ki darkhwast"**
   - Wajah likhe baghair form aage nahi baRhega (kam az kam 5 harf).
3. Us din ke khane par **peela nuqta** aa jayega.
4. Ab **afsar ke login** se `/admin/hr/corrections` kholein.
   - Wahan **purana** aur **naya** sath sath dikhega.
   - Comment likhe baghair koi bhi button kaam nahi karega.
5. **Manzoor** karein → us din ki hazri badal jayegi.
6. Wapas calendar par jayein, usi din par click karein →
   **"Kya kya badla"** mein purani qeemat, nayi qeemat aur wajah likhi
   hogi. Khane par ✎ ka nishan bhi aa jayega.

**Ye jaanchein:**
- [ ] Apni darkhwast khud manzoor karne ki koshish karein → rok lagni chahiye.
- [ ] Kisi aise bande ki darkhwast jo aap ki team mein nahi → rok lagni chahiye.
- [ ] Ek hi din ki doosri darkhwast → "pehle se zer-e-ghaur hai".
- [ ] **Wapas bhejein** (send back) → banda dobara bhej sakta hai.

---

## 3. Afsar khud hazri lagaye

Calendar mein din par click → **"Hazri lagayein"** (sirf afsar/HR ko
dikhta hai).

- [ ] Wajah ke baghair → rukna chahiye.
- [ ] Lagane ke baad "Kya kya badla" mein wajah nazar aani chahiye.
- [ ] Us din ka `Kahan se` ab **"Haath se lagayi"** hona chahiye.

---

## 4. Apni hazri khud na badle

Ye database ka taala hai, safhe ka nahi — is liye ise ULTA raaste se
jaanchein:

- [ ] Aam staff ke login se apna check-in dobara karein → "Aaj ka
      check-in pehle ho chuka hai".
- [ ] Check-out do dafa dabayein → doosri dafa rukna chahiye
      (**pehle ye do dafa dihari chaRha deta tha**).
- [ ] Jis din manzoor shuda chhutti hai, us din check-in karein →
      rukna chahiye, wajah ke sath.

---

## 5. Chhutti (Leave) — ab wohi qanoon jo hazri ka hai

`/admin/hr/leave`

- [ ] Chhutti manzoor karein → un dinon ka calendar khud "Chhutti"
      dikhaye.
- [ ] **Zer-e-ghaur** chhutti wale din calendar par "Chhutti
      zer-e-ghaur" dikhe — **"Ghair hazir" nahi**.
- [ ] Manzoori wapas lein → sirf chhutti wali qatarein hatti hain, asli
      hazri wahin rehti hai.

**Ye chaar cheezein nayi hain:**

- [ ] **Comment ab manzoori par bhi lazmi hai** (pehle sirf na-manzoori
      par tha). Khali chhoR kar dabayein → rukna chahiye.
- [ ] **Wapas bhejein** ka teesra button. Wapas bheji hui darkhwast
      "faisla shuda" nahi hoti — banda theek kar ke dobara bhej sakta
      hai.
- [ ] **Aadha din** ka khana. Do tareekhein alag rakh kar aadha din
      chunein → rukna chahiye.
- [ ] **Sirf apni team**: doosri branch ke bande ki chhutti manzoor
      karne ki koshish karein → rukna chahiye. (Pehle koi bhi manager
      kisi ki bhi chhutti manzoor kar sakta tha, aur us ke apne afsar
      ko khabar bhi na hoti.)
- [ ] Manager ke login se chhutti ki fehrist kholein → sirf apni team
      ki darkhwastein dikhni chahiye. Chhutti ki wajah mein bimari
      likhi hoti hai — wo har kisi ke parhne ki cheez nahi.

---

## 5b. Aazmaishi muddat aur saalana chhutti

`/admin/hr/settings` → **Chhutti ka usool**, aur `/admin/hr/probation`

**Usool (default jo main ne rakhe):**

| Cheez | Default | Aap badal sakte hain |
|---|---|---|
| Saalana chhutti | 20 din | Haan |
| Aazmaishi muddat | 3 mahine | Haan |
| Kul hadd | 6 mahine | Haan |
| Aazmaish par tankhwah wali chhutti | **Nahi** | Haan (nishan laga dein) |
| Pehla saal mahinon ke hisaab se | Haan | Haan |
| Bachi chhutti agle saal | **Nahi (0)** | Haan |

**Jaanchein:**

- [ ] `/admin/hr/probation` → **Aazmaish shuru karein**: banda, tareekh,
      mahine. Aakhri tareekh khud ban jayegi.
- [ ] Us bande ke login se **saalana chhutti** maangein → rukna chahiye,
      wajah ke sath ("aazmaishi muddat jaari hai").
- [ ] Wohi banda **bila tankhwah (unpaid)** chhutti maange → mil jani
      chahiye.
- [ ] `/admin/my-attendance` par us bande ko **"0 din"** nahi, balke
      **wajah** likhi dikhni chahiye.
- [ ] Aazmaish ki tareekh guzarne dein → banda **khud ba khud pakka
      NAHI hota**. Board aur probation ke safhe par **laal "Faisla baqi
      hai"** dikhna chahiye.
- [ ] **Muddat baRhayein** → comment ke baghair rukna chahiye.
- [ ] BaRhate rahein → 6 mahine ki hadd par "ab aur nahi baRh sakti"
      aana chahiye.
- [ ] **Pakka karein** → us tareekh se saalana chhutti shuru. Agar saal
      ke beech mein pakka hua to din **mahinon ke hisaab se** milenge
      (mesalan September mein pakka = 20 × 4/12 = 6.7 din).
- [ ] Ab wohi banda saalana chhutti maange → mil jani chahiye, aur
      bacha hua adad ghat jaye.
- [ ] Bache hue din se **zyada** maangein → rukna chahiye, adad bata
      kar.
- [ ] Pakka hue bande ko wapas aazmaish par daalne ki koshish karein →
      pehle rukna chahiye, phir alag nishan laga kar hi hona chahiye
      (kyunke us se us ki chhutti khatam ho jati hai).

**Yaad rahe:** mojooda saara staff **"pakka"** likha gaya hai, aazmaish
par nahi. Jo waqai naya hai, us ko HR haath se aazmaish par daalega.
Ulta karne par un logon ki chhutti chup chaap khatam ho jati jo saalon
se kaam kar rahe hain.

## 6. Mahina band karna aur tankhwah

`/admin/hr/settings` → **Mahina band karna**

- [ ] Khuli darkhwastein rehte hue band karne ki koshish → "X
      darkhwastein abhi zer-e-ghaur hain" — rukna chahiye.
- [ ] Sab par faisla kar ke phir band karein → ho jana chahiye.
- [ ] `/admin/hr` → **Tankhwah darj karein**: mulazim aur mahina
      chunte hi **us mahine ki hazri ke adad form par khud aa jayenge**
      (kaam ke din, hazir, chhutti, ghair hazir, record nahi, der).
      Adad dekh kar tankhwah likhein — rok ke intezar mein nahi.
- [ ] Mahina band na ho to darj karne par saaf paighaam aana chahiye.
- [ ] "Hazri adhoori hai, phir bhi banayein" par nishan laga kar →
      ban jani chahiye (yani rok soch kar toRi ja sakti hai, ittefaqan
      nahi).
- [ ] Band mahine mein hazri badalne ki koshish → rukna chahiye.
- [ ] Mahina dobara kholein → **wajah lazmi** hai.

---

## 7. Board (`/admin/hr/attendance/board`)

- [ ] "Dhyan chahiye" ke chaar adad.
- [ ] Aaj ka har banda — waqt, der, kahan se.
- [ ] **Manager ke login se sirf apni team dikhni chahiye**, poori
      company nahi.
- [ ] Kisi adad ke jawab mein `— parha nahi ja saka` aaye to wo
      **sifar nahi** hai — us ka matlab hai ke sawal ka jawab hi nahi
      mila.

---

## 8. Jo cheezein JAAN BOOJH KAR abhi nahi hain

| Cheez | Kyun nahi |
|---|---|
| Biometric machine se seedha data | Machine ka model aur us ka raasta abhi tay nahi. `source = 'biometric'` ka khana bana hua hai — machine milte hi wo bhar jayega. |
| Offline sync ki app | `synced_at` aur `is_offline` ke khane bane hue hain (asal waqt aur pahunchne ka waqt alag alag). Bharne wali PWA Phase 17 mein hai. |
| Overtime ka hisaab | `work_minutes` roz mehfooz hota hai. Overtime ka usool (kis ke baad, kis rate par) aap se poochhe baghair likhna theek nahi tha. |
| Chhutti ka saalana kota (balance) | Aap ne kota ka koi usool nahi bataya. Bina usool ke adad likhna wohi ghalti hai jis se ye project bachta aaya hai. |

---

## 9. Ek ZTEST qatar testing par chhoRi hai

`HR Department` ke naam par **2026-08-03** ki hazri banai gayi, phir
haath se badli gayi — taake audit ka raasta khud dekha ja sake. Ye
qatar jaan boojh kar chhoRi hai, mitayein nahi.
