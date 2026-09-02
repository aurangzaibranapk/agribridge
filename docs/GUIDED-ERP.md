# AgriBridge Guided ERP — malik ka naqsha, aur is ki asal halat

Malik ka usool (2 September 2026):

> "Har kaam ke liye ek seedha raasta, AI har step par guide kare, aur
> har department sirf apna relevant kaam dekhe."
>
> Naam: **AgriBridge Guided ERP**. AI ka hissa: **AgriBridge Work Coach**.
> Goal: *Ask what to do → AI guides you → You verify → System records.*

Ye file malik ke 16 nukton ko system ki asal halat se milati hai. Har
qatar ka darja teen mein se ek hai: ✅ bana hua, 🟡 adha, ❌ baqi.
"Adha" ka matlab: kuch hissa hai magar us nukte ka maqsad poora nahi
hota.

---

## 1. Solah nukte, ek ek kar ke

| # | Malik ka nukta | Halat | Aaj kya hai, kya nahi |
|---|---|---|---|
| 1 | Staff ko sirf "My Work" dikhe, poora sidebar nahi | ✅ (B) | 250 ke baad staff ko sidebar nahi milti; ghar "Mera Kaam" hai; department dashboards role se bante hain. **Magar "Aaj ka Kaam" ki fehrist department-war nahi** (Purchase Staff → New Purchase, Pending Bills...). `pending-counts.ts` mein ginti hai, kaam ki fehrist nahi |
| 2 | "Aaj kya karna hai?" AI box har dashboard par | ❌ | Bridge AI ek alag safha hai (/admin/bridge-ai). Dashboard par box nahi; "kahan jaun" ka jawab nahi deta; safha kholne ka link nahi deta |
| 3 | Department-trained AI | 🟡 | `classifyAgent` sawal ke lafzon se 4 agent chunta hai (crop/livestock/finance/general). **Banday ke department se nahi.** Purchase/Warehouse/Shop/Admin agent hain hi nahi |
| 4 | Screenshot Help | ❌ | Gemini tasveer parhta hai (Maal Andar, bill) magar "ye safha samjhao" ka raasta nahi. Is ke liye #11 (feature ki maloomat) pehle chahiye, warna AI andaza lagayega |
| 5 | Har safhe par "?" Is Page Ko Samjhein | ✅ (266) | Har safhe ke upar daayen "? Samjhein" → side panel: maqsad, kaun, kab, aam raasta, aage kya, ghaltiyan, video, FAQ, mutalliqa safhe, AI se poochein |
| 6 | Guided / Training Mode naye banday ke liye | ❌ | Kuch nahi |
| 7 | Simple vs Advanced mode | ❌ | Profile par koi mode nahi; form sab ke liye ek jaise (purchase form par 15+ khane) |
| 8 | "Next Step" har process mein | 🟡→✅ (B, purchase aur bill; agri-order par timeline pehle se) | Purchase par darja hai (manzoori baqi → manzoor → maal aa gaya), agri-order par timeline. **Ek jaisi "Agla qadam" patti kahin nahi** |
| 9 | Dashboard par "Needs Attention" | ✅ (B) | Ginti alag alag jagah: Adhoore Products (258), Due Soon (255), pending-counts. **Ek jagah, role ke hisaab se, click karne layak fehrist nahi** |
| 10 | Training documentaries | ❌ | Ye content malik banayenge (video). System mein video ka khana bhi nahi |
| 11 | Har feature ki documentation system ke andar | ✅ (266) | `feature_help` table, 33 features likhe (Inventory ke 11, purchase ka raasta, POS, CRM, cash-close, Mera Kaam, Bridge AI); baqi features Owner/Admin `/admin/platform/help` par likhte hain, kaun sa baqi hai wahin dikhta hai |
| 12 | AI ko system ka asal naqsha pata ho, user ki halat dekh kar jawab de | ❌ | AI ke paas naqsha nahi. "Maal aa gaya, ab kya?" par wo purchase ka darja dekh kar nahi bolta |
| 13 | AI ko pata ho kaun pooch raha hai (role-aware) | ❌ | API route sirf "staff hai" dekhta hai. Role, department, ijazatein AI tak nahi jatin |
| 14 | UI ki zaban staff-dost | 🟡 | Roz ke safhe Roman Urdu mein (ur/en bhi). Kuch label abhi technical: "Stock Transfer", "Pending Product Edits", "Catalog Export" |
| 15 | AgriBridge Academy (module, demo, progress) | ❌ | Kuch nahi |
| 16 | "System khol lo" aur system khud bata de | ❌ | #1 + #9 + #12 + #13 milkar yahi banta hai |

**Ginti (B ke baad):** 16 mein se 5 poore, 3 adhe, 8 baqi. Jo bana hua hai wo
neev hai (role-based dashboards, Mera Kaam, Bridge AI ke tools,
Gemini se tasveer parhna). Guided ERP us ke upar banega.

