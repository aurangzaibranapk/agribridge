# Login page: faisla — 6 September 2026

**Login ka replacement CANCEL hai.** Ye file is liye hai ke baad mein
koi (insaan ya AI) purana login code dobara na laga de.

## Faisla (malik ka, unhi ke alfaz ke mutabiq)

> Existing login ko replace nahi karna. Current login hi **source of
> truth** rahega, kyun ke is mein Farmer OTP, Email OTP, User ID login,
> separate farmer/admin-staff-vendor flows aur Urdu/i18n already maujood
> hain.
>
> Jo pasted login code bheja gaya tha usay implement na karein aur
> current files ko overwrite na karein.
>
> Agar social login add karna ho to **sirf Google + Facebook OAuth
> buttons aur `signInWithOAuth` logic** existing current login ke ooper
> **safely merge** karein. Existing OTP/password/User ID/i18n/redirect
> flows ko **touch na karein**.
>
> Pehle Testing branch par karein. Live par tab tak deploy na karein jab
> tak main approve na karun.
>
> Agar existing "last-good selected AgriBridge login design" already
> restore ho chuka hai to us design ko **preserve** karein.

## Kyun — asal muqabla

Jo code bheja gaya tha wo maujooda login se **purana aur saada** tha.
Seedha badal dene par ye sab **khatam** ho jata:

| | Abhi jo hai | Jo bheja gaya tha |
|---|---|---|
| Farmer ka OTP login (WhatsApp / SMS) | ✅ | ❌ |
| Email OTP (6 hindse) | ✅ | ❌ |
| User ID se login | ✅ | ❌ |
| Do alag raaste (farmer vs admin/staff/vendor) | ✅ | ❌ |
| Urdu / i18n (`LangProvider`, `t(...)`) | ✅ | ❌ |
| Google login | ❌ | ✅ |
| Facebook login | ❌ | ✅ |

Sab se bhaari nuqsan pehli qatar hai: **wo kisan jo sirf mobile number
aur OTP se andar aata hai, us ke paas password hai hi nahi.** Us ke liye
login ka darwaza band ho jata.

Yani naye code mein sirf **ek** cheez aisi thi jo maujooda mein nahi --
social login. Baqi har cheez mein maujooda behtar hai. Is liye faisla:
**badlo nahi, us ek cheez ko jorr do -- aur wo bhi tab jab malik kahein.**

## Files

- `src/app/login/page.tsx` — design (developer ka hissa)
- `src/app/login/login-form.tsx` — saare login ke raaste

## Ek kharabi jo is dauran mili — THEEK KAR DI GAYI

`login-form.tsx` mein "Not a member? Register" ka link `/register` par
jata hai.

**`/register` naam ka koi safha maujood nahi.** Sirf `/register/farmer`
hai, aur `next.config` mein us ka koi redirect bhi nahi.

Yani naya kisan jo "Register" dabata hai, usay **404** milta hai — wo
register kar hi nahi sakta.

**Malik ne khud kaha ke ye theek kar dun** ("ye aap kar do, lekin same to
same rakhna hai"), is liye sirf ye kiya gaya:

```
href="/register"  →  href="/register/farmer"
```

**Ek lakeer, aur bas.** `page.tsx` ko haath nahi lagaya; `login-form.tsx`
mein bhi baqi sab harf-ba-harf wahi hai (`git diff` = 1 insertion,
1 deletion).

Aage ke liye ek behtar raasta bhi maujood hai, magar wo malik ke kehne
par hi: `src/app/register/page.tsx` bana kar wahan se aage bhejna --
agar kabhi customer ya vendor ki alag registration bhi aani ho.

Baqi login page abhi bhi **developer ka hissa** hai (malik ka usool,
6 September). Us mein koi aur cheez AI apni marzi se nahi badlega.

---

# LOGIN LIVE DEPLOYMENT — MANZOOR SHUDA VERSION

**Malik ki manzoori, 6 September.** Local par test ho chuka; **wohi state
Live par jani hai.**

## Source of truth

| | |
|---|---|
| Branch | `claude/code-load-project-structure-fq91y9` |
| Tested HEAD | `0eeaa4b` |

Login ki tarikh mein chune hue design aur fix:

| Commit | Kya |
|---|---|
| `568f57f` | Restore last-good selected AgriBridge login design |
| `8e02a96` | Fit finalized AgriBridge login within desktop viewport |
| `0eeaa4b` | Register ka toota link theek |

## Jo HAR HAAL mein qaim rahega

- Login page kisi paste kiye hue / purane code se **replace nahi hoga**
- Farmer Mobile OTP
- Email OTP
- User ID login
- Farmer aur Admin/Staff/Vendor ke **alag alag** login raaste
- Urdu / i18n (`LangProvider`, `t(...)`)
- Role ke hisaab se redirect aur poora auth ka logic
- Chuna hua "last-good AgriBridge login design"
- **Google/Facebook abhi NAHI** jorna

## Live par jane se pehle

- Maujooda **Live database ko haath nahi lagana** — na badalna, na reset,
  na seed, na delete.
- **Is login ke liye koi migration nahi chahiye.** Agar koi asal dependency
  nikle to pehle **batana hai**, chalani nahi.
- Asal kisan, finance, inventory, milk, machinery, orders aur accounting
  ka data bilkul nahi chhoona.

## Sirf `page.tsx` copy-paste karna GHALAT hoga

Maujooda login OTP, i18n aur auth ki **kai maujooda cheezon se juRa hua**
hai. Us ka ek adha hissa uthana us jorr ko toR deta hai. Mehfooz raasta
**test shuda commit / branch** hi hai.

## Cache — aur is par ek durusti

Malik ka andaza tha ke local par jo "bara SVG wala toota safha" aaya wo
`.next` / browser / service-worker ke purane cache se tha, login ke code
se nahi. **Pehla hissa bilkul theek hai, doosre mein ek durusti hai:**

`public/sw.js` maujood hai, magar wo **network-first** likha hua hai:

```js
fetch(event.request).then(...).catch(() => caches.match(event.request))
```

Yani jab tak internet chal raha ho, wo **purani cheez deta hi nahi** --
cache sirf tab kaam aati hai jab network waqai na ho. Sath hi
`skipWaiting()` aur `clients.claim()` hain, is liye naya worker foran
chalta hai.

**Is liye service worker par shak ghalat jagah le jayega.** Asal wajah
server par pari **purani `.next`** thi: tar purani files ke ooper likhta
hai magar mitata nahi, aur purane-naye chunk mil kar app toR dete hain.

Aur Next.js har build par naya `BUILD_ID` deta hai, yani asset ke URL
khud badal jate hain -- browser ka purana cache khud beasar ho jata hai.

**Deploy ka theek tareeqa:**

1. `rm -rf .next` phir naya build
2. cPanel par **Stop**
3. `domains/agribridge` mein **purani `.next` DELETE** -- ye qadam mat
   chhoRein
4. `deploy.tar.gz` upload → Extract
5. **Start**
6. Browser mein ek dafa **Ctrl+Shift+R** (agar kisi ka purana safha khula
   ho)

## Production smoke test

1. Login page desktop par theek render
2. Mobile par theek render
3. Farmer Mobile OTP login
4. Email OTP login
5. User ID login
6. Admin / Staff login
7. Vendor login
8. Urdu / i18n
9. Farmer registration ka link
10. Role ke hisaab se redirect

**Agar production par styling tooti nazar aaye to login code rollback ya
replace NA karein.** Pehle build, static CSS, `.next` aur cache dekhein.

## Purana bheja gaya 2-file wala login

**Discard.** Live par istemal nahi karna.
