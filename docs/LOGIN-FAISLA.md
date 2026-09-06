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

## Ek kharabi jo is dauran mili — abhi TOOTI HUI hai

`login-form.tsx` mein "Not a member? Register" ka link `/register` par
jata hai.

**`/register` naam ka koi safha maujood nahi.** Sirf `/register/farmer`
hai, aur `next.config` mein us ka koi redirect bhi nahi.

Yani naya kisan jo "Register" dabata hai, usay **404** milta hai — wo
register kar hi nahi sakta.

Ilaaj do mein se ek:

1. `href="/register"` → `href="/register/farmer"`
2. Ya `src/app/register/page.tsx` bana kar wahan bhej dein — agar aage
   customer/vendor ki alag registration bhi aani ho to ye behtar hai.

Ye login page ka hissa hai, is liye **AI ne khud theek nahi kiya** —
malik ke usool (6 September) ke mutabiq front website, front page aur
login page developer ka hissa hain.
