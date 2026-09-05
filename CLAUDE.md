# AgriBridge — kaam karne ka tareeqa

## Command kab bhejni hain: malik ke kehne par, pehle nahi

Malik ka usool (unhi ke alfaz): *"main jab bolon ke system par nahi —
command HOLD. Jab main bolon system par aa gaya, tab aap ne jo jo kaam
hua ya us time tak hum ne kiya hai, un ki command bhej deni hai."*

Yani:

- **Wo system par nahi hote to command NAHI bhejni.** Kaam chalta
  rehta hai, magar command rok kar rakhni hai. Bhej dena un ke liye
  bekaar hai — wo us waqt kahin aur kaam karwa rahe hote hain, aur
  paighaam neeche dab jata hai.
- **Wo kahein "system par aa gaya"** — tab us waqt tak ka SAARA kaam ki
  **poori command ek sath**, ek hi paighaam mein.
- **Chat mein, file mein nahi.** Wo chat se copy kar ke apni machine par
  paste karte hain.
- Jahan tarteeb ahem ho ("pehle ye, phir mujhe batayein, phir wo"),
  wahan rukne ki jagah saaf likhein — magar command phir bhi saari ek
  sath.

**Is liye rokay hue kaam ki fehrist rakhni paRti hai.** Kaun si migration
Live par chalni baqi hai, kaun sa build banna hai — ye
`docs/LIVE-DEPLOYMENT-RECORD.md` mein likha rehta hai, taake un ke
aane par poori fehrist ek sath ban sake aur koi qadam chhoot na jaye.

## Deploy: HAMESHA dono command ek sath dein

Malik apne computer par khud build kar ke cPanel par upload karte hain.
Un ka usool: **har dafa dono command ek sath likh kar dein** — pehle
sirf build wala de kar phir package wale ka intezar na karayein.

**1. Pull + build**
```
git pull origin claude/code-load-project-structure-fq91y9 && npm run build > build.log 2>&1; tail -5 build.log
```

**2. Package**
```
ls -l .next/BUILD_ID && rm -f deploy.tar.gz && tar --exclude='.next/cache' -czf deploy.tar.gz .next && ls -lh deploy.tar.gz
```

Phir cPanel: **Setup Node.js App → Stop** → File Manager →
`domains/agribridge` → `deploy.tar.gz` Upload (overwrite) → right-click
**Extract** → **Start**.

Sirf `.next` server par jata hai. Baqi source files pehle hi `git pull`
se un ki machine par pahunch jati hain — unhen alag se bhejne ki
zaroorat nahi.

Windows / Git Bash: project `/c/Users/Dx Home Films Lab 8K/Downloads/agribridge`
par hai (naam mein space hai, quotes lagti hain). Ctrl+V kaam nahi karta —
right-click → Paste, ya Shift+Insert.

## Baat cheet

Roman Urdu mein. Command ek ek kar ke, files ya lambi guide bhej kar
nahi.

## Do database

- **Live**: `ktskwawkslaznkjjacni`
- **Testing**: `hwaiuwxqldxsoukkfefn`

Har migration **pehle testing par**, wahan test pass ho to **phir live**
par. `.env.development.local` hamesha testing ki taraf ho, live ki taraf
kabhi nahi — warna local testing se asal kisanon ko WhatsApp chala jayega.

## Do usool jo is project mein bar bar kaam aaye

**Sifar aur "hisaab nahi rakha jata" ek cheez nahi.** Sifar kehta hai
"dekh liya, kuch nahi hua". Jis cheez ka indraj hi nahi hota, us ke
saamne Rs 0 likhna jhoot hai — wahan saaf likhein ke track nahi hoti.

**Ijazat wali rok ke peeche khali jawab ko asal adad na samjhein.** RLS
ya staff-gated view kisi bande ke haath mein sifar qatarein laata hai.
Us "kuch nahi mila" ko "qeemat sifar hai" samajh lena is project mein
teen dafa ghalat adad de chuka hai. Aise sawal ka jawab
`SECURITY DEFINER` function se lein, aur "mila nahi" ke liye NULL rakhen,
sifar nahi.

## Aage ka naqsha (malik ka)

Phase 16 Delivery & Logistics ke baad **Phase 17 se 20 tak malik ki apni
development hai**: 17 Mobile/PWA, 18 SaaS (multi-tenant), 19 Security aur
Audit hardening, 20 Scale / national marketplace.

Do baatein aaj ke faislon par asar daalti hain, is liye yahan likhi hain:

- **18 (multi-tenant)** — aaj ka har naya table aur view ek hi karobar
  maan kar likha ja raha hai. Jahan aasani se ho sake, wahan tenant ka
  khana rakhna baad ki takleef bachata hai.
- **19 (security)** — RLS aur `SECURITY DEFINER` ke faisle abhi se soch
  kar karein. `fn_reset_test_financials` jaisa har raasta `is_live` ke
  taale ke peeche hona chahiye.

## Feature kab "poora" hai (malik ka usool, 2 September)

Koi bhi naya feature tab tak "100% poora" nahi jab tak saaton na hon
(malik ne 2 September ki report ke baad ye lock kiya):
**Feature (code) ✓ Permission ✓ Help (feature_help) ✓ AI Knowledge
(SYSTEM_MAP / coach tools) ✓ Audit ✓ Simple Staff Workflow (Mera Kaam
par raasta, agla qadam) ✓ Testing (rollback test testing DB par) ✓.**
Naqsha aur tarteeb `docs/GUIDED-ERP.md` mein hai. Har naye safhe ke
sath us ki `feature_help` qatar (maqsad, kaun, kab, kaise, agla qadam,
ghaltiyan) usi commit mein jaye.

Falsafa (malik ke alfaz): *"Staff ko ERP seekhna nahi — AgriBridge ko
staff ko kaam sikhana hai."*

## Live deploy ki tarteeb — P0 rule (2 September ke baad)

Pichli deployment mein build migrations se pehle start hua aur backup ki
tasdeeq nahi thi. Ab ye tarteeb kabhi nahi badlegi:

**Backup verified → pre-migration record (ginti) → migrations →
verification (ginti dobara) → naya build upload → smoke test → Live
accepted.**

Backup ki tasdeeq (file ka size chat mein) aane se pehle koi migration
Live par nahi chalegi — malik "chalao" bhi kahein to pehle backup
poochna hai. Build migrations ke baad hi upload ho.