---

## 2. Ek faisla jo sab se pehle hai: feature ki maloomat ek table mein

Malik ke 16 mein se 6 nukte (4, 5, 11, 12, 13, 15) ek hi cheez maangte
hain: **har feature ki tasdeeq-shuda maloomat system ke andar**, jo
insaan bhi parhe aur AI bhi. Wo table `feature_help` hogi:

```
feature_key       products.setup
purpose           Adhoore products ko bikri ke liye tayyar karna
who               Owner, Admin, Warehouse
when              Naya maal aane ke baad; POS par cheez na mile to
how               (qadam ba qadam, Roman Urdu; en/ur bhi)
next              Rate/barcode/tasveer poori -> Sale Ready -> POS
mistakes          Sale rate 0 likhna; naam mein pack size na likhna
video_url         (malik ki documentary)
faq               [{q, a}]
related           [products, products.labels, purchases]
```

AI ka har jawab **isi se** aayega, apne ilm se nahi. Is se #4 (screenshot
→ safha pehchan kar isi table se batana), #5 (? panel isi ko dikhata
hai), #12 (naqsha = features ka silsila jo `next` mein likha hai), #13
(role `who` se, aur banday ki asal ijazat se) sab ek jagah se chalte
hain.

Aur is ka developer rule (malik ke alfaz mein): **koi feature "poora"
tab tak nahi jab tak Code ✓ Permissions ✓ Help ✓ AI Knowledge ✓
Training Guide ✓.** Ye CLAUDE.md mein likh diya gaya hai.

---

## 3. Banane ki tarteeb

Usool wahi: jo cheez **aaj ki live karyana dukan** ko sab se pehle
aasan banaye, wo pehle. Har qadam apne aap mein poora ho, aur pichhle
par khaRa ho.

| Qadam | Kaam | Malik ke nukte | Andaza |
|---|---|---|---|
| **A** | ~~Feature ki maloomat + "?" panel~~ | ✅ **Ho gaya (266)** — `feature_help` (rm/en, ur Roman par girta hai), har safhe ke upar "? Samjhein" (sidebar wali aur bina-sidebar dono patti), 33 features ki maloomat, Owner/Admin ka editor `/admin/platform/help`, "AI se poochein" Bridge AI par sawal ke sath | 5, 11 | — |
| **B** | ~~Needs Attention + Agla Qadam~~ | ✅ **Ho gaya** — `needs-attention.ts` (16 asal ginti, service client, "—" jab na mile), Mera Kaam aur department dashboards par role ke raaston ke mutabiq; "Agla qadam" ki patti purchases ki har qatar aur bill ke safhe par | 1, 8, 9 | — |
| **C** | **Work Coach.** Har dashboard par "Aaj kya karna hai?" box. AI ko: banday ka role, department, ijazatein, feature_help, system ka naqsha, aur B ki asal halat (tools: `get_my_work`, `open_page` jo link deta hai, purane tools). Role ke hisaab se jawab ("aap purchase nahi banate, stock request banate hain"). **Screenshot help**: tasveer + sawal -> safha pehchan -> feature_help se jawab | 2, 3, 4, 12, 13, 16 | 2 din |
| **D** | **Training Mode + Academy.** `training_modules` (department-war, video + qadam + "demo try karein"), `staff_training_progress`; naye banday ka pehla login Training Mode mein: sirf 4 kaam, agla button highlight; manager ko progress. Video malik ke -- system khane deta hai | 6, 10, 15 | 2 din |
| **E** | **Simple / Advanced mode + zaban ki safai.** Profile par mode; Simple mein purchase = Upload → Check → Bhejein (baqi khane chhupe), POS/receiving/stock request bhi; Advanced sab. Technical label ki jagah kaam ka lafz, technical naam doosri line mein (Admin ke liye) | 7, 14 | 1.5 din |

A se C tak -- **teen din** -- "system khol lo" wala tajurba ban jata
hai. D aur E us ko naye staff aur bikri (software bechne) ke liye
tayyar karte hain.

---

## 4. Jo is naqshe se NAHI badlega

- **AI kabhi khud kuch mehfooz nahi karta.** Draft banata hai, insaan
  manzoor karta hai (Bridge AI ka pehle se usool, 259/260 mein bhi).
- **Rok database par rehti hai**, safhe par nahi (bina rate bikri nahi,
  bina manzoori receive nahi). Simple mode khane chhupata hai, rok nahi.
- **Sifar aur "hisaab nahi rakha" ek cheez nahi** -- Needs Attention
  mein bhi: jo ginti kisi ijazat ki wajah se na mile, wahan "—", 0 nahi.
- Purane safhe mitte nahi; raasta ek hota hai (jaise 265 mein).
