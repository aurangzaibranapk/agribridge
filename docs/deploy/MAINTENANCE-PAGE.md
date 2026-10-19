# "System Update" safha — Node band ho tab bhi (design B, Harvest Aurora)

Malik ne 19 Oct 2026 ko design **B** approve kiya (headline: "Hum system ko behtar bana rahe hain").

## Ye kya karta hai
| Halat | Kaun jawab deta hai | User ko kya dikhta hai |
|---|---|---|
| Node chal raha hai + `~/domains/agribridge/maintenance.on` | `server.js` (pehle se) | ye safha, HTTP 503 |
| Deploy: `<DOCUMENT_ROOT>/ab-maintenance/deploy-in-progress.flag` maujood | Apache `.htaccess` | ye safha, HTTP 503 + Retry-After 300 |
| Node band / crash / upload ke darmiyan (flag nahi) | Apache `ErrorDocument` | ye safha (Apache ke 403/404/500/502 ki jagah) |

Ek hi file: `public/system-update.html`. Release banate waqt `scripts/package-cpanel.sh` isi ki copy
`ab-maintenance/index.html` banata hai, aur `.release/verify.mjs` fail ho jata hai agar dono copies
alag hon (`tests/maintenance-copy-verify.cjs`). `.htaccess` snippet aur on/off scripts tarball mein
`.release/maintenance/` mein hote hain (public nahi).

Safha: ek file, koi internet request nahi, light/dark khud, EN / Roman / اردو (RTL), har 30 sec
`HEAD /` check — site wapas aaye to khud reload. WhatsApp / Call / Email buttons.

## Ek dafa ki setup (`<DOCUMENT_ROOT>` malik bhejenge)
`<DOCUMENT_ROOT>` = cPanel → **Domains** → alranatraders.pk → "Document Root"
(aksar `/home/<user>/public_html`). Ye `~/domains/agribridge` (app root) **nahi** hai.

1. **Backup:** File Manager → `<DOCUMENT_ROOT>` → Settings mein "Show Hidden Files" on →
   `.htaccess` par right-click → Copy → naam `.htaccess.bak-YYYYMMDD`.
2. **Safha rakhein:** `<DOCUMENT_ROOT>` mein naya folder `ab-maintenance` → us mein release ki
   `ab-maintenance/index.html` upload karein (ya `~/domains/agribridge/ab-maintenance/index.html`
   se Copy).
3. **assetlinks:** `<DOCUMENT_ROOT>/.well-known/` mein `assetlinks.json` copy karein
   (`~/domains/agribridge/public/.well-known/assetlinks.json` se). Node band ho tab bhi Play app
   link 200 dega.
4. **.htaccess:** `<DOCUMENT_ROOT>/.htaccess` → Edit → `.release/maintenance/htaccess-snippet.conf`
   ka poora text **sab se upar** paste karein — `# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN`
   wale hisse se **pehle**, us ke andar kabhi nahi. Save.
5. **Test:**
   - Site kholein → normal chalni chahiye.
   - `https://alranatraders.pk/.well-known/assetlinks.json` → JSON aana chahiye.
   - `ab-maintenance` mein naya file `deploy-in-progress.flag` banayein → site par "Hum system ko
     behtar bana rahe hain" aana chahiye → flag delete → site wapas.
   - Kuch bhi ghalat ho: `.htaccess.bak-…` ko wapas `.htaccess` naam de dein.

## Har deploy par
1. **ON:** `<DOCUMENT_ROOT>/ab-maintenance/` mein file `deploy-in-progress.flag` banayein.
2. Setup Node.js App → Stop → upload/extract → `node .release/verify.mjs` (VERIFIED) → Start.
3. Agar design badla ho (verify warning de): naye release ki `ab-maintenance/index.html` docroot
   mein dobara copy karein. Check: `AB_DOCROOT=<DOCUMENT_ROOT> node .release/verify.mjs`.
4. **OFF:** `deploy-in-progress.flag` delete karein. Khule hue safhe 30 sec mein khud site khol denge.

Terminal se yahi: `bash .release/maintenance/maintenance-on.sh <DOCUMENT_ROOT>` /
`bash .release/maintenance/maintenance-off.sh <DOCUMENT_ROOT>` (ye `maintenance.on` bhi on/off karte hain).
Flag bhool jayein tab bhi Node band hone par Apache ka bura error nahi, yahi safha dikhega.

## Khatre
- Snippet Passenger block se bahar hai; rewrite sirf flag file par chalta hai; ErrorDocument app ke
  apne jawab nahi badalta (PassengerErrorOverride default off). Is host par pehli dafa step 5 se test.
- Flag on ho to malik ko bhi site nahi dikhti (sirf `/.well-known/` khula).
- SEO: deploy par 503 + Retry-After + noindex, Google baad mein dobara aata hai.
- Docroot mein kisi asli missing file ka 404 bhi yahi safha dikhayega (kam hota hai).
