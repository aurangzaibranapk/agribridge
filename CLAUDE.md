# AgriBridge — kaam karne ka tareeqa

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
